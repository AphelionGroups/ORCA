package project

import (
	"context"
	"encoding/json"
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

func (r *Repository) List(ctx context.Context, workspaceID uuid.UUID, spaceID *uuid.UUID) ([]Project, error) {
	query := `
		SELECT id, workspace_id, space_id, name, description, status, target_date, kanban_columns, created_at, updated_at
		FROM projects
		WHERE workspace_id = $1 AND deleted_at IS NULL
	`
	args := []any{workspaceID}

	if spaceID != nil && *spaceID != uuid.Nil {
		query += " AND space_id = $2"
		args = append(args, *spaceID)
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("project.List: %w", err)
	}
	defer rows.Close()

	projects := make([]Project, 0)
	for rows.Next() {
		var p Project
		err := rows.Scan(
			&p.ID, &p.WorkspaceID, &p.SpaceID, &p.Name, &p.Description, &p.Status, &p.TargetDate, &p.KanbanColumns, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("project.List scan: %w", err)
		}
		projects = append(projects, p)
	}
	return projects, nil
}

func (r *Repository) GetByID(ctx context.Context, workspaceID, id uuid.UUID) (*Project, error) {
	query := `
		SELECT id, workspace_id, space_id, name, description, status, target_date, kanban_columns, created_at, updated_at
		FROM projects
		WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
	`
	var p Project
	err := r.pool.QueryRow(ctx, query, workspaceID, id).Scan(
		&p.ID, &p.WorkspaceID, &p.SpaceID, &p.Name, &p.Description, &p.Status, &p.TargetDate, &p.KanbanColumns, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("project.GetByID: %w", err)
	}
	return &p, nil
}

func (r *Repository) Create(ctx context.Context, p *Project) error {
	if p.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("project.Create uuidv7: %w", err)
		}
		p.ID = newID
	}
	now := time.Now().UTC()
	p.CreatedAt = now
	p.UpdatedAt = now

	if p.Status == "" {
		p.Status = "active"
	}

	if len(p.KanbanColumns) == 0 {
		p.KanbanColumns = json.RawMessage(`["Backlog", "Todo", "In Progress", "Done"]`)
	}

	query := `
		INSERT INTO projects (id, workspace_id, space_id, name, description, status, target_date, kanban_columns, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.pool.Exec(ctx, query,
		p.ID, p.WorkspaceID, p.SpaceID, p.Name, p.Description, p.Status, p.TargetDate, p.KanbanColumns, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("project.Create exec: %w", err)
	}
	return nil
}

func (r *Repository) Update(ctx context.Context, p *Project) error {
	p.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE projects
		SET name = $1, description = $2, status = $3, target_date = $4, kanban_columns = $5, updated_at = $6
		WHERE workspace_id = $7 AND id = $8 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query,
		p.Name, p.Description, p.Status, p.TargetDate, p.KanbanColumns, p.UpdatedAt, p.WorkspaceID, p.ID,
	)
	if err != nil {
		return fmt.Errorf("project.Update exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("project not found or already deleted")
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
	now := time.Now().UTC()
	query := `
		UPDATE projects
		SET deleted_at = $1, updated_at = $1
		WHERE workspace_id = $2 AND id = $3 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, now, workspaceID, id)
	if err != nil {
		return fmt.Errorf("project.Delete exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("project not found or already deleted")
	}
	return nil
}
