package storage

import (
	"context"
	"fmt"
	"log"

	"github.com/AphelionGroups/ORCA/internal/platform/config"
)

// InitStorage initializes the appropriate storage provider based on configuration.
// If S3 parameters are configured or driver is explicitly "s3", S3Storage is initialized.
// Otherwise, it falls back to LocalStorage.
func InitStorage(ctx context.Context, cfg *config.Config) (Service, error) {
	if cfg.StorageDriver != "auto" && cfg.StorageDriver != "local" && cfg.StorageDriver != "s3" {
		return nil, fmt.Errorf("unsupported storage driver")
	}
	if cfg.StorageDriver == "s3" && cfg.StorageS3Bucket == "" {
		return nil, fmt.Errorf("STORAGE_S3_BUCKET is required for s3")
	}
	useS3 := cfg.StorageDriver == "s3" || (cfg.StorageDriver == "auto" && cfg.StorageS3Bucket != "")

	if useS3 {
		log.Printf("[ORCA-STORAGE] Initializing S3 Object Storage (Bucket: %s, Endpoint: %s)", cfg.StorageS3Bucket, cfg.StorageS3Endpoint)
		s3Store, err := NewS3Storage(ctx, S3Config{
			Endpoint:      cfg.StorageS3Endpoint,
			Bucket:        cfg.StorageS3Bucket,
			Region:        cfg.StorageS3Region,
			AccessKey:     cfg.StorageS3AccessKey,
			SecretKey:     cfg.StorageS3SecretKey,
			PublicURLBase: cfg.StorageS3PublicURLBase,
		})
		if err != nil {
			return nil, fmt.Errorf("S3 storage initialization failed: %w", err)
		} else {
			return s3Store, nil
		}
	}

	log.Printf("[ORCA-STORAGE] Initializing Local Disk Storage (Dir: %s)", cfg.StorageLocalDir)
	return NewLocalStorage(cfg.StorageLocalDir, "/uploads")
}
