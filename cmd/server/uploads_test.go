package main

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestUploadedAssetsHideDirectoryIndexes(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "tenant", "images"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "tenant", "images", "image.png"), []byte("image"), 0600); err != nil {
		t.Fatal(err)
	}
	handler := uploadedAssetsHandler(dir)
	for _, tc := range []struct {
		path string
		want int
	}{{"/uploads/", 404}, {"/uploads/tenant/", 404}, {"/uploads/tenant/images/", 404}, {"/uploads/tenant/images/image.png", 200}} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("GET", tc.path, nil))
		if rec.Code != tc.want {
			t.Fatalf("%s: want %d got %d", tc.path, tc.want, rec.Code)
		}
		if rec.Header().Get("Content-Security-Policy") == "" {
			t.Fatal("missing asset sandbox")
		}
	}
}
