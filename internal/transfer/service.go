package transfer

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/storage"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool  *pgxpool.Pool
	store storage.ArchiveStore
}

func NewService(pool *pgxpool.Pool, store storage.ArchiveStore) *Service {
	return &Service{pool, store}
}

var assetURL = regexp.MustCompile(`https?://[^\s"'<>()[\]\\]+|/uploads/[^\s"'<>()[\]\\]+`)
var uuidPattern = regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

func walk(value any, visit func(string) string) any {
	switch v := value.(type) {
	case string:
		return visit(v)
	case map[string]any:
		for key, item := range v {
			v[key] = walk(item, visit)
		}
	case []any:
		for i, item := range v {
			v[i] = walk(item, visit)
		}
	}
	return value
}
func label(row Record) string {
	if value := str(row, "title"); value != "" {
		return value
	}
	if value := str(row, "name"); value != "" {
		return value
	}
	return "Konten terkait"
}

func (s *Service) Export(ctx context.Context, ws uuid.UUID, scope Scope) (*Package, error) {
	if scope.Kind != "workspace" && (!validID(scope.ID) || (scope.Kind != "space" && scope.Kind != "project" && scope.Kind != "board" && scope.Kind != "task")) {
		return nil, invalid("choose a valid export scope")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	all := map[string][]Record{}
	lookup := map[string]Record{}
	total := 0
	size := 0
	for _, table := range tables {
		rows, err := tx.Query(ctx, fmt.Sprintf(`SELECT to_jsonb(t) FROM %s t WHERE workspace_id=$1 AND deleted_at IS NULL ORDER BY id LIMIT %d`, table, maxRecords+1), ws)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var raw []byte
			if err = rows.Scan(&raw); err != nil {
				rows.Close()
				return nil, err
			}
			total++
			size += len(raw)
			if total > maxRecords || size > maxManifestBytes {
				rows.Close()
				return nil, invalid("workspace exceeds the package limit (20000 records / 16 MB of data)")
			}
			var source Record
			if err = json.Unmarshal(raw, &source); err != nil {
				rows.Close()
				return nil, err
			}
			row := Record{}
			for _, column := range columns[table] {
				if value, ok := source[column]; ok {
					row[column] = value
				}
			}
			all[table] = append(all[table], row)
			lookup[str(row, "id")] = row
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, err
		}
	}
	name := "Workspace"
	if scope.Kind == "workspace" {
		if err = tx.QueryRow(ctx, `SELECT name FROM workspaces WHERE id=$1 AND deleted_at IS NULL`, ws).Scan(&name); err != nil {
			return nil, httputil.ErrNotFound
		}
	} else {
		root := lookup[scope.ID]
		table := kinds[scope.Kind]
		if scope.Kind == "board" {
			table = "note_boards"
		}
		found := false
		for _, row := range all[table] {
			if str(row, "id") == scope.ID {
				found = true
				name = label(root)
				break
			}
		}
		if !found {
			return nil, httputil.ErrNotFound
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	p := &Package{Format: "orca", Version: 1, Name: name, Scope: scope, ExportedAt: time.Now().UTC(), Entities: map[string][]Record{}, Assets: []Asset{}, Warnings: []string{}, Files: map[string][]byte{}}
	selected := map[string]bool{}
	add := func(table string, row Record) {
		id := str(row, "id")
		if !selected[id] {
			selected[id] = true
			p.Entities[table] = append(p.Entities[table], row)
		}
	}
	for _, row := range all["spaces"] {
		if scope.Kind == "workspace" || scope.Kind == "space" && str(row, "id") == scope.ID {
			add("spaces", row)
		}
	}
	for _, row := range all["projects"] {
		if scope.Kind == "workspace" || selected[str(row, "space_id")] || scope.Kind == "project" && str(row, "id") == scope.ID {
			add("projects", row)
		}
	}
	for _, table := range []string{"documents", "note_boards", "tasks"} {
		for _, row := range all[table] {
			if scope.Kind == "workspace" || selected[str(row, "space_id")] || selected[str(row, "project_id")] || scope.Kind == "board" && table == "note_boards" && str(row, "id") == scope.ID || scope.Kind == "task" && table == "tasks" && str(row, "id") == scope.ID {
				add(table, row)
			}
		}
	}
	for changed := true; changed; {
		changed = false
		for _, row := range all["tasks"] {
			if !selected[str(row, "id")] && selected[str(row, "parent_task_id")] {
				add("tasks", row)
				changed = true
			}
		}
	}
	for _, row := range all["note_blocks"] {
		if selected[str(row, "board_id")] {
			add("note_blocks", row)
		}
	}
	for _, row := range all["events"] {
		if scope.Kind == "workspace" || selected[str(row, "space_id")] || selected[str(row, "linked_task_id")] {
			add("events", row)
		}
	}
	if scope.Kind == "workspace" {
		for _, row := range all["inbox_notes"] {
			add("inbox_notes", row)
		}
	}
	for _, row := range all["entity_links"] {
		from, to := selected[str(row, "from_id")], selected[str(row, "to_id")]
		if from && to {
			add("entity_links", row)
		} else if from || to {
			included, external := str(row, "from_id"), str(row, "to_id")
			if to {
				included, external = external, included
			}
			text := "Referensi di luar paket: " + label(lookup[external])
			p.Warnings = append(p.Warnings, label(lookup[included])+" — "+text)
			target := lookup[included]
			if value, ok := target["content"].(string); ok {
				target["content"] = value + "\n\n" + text
			} else if _, ok := target["description"]; ok {
				target["description"] = str(target, "description") + "\n\n" + text
			}
		}
	}
	for table, rows := range p.Entities {
		for _, row := range rows {
			for _, key := range []string{"project_id", "parent_task_id", "linked_task_id"} {
				if id := str(row, key); id != "" && !selected[id] {
					row[key] = nil
					p.Warnings = append(p.Warnings, label(row)+": hubungan ke "+label(lookup[id])+" dilepas karena berada di luar paket.")
				}
			}
			if len(p.Entities["spaces"]) > 0 && str(row, "space_id") != "" && !selected[str(row, "space_id")] {
				if table == "events" {
					row["space_id"] = nil
				} else {
					return nil, invalid("related content has a different space; export the workspace instead")
				}
			}
			for _, key := range []string{"content", "description", "metadata"} {
				if row[key] != nil {
					external := false
					row[key] = walk(row[key], func(value string) string {
						return uuidPattern.ReplaceAllStringFunc(value, func(id string) string {
							if !selected[id] && lookup[id] != nil {
								external = true
								return "[" + label(lookup[id]) + "]"
							}
							return id
						})
					})
					if external {
						p.Warnings = append(p.Warnings, label(row)+": referensi konten di luar paket dipertahankan sebagai teks.")
						if table == "note_blocks" && str(row, "type") == "task_embed" {
							row["type"] = "text"
							content, _ := row["content"].(map[string]any)
							text, _ := content["text"].(string)
							if strings.TrimSpace(text) == "" {
								text, _ = content["task_id"].(string)
							}
							if strings.TrimSpace(text) == "" {
								text = label(row)
							}
							row["content"] = map[string]any{"schema_version": 1, "text": text + "\n\nReferensi task di luar paket."}
						}
					}
				}
			}
		}
	}
	urls := map[string]bool{}
	for _, rows := range p.Entities {
		for _, row := range rows {
			for _, key := range []string{"content", "description", "metadata"} {
				walk(row[key], func(value string) string {
					for _, raw := range assetURL.FindAllString(value, -1) {
						urls[raw] = true
					}
					return value
				})
			}
		}
	}
	sorted := make([]string, 0, len(urls))
	for raw := range urls {
		sorted = append(sorted, raw)
	}
	sort.Strings(sorted)
	assetBytes := 0
	for _, raw := range sorted {
		key, owned := s.store.AssetKey(ws.String(), raw)
		if !owned {
			if strings.Contains(raw, "/uploads/") {
				return nil, invalid("an attachment belongs to another workspace or storage location")
			}
			if strings.Contains(strings.ToLower(raw), ".png") || strings.Contains(strings.ToLower(raw), ".jpg") || strings.Contains(strings.ToLower(raw), ".webp") {
				p.Warnings = append(p.Warnings, "Gambar eksternal tetap berupa URL dan tidak dimasukkan ke paket: "+raw)
			}
			continue
		}
		body, err := s.store.ReadAsset(ctx, key)
		if err != nil {
			return nil, invalid("cannot read attachment; restore it before exporting: " + raw)
		}
		assetBytes += len(body)
		if assetBytes > maxExpandedBytes || len(p.Assets) >= 500 {
			return nil, invalid("attachments exceed the package limit")
		}
		sum := sha256.Sum256(body)
		name := fmt.Sprintf("assets/%04d", len(p.Assets)+1)
		p.Assets = append(p.Assets, Asset{name, raw, hex.EncodeToString(sum[:]), http.DetectContentType(body)})
		p.Files[name] = body
	}
	p.Warnings = unique(p.Warnings)
	if err = p.Validate(); err != nil {
		return nil, err
	}
	return p, nil
}
func unique(items []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			out = append(out, item)
		}
	}
	sort.Strings(out)
	return out
}

type Destination struct {
	SpaceID   string `json:"space_id"`
	ProjectID string `json:"project_id,omitempty"`
}
type ImportResult struct {
	Name      string            `json:"name"`
	Counts    map[string]int    `json:"counts"`
	IDs       map[string]string `json:"ids"`
	Warnings  []string          `json:"warnings"`
	SpaceID   string            `json:"space_id,omitempty"`
	ProjectID string            `json:"project_id,omitempty"`
}

func (s *Service) Import(ctx context.Context, ws, requestID uuid.UUID, data []byte, dest Destination) (result *ImportResult, err error) {
	p, err := Decode(data)
	if err != nil {
		return nil, err
	}
	if requestID == uuid.Nil {
		return nil, invalid("import request ID is required")
	}
	if len(p.Entities["spaces"]) == 0 && p.Scope.Kind != "workspace" {
		if !validID(dest.SpaceID) {
			return nil, invalid("choose a destination space")
		}
	} else if dest.SpaceID != "" || dest.ProjectID != "" {
		return nil, invalid("this package creates its own spaces")
	}
	digest := sha256.Sum256(data)
	fingerprint := hex.EncodeToString(digest[:]) + ":" + dest.SpaceID + ":" + dest.ProjectID
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	uploaded := []string{}
	committed, commitAttempted := false, false
	defer func() {
		tx.Rollback(context.Background())
		if !committed && !commitAttempted {
			cleanup, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			for _, key := range uploaded {
				if e := s.store.DeleteAsset(cleanup, key); e != nil {
					log.Printf("[ORCA-TRANSFER] attachment cleanup needed for %s: %v", key, e)
				}
			}
		}
	}()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,7))`, ws.String()); err != nil {
		return nil, err
	}
	var existingFingerprint string
	var existingResult []byte
	err = tx.QueryRow(ctx, `SELECT fingerprint,result FROM transfer_imports WHERE workspace_id=$1 AND request_id=$2`, ws, requestID).Scan(&existingFingerprint, &existingResult)
	if err == nil {
		if existingFingerprint != fingerprint {
			return nil, httputil.ErrConflict
		}
		var restored ImportResult
		if err = json.Unmarshal(existingResult, &restored); err != nil {
			return nil, err
		}
		return &restored, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if dest.SpaceID != "" {
		var id string
		if err = tx.QueryRow(ctx, `SELECT id FROM spaces WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL FOR SHARE`, ws, dest.SpaceID).Scan(&id); err != nil {
			return nil, invalid("destination space is unavailable")
		}
	}
	if dest.ProjectID != "" {
		if !validID(dest.ProjectID) || p.Scope.Kind != "board" && p.Scope.Kind != "task" {
			return nil, invalid("project destination is only available for boards and tasks")
		}
		var id string
		if err = tx.QueryRow(ctx, `SELECT id FROM projects WHERE workspace_id=$1 AND space_id=$2 AND id=$3 AND deleted_at IS NULL FOR SHARE`, ws, dest.SpaceID, dest.ProjectID).Scan(&id); err != nil {
			return nil, invalid("destination project is unavailable")
		}
	}
	ids := map[string]string{}
	for _, rows := range p.Entities {
		for _, row := range rows {
			ids[str(row, "id")] = uuid.NewString()
		}
	}
	replacements := map[string]string{}
	for _, asset := range p.Assets {
		ext := map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp"}[asset.ContentType]
		key := fmt.Sprintf("%s/images/import_%s_%s%s", ws, requestID, uuid.NewString(), ext)
		uploaded = append(uploaded, key)
		body := p.Files[asset.Path]
		url, err := s.store.Upload(ctx, key, bytes.NewReader(body), int64(len(body)), asset.ContentType)
		if err != nil {
			return nil, fmt.Errorf("upload imported attachment: %w", err)
		}
		replacements[asset.SourceURL] = url
	}
	// Only validated package IDs are mapped. Destination IDs are never read from
	// the package itself, and unknown fields cannot reach SQL.
	for table, rows := range p.Entities {
		for _, row := range rows {
			oldID := str(row, "id")
			row["id"] = ids[oldID]
			for _, key := range []string{"space_id", "project_id", "parent_task_id", "board_id", "linked_task_id", "from_id", "to_id"} {
				old := str(row, key)
				if old == "" {
					continue
				}
				if mapped := ids[old]; mapped != "" {
					row[key] = mapped
				} else if key == "space_id" {
					if dest.SpaceID != "" {
						row[key] = dest.SpaceID
					} else {
						row[key] = nil
					}
				} else if key == "project_id" {
					row[key] = nil
				}
			}
			if len(p.Entities["spaces"]) == 0 && table == "events" && str(row, "space_id") == "" && dest.SpaceID != "" {
				row["space_id"] = dest.SpaceID
			}
			if (table == "note_boards" || table == "tasks") && dest.ProjectID != "" {
				row["project_id"] = dest.ProjectID
			}
			if table == "spaces" {
				row["name"] = copyName(str(row, "name"), 100)
				row["slug"] = "import-" + str(row, "id")
			}
			if table == "projects" {
				row["name"] = copyName(str(row, "name"), 255)
			}
			if (p.Scope.Kind == "task" && oldID == p.Scope.ID) || (p.Scope.Kind == "board" && oldID == p.Scope.ID) {
				row["title"] = copyName(str(row, "title"), 255)
			}
			for _, key := range []string{"content", "description", "metadata"} {
				if row[key] != nil {
					row[key] = walk(row[key], func(text string) string {
						text = assetURL.ReplaceAllStringFunc(text, func(raw string) string {
							if replacement := replacements[raw]; replacement != "" {
								return replacement
							}
							return raw
						})
						return uuidPattern.ReplaceAllStringFunc(text, func(old string) string {
							if mapped := ids[old]; mapped != "" {
								return mapped
							}
							return old
						})
					})
				}
			}
		}
	}
	if err = insertRecords(ctx, tx, ws, p); err != nil {
		return nil, err
	}
	result = &ImportResult{Name: p.Name, Counts: p.preview(len(data)).Counts, IDs: ids, Warnings: p.Warnings, SpaceID: dest.SpaceID, ProjectID: dest.ProjectID}
	if len(p.Entities["spaces"]) > 0 {
		result.SpaceID = str(p.Entities["spaces"][0], "id")
	}
	if len(p.Entities["projects"]) > 0 {
		result.ProjectID = str(p.Entities["projects"][0], "id")
		result.SpaceID = str(p.Entities["projects"][0], "space_id")
	}
	body, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO transfer_imports(workspace_id,request_id,fingerprint,result)VALUES($1,$2,$3,$4)`, ws, requestID, fingerprint, body); err != nil {
		return nil, err
	}
	commitAttempted = true
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	committed = true
	return result, nil
}
func copyName(name string, max int) string {
	r := []rune(name)
	suffix := " (Salinan)"
	if len(r) > max-len(suffix) {
		r = r[:max-len(suffix)]
	}
	return string(r) + suffix
}
func insertRecords(ctx context.Context, tx pgx.Tx, ws uuid.UUID, p *Package) error {
	// Preserve already-valid legacy deeper hierarchies during a portable copy.
	if _, err := tx.Exec(ctx, `SELECT set_config('orca.import_hierarchy','on',true)`); err != nil {
		return err
	}
	tasks := p.Entities["tasks"]
	ordered := []Record{}
	seen := map[string]bool{}
	for len(ordered) < len(tasks) {
		before := len(ordered)
		for _, row := range tasks {
			id := str(row, "id")
			parent := str(row, "parent_task_id")
			if !seen[id] && (parent == "" || seen[parent]) {
				seen[id] = true
				ordered = append(ordered, row)
			}
		}
		if before == len(ordered) {
			return invalid("unresolved task hierarchy")
		}
	}
	for _, table := range tables {
		rows := p.Entities[table]
		if table == "tasks" {
			rows = ordered
		}
		for _, row := range rows {
			fields := []string{"workspace_id"}
			selects := []string{"$2::uuid"}
			for _, column := range columns[table] {
				if _, ok := row[column]; ok {
					fields = append(fields, column)
					selects = append(selects, "r."+column)
				}
			}
			body, err := json.Marshal(row)
			if err != nil {
				return err
			}
			query := fmt.Sprintf(`INSERT INTO %s (%s) SELECT %s FROM jsonb_populate_record(NULL::%s,$1::jsonb) r`, table, strings.Join(fields, ","), strings.Join(selects, ","), table)
			if _, err = tx.Exec(ctx, query, body, ws); err != nil {
				return fmt.Errorf("import %s: %w", table, err)
			}
		}
	}
	// The transaction-local import flag preserves exported statuses and automation ownership.
	return nil
}
