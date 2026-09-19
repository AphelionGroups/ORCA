package doc

import (
	"time"

	"github.com/google/uuid"
)

type Document struct {
	ID          uuid.UUID  `json:"id"`
	WorkspaceID uuid.UUID  `json:"workspace_id"`
	SpaceID     uuid.UUID  `json:"space_id"`
	ProjectID   *uuid.UUID `json:"project_id,omitempty"`
	Title       string     `json:"title"`
	DocType     string     `json:"doc_type"`
	Content     string     `json:"content"`
	IsPinned    bool       `json:"is_pinned"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty"`
}

type CreateDocumentRequest struct {
	SpaceID   uuid.UUID  `json:"space_id"`
	ProjectID *uuid.UUID `json:"project_id,omitempty"`
	Title     string     `json:"title"`
	DocType   string     `json:"doc_type"`
	Content   string     `json:"content"`
	IsPinned  bool       `json:"is_pinned"`
}

type UpdateDocumentRequest struct {
	ProjectID *uuid.UUID `json:"project_id,omitempty"`
	Title     string     `json:"title"`
	DocType   string     `json:"doc_type"`
	Content   string     `json:"content"`
	IsPinned  bool       `json:"is_pinned"`
}
