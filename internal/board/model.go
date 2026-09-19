package board

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type NoteBoard struct {
	ID            uuid.UUID       `json:"id"`
	WorkspaceID   uuid.UUID       `json:"workspace_id"`
	SpaceID       uuid.UUID       `json:"space_id"`
	ProjectID     *uuid.UUID      `json:"project_id,omitempty"`
	Title         string          `json:"title"`
	ViewportState json.RawMessage `json:"viewport_state"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	DeletedAt     *time.Time      `json:"deleted_at,omitempty"`
}

type NoteBlock struct {
	ID          uuid.UUID       `json:"id"`
	BoardID     uuid.UUID       `json:"board_id"`
	WorkspaceID uuid.UUID       `json:"workspace_id"`
	Type        string          `json:"type"` // 'sticky', 'text', 'card', 'image', 'task_embed'
	PosX        float64         `json:"pos_x"`
	PosY        float64         `json:"pos_y"`
	Width       *float64        `json:"width,omitempty"`
	Height      *float64        `json:"height,omitempty"`
	Content     json.RawMessage `json:"content"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	DeletedAt   *time.Time      `json:"deleted_at,omitempty"`
}

type CreateBoardRequest struct {
	SpaceID       uuid.UUID       `json:"space_id"`
	ProjectID     *uuid.UUID      `json:"project_id,omitempty"`
	Title         string          `json:"title"`
	ViewportState json.RawMessage `json:"viewport_state,omitempty"`
}

type UpdateBoardRequest struct {
	ProjectID     *uuid.UUID      `json:"project_id,omitempty"`
	Title         string          `json:"title"`
	ViewportState json.RawMessage `json:"viewport_state,omitempty"`
}

type CreateBlockRequest struct {
	ID      *uuid.UUID      `json:"id,omitempty"`
	BoardID uuid.UUID       `json:"board_id"`
	Type    string          `json:"type"`
	PosX    float64         `json:"pos_x"`
	PosY    float64         `json:"pos_y"`
	Width   *float64        `json:"width,omitempty"`
	Height  *float64        `json:"height,omitempty"`
	Content json.RawMessage `json:"content"`
}

type UpdateBlockRequest struct {
	Type    string          `json:"type,omitempty"`
	PosX    *float64        `json:"pos_x,omitempty"`
	PosY    *float64        `json:"pos_y,omitempty"`
	Width   *float64        `json:"width,omitempty"`
	Height  *float64        `json:"height,omitempty"`
	Content json.RawMessage `json:"content,omitempty"`
}
