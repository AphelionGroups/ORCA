package project

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID            uuid.UUID       `json:"id"`
	WorkspaceID   uuid.UUID       `json:"workspace_id"`
	SpaceID       uuid.UUID       `json:"space_id"`
	Name          string          `json:"name"`
	Description   *string         `json:"description,omitempty"`
	Status        string          `json:"status"`
	TargetDate    *time.Time      `json:"target_date,omitempty"`
	KanbanColumns json.RawMessage `json:"kanban_columns"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	DeletedAt     *time.Time      `json:"deleted_at,omitempty"`
}

type CreateProjectRequest struct {
	SpaceID       uuid.UUID       `json:"space_id"`
	Name          string          `json:"name"`
	Description   *string         `json:"description,omitempty"`
	Status        string          `json:"status"`
	TargetDate    *time.Time      `json:"target_date,omitempty"`
	KanbanColumns json.RawMessage `json:"kanban_columns,omitempty"`
}

type UpdateProjectRequest struct {
	Name          string          `json:"name"`
	Description   *string         `json:"description,omitempty"`
	Status        string          `json:"status"`
	TargetDate    *time.Time      `json:"target_date,omitempty"`
	KanbanColumns json.RawMessage `json:"kanban_columns,omitempty"`
}
