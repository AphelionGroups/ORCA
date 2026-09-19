package httputil

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRespondJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	RespondJSON(rec, http.StatusOK, map[string]string{"message": "hello"})

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"message":"hello"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestRespondError(t *testing.T) {
	rec := httptest.NewRecorder()
	RespondError(rec, http.StatusBadRequest, "bad request data")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"error":"bad request data"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestParseJSON(t *testing.T) {
	type Sample struct {
		Name string `json:"name"`
	}

	body := bytes.NewBufferString(`{"name":"test"}`)
	req := httptest.NewRequest("POST", "/", body)

	var s Sample
	if err := ParseJSON(req, &s); err != nil {
		t.Fatalf("failed to parse json: %v", err)
	}
	if s.Name != "test" {
		t.Fatalf("expected name 'test', got '%s'", s.Name)
	}

	// Unknown field test
	badBody := bytes.NewBufferString(`{"name":"test","unknown":"field"}`)
	badReq := httptest.NewRequest("POST", "/", badBody)
	var s2 Sample
	if err := ParseJSON(badReq, &s2); err == nil {
		t.Fatal("expected error on unknown field, got nil")
	}
}
