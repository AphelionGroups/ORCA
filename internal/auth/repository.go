package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
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

// CreateWithWorkspace atomically provisions an isolated workspace for a new owner.
func (r *Repository) CreateWithWorkspace(ctx context.Context, u *User) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `INSERT INTO workspaces (id,name,slug,owner_id) VALUES ($1,$2,$3,$4)`, u.WorkspaceID, u.FullName+"'s workspace", u.WorkspaceID.String(), u.ID)
	if err != nil {
		return fmt.Errorf("create workspace: %w", err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO users (id,workspace_id,email,password_hash,full_name,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, u.ID, u.WorkspaceID, strings.ToLower(u.Email), u.PasswordHash, u.FullName, u.CreatedAt, u.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create owner: %w", err)
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}
