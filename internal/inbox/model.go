package inbox

import (
	"time"

	"github.com/google/uuid"
)

type Note struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Content     string    `json:"content"`
	Color       string    `json:"color"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateNoteRequest struct {
	Content string `json:"content"`
	Color   string `json:"color"`
}

type UpdateNoteRequest struct {
	Content    *string `json:"content"`
	Color      *string `json:"color"`
	IsArchived *bool   `json:"is_archived"`
}

type ConvertToTaskRequest struct {
	SpaceID   uuid.UUID  `json:"space_id"`
	ProjectID *uuid.UUID `json:"project_id"`
	Title     string     `json:"title"`
	Priority  string     `json:"priority"`
	DueDate   *time.Time `json:"due_date"`
}

type ConvertToDocRequest struct {
	SpaceID   uuid.UUID  `json:"space_id"`
	ProjectID *uuid.UUID `json:"project_id"`
	Title     string     `json:"title"`
}
