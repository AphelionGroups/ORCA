package space

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
)

func TestHandler_Create_Validation(t *testing.T) {
	h := NewHandler(nil)
	handler := middleware.WorkspaceContext(h.Routes())

	// Missing name & slug
	body := bytes.NewBufferString(`{"icon":"briefcase"}`)
	req := httptest.NewRequest("POST", "/", body)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for empty name/slug, got %d", rec.Code)
	}
}

func TestHandler_GetByID_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	handler := middleware.WorkspaceContext(h.Routes())

	req := httptest.NewRequest("GET", "/invalid-uuid-123", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid UUID, got %d", rec.Code)
	}
}
