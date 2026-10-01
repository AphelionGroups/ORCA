package storage

import (
	"context"
	"io"
)

// Service defines standard operations for object storage
type Service interface {
	Upload(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) (string, error)
	Driver() string
}
