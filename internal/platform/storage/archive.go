package storage

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const MaxAssetBytes = 10 << 20

// ArchiveStore never fetches arbitrary URLs. Only keys belonging to the current
// workspace in the configured storage backend can be read for a package.
type ArchiveStore interface {
	Service
	AssetKey(workspace, rawURL string) (string, bool)
	ReadAsset(context.Context, string) ([]byte, error)
	DeleteAsset(context.Context, string) error
}

func validAssetKey(workspace, key string) bool {
	return strings.HasPrefix(key, workspace+"/") && path.Clean(key) == key && filepath.IsLocal(key) && !strings.ContainsAny(key, "\\\x00")
}
func (l *LocalStorage) AssetKey(workspace, rawURL string) (string, bool) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", false
	}
	base, err := url.Parse(l.baseURL)
	if err != nil {
		return "", false
	}
	prefix := strings.TrimRight(base.Path, "/") + "/"
	if !strings.HasPrefix(u.Path, prefix) {
		return "", false
	}
	key := strings.TrimPrefix(u.Path, prefix)
	return key, validAssetKey(workspace, key)
}
func (l *LocalStorage) assetPath(key string) (string, error) {
	if !filepath.IsLocal(key) || strings.Contains(key, "\\") || path.Clean(key) != key {
		return "", fmt.Errorf("invalid asset key")
	}
	root, err := filepath.EvalSymlinks(l.baseDir)
	if err != nil {
		return "", err
	}
	root, err = filepath.Abs(root)
	if err != nil {
		return "", err
	}
	target, err := filepath.EvalSymlinks(filepath.Join(root, key))
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(root, target)
	if err != nil || !filepath.IsLocal(rel) {
		return "", fmt.Errorf("asset escapes storage")
	}
	return target, nil
}
func (l *LocalStorage) ReadAsset(ctx context.Context, key string) ([]byte, error) {
	target, err := l.assetPath(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(target)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return nil, fmt.Errorf("asset is not a file")
	}
	return readAsset(f)
}
func (l *LocalStorage) DeleteAsset(ctx context.Context, key string) error {
	target, err := l.assetPath(key)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return os.Remove(target)
}
func (s *S3Storage) AssetKey(workspace, rawURL string) (string, bool) {
	prefix := s.publicURLBase + "/"
	if !strings.HasPrefix(rawURL, prefix) {
		return "", false
	}
	key := strings.TrimPrefix(rawURL, prefix)
	return key, validAssetKey(workspace, key)
}
func (s *S3Storage) ReadAsset(ctx context.Context, key string) ([]byte, error) {
	result, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil {
		return nil, err
	}
	defer result.Body.Close()
	return readAsset(result.Body)
}
func (s *S3Storage) DeleteAsset(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	return err
}
func readAsset(reader io.Reader) ([]byte, error) {
	b, err := io.ReadAll(io.LimitReader(reader, MaxAssetBytes+1))
	if err != nil {
		return nil, err
	}
	if len(b) > MaxAssetBytes {
		return nil, fmt.Errorf("asset exceeds 10 MB")
	}
	if !AllowedAssetType(http.DetectContentType(b)) {
		return nil, fmt.Errorf("unsupported attachment type")
	}
	return b, nil
}
func AllowedAssetType(kind string) bool {
	return kind == "image/png" || kind == "image/jpeg" || kind == "image/gif" || kind == "image/webp"
}
