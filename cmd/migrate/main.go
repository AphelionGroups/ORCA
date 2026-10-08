package main

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AphelionGroups/ORCA/internal/platform/config"
	"github.com/AphelionGroups/ORCA/internal/platform/db"
)

func main() {
	cfg := config.Load()
	log.Println("[ORCA-MIGRATE] Connecting to PostgreSQL ...")

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

	if err := db.AutoMigrate(ctx, pool); err != nil {
		log.Fatalf("[ORCA-MIGRATE-ERROR] %v", err)
	}
	log.Println("[ORCA-MIGRATE-SUCCESS] All versioned migrations applied.")
}
