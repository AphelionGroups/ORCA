package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AphelionGroups/ORCA/internal/platform/config"
)

func main() {
	cfg := config.Load()
	log.Printf("[ORCA-MIGRATE] Connecting to PostgreSQL at %s ...", cfg.DatabaseURL)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[ORCA-MIGRATE-ERROR] Failed to configure pool: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("[ORCA-MIGRATE-ERROR] Database ping failed: %v", err)
	}
	log.Println("[ORCA-MIGRATE] Database connected successfully!")

	sqlBytes, err := os.ReadFile("migrations/000001_init_schema.up.sql")
	if err != nil {
		log.Fatalf("[ORCA-MIGRATE-ERROR] Failed to read migrations/000001_init_schema.up.sql: %v", err)
	}

	log.Println("[ORCA-MIGRATE] Executing 000001_init_schema.up.sql ...")
	if _, err := pool.Exec(ctx, string(sqlBytes)); err != nil {
		log.Fatalf("[ORCA-MIGRATE-ERROR] Failed to execute migration: %v", err)
	}

	log.Println("[ORCA-MIGRATE-SUCCESS] All 10 tables, indexes, and default seed data have been successfully migrated!")
}
