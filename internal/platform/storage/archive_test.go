package storage

import (
	"bytes"
	"context"
	"encoding/base64"
	"testing"

	"github.com/google/uuid"
)

func TestArchiveStorageOwnershipAndCleanup(t *testing.T) {
	ctx := context.Background()
	ws := uuid.NewString()
	store, err := NewLocalStorage(t.TempDir(), "/uploads")
	if err != nil {
		t.Fatal(err)
	}
	gif, _ := base64.StdEncoding.DecodeString("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
	key := ws + "/images/example.gif"
	url, err := store.Upload(ctx, key, bytes.NewReader(gif), int64(len(gif)), "image/gif")
	if err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{url, "http://localhost:8080" + url} {
		got, ok := store.AssetKey(ws, raw)
		if !ok || got != key {
			t.Fatal("owned URL not recognized")
		}
	}
	for _, raw := range []string{"/uploads/" + uuid.NewString() + "/images/other.gif", "/uploads/" + ws + "/../other.gif", "/uploads/" + ws + "/%2e%2e/other.gif"} {
		if _, ok := store.AssetKey(ws, raw); ok {
			t.Fatal("unsafe asset key accepted")
		}
	}
	body, err := store.ReadAsset(ctx, key)
	if err != nil || !bytes.Equal(body, gif) {
		t.Fatal("asset read failed")
	}
	if _, err := store.ReadAsset(ctx, "../outside"); err == nil {
		t.Fatal("path traversal read accepted")
	}
	if err := store.DeleteAsset(ctx, key); err != nil {
		t.Fatal(err)
	}
	if _, err := store.ReadAsset(ctx, key); err == nil {
		t.Fatal("asset survived cleanup")
	}
	if err := store.DeleteAsset(ctx, key); err != nil {
		t.Fatal("cleanup must be repeatable")
	}
	s3 := &S3Storage{publicURLBase: "https://media.example.invalid/orca"}
	if got, ok := s3.AssetKey(ws, "https://media.example.invalid/orca/"+key); !ok || got != key {
		t.Fatal("owned S3 URL not recognized")
	}
	if _, ok := s3.AssetKey(ws, "http://169.254.169.254/"+key); ok {
		t.Fatal("arbitrary remote URL accepted")
	}
}
