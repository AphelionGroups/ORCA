package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type LocalStorage struct {
	baseDir string
	baseURL string
}

func NewLocalStorage(baseDir, baseURL string) (*LocalStorage, error) {
	if baseDir == "" {
		baseDir = "./uploads"
	}
	if baseURL == "" {
		baseURL = "/uploads"
	}

	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create upload directory %s: %w", baseDir, err)
	}

	return &LocalStorage{
		baseDir: baseDir,
		baseURL: baseURL,
	}, nil
}

func (l *LocalStorage) Driver() string {
	return "local"
}

func (l *LocalStorage) BaseDir() string {
	return l.baseDir
}

func (l *LocalStorage) Upload(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) (string, error) {
	targetPath := filepath.Join(l.baseDir, filepath.Clean(objectKey))
	dir := filepath.Dir(targetPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create target subfolder: %w", err)
	}

	dst, err := os.Create(targetPath)
	if err != nil {
		return "", fmt.Errorf("failed to create file on disk: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, reader); err != nil {
		return "", fmt.Errorf("failed to write data: %w", err)
	}

	// Returns path-based web URL
	return fmt.Sprintf("%s/%s", l.baseURL, objectKey), nil
}
