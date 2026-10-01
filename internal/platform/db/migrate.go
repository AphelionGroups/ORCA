package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AphelionGroups/ORCA/migrations"
)

// AutoMigrate runs the embedded database migrations against the connection pool.
// Safe to run idempotently on every startup.
func AutoMigrate(ctx context.Context, pool *pgxpool.Pool) error {
	log.Println("[ORCA-MIGRATE] Checking database schema & running automatic migrations...")

	execCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if _, err := pool.Exec(execCtx, migrations.InitSchemaSQL); err != nil {
		return fmt.Errorf("auto-migration failed: %w", err)
	}

	log.Println("[ORCA-MIGRATE] Database schema verified and up-to-date!")
	return nil
}
