package doc

import (
	"context"
	"errors"
	"fmt"
	"time"

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

func (r *Repository) List(ctx context.Context, workspaceID uuid.UUID, spaceID *uuid.UUID, projectID *uuid.UUID) ([]Document, error) {
	query := `
		SELECT id, workspace_id, space_id, project_id, title, doc_type, content, is_pinned, created_at, updated_at
		FROM documents
		WHERE workspace_id = $1 AND deleted_at IS NULL
	`
	args := []any{workspaceID}
	argIdx := 2

	if spaceID != nil && *spaceID != uuid.Nil {
		query += fmt.Sprintf(" AND space_id = $%d", argIdx)
		args = append(args, *spaceID)
		argIdx++
	}

	if projectID != nil && *projectID != uuid.Nil {
		query += fmt.Sprintf(" AND project_id = $%d", argIdx)
		args = append(args, *projectID)
		argIdx++
	}

	query += " ORDER BY is_pinned DESC, updated_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("doc.List: %w", err)
	}
	defer rows.Close()

	docs := make([]Document, 0)
	for rows.Next() {
		var d Document
		err := rows.Scan(
			&d.ID, &d.WorkspaceID, &d.SpaceID, &d.ProjectID, &d.Title, &d.DocType, &d.Content, &d.IsPinned, &d.CreatedAt, &d.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("doc.List scan: %w", err)
		}
		docs = append(docs, d)
	}
	return docs, nil
}

func (r *Repository) GetByID(ctx context.Context, workspaceID, id uuid.UUID) (*Document, error) {
	query := `
		SELECT id, workspace_id, space_id, project_id, title, doc_type, content, is_pinned, created_at, updated_at
		FROM documents
		WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
	`
	var d Document
	err := r.pool.QueryRow(ctx, query, workspaceID, id).Scan(
		&d.ID, &d.WorkspaceID, &d.SpaceID, &d.ProjectID, &d.Title, &d.DocType, &d.Content, &d.IsPinned, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("doc.GetByID: %w", err)
	}
	return &d, nil
}

func (r *Repository) Create(ctx context.Context, d *Document) error {
	if d.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("doc.Create uuidv7: %w", err)
		}
		d.ID = newID
	}
	now := time.Now().UTC()
	d.CreatedAt = now
	d.UpdatedAt = now

	if d.DocType == "" {
		d.DocType = "general"
	}

	query := `
		INSERT INTO documents (id, workspace_id, space_id, project_id, title, doc_type, content, is_pinned, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.pool.Exec(ctx, query,
		d.ID, d.WorkspaceID, d.SpaceID, d.ProjectID, d.Title, d.DocType, d.Content, d.IsPinned, d.CreatedAt, d.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("doc.Create exec: %w", err)
	}
	return nil
}

func (r *Repository) Update(ctx context.Context, d *Document) error {
	d.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE documents
		SET project_id = $1, title = $2, doc_type = $3, content = $4, is_pinned = $5, updated_at = $6
		WHERE workspace_id = $7 AND id = $8 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query,
		d.ProjectID, d.Title, d.DocType, d.Content, d.IsPinned, d.UpdatedAt, d.WorkspaceID, d.ID,
	)
	if err != nil {
		return fmt.Errorf("doc.Update exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("document not found or already deleted")
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
	now := time.Now().UTC()
	query := `
		UPDATE documents
		SET deleted_at = $1, updated_at = $1
		WHERE workspace_id = $2 AND id = $3 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, now, workspaceID, id)
	if err != nil {
		return fmt.Errorf("doc.Delete exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("document not found or already deleted")
	}
	return nil
}
