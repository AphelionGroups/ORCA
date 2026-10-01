package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("email is already registered")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) GetByEmail(ctx context.Context, email string) (*User, error) {
	query := `
		SELECT id, workspace_id, email, password_hash, full_name, avatar_url, created_at, updated_at, deleted_at
		FROM users
		WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL
		LIMIT 1;
	`
	var u User
	err := r.pool.QueryRow(ctx, query, email).Scan(
		&u.ID,
		&u.WorkspaceID,
		&u.Email,
		&u.PasswordHash,
		&u.FullName,
		&u.AvatarURL,
		&u.CreatedAt,
		&u.UpdatedAt,
		&u.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("auth.repo.GetByEmail: %w", err)
	}
	return &u, nil
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	query := `
		SELECT id, workspace_id, email, password_hash, full_name, avatar_url, created_at, updated_at, deleted_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
		LIMIT 1;
	`
	var u User
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&u.ID,
		&u.WorkspaceID,
		&u.Email,
		&u.PasswordHash,
		&u.FullName,
		&u.AvatarURL,
		&u.CreatedAt,
		&u.UpdatedAt,
		&u.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("auth.repo.GetByID: %w", err)
	}
	return &u, nil
}

func (r *Repository) Create(ctx context.Context, u *User) error {
	query := `
		INSERT INTO users (id, workspace_id, email, password_hash, full_name, avatar_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
	`
	now := time.Now()
	if u.CreatedAt.IsZero() {
		u.CreatedAt = now
	}
	u.UpdatedAt = now

	_, err := r.pool.Exec(ctx, query,
		u.ID,
		u.WorkspaceID,
		u.Email,
		u.PasswordHash,
		u.FullName,
		u.AvatarURL,
		u.CreatedAt,
		u.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("auth.repo.Create: %w", err)
	}
	return nil
}

func (r *Repository) UpdateProfile(ctx context.Context, id uuid.UUID, fullName, email string, avatarURL *string) error {
	query := `
		UPDATE users
		SET full_name = $1, email = $2, avatar_url = $3, updated_at = NOW()
		WHERE id = $4 AND deleted_at IS NULL;
	`
	cmd, err := r.pool.Exec(ctx, query, fullName, email, avatarURL, id)
	if err != nil {
		return fmt.Errorf("auth.repo.UpdateProfile: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *Repository) UpdatePassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	query := `
		UPDATE users
		SET password_hash = $1, updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL;
	`
	cmd, err := r.pool.Exec(ctx, query, passwordHash, id)
	if err != nil {
		return fmt.Errorf("auth.repo.UpdatePassword: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *Repository) GetDefaultWorkspaceID(ctx context.Context) (uuid.UUID, error) {
	query := `SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1;`
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, query).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Fallback to default personal workspace
			return uuid.MustParse("018f0000-0000-7000-8000-000000000001"), nil
		}
		return uuid.Nil, fmt.Errorf("auth.repo.GetDefaultWorkspaceID: %w", err)
	}
	return id, nil
}
