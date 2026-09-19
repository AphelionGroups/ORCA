package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

type contextKey string

const (
	WorkspaceIDKey contextKey = "workspace_id"
	// DefaultPersonalWorkspaceID is used for personal/single-user installations
	DefaultPersonalWorkspaceID = "018f0000-0000-7000-8000-000000000001"
)

func WorkspaceContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		wsHeader := r.Header.Get("X-Workspace-ID")
		var wsID uuid.UUID
		var err error

		if wsHeader != "" {
			wsID, err = uuid.Parse(wsHeader)
		}

		if err != nil || wsID == uuid.Nil {
			wsID = uuid.MustParse(DefaultPersonalWorkspaceID)
		}

		ctx := context.WithValue(r.Context(), WorkspaceIDKey, wsID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetWorkspaceID(ctx context.Context) uuid.UUID {
	if val, ok := ctx.Value(WorkspaceIDKey).(uuid.UUID); ok && val != uuid.Nil {
		return val
	}
	return uuid.MustParse(DefaultPersonalWorkspaceID)
}
