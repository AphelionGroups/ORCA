package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestWorkspaceContext_Default(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	var capturedID uuid.UUID
	handler := WorkspaceContext(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedID = GetWorkspaceID(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	handler.ServeHTTP(rec, req)

	expectedDefault := uuid.MustParse(DefaultPersonalWorkspaceID)
	if capturedID != expectedDefault {
		t.Fatalf("expected workspace ID %s, got %s", expectedDefault, capturedID)
	}
}

func TestWorkspaceContext_CustomHeader(t *testing.T) {
	customID := uuid.New()
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Workspace-ID", customID.String())
	rec := httptest.NewRecorder()

	var capturedID uuid.UUID
	handler := WorkspaceContext(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedID = GetWorkspaceID(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	handler.ServeHTTP(rec, req)

	if capturedID != customID {
		t.Fatalf("expected workspace ID %s, got %s", customID, capturedID)
	}
}
