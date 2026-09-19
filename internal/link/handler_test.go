package link

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
)

func TestHandler_ListByEntity_MissingQueryParams(t *testing.T) {
	h := NewHandler(nil)
	handler := middleware.WorkspaceContext(h.Routes())

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for missing type/id, got %d", rec.Code)
	}
}

func TestHandler_Create_Validation(t *testing.T) {
	h := NewHandler(nil)
	handler := middleware.WorkspaceContext(h.Routes())

	body := bytes.NewBufferString(`{"from_type":"task"}`)
	req := httptest.NewRequest("POST", "/", body)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for incomplete fields, got %d", rec.Code)
	}
}

func TestHandler_Delete_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	handler := middleware.WorkspaceContext(h.Routes())

	req := httptest.NewRequest("DELETE", "/invalid-link-id", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for bad UUID, got %d", rec.Code)
	}
}
