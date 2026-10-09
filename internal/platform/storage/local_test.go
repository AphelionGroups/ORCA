package storage

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLocalStoragePersistenceAndBoundary(t *testing.T) {
	dir := t.TempDir()
	store, err := NewLocalStorage(dir, "/uploads")
	if err != nil {
		t.Fatal(err)
	}
	url, err := store.Upload(context.Background(), "tenant/images/test.png", strings.NewReader("image"), 5, "image/png")
	if err != nil || url != "/uploads/tenant/images/test.png" {
		t.Fatalf("upload: %s %v", url, err)
	}
	recreated, err := NewLocalStorage(dir, "/uploads")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(recreated.BaseDir(), "tenant/images/test.png"))
	if err != nil || string(data) != "image" {
		t.Fatal("stored image lost")
	}
	for _, key := range []string{"../outside", "/absolute", "tenant\\..\\outside"} {
		if _, err := store.Upload(context.Background(), key, strings.NewReader("bad"), 3, "image/png"); err == nil {
			t.Fatalf("unsafe key accepted: %s", key)
		}
	}
}
