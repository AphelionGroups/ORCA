package storage

import (
	"context"
	"github.com/AphelionGroups/ORCA/internal/platform/config"
	"testing"
)

func TestStorageFactoryRejectsInvalidConfiguration(t *testing.T) {
	for _, driver := range []string{"unknown", "s3"} {
		cfg := &config.Config{StorageDriver: driver, StorageLocalDir: t.TempDir()}
		if _, err := InitStorage(context.Background(), cfg); err == nil {
			t.Fatalf("invalid %s silently fell back", driver)
		}
	}
}
