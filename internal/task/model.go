package task

import (
	"time"

	"github.com/google/uuid"
)

type Task struct {
	ID               uuid.UUID  `json:"id"`
	WorkspaceID      uuid.UUID  `json:"workspace_id"`
	SpaceID          uuid.UUID  `json:"space_id"`
	ProjectID        *uuid.UUID `json:"project_id,omitempty"`
	ParentTaskID     *uuid.UUID `json:"parent_task_id,omitempty"`
	Title            string     `json:"title"`
	Description      *string    `json:"description,omitempty"`
	Status           string     `json:"status"`
	Priority         string     `json:"priority"`
	DueDate          *time.Time `json:"due_date,omitempty"`
	PlannedDate      *time.Time `json:"planned_date,omitempty"`
	EstimatedMinutes *int       `json:"estimated_minutes,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`
}

type CreateTaskRequest struct {
	SpaceID          uuid.UUID  `json:"space_id"`
	ProjectID        *uuid.UUID `json:"project_id,omitempty"`
	ParentTaskID     *uuid.UUID `json:"parent_task_id,omitempty"`
	Title            string     `json:"title"`
	Description      *string    `json:"description,omitempty"`
	Status           string     `json:"status"`
	Priority         string     `json:"priority"`
	DueDate          *time.Time `json:"due_date,omitempty"`
	PlannedDate      *string    `json:"planned_date,omitempty"` // format: "2006-01-02"
	EstimatedMinutes *int       `json:"estimated_minutes,omitempty"`
}

type UpdateTaskRequest struct {
	SpaceID          *uuid.UUID `json:"space_id,omitempty"`
	ProjectID        *uuid.UUID `json:"project_id,omitempty"`
	ParentTaskID     *uuid.UUID `json:"parent_task_id,omitempty"`
	Title            string     `json:"title"`
	Description      *string    `json:"description,omitempty"`
	Status           string     `json:"status"`
	Priority         string     `json:"priority"`
	DueDate          *time.Time `json:"due_date,omitempty"`
	PlannedDate      *string    `json:"planned_date,omitempty"` // format: "2006-01-02"
	EstimatedMinutes *int       `json:"estimated_minutes,omitempty"`
}

type UpdateTaskStatusRequest struct {
	Status string `json:"status"`
}
