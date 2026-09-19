package calendar

import (
	"time"

	"github.com/google/uuid"
)

type Event struct {
	ID               uuid.UUID  `json:"id"`
	WorkspaceID      uuid.UUID  `json:"workspace_id"`
	SpaceID          *uuid.UUID `json:"space_id,omitempty"`
	LinkedTaskID     *uuid.UUID `json:"linked_task_id,omitempty"`
	Title            string     `json:"title"`
	Description      *string    `json:"description,omitempty"`
	StartAt          time.Time  `json:"start_at"`
	EndAt            time.Time  `json:"end_at"`
	IsAllDay         bool       `json:"is_all_day"`
	ExternalProvider *string    `json:"external_provider,omitempty"`
	ExternalEventID  *string    `json:"external_event_id,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`
}

type CreateEventRequest struct {
	SpaceID          *uuid.UUID `json:"space_id,omitempty"`
	LinkedTaskID     *uuid.UUID `json:"linked_task_id,omitempty"`
	Title            string     `json:"title"`
	Description      *string    `json:"description,omitempty"`
	StartAt          time.Time  `json:"start_at"`
	EndAt            time.Time  `json:"end_at"`
	IsAllDay         bool       `json:"is_all_day"`
	ExternalProvider *string    `json:"external_provider,omitempty"`
	ExternalEventID  *string    `json:"external_event_id,omitempty"`
}

type UpdateEventRequest struct {
	SpaceID          *uuid.UUID `json:"space_id,omitempty"`
	LinkedTaskID     *uuid.UUID `json:"linked_task_id,omitempty"`
	Title            string     `json:"title"`
	Description      *string    `json:"description,omitempty"`
	StartAt          time.Time  `json:"start_at"`
	EndAt            time.Time  `json:"end_at"`
	IsAllDay         bool       `json:"is_all_day"`
	ExternalProvider *string    `json:"external_provider,omitempty"`
	ExternalEventID  *string    `json:"external_event_id,omitempty"`
}
