package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port               string
	Env                string
	DatabaseURL        string
	DBMaxConns         int32
	DBMinConns         int32
	DBMaxConnLifetime  time.Duration
	CORSAllowedOrigins []string

	// Auto Migration
	AutoMigrate bool

	// Auth & Security
	JWTSecret               string
	AllowDevWorkspaceHeader bool
	AllowRegistration       bool

	// Object Storage (Supabase, Cloudflare R2, AWS S3, MinIO, or Local)
	StorageDriver          string // "auto", "s3", or "local"
	StorageS3Endpoint      string
	StorageS3Bucket        string
	StorageS3Region        string
	StorageS3AccessKey     string
	StorageS3SecretKey     string
	StorageS3PublicURLBase string
	StorageLocalDir        string
}

func Load() *Config {
	return &Config{
		Port:               getEnv("PORT", "8080"),
		Env:                getEnv("ENV", "development"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://orca:orca_secret@localhost:5432/orca_db?sslmode=disable"),
		DBMaxConns:         getEnvAsInt32("DB_MAX_CONNS", 25),
		DBMinConns:         getEnvAsInt32("DB_MIN_CONNS", 5),
		DBMaxConnLifetime:  getEnvAsDuration("DB_MAX_CONN_LIFETIME", 1*time.Hour),
		CORSAllowedOrigins: getEnvAsSlice("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"}),

		AutoMigrate:             getEnvAsBool("AUTO_MIGRATE", true),
		JWTSecret:               getEnv("JWT_SECRET", "orca_super_secret_jwt_key_2026_change_in_production"),
		AllowDevWorkspaceHeader: getEnvAsBool("ALLOW_DEV_WORKSPACE_HEADER", false),
		AllowRegistration:       getEnvAsBool("ALLOW_REGISTRATION", true),

		StorageDriver:          getEnv("STORAGE_DRIVER", "auto"),
		StorageS3Endpoint:      getEnv("STORAGE_S3_ENDPOINT", ""),
		StorageS3Bucket:        getEnv("STORAGE_S3_BUCKET", ""),
		StorageS3Region:        getEnv("STORAGE_S3_REGION", "auto"),
		StorageS3AccessKey:     getEnv("STORAGE_S3_ACCESS_KEY", ""),
		StorageS3SecretKey:     getEnv("STORAGE_S3_SECRET_KEY", ""),
		StorageS3PublicURLBase: getEnv("STORAGE_S3_PUBLIC_URL_BASE", ""),
		StorageLocalDir:        getEnv("STORAGE_LOCAL_DIR", "./uploads"),
	}
}

func getEnvAsBool(key string, fallback bool) bool {
	if val := os.Getenv(key); val != "" {
		if b, err := strconv.ParseBool(val); err == nil {
			return b
		}
	}
	return fallback
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvAsInt32(key string, fallback int32) int32 {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.ParseInt(val, 10, 32); err == nil {
			return int32(intVal)
		}
	}
	return fallback
}

func getEnvAsDuration(key string, fallback time.Duration) time.Duration {
	if val := os.Getenv(key); val != "" {
		if d, err := time.ParseDuration(val); err == nil {
			return d
		}
	}
	return fallback
}

func getEnvAsSlice(key string, fallback []string) []string {
	if val := os.Getenv(key); val != "" {
		parts := strings.Split(val, ",")
		res := make([]string, 0, len(parts))
		for _, p := range parts {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				res = append(res, trimmed)
			}
		}
		if len(res) > 0 {
			return res
		}
	}
	return fallback
}

// Validate refuses unsafe production defaults before any service is started.
func (c *Config) Validate() error {
	if c.Env != "development" && c.Env != "production" && c.Env != "test" {
		return fmt.Errorf("ENV must be development, production, or test")
	}
	if c.Env != "development" && (len(c.JWTSecret) < 32 || c.JWTSecret == "orca_super_secret_jwt_key_2026_change_in_production" || c.JWTSecret == "replace-with-a-random-secret-of-at-least-32-bytes") {
		return fmt.Errorf("JWT_SECRET must be a unique secret of at least 32 bytes outside development")
	}
	if c.AllowDevWorkspaceHeader && c.Env != "development" {
		return fmt.Errorf("ALLOW_DEV_WORKSPACE_HEADER is only permitted in development")
	}
	if c.DBMinConns < 0 || c.DBMaxConns < 1 || c.DBMinConns > c.DBMaxConns {
		return fmt.Errorf("invalid database pool limits")
	}
	return nil
}
