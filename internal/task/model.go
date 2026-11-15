package task

import (
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"time"

	"github.com/google/uuid"
)

type Task struct {
	AutoCompleteSubtasks bool       `json:"auto_complete_subtasks"`
	ParentTitle          *string    `json:"parent_title,omitempty"`
	SubtaskCount         int        `json:"subtask_count"`
	SubtaskDone          int        `json:"subtask_done"`
	DescendantCount      int        `json:"descendant_count"`
	ID                   uuid.UUID  `json:"id"`
	WorkspaceID          uuid.UUID  `json:"workspace_id"`
	SpaceID              uuid.UUID  `json:"space_id"`
	ProjectID            *uuid.UUID `json:"project_id,omitempty"`
	ParentTaskID         *uuid.UUID `json:"parent_task_id,omitempty"`
	Title                string     `json:"title"`
	Description          *string    `json:"description,omitempty"`
	Status               string     `json:"status"`
	Priority             string     `json:"priority"`
	DueDate              *time.Time `json:"due_date,omitempty"`
	PlannedDate          *time.Time `json:"planned_date,omitempty"`
	EstimatedMinutes     *int       `json:"estimated_minutes,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
	DeletedAt            *time.Time `json:"deleted_at,omitempty"`
}

type CreateTaskRequest struct {
	AutoCompleteSubtasks bool       `json:"auto_complete_subtasks"`
	SpaceID              uuid.UUID  `json:"space_id"`
	ProjectID            *uuid.UUID `json:"project_id,omitempty"`
	ParentTaskID         *uuid.UUID `json:"parent_task_id,omitempty"`
	Title                string     `json:"title"`
	Description          *string    `json:"description,omitempty"`
	Status               string     `json:"status"`
	Priority             string     `json:"priority"`
	DueDate              *time.Time `json:"due_date,omitempty"`
	PlannedDate          *string    `json:"planned_date,omitempty"` // format: "2006-01-02"
	EstimatedMinutes     *int       `json:"estimated_minutes,omitempty"`
}

type UpdateTaskRequest struct {
	AutoCompleteSubtasks *bool                        `json:"auto_complete_subtasks,omitempty"`
	ExpectedUpdatedAt    *time.Time                   `json:"expected_updated_at,omitempty"`
	SpaceID              *uuid.UUID                   `json:"space_id,omitempty"`
	ProjectID            httputil.Optional[uuid.UUID] `json:"project_id,omitempty"`
	ParentTaskID         httputil.Optional[uuid.UUID] `json:"parent_task_id,omitempty"`
	Title                string                       `json:"title"`
	Description          httputil.Optional[string]    `json:"description,omitempty"`
	Status               string                       `json:"status"`
	Priority             string                       `json:"priority"`
	DueDate              httputil.Optional[time.Time] `json:"due_date,omitempty"`
	PlannedDate          httputil.Optional[string]    `json:"planned_date,omitempty"` // format: "2006-01-02"
	EstimatedMinutes     httputil.Optional[int]       `json:"estimated_minutes,omitempty"`
}

type UpdateTaskStatusRequest struct {
	ExpectedUpdatedAt *time.Time `json:"expected_updated_at,omitempty"`
	Status            string     `json:"status"`
}
