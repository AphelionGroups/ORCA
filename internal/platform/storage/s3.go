package storage

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Config struct {
	Endpoint      string
	Bucket        string
	Region        string
	AccessKey     string
	SecretKey     string
	PublicURLBase string
}

type S3Storage struct {
	client        *s3.Client
	bucket        string
	publicURLBase string
}

// NewS3Storage creates a storage client for S3-compatible endpoints:
// Cloudflare R2, Supabase Storage S3 API, AWS S3, MinIO, etc.
func NewS3Storage(ctx context.Context, cfg S3Config) (*S3Storage, error) {
	if cfg.Bucket == "" {
		return nil, fmt.Errorf("S3 bucket name is required")
	}

	region := cfg.Region
	if region == "" {
		region = "auto"
	}

	loadOpts := []func(*config.LoadOptions) error{
		config.WithRegion(region),
	}

	if cfg.AccessKey != "" && cfg.SecretKey != "" {
		loadOpts = append(loadOpts, config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKey,
			cfg.SecretKey,
			"",
		)))
	}

	awsCfg, err := config.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS/S3 config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
			o.UsePathStyle = true
		}
	})

	publicBase := strings.TrimRight(cfg.PublicURLBase, "/")
	if publicBase == "" {
		if cfg.Endpoint != "" {
			publicBase = fmt.Sprintf("%s/%s", strings.TrimRight(cfg.Endpoint, "/"), cfg.Bucket)
		} else {
			publicBase = fmt.Sprintf("https://%s.s3.%s.amazonaws.com", cfg.Bucket, region)
		}
	}

	return &S3Storage{
		client:        client,
		bucket:        cfg.Bucket,
		publicURLBase: publicBase,
	}, nil
}

func (s *S3Storage) Driver() string {
	return "s3"
}

func (s *S3Storage) Upload(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) (string, error) {
	input := &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(objectKey),
		Body:        reader,
		ContentType: aws.String(contentType),
	}

	if size > 0 {
		input.ContentLength = aws.Int64(size)
	}

	if _, err := s.client.PutObject(ctx, input); err != nil {
		return "", fmt.Errorf("s3 upload failed: %w", err)
	}

	return fmt.Sprintf("%s/%s", s.publicURLBase, objectKey), nil
}
