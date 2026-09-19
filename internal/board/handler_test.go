package board

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
)

func TestHandler_CreateBoard_Validation(t *testing.T) {
	h := NewHandler(nil)
	handler := middleware.WorkspaceContext(h.BoardRoutes())

	// Missing title & space_id
	body := bytes.NewBufferString(`{}`)
	req := httptest.NewRequest("POST", "/", body)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for empty title/space_id, got %d", rec.Code)
	}
}

func TestHandler_GetBoardByID_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	handler := middleware.WorkspaceContext(h.BoardRoutes())

	req := httptest.NewRequest("GET", "/invalid-board-id", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for bad UUID, got %d", rec.Code)
	}
}

func TestHandler_GetBlockByID_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	handler := middleware.WorkspaceContext(h.BlockRoutes())

	req := httptest.NewRequest("GET", "/invalid-block-id", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for bad UUID, got %d", rec.Code)
	}
}
