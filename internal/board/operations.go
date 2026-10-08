package board

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Connection struct {
	ID        uuid.UUID  `json:"id"`
	FromID    uuid.UUID  `json:"fromId"`
	ToID      uuid.UUID  `json:"toId"`
	FromSide  string     `json:"fromSide,omitempty"`
	ToSide    string     `json:"toSide,omitempty"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}
type BlockMutation struct {
	ID     uuid.UUID           `json:"id"`
	Action string              `json:"action"`
	Patch  UpdateBlockRequest  `json:"patch"`
	Create *CreateBlockRequest `json:"create,omitempty"`
}
type ConnectionMutation struct {
	Action     string     `json:"action"`
	Connection Connection `json:"connection"`
}
type OperationRequest struct {
	ID          uuid.UUID            `json:"id"`
	Mode        string               `json:"mode"`
	Blocks      []BlockMutation      `json:"blocks"`
	Connections []ConnectionMutation `json:"connections"`
}
type OperationResult struct {
	ID          uuid.UUID    `json:"id"`
	Blocks      []NoteBlock  `json:"blocks"`
	Connections []Connection `json:"connections"`
}
type recordSnapshot struct {
	Table string          `json:"table"`
	ID    uuid.UUID       `json:"id"`
	Value json.RawMessage `json:"value"`
}

func snapshot(ctx context.Context, tx pgx.Tx, workspace uuid.UUID, table string, id uuid.UUID) (recordSnapshot, error) {
	var value json.RawMessage
	// Table names come exclusively from this module's two fixed call sites.
	if table != "note_blocks" && table != "entity_links" {
		return recordSnapshot{}, invalid("unsupported snapshot table")
	}
	err := tx.QueryRow(ctx, fmt.Sprintf(`SELECT to_jsonb(t) FROM %s t WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, table), workspace, id).Scan(&value)
	if errors.Is(err, pgx.ErrNoRows) {
		value = json.RawMessage("null")
		err = nil
	}
	return recordSnapshot{Table: table, ID: id, Value: value}, err
}

func (r *Repository) ApplyOperation(ctx context.Context, workspace, boardID uuid.UUID, req OperationRequest) (*OperationResult, error) {
	if req.ID == uuid.Nil || (req.Mode != "apply" && req.Mode != "undo" && req.Mode != "redo") || len(req.Blocks)+len(req.Connections) > 200 {
		return nil, invalid("invalid board operation")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	// Serialize board receipts while retaining ordinary tenant/parent validation.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,91371))`, boardID.String()); err != nil {
		return nil, err
	}
	var present bool
	if err = tx.QueryRow(ctx, `SELECT true FROM note_boards WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL FOR SHARE`, workspace, boardID).Scan(&present); err != nil {
		return nil, httputil.ErrNotFound
	}
	var state string
	var beforeJSON, afterJSON json.RawMessage
	err = tx.QueryRow(ctx, `SELECT state,before_snapshot,after_snapshot FROM board_operations WHERE workspace_id=$1 AND board_id=$2 AND id=$3 FOR UPDATE`, workspace, boardID, req.ID).Scan(&state, &beforeJSON, &afterJSON)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if err == nil {
		desiredState := "applied"
		if req.Mode == "undo" {
			desiredState = "undone"
		}
		if state != desiredState {
			if req.Mode == "apply" {
				return nil, httputil.ErrConflict
			}
			var expected, target []recordSnapshot
			source, destination := beforeJSON, afterJSON
			if req.Mode == "undo" {
				source, destination = afterJSON, beforeJSON
			}
			if err = json.Unmarshal(source, &expected); err != nil {
				return nil, err
			}
			if err = json.Unmarshal(destination, &target); err != nil {
				return nil, err
			}
			for _, record := range expected {
				var matches bool
				query := fmt.Sprintf(`SELECT to_jsonb(t)=$3::jsonb FROM %s t WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, record.Table)
				if err = tx.QueryRow(ctx, query, workspace, record.ID, record.Value).Scan(&matches); err != nil || !matches {
					return nil, httputil.ErrConflict
				}
			}
			if err = restoreSnapshots(ctx, tx, workspace, target); err != nil {
				return nil, err
			}
			actual := make([]recordSnapshot, 0, len(target))
			for _, record := range target {
				current, e := snapshot(ctx, tx, workspace, record.Table, record.ID)
				if e != nil {
					return nil, e
				}
				actual = append(actual, current)
				// Rebase only receipts referencing the exact restored version. This
				// keeps consecutive undo/redo valid without relaxing conflict checks
				// for edits made outside this history transition.
				for _, column := range []string{"before_snapshot", "after_snapshot"} {
					_, e = tx.Exec(ctx, fmt.Sprintf(`UPDATE board_operations SET %s=(SELECT jsonb_agg(CASE WHEN entry->>'table'=$4 AND entry->>'id'=$5 AND entry->'value'=$6::jsonb THEN jsonb_set(entry,'{value}',$7::jsonb) ELSE entry END ORDER BY ordinal) FROM jsonb_array_elements(%s) WITH ORDINALITY AS items(entry,ordinal)) WHERE workspace_id=$1 AND board_id=$2 AND id<>$3 AND EXISTS(SELECT 1 FROM jsonb_array_elements(%s) AS entry WHERE entry->>'table'=$4 AND entry->>'id'=$5 AND entry->'value'=$6::jsonb)`, column, column, column), workspace, boardID, req.ID, record.Table, record.ID.String(), record.Value, current.Value)
					if e != nil {
						return nil, e
					}
				}
			}
			actualJSON, e := json.Marshal(actual)
			if e != nil {
				return nil, e
			}
			field := "after_snapshot"
			if req.Mode == "undo" {
				field = "before_snapshot"
			}
			_, err = tx.Exec(ctx, fmt.Sprintf(`UPDATE board_operations SET state=$1,%s=$2,updated_at=NOW() WHERE id=$3`, field), desiredState, actualJSON, req.ID)
			if err != nil {
				return nil, err
			}
		}
	} else {
		if req.Mode != "apply" || len(req.Blocks)+len(req.Connections) == 0 {
			return nil, httputil.ErrNotFound
		}
		records := make([]recordSnapshot, 0)
		seen := map[string]bool{}
		remember := func(table string, id uuid.UUID) error {
			key := table + id.String()
			if seen[key] {
				return nil
			}
			record, e := snapshot(ctx, tx, workspace, table, id)
			if e == nil {
				seen[key] = true
				records = append(records, record)
			}
			return e
		}
		for i := range req.Blocks {
			mutation := &req.Blocks[i]
			if mutation.Action == "create" && mutation.ID == uuid.Nil {
				mutation.ID, err = uuid.NewV7()
				if err != nil {
					return nil, err
				}
			}
			if mutation.ID == uuid.Nil {
				return nil, invalid("block ID is required")
			}
			if err = remember("note_blocks", mutation.ID); err != nil {
				return nil, err
			}
			if mutation.Action != "create" {
				var belongs bool
				if err = tx.QueryRow(ctx, `SELECT true FROM note_blocks WHERE workspace_id=$1 AND board_id=$2 AND id=$3`, workspace, boardID, mutation.ID).Scan(&belongs); err != nil {
					return nil, httputil.ErrNotFound
				}
			}
			if mutation.Action == "delete" {
				rows, e := tx.Query(ctx, `SELECT id FROM entity_links WHERE workspace_id=$1 AND deleted_at IS NULL AND ((from_type='note_block' AND from_id=$2) OR (to_type='note_block' AND to_id=$2)) ORDER BY id`, workspace, mutation.ID)
				if e != nil {
					return nil, e
				}
				ids := []uuid.UUID{}
				for rows.Next() {
					var id uuid.UUID
					if e = rows.Scan(&id); e != nil {
						rows.Close()
						return nil, e
					}
					ids = append(ids, id)
				}
				e = rows.Err()
				rows.Close()
				if e != nil {
					return nil, e
				}
				for _, id := range ids {
					if err = remember("entity_links", id); err != nil {
						return nil, err
					}
				}
			}
		}
		for i := range req.Connections {
			mutation := &req.Connections[i]
			connection := &mutation.Connection
			if mutation.Action == "create" {
				var existingID uuid.UUID
				e := tx.QueryRow(ctx, `SELECT id FROM entity_links WHERE workspace_id=$1 AND from_type='note_block' AND from_id=$2 AND to_type='note_block' AND to_id=$3 AND relation_type='connects_to'`, workspace, connection.FromID, connection.ToID).Scan(&existingID)
				if e == nil {
					if connection.ID != uuid.Nil && connection.ID != existingID {
						return nil, httputil.ErrConflict
					}
					connection.ID = existingID
				} else if !errors.Is(e, pgx.ErrNoRows) {
					return nil, e
				}
			}
			if connection.ID == uuid.Nil {
				err = tx.QueryRow(ctx, `SELECT id FROM entity_links WHERE workspace_id=$1 AND from_type='note_block' AND from_id=$2 AND to_type='note_block' AND to_id=$3 AND relation_type='connects_to'`, workspace, connection.FromID, connection.ToID).Scan(&connection.ID)
				if errors.Is(err, pgx.ErrNoRows) && mutation.Action == "create" {
					connection.ID, err = uuid.NewV7()
				}
				if err != nil {
					return nil, httputil.ErrNotFound
				}
			}
			var existingScope uuid.UUID
			scopeErr := tx.QueryRow(ctx, `SELECT b.board_id FROM entity_links l JOIN note_blocks b ON b.id=l.from_id AND b.workspace_id=l.workspace_id WHERE l.workspace_id=$1 AND l.id=$2 AND l.from_type='note_block' AND l.to_type='note_block' AND l.relation_type='connects_to'`, workspace, connection.ID).Scan(&existingScope)
			if scopeErr == nil && existingScope != boardID {
				return nil, httputil.ErrNotFound
			}
			if scopeErr != nil && !errors.Is(scopeErr, pgx.ErrNoRows) {
				return nil, scopeErr
			}
			if scopeErr != nil && mutation.Action != "create" {
				return nil, httputil.ErrNotFound
			}
			if err = remember("entity_links", connection.ID); err != nil {
				return nil, err
			}
		}
		for _, mutation := range req.Blocks {
			if err = applyBlock(ctx, tx, workspace, boardID, mutation); err != nil {
				return nil, err
			}
		}
		for _, mutation := range req.Connections {
			if err = applyConnection(ctx, tx, workspace, boardID, mutation); err != nil {
				return nil, err
			}
		}
		beforeJSON, err = json.Marshal(records)
		if err != nil {
			return nil, err
		}
		after := make([]recordSnapshot, 0, len(records))
		for _, record := range records {
			current, e := snapshot(ctx, tx, workspace, record.Table, record.ID)
			if e != nil {
				return nil, e
			}
			after = append(after, current)
		}
		afterJSON, err = json.Marshal(after)
		if err != nil {
			return nil, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO board_operations(id,workspace_id,board_id,state,before_snapshot,after_snapshot)VALUES($1,$2,$3,'applied',$4,$5)`, req.ID, workspace, boardID, beforeJSON, afterJSON); err != nil {
			return nil, err
		}
	}
	result, err := operationGraph(ctx, tx, workspace, boardID, req.ID)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

func applyBlock(ctx context.Context, tx pgx.Tx, workspace, boardID uuid.UUID, m BlockMutation) error {
	switch m.Action {
	case "create":
		if m.Create == nil {
			return invalid("block create payload required")
		}
		b := m.Create
		if b.Type == "" {
			b.Type = "sticky"
		}
		if len(b.Content) == 0 {
			b.Content = json.RawMessage(`{}`)
		}
		if err := ValidateContent(b.Type, b.Content); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO note_blocks(id,workspace_id,board_id,type,pos_x,pos_y,width,height,content)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, m.ID, workspace, boardID, b.Type, b.PosX, b.PosY, b.Width, b.Height, b.Content)
		return err
	case "delete", "restore":
		current, err := snapshot(ctx, tx, workspace, "note_blocks", m.ID)
		if err != nil {
			return err
		}
		var block NoteBlock
		if err = json.Unmarshal(current.Value, &block); err != nil {
			return err
		}
		if err = httputil.CheckVersion(m.Patch.ExpectedUpdatedAt, block.UpdatedAt); err != nil {
			return err
		}
		query := `UPDATE note_blocks SET deleted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE workspace_id=$1 AND board_id=$2 AND id=$3`
		if m.Action == "restore" {
			query = `UPDATE note_blocks SET deleted_at=NULL,updated_at=clock_timestamp() WHERE workspace_id=$1 AND board_id=$2 AND id=$3`
		}
		_, err = tx.Exec(ctx, query, workspace, boardID, m.ID)
		return err
	case "update":
		current, err := snapshot(ctx, tx, workspace, "note_blocks", m.ID)
		if err != nil {
			return err
		}
		var b NoteBlock
		if err = json.Unmarshal(current.Value, &b); err != nil {
			return err
		}
		if b.DeletedAt != nil {
			return httputil.ErrNotFound
		}
		p := m.Patch
		if err = httputil.CheckVersion(p.ExpectedUpdatedAt, b.UpdatedAt); err != nil {
			return err
		}
		if p.Type != "" {
			b.Type = p.Type
		}
		if p.PosX != nil {
			b.PosX = *p.PosX
		}
		if p.PosY != nil {
			b.PosY = *p.PosY
		}
		if p.Width != nil {
			b.Width = p.Width
			if *p.Width <= 0 {
				b.Width = nil
			}
		}
		if p.Height != nil {
			b.Height = p.Height
			if *p.Height <= 0 {
				b.Height = nil
			}
		}
		if len(p.Content) > 0 {
			b.Content = p.Content
		}
		if err = ValidateContent(b.Type, b.Content); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE note_blocks SET type=$1,pos_x=$2,pos_y=$3,width=$4,height=$5,content=$6,updated_at=clock_timestamp() WHERE workspace_id=$7 AND board_id=$8 AND id=$9`, b.Type, b.PosX, b.PosY, b.Width, b.Height, b.Content, workspace, boardID, m.ID)
		return err
	default:
		return invalid("invalid block action")
	}
}
func applyConnection(ctx context.Context, tx pgx.Tx, workspace, boardID uuid.UUID, m ConnectionMutation) error {
	c := m.Connection
	if m.Action == "update" || m.Action == "delete" {
		var updatedAt time.Time
		if err := tx.QueryRow(ctx, `SELECT updated_at FROM entity_links WHERE workspace_id=$1 AND id=$2`, workspace, c.ID).Scan(&updatedAt); err != nil {
			return httputil.ErrNotFound
		}
		if err := httputil.CheckVersion(c.UpdatedAt, updatedAt); err != nil {
			return err
		}
	}
	if m.Action == "delete" {
		result, err := tx.Exec(ctx, `UPDATE entity_links l SET deleted_at=clock_timestamp() WHERE l.workspace_id=$1 AND l.id=$2 AND l.relation_type='connects_to' AND EXISTS(SELECT 1 FROM note_blocks b WHERE b.workspace_id=$1 AND b.board_id=$3 AND b.id=l.from_id)`, workspace, c.ID, boardID)
		if err == nil && result.RowsAffected() != 1 {
			return httputil.ErrNotFound
		}
		return err
	}
	if m.Action != "create" && m.Action != "update" {
		return invalid("invalid connection action")
	}
	for _, side := range []string{c.FromSide, c.ToSide} {
		if side != "" && side != "top" && side != "right" && side != "bottom" && side != "left" {
			return invalid("invalid connector side")
		}
	}
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM note_blocks WHERE workspace_id=$1 AND board_id=$2 AND id=ANY($3) AND deleted_at IS NULL`, workspace, boardID, []uuid.UUID{c.FromID, c.ToID}).Scan(&count); err != nil {
		return err
	}
	if count != 2 {
		return httputil.ErrNotFound
	}
	metadata, _ := json.Marshal(map[string]any{"schema_version": 1, "fromSide": c.FromSide, "toSide": c.ToSide})
	if m.Action == "create" {
		_, err := tx.Exec(ctx, `INSERT INTO entity_links(id,workspace_id,from_type,from_id,to_type,to_id,relation_type,metadata)VALUES($1,$2,'note_block',$3,'note_block',$4,'connects_to',$5) ON CONFLICT(workspace_id,from_type,from_id,to_type,to_id,relation_type)DO UPDATE SET metadata=EXCLUDED.metadata,deleted_at=NULL`, c.ID, workspace, c.FromID, c.ToID, metadata)
		return err
	}
	result, err := tx.Exec(ctx, `UPDATE entity_links SET from_id=$1,to_id=$2,metadata=$3,deleted_at=NULL WHERE workspace_id=$4 AND id=$5 AND relation_type='connects_to'`, c.FromID, c.ToID, metadata, workspace, c.ID)
	if err == nil && result.RowsAffected() != 1 {
		return httputil.ErrNotFound
	}
	return err
}
func restoreSnapshots(ctx context.Context, tx pgx.Tx, workspace uuid.UUID, records []recordSnapshot) error {
	// Restore/delete blocks first; links are restored only after both endpoints are active.
	for _, table := range []string{"note_blocks", "entity_links"} {
		for _, record := range records {
			if record.Table != table {
				continue
			}
			if string(record.Value) == "null" {
				if _, err := tx.Exec(ctx, fmt.Sprintf(`UPDATE %s SET deleted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE workspace_id=$1 AND id=$2`, table), workspace, record.ID); err != nil {
					return err
				}
				continue
			}
			query := `UPDATE note_blocks b SET type=s.type,pos_x=s.pos_x,pos_y=s.pos_y,width=s.width,height=s.height,content=s.content,deleted_at=s.deleted_at,updated_at=clock_timestamp() FROM jsonb_populate_record(NULL::note_blocks,$3) s WHERE b.workspace_id=$1 AND b.id=$2`
			if table == "entity_links" {
				query = `UPDATE entity_links l SET from_type=s.from_type,from_id=s.from_id,to_type=s.to_type,to_id=s.to_id,relation_type=s.relation_type,metadata=s.metadata,deleted_at=s.deleted_at,updated_at=clock_timestamp() FROM jsonb_populate_record(NULL::entity_links,$3) s WHERE l.workspace_id=$1 AND l.id=$2`
			}
			if _, err := tx.Exec(ctx, query, workspace, record.ID, record.Value); err != nil {
				return err
			}
		}
	}
	return nil
}
func operationGraph(ctx context.Context, tx pgx.Tx, workspace, boardID, operationID uuid.UUID) (*OperationResult, error) {
	result := &OperationResult{ID: operationID, Blocks: []NoteBlock{}, Connections: []Connection{}}
	rows, err := tx.Query(ctx, `SELECT to_jsonb(b) FROM note_blocks b WHERE workspace_id=$1 AND board_id=$2 AND deleted_at IS NULL ORDER BY created_at,id`, workspace, boardID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var raw json.RawMessage
		var b NoteBlock
		if err = rows.Scan(&raw); err != nil {
			rows.Close()
			return nil, err
		}
		if err = json.Unmarshal(raw, &b); err != nil {
			rows.Close()
			return nil, err
		}
		result.Blocks = append(result.Blocks, b)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	result.Connections, err = operationConnections(ctx, tx, workspace, boardID)
	return result, err
}
func operationConnections(ctx context.Context, tx pgx.Tx, workspace, boardID uuid.UUID) ([]Connection, error) {
	connections := []Connection{}
	rows, err := tx.Query(ctx, `SELECT l.id,l.from_id,l.to_id,COALESCE(l.metadata->>'fromSide',''),COALESCE(l.metadata->>'toSide',''),l.updated_at FROM entity_links l JOIN note_blocks a ON a.id=l.from_id AND a.workspace_id=l.workspace_id JOIN note_blocks b ON b.id=l.to_id AND b.workspace_id=l.workspace_id WHERE l.workspace_id=$1 AND a.board_id=$2 AND b.board_id=$2 AND a.deleted_at IS NULL AND b.deleted_at IS NULL AND l.deleted_at IS NULL AND l.relation_type='connects_to' ORDER BY l.created_at,l.id`, workspace, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var c Connection
		if err = rows.Scan(&c.ID, &c.FromID, &c.ToID, &c.FromSide, &c.ToSide, &c.UpdatedAt); err != nil {
			return nil, err
		}
		connections = append(connections, c)
	}
	return connections, rows.Err()
}

type Viewport struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Zoom float64 `json:"zoom"`
}

func (r *Repository) SaveViewport(ctx context.Context, workspace, id uuid.UUID, v Viewport) error {
	if math.IsNaN(v.X) || math.IsInf(v.X, 0) || math.IsNaN(v.Y) || math.IsInf(v.Y, 0) || v.Zoom < 0.2 || v.Zoom > 2 {
		return invalid("invalid viewport")
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	result, err := r.pool.Exec(ctx, `UPDATE note_boards SET viewport_state=$1 WHERE workspace_id=$2 AND id=$3 AND deleted_at IS NULL`, raw, workspace, id)
	if err == nil && result.RowsAffected() != 1 {
		return httputil.ErrNotFound
	}
	return err
}
