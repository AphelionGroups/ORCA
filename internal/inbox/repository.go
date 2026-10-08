package inbox

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) List(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]Note, error) {
	query := `
		SELECT id, workspace_id, content, color, is_archived, created_at, updated_at
		FROM inbox_notes
		WHERE workspace_id = $1 AND deleted_at IS NULL
	`
	if !includeArchived {
		query += " AND is_archived = false"
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.pool.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("inbox.List: %w", err)
	}
	defer rows.Close()

	notes := make([]Note, 0)
	for rows.Next() {
		var n Note
		err := rows.Scan(&n.ID, &n.WorkspaceID, &n.Content, &n.Color, &n.IsArchived, &n.CreatedAt, &n.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("inbox.List scan: %w", err)
		}
		notes = append(notes, n)
	}
	return notes, nil
}

func (r *Repository) GetByID(ctx context.Context, workspaceID, id uuid.UUID) (*Note, error) {
	query := `
		SELECT id, workspace_id, content, color, is_archived, created_at, updated_at
		FROM inbox_notes
		WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
	`
	var n Note
	err := r.pool.QueryRow(ctx, query, workspaceID, id).Scan(
		&n.ID, &n.WorkspaceID, &n.Content, &n.Color, &n.IsArchived, &n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("inbox.GetByID: %w", err)
	}
	return &n, nil
}

func (r *Repository) Create(ctx context.Context, n *Note) error {
	if n.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			newID = uuid.New()
		}
		n.ID = newID
	}
	if n.Color == "" {
		n.Color = "default"
	}
	now := time.Now().UTC()
	n.CreatedAt = now
	n.UpdatedAt = now

	query := `
		INSERT INTO inbox_notes (id, workspace_id, content, color, is_archived, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := r.pool.Exec(ctx, query, n.ID, n.WorkspaceID, n.Content, n.Color, n.IsArchived, n.CreatedAt, n.UpdatedAt)
	if err != nil {
		return fmt.Errorf("inbox.Create: %w", err)
	}
	return nil
}

func (r *Repository) Update(ctx context.Context, n *Note) error {
	n.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE inbox_notes
		SET content = $1, color = $2, is_archived = $3, updated_at = $4
		WHERE workspace_id = $5 AND id = $6 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, n.Content, n.Color, n.IsArchived, n.UpdatedAt, n.WorkspaceID, n.ID)
	if err != nil {
		return fmt.Errorf("inbox.Update: %w", err)
	}
	if res.RowsAffected() == 0 {
		return httputil.ErrNotFound
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
	query := `
		UPDATE inbox_notes
		SET deleted_at = NOW()
		WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, workspaceID, id)
	if err != nil {
		return fmt.Errorf("inbox.Delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return httputil.ErrNotFound
	}
	return nil
}

func (r *Repository) ConvertToTask(ctx context.Context, workspaceID, noteID uuid.UUID, req ConvertToTaskRequest) (uuid.UUID, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, fmt.Errorf("inbox.ConvertToTask tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Fetch note
	var content string
	err = tx.QueryRow(ctx, `SELECT content FROM inbox_notes WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL`, workspaceID, noteID).Scan(&content)
	if err != nil {
		return uuid.Nil, fmt.Errorf("inbox note not found: %w", err)
	}

	taskID, err := uuid.NewV7()
	if err != nil {
		taskID = uuid.New()
	}

	title := req.Title
	if title == "" {
		title = content
		if len(title) > 255 {
			title = title[:255]
		}
	}
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	// 2. Insert into tasks
	taskQuery := `
		INSERT INTO tasks (id, workspace_id, space_id, project_id, title, description, status, priority, due_date, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'todo', $7, $8, NOW(), NOW())
	`
	_, err = tx.Exec(ctx, taskQuery, taskID, workspaceID, req.SpaceID, req.ProjectID, title, content, priority, req.DueDate)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to insert task: %w", err)
	}

	// 3. Mark note as deleted / converted
	_, err = tx.Exec(ctx, `UPDATE inbox_notes SET deleted_at = NOW() WHERE workspace_id = $1 AND id = $2`, workspaceID, noteID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to soft delete note: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, fmt.Errorf("commit tx: %w", err)
	}

	return taskID, nil
}

func (r *Repository) ConvertToDoc(ctx context.Context, workspaceID, noteID uuid.UUID, req ConvertToDocRequest) (uuid.UUID, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, fmt.Errorf("inbox.ConvertToDoc tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Fetch note
	var content string
	err = tx.QueryRow(ctx, `SELECT content FROM inbox_notes WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL`, workspaceID, noteID).Scan(&content)
	if err != nil {
		return uuid.Nil, fmt.Errorf("inbox note not found: %w", err)
	}

	docID, err := uuid.NewV7()
	if err != nil {
		docID = uuid.New()
	}

	title := req.Title
	if title == "" {
		title = content
		if len(title) > 100 {
			title = title[:100]
		}
	}

	// 2. Insert into documents
	docQuery := `
		INSERT INTO documents (id, workspace_id, space_id, project_id, title, doc_type, content, is_pinned, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'general', $6, false, NOW(), NOW())
	`
	_, err = tx.Exec(ctx, docQuery, docID, workspaceID, req.SpaceID, req.ProjectID, title, content)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to insert document: %w", err)
	}

	// 3. Mark note as deleted / converted
	_, err = tx.Exec(ctx, `UPDATE inbox_notes SET deleted_at = NOW() WHERE workspace_id = $1 AND id = $2`, workspaceID, noteID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to soft delete note: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, fmt.Errorf("commit tx: %w", err)
	}

	return docID, nil
}
