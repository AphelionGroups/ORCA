package link

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) ListByEntity(ctx context.Context, workspaceID uuid.UUID, entityType string, entityID uuid.UUID) ([]EntityLink, error) {
	query := `
		SELECT id, workspace_id, from_type, from_id, to_type, to_id, relation_type, metadata, created_at
		FROM entity_links
		WHERE workspace_id = $1 AND ((from_type = $2 AND from_id = $3) OR (to_type = $2 AND to_id = $3))
		ORDER BY created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, workspaceID, entityType, entityID)
	if err != nil {
		return nil, fmt.Errorf("link.ListByEntity: %w", err)
	}
	defer rows.Close()

	links := make([]EntityLink, 0)
	for rows.Next() {
		var l EntityLink
		err := rows.Scan(
			&l.ID, &l.WorkspaceID, &l.FromType, &l.FromID, &l.ToType, &l.ToID, &l.RelationType, &l.Metadata, &l.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("link.ListByEntity scan: %w", err)
		}
		links = append(links, l)
	}
	return links, nil
}

func (r *Repository) Create(ctx context.Context, l *EntityLink) error {
	if l.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("link.Create uuidv7: %w", err)
		}
		l.ID = newID
	}
	l.CreatedAt = time.Now().UTC()

	if l.RelationType == "" {
		l.RelationType = "relates_to"
	}
	if len(l.Metadata) == 0 {
		l.Metadata = json.RawMessage(`{}`)
	}

	query := `
		INSERT INTO entity_links (id, workspace_id, from_type, from_id, to_type, to_id, relation_type, metadata, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (workspace_id, from_type, from_id, to_type, to_id, relation_type)
		DO NOTHING
	`
	_, err := r.pool.Exec(ctx, query,
		l.ID, l.WorkspaceID, l.FromType, l.FromID, l.ToType, l.ToID, l.RelationType, l.Metadata, l.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("link.Create exec: %w", err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
	query := `
		DELETE FROM entity_links
		WHERE workspace_id = $1 AND id = $2
	`
	res, err := r.pool.Exec(ctx, query, workspaceID, id)
	if err != nil {
		return fmt.Errorf("link.Delete exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("link not found")
	}
	return nil
}
