package space

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

func (r *Repository) List(ctx context.Context, workspaceID uuid.UUID) ([]Space, error) {
	query := `
		SELECT id, workspace_id, name, slug, icon, color, sort_order, created_at, updated_at
		FROM spaces
		WHERE workspace_id = $1 AND deleted_at IS NULL
		ORDER BY sort_order ASC, created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("space.List: %w", err)
	}
	defer rows.Close()

	spaces := make([]Space, 0)
	for rows.Next() {
		var s Space
		err := rows.Scan(
			&s.ID, &s.WorkspaceID, &s.Name, &s.Slug, &s.Icon, &s.Color, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("space.List scan: %w", err)
		}
		spaces = append(spaces, s)
	}

	return spaces, nil
}

func (r *Repository) GetByID(ctx context.Context, workspaceID, id uuid.UUID) (*Space, error) {
	query := `
		SELECT id, workspace_id, name, slug, icon, color, sort_order, created_at, updated_at
		FROM spaces
		WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
	`
	var s Space
	err := r.pool.QueryRow(ctx, query, workspaceID, id).Scan(
		&s.ID, &s.WorkspaceID, &s.Name, &s.Slug, &s.Icon, &s.Color, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("space.GetByID: %w", err)
	}
	return &s, nil
}

func (r *Repository) Create(ctx context.Context, s *Space) error {
	if s.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("space.Create uuidv7: %w", err)
		}
		s.ID = newID
	}
	now := time.Now().UTC()
	s.CreatedAt = now
	s.UpdatedAt = now

	query := `
		INSERT INTO spaces (id, workspace_id, name, slug, icon, color, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.pool.Exec(ctx, query,
		s.ID, s.WorkspaceID, s.Name, s.Slug, s.Icon, s.Color, s.SortOrder, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("space.Create exec: %w", err)
	}
	return nil
}

func (r *Repository) Update(ctx context.Context, s *Space) error {
	s.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE spaces
		SET name = $1, icon = $2, color = $3, sort_order = $4, updated_at = $5
		WHERE workspace_id = $6 AND id = $7 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query,
		s.Name, s.Icon, s.Color, s.SortOrder, s.UpdatedAt, s.WorkspaceID, s.ID,
	)
	if err != nil {
		return fmt.Errorf("space.Update exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("space not found or already deleted")
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
	now := time.Now().UTC()
	query := `
		UPDATE spaces
		SET deleted_at = $1, updated_at = $1
		WHERE workspace_id = $2 AND id = $3 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, now, workspaceID, id)
	if err != nil {
		return fmt.Errorf("space.Delete exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("space not found or already deleted")
	}
	return nil
}
