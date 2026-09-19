package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Pool struct {
	*pgxpool.Pool
}

func NewPostgresPool(ctx context.Context, connString string, maxConns, minConns int32, maxConnLifetime time.Duration) (*Pool, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("db.NewPostgresPool parse config: %w", err)
	}

	config.MaxConns = maxConns
	config.MinConns = minConns
	config.MaxConnLifetime = maxConnLifetime

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("db.NewPostgresPool create pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		// Log warning but don't strictly fatal if db is still spinning up
		return &Pool{Pool: pool}, fmt.Errorf("db.NewPostgresPool ping: %w", err)
	}

	return &Pool{Pool: pool}, nil
}
