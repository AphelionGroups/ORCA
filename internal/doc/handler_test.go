package doc

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

	// Missing title & space_id
	body := bytes.NewBufferString(`{"content":"test doc"}`)
	req := httptest.NewRequest("POST", "/", body)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for empty title/space_id, got %d", rec.Code)
	}
}

func TestHandler_GetByID_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	handler := middleware.WorkspaceContext(h.Routes())

	req := httptest.NewRequest("GET", "/invalid-doc-id", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for bad UUID, got %d", rec.Code)
	}
}
