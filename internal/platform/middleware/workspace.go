package middleware

import (
	"context"
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/google/uuid"
	"net/http"
)

type contextKey string

const (
	WorkspaceIDKey             contextKey = "workspace_id"
	DefaultPersonalWorkspaceID            = "018f0000-0000-7000-8000-000000000001"
)

// WorkspaceContext checks an optional header against the authenticated tenant.
func WorkspaceContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		wsID := GetWorkspaceID(r.Context())
		if wsID == uuid.Nil {
			httputil.RespondError(w, http.StatusUnauthorized, "Authenticated workspace is required")
			return
		}
		if header := r.Header.Get("X-Workspace-ID"); header != "" {
			requested, err := uuid.Parse(header)
			if err != nil || requested == uuid.Nil {
				httputil.RespondError(w, http.StatusBadRequest, "Invalid workspace header")
				return
			}
			if requested != wsID {
				httputil.RespondError(w, http.StatusForbidden, "Workspace access denied")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
func GetWorkspaceID(ctx context.Context) uuid.UUID {
	if id, ok := ctx.Value(WorkspaceIDKey).(uuid.UUID); ok {
		return id
	}
	return uuid.Nil
}
