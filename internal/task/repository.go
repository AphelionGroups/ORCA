package task

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ListFilter struct {
	SpaceID     *uuid.UUID
	ProjectID   *uuid.UUID
	InboxOnly   bool
	PlannedDate *time.Time
	Status      string
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) List(ctx context.Context, workspaceID uuid.UUID, filter ListFilter) ([]Task, error) {
	query := `
		SELECT id, workspace_id, space_id, project_id, parent_task_id, title, description,
		       status, priority, due_date, planned_date, estimated_minutes, created_at, updated_at
		FROM tasks
		WHERE workspace_id = $1 AND deleted_at IS NULL
	`
	args := []any{workspaceID}
	argIdx := 2

	if filter.SpaceID != nil && *filter.SpaceID != uuid.Nil {
		query += fmt.Sprintf(" AND space_id = $%d", argIdx)
		args = append(args, *filter.SpaceID)
		argIdx++
	}

	if filter.InboxOnly {
		query += " AND project_id IS NULL"
	} else if filter.ProjectID != nil && *filter.ProjectID != uuid.Nil {
		query += fmt.Sprintf(" AND project_id = $%d", argIdx)
		args = append(args, *filter.ProjectID)
		argIdx++
	}

	if filter.PlannedDate != nil {
		query += fmt.Sprintf(" AND planned_date = $%d", argIdx)
		args = append(args, *filter.PlannedDate)
		argIdx++
	}

	if filter.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, filter.Status)
		argIdx++
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("task.List: %w", err)
	}
	defer rows.Close()

	tasks := make([]Task, 0)
	for rows.Next() {
		var t Task
		err := rows.Scan(
			&t.ID, &t.WorkspaceID, &t.SpaceID, &t.ProjectID, &t.ParentTaskID, &t.Title, &t.Description,
			&t.Status, &t.Priority, &t.DueDate, &t.PlannedDate, &t.EstimatedMinutes, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("task.List scan: %w", err)
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (r *Repository) GetByID(ctx context.Context, workspaceID, id uuid.UUID) (*Task, error) {
	query := `
		SELECT id, workspace_id, space_id, project_id, parent_task_id, title, description,
		       status, priority, due_date, planned_date, estimated_minutes, created_at, updated_at
		FROM tasks
		WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
	`
	var t Task
	err := r.pool.QueryRow(ctx, query, workspaceID, id).Scan(
		&t.ID, &t.WorkspaceID, &t.SpaceID, &t.ProjectID, &t.ParentTaskID, &t.Title, &t.Description,
		&t.Status, &t.Priority, &t.DueDate, &t.PlannedDate, &t.EstimatedMinutes, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("task.GetByID: %w", err)
	}
	return &t, nil
}

func (r *Repository) Create(ctx context.Context, t *Task) error {
	if t.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("task.Create uuidv7: %w", err)
		}
		t.ID = newID
	}
	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now

	if t.Status == "" {
		t.Status = "todo"
	}
	if t.Priority == "" {
		t.Priority = "medium"
	}

	query := `
		INSERT INTO tasks (id, workspace_id, space_id, project_id, parent_task_id, title, description,
		                  status, priority, due_date, planned_date, estimated_minutes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	_, err := r.pool.Exec(ctx, query,
		t.ID, t.WorkspaceID, t.SpaceID, t.ProjectID, t.ParentTaskID, t.Title, t.Description,
		t.Status, t.Priority, t.DueDate, t.PlannedDate, t.EstimatedMinutes, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("task.Create exec: %w", err)
	}
	return nil
}

func (r *Repository) Update(ctx context.Context, t *Task) error {
	t.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE tasks
		SET space_id = $1, project_id = $2, parent_task_id = $3, title = $4, description = $5,
		    status = $6, priority = $7, due_date = $8, planned_date = $9, estimated_minutes = $10, updated_at = $11
		WHERE workspace_id = $12 AND id = $13 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query,
		t.SpaceID, t.ProjectID, t.ParentTaskID, t.Title, t.Description,
		t.Status, t.Priority, t.DueDate, t.PlannedDate, t.EstimatedMinutes, t.UpdatedAt, t.WorkspaceID, t.ID,
	)
	if err != nil {
		return fmt.Errorf("task.Update exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("task not found or already deleted")
	}
	return nil
}

func (r *Repository) UpdateStatus(ctx context.Context, workspaceID, id uuid.UUID, status string) error {
	now := time.Now().UTC()
	query := `
		UPDATE tasks
		SET status = $1, updated_at = $2
		WHERE workspace_id = $3 AND id = $4 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, status, now, workspaceID, id)
	if err != nil {
		return fmt.Errorf("task.UpdateStatus exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("task not found or already deleted")
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
	now := time.Now().UTC()
	query := `
		UPDATE tasks
		SET deleted_at = $1, updated_at = $1
		WHERE workspace_id = $2 AND id = $3 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, now, workspaceID, id)
	if err != nil {
		return fmt.Errorf("task.Delete exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("task not found or already deleted")
	}
	return nil
}
