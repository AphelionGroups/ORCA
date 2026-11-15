// Package transfer implements the portable, versioned ORCA package format.
package transfer

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/AphelionGroups/ORCA/internal/platform/storage"
	"github.com/google/uuid"
)

const MaxPackageBytes = 128 << 20
const maxExpandedBytes = 256 << 20
const maxManifestBytes = 16 << 20
const maxRecords = 20000

type Record map[string]any
type Scope struct {
	Kind string `json:"kind"`
	ID   string `json:"id,omitempty"`
}
type Asset struct {
	Path        string `json:"path"`
	SourceURL   string `json:"source_url"`
	SHA256      string `json:"sha256"`
	ContentType string `json:"content_type"`
}
type Package struct {
	Format     string              `json:"format"`
	Version    int                 `json:"version"`
	Name       string              `json:"name"`
	Scope      Scope               `json:"scope"`
	ExportedAt time.Time           `json:"exported_at"`
	Entities   map[string][]Record `json:"entities"`
	Assets     []Asset             `json:"assets"`
	Warnings   []string            `json:"warnings"`
	Files      map[string][]byte   `json:"-"`
}
type Preview struct {
	Name                string         `json:"name"`
	Scope               Scope          `json:"scope"`
	Counts              map[string]int `json:"counts"`
	Warnings            []string       `json:"warnings"`
	RequiresDestination bool           `json:"requires_destination"`
	Bytes               int            `json:"bytes"`
}

// These are the only tables and columns accepted from or written to a package.
var tables = []string{"spaces", "projects", "documents", "note_boards", "tasks", "note_blocks", "events", "inbox_notes", "entity_links"}
var columns = map[string][]string{
	"spaces":       {"id", "name", "slug", "icon", "color", "sort_order"},
	"projects":     {"id", "space_id", "name", "description", "status", "target_date", "kanban_columns"},
	"documents":    {"id", "space_id", "project_id", "title", "doc_type", "content", "is_pinned"},
	"note_boards":  {"id", "space_id", "project_id", "title", "viewport_state"},
	"tasks":        {"id", "space_id", "project_id", "parent_task_id", "title", "description", "status", "priority", "due_date", "planned_date", "estimated_minutes", "auto_complete_subtasks", "completed_by_subtasks"},
	"note_blocks":  {"id", "board_id", "type", "pos_x", "pos_y", "width", "height", "content"},
	"events":       {"id", "space_id", "linked_task_id", "title", "description", "start_at", "end_at", "is_all_day"},
	"inbox_notes":  {"id", "content", "color", "is_archived"},
	"entity_links": {"id", "from_type", "from_id", "to_type", "to_id", "relation_type", "metadata"},
}
var kinds = map[string]string{"space": "spaces", "project": "projects", "document": "documents", "note_board": "note_boards", "task": "tasks", "note_block": "note_blocks", "event": "events", "inbox_note": "inbox_notes"}

func str(r Record, key string) string { v, _ := r[key].(string); return v }
func validID(id string) bool {
	u, err := uuid.Parse(id)
	return err == nil && u != uuid.Nil && u.String() == id
}
func invalid(message string) error { return fmt.Errorf("ORCA package: %s", message) }
func (p *Package) preview(size int) Preview {
	counts := map[string]int{}
	for _, table := range tables {
		counts[table] = len(p.Entities[table])
	}
	counts["assets"] = len(p.Assets)
	return Preview{p.Name, p.Scope, counts, p.Warnings, len(p.Entities["spaces"]) == 0 && p.Scope.Kind != "workspace", size}
}

func Encode(p *Package) ([]byte, error) {
	if err := p.Validate(); err != nil {
		return nil, err
	}
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return nil, err
	}
	if len(data) > maxManifestBytes {
		return nil, invalid("manifest exceeds 16 MB")
	}
	var out bytes.Buffer
	w := zip.NewWriter(&out)
	entry, err := w.Create("manifest.json")
	if err != nil {
		return nil, err
	}
	if _, err = entry.Write(data); err != nil {
		return nil, err
	}
	for _, asset := range p.Assets {
		entry, err = w.Create(asset.Path)
		if err != nil {
			return nil, err
		}
		if _, err = entry.Write(p.Files[asset.Path]); err != nil {
			return nil, err
		}
	}
	if err = w.Close(); err != nil {
		return nil, err
	}
	if out.Len() > MaxPackageBytes {
		return nil, invalid("package exceeds 128 MB")
	}
	return out.Bytes(), nil
}
func Decode(data []byte) (*Package, error) {
	if len(data) > MaxPackageBytes {
		return nil, invalid("package exceeds 128 MB")
	}
	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, invalid("choose a valid .orca.zip file")
	}
	if len(archive.File) > 502 {
		return nil, invalid("too many files")
	}
	files := map[string][]byte{}
	var expanded uint64
	for _, file := range archive.File {
		name := file.Name
		if path.Clean(name) != name || strings.HasPrefix(name, "/") || strings.ContainsAny(name, "\\\x00") || file.FileInfo().IsDir() || (!strings.HasPrefix(name, "assets/") && name != "manifest.json") {
			return nil, invalid("invalid archive path")
		}
		if _, exists := files[name]; exists {
			return nil, invalid("duplicate archive path")
		}
		limit := uint64(storage.MaxAssetBytes)
		if name == "manifest.json" {
			limit = maxManifestBytes
		}
		expanded += file.UncompressedSize64
		if expanded > maxExpandedBytes || file.UncompressedSize64 > limit {
			return nil, invalid("expanded package is too large")
		}
		reader, err := file.Open()
		if err != nil {
			return nil, invalid("cannot read archive")
		}
		body, readErr := io.ReadAll(io.LimitReader(reader, int64(limit)+1))
		reader.Close()
		if readErr != nil || uint64(len(body)) > limit {
			return nil, invalid("corrupt or oversized file")
		}
		files[name] = body
	}
	manifest, ok := files["manifest.json"]
	if !ok {
		return nil, invalid("manifest.json is missing")
	}
	delete(files, "manifest.json")
	var p Package
	decoder := json.NewDecoder(bytes.NewReader(manifest))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(&p); err != nil {
		return nil, invalid("invalid manifest")
	}
	if err = decoder.Decode(new(any)); err != io.EOF {
		return nil, invalid("trailing manifest data")
	}
	p.Files = files
	if err = p.Validate(); err != nil {
		return nil, err
	}
	return &p, nil
}
func (p *Package) Validate() error {
	if p.Format != "orca" || p.Version != 1 {
		return invalid("unsupported format version; use ORCA package version 1")
	}
	if strings.TrimSpace(p.Name) == "" || len(p.Name) > 1024 {
		return invalid("invalid package name")
	}
	if p.Scope.Kind != "workspace" && p.Scope.Kind != "space" && p.Scope.Kind != "project" && p.Scope.Kind != "board" && p.Scope.Kind != "task" {
		return invalid("unsupported scope")
	}
	all := map[string]string{}
	byID := map[string]Record{}
	total := 0
	for table, rows := range p.Entities {
		allowed, ok := columns[table]
		if !ok {
			return invalid("unknown entity type")
		}
		total += len(rows)
		if total > maxRecords {
			return invalid("too many entities (maximum 20000)")
		}
		for _, row := range rows {
			if err := validateFields(table, row); err != nil {
				return err
			}
			id := str(row, "id")
			if !validID(id) || all[id] != "" {
				return invalid("invalid or duplicate entity ID")
			}
			all[id] = table
			byID[id] = row
			for key := range row {
				found := false
				for _, column := range allowed {
					if column == key {
						found = true
						break
					}
				}
				if !found {
					return invalid("unexpected entity field: " + key)
				}
			}
			for _, key := range []string{"space_id", "project_id", "parent_task_id", "board_id", "linked_task_id", "from_id", "to_id"} {
				if row[key] != nil && !validID(str(row, key)) {
					return invalid("invalid reference ID")
				}
			}
			if table == "spaces" || table == "projects" {
				if strings.TrimSpace(str(row, "name")) == "" {
					return invalid("entity name is missing")
				}
			}
			if table == "tasks" || table == "documents" || table == "note_boards" || table == "events" {
				if strings.TrimSpace(str(row, "title")) == "" {
					return invalid("entity title is missing")
				}
			}
		}
	}
	if total == 0 {
		return invalid("package contains no data")
	}
	for table, rows := range p.Entities {
		for _, row := range rows {
			for key, target := range map[string]string{"space_id": "spaces", "project_id": "projects", "parent_task_id": "tasks", "board_id": "note_boards", "linked_task_id": "tasks"} {
				id := str(row, key)
				if id == "" {
					if key == "space_id" && table != "spaces" && table != "events" && table != "note_blocks" && table != "inbox_notes" && table != "entity_links" {
						return invalid("space reference is missing")
					}
					if key == "board_id" && table == "note_blocks" {
						return invalid("board reference is missing")
					}
					continue
				}
				if all[id] != target && !(key == "space_id" && len(p.Entities["spaces"]) == 0) {
					return invalid("missing related " + target)
				}
			}
			if project := byID[str(row, "project_id")]; project != nil && str(project, "space_id") != str(row, "space_id") {
				return invalid("project and space do not match")
			}
			if table == "tasks" {
				seen := map[string]bool{str(row, "id"): true}
				for ancestor := str(row, "parent_task_id"); ancestor != ""; ancestor = str(byID[ancestor], "parent_task_id") {
					if seen[ancestor] {
						return invalid("task hierarchy contains a cycle")
					}
					seen[ancestor] = true
					if str(byID[ancestor], "space_id") != str(row, "space_id") || str(byID[ancestor], "project_id") != str(row, "project_id") {
						return invalid("parent and child scopes do not match")
					}
				}
			}
			if table == "entity_links" {
				from, to := str(row, "from_id"), str(row, "to_id")
				if kinds[str(row, "from_type")] == "" || kinds[str(row, "to_type")] == "" || all[from] != kinds[str(row, "from_type")] || all[to] != kinds[str(row, "to_type")] {
					return invalid("link references missing content")
				}
				if str(row, "relation_type") == "connects_to" && (all[from] != "note_blocks" || all[to] != "note_blocks" || from == to || str(byID[from], "board_id") != str(byID[to], "board_id")) {
					return invalid("invalid board connector")
				}
			}
		}
	}
	if len(p.Assets) > 500 || len(p.Assets) != len(p.Files) {
		return invalid("attachment inventory does not match archive")
	}
	seenPaths, seenURLs := map[string]bool{}, map[string]bool{}
	expanded := 0
	for _, asset := range p.Assets {
		data, ok := p.Files[asset.Path]
		expanded += len(data)
		sum := sha256.Sum256(data)
		if !ok || !strings.HasPrefix(asset.Path, "assets/") || path.Clean(asset.Path) != asset.Path || seenPaths[asset.Path] || seenURLs[asset.SourceURL] || asset.SourceURL == "" || len(data) > storage.MaxAssetBytes || expanded > maxExpandedBytes || hex.EncodeToString(sum[:]) != asset.SHA256 || !storage.AllowedAssetType(asset.ContentType) || http.DetectContentType(data) != asset.ContentType {
			return invalid("missing, corrupt or unsupported attachment")
		}
		seenPaths[asset.Path] = true
		seenURLs[asset.SourceURL] = true
	}
	for _, rows := range p.Entities {
		for _, row := range rows {
			for _, key := range []string{"content", "description", "metadata"} {
				var missing bool
				walk(row[key], func(value string) string {
					for _, raw := range assetURL.FindAllString(value, -1) {
						if strings.Contains(raw, "/uploads/") && !seenURLs[raw] {
							missing = true
						}
					}
					return value
				})
				if missing {
					return invalid("a referenced attachment is missing from the package")
				}
			}
		}
	}
	return nil
}
