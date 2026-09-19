package calendar

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

func (r *Repository) List(ctx context.Context, workspaceID uuid.UUID, startAt, endAt *time.Time, spaceID *uuid.UUID) ([]Event, error) {
	query := `
		SELECT id, workspace_id, space_id, linked_task_id, title, description,
		       start_at, end_at, is_all_day, external_provider, external_event_id,
		       created_at, updated_at
		FROM events
		WHERE workspace_id = $1 AND deleted_at IS NULL
	`
	args := []any{workspaceID}
	argIdx := 2

	if startAt != nil {
		query += fmt.Sprintf(" AND end_at >= $%d", argIdx)
		args = append(args, *startAt)
		argIdx++
	}

	if endAt != nil {
		query += fmt.Sprintf(" AND start_at <= $%d", argIdx)
		args = append(args, *endAt)
		argIdx++
	}

	if spaceID != nil && *spaceID != uuid.Nil {
		query += fmt.Sprintf(" AND space_id = $%d", argIdx)
		args = append(args, *spaceID)
		argIdx++
	}

	query += " ORDER BY start_at ASC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("calendar.List: %w", err)
	}
	defer rows.Close()

	events := make([]Event, 0)
	for rows.Next() {
		var e Event
		err := rows.Scan(
			&e.ID, &e.WorkspaceID, &e.SpaceID, &e.LinkedTaskID, &e.Title, &e.Description,
			&e.StartAt, &e.EndAt, &e.IsAllDay, &e.ExternalProvider, &e.ExternalEventID,
			&e.CreatedAt, &e.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("calendar.List scan: %w", err)
		}
		events = append(events, e)
	}
	return events, nil
}

func (r *Repository) GetByID(ctx context.Context, workspaceID, id uuid.UUID) (*Event, error) {
	query := `
		SELECT id, workspace_id, space_id, linked_task_id, title, description,
		       start_at, end_at, is_all_day, external_provider, external_event_id,
		       created_at, updated_at
		FROM events
		WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
	`
	var e Event
	err := r.pool.QueryRow(ctx, query, workspaceID, id).Scan(
		&e.ID, &e.WorkspaceID, &e.SpaceID, &e.LinkedTaskID, &e.Title, &e.Description,
		&e.StartAt, &e.EndAt, &e.IsAllDay, &e.ExternalProvider, &e.ExternalEventID,
		&e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("calendar.GetByID: %w", err)
	}
	return &e, nil
}

func (r *Repository) Create(ctx context.Context, e *Event) error {
	if e.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("calendar.Create uuidv7: %w", err)
		}
		e.ID = newID
	}
	now := time.Now().UTC()
	e.CreatedAt = now
	e.UpdatedAt = now

	query := `
		INSERT INTO events (id, workspace_id, space_id, linked_task_id, title, description,
		                   start_at, end_at, is_all_day, external_provider, external_event_id,
		                   created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err := r.pool.Exec(ctx, query,
		e.ID, e.WorkspaceID, e.SpaceID, e.LinkedTaskID, e.Title, e.Description,
		e.StartAt, e.EndAt, e.IsAllDay, e.ExternalProvider, e.ExternalEventID,
		e.CreatedAt, e.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("calendar.Create exec: %w", err)
	}
	return nil
}

func (r *Repository) Update(ctx context.Context, e *Event) error {
	e.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE events
		SET space_id = $1, linked_task_id = $2, title = $3, description = $4,
		    start_at = $5, end_at = $6, is_all_day = $7, external_provider = $8, external_event_id = $9,
		    updated_at = $10
		WHERE workspace_id = $11 AND id = $12 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query,
		e.SpaceID, e.LinkedTaskID, e.Title, e.Description,
		e.StartAt, e.EndAt, e.IsAllDay, e.ExternalProvider, e.ExternalEventID,
		e.UpdatedAt, e.WorkspaceID, e.ID,
	)
	if err != nil {
		return fmt.Errorf("calendar.Update exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("event not found or already deleted")
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
	now := time.Now().UTC()
	query := `
		UPDATE events
		SET deleted_at = $1, updated_at = $1
		WHERE workspace_id = $2 AND id = $3 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, now, workspaceID, id)
	if err != nil {
		return fmt.Errorf("calendar.Delete exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("event not found or already deleted")
	}
	return nil
}
