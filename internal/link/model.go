package link

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type EntityLink struct {
	ID           uuid.UUID       `json:"id"`
	WorkspaceID  uuid.UUID       `json:"workspace_id"`
	FromType     string          `json:"from_type"`
	FromID       uuid.UUID       `json:"from_id"`
	ToType       string          `json:"to_type"`
	ToID         uuid.UUID       `json:"to_id"`
	RelationType string          `json:"relation_type"`
	Metadata     json.RawMessage `json:"metadata"`
	CreatedAt    time.Time       `json:"created_at"`
}

type CreateEntityLinkRequest struct {
	FromType     string          `json:"from_type"`
	FromID       uuid.UUID       `json:"from_id"`
	ToType       string          `json:"to_type"`
	ToID         uuid.UUID       `json:"to_id"`
	RelationType string          `json:"relation_type"`
	Metadata     json.RawMessage `json:"metadata,omitempty"`
}
