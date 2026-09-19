package board

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// ----------------- BOARDS -----------------

func (r *Repository) ListBoards(ctx context.Context, workspaceID uuid.UUID, spaceID *uuid.UUID, projectID *uuid.UUID) ([]NoteBoard, error) {
	query := `
		SELECT id, workspace_id, space_id, project_id, title, viewport_state, created_at, updated_at
		FROM note_boards
		WHERE workspace_id = $1 AND deleted_at IS NULL
	`
	args := []any{workspaceID}
	argIdx := 2

	if spaceID != nil && *spaceID != uuid.Nil {
		query += fmt.Sprintf(" AND space_id = $%d", argIdx)
		args = append(args, *spaceID)
		argIdx++
	}

	if projectID != nil && *projectID != uuid.Nil {
		query += fmt.Sprintf(" AND project_id = $%d", argIdx)
		args = append(args, *projectID)
		argIdx++
	}

	query += " ORDER BY updated_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("board.ListBoards: %w", err)
	}
	defer rows.Close()

	boards := make([]NoteBoard, 0)
	for rows.Next() {
		var b NoteBoard
		err := rows.Scan(
			&b.ID, &b.WorkspaceID, &b.SpaceID, &b.ProjectID, &b.Title, &b.ViewportState, &b.CreatedAt, &b.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("board.ListBoards scan: %w", err)
		}
		boards = append(boards, b)
	}
	return boards, nil
}

func (r *Repository) GetBoardByID(ctx context.Context, workspaceID, id uuid.UUID) (*NoteBoard, error) {
	query := `
		SELECT id, workspace_id, space_id, project_id, title, viewport_state, created_at, updated_at
		FROM note_boards
		WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
	`
	var b NoteBoard
	err := r.pool.QueryRow(ctx, query, workspaceID, id).Scan(
		&b.ID, &b.WorkspaceID, &b.SpaceID, &b.ProjectID, &b.Title, &b.ViewportState, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("board.GetBoardByID: %w", err)
	}
	return &b, nil
}

func (r *Repository) CreateBoard(ctx context.Context, b *NoteBoard) error {
	if b.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("board.CreateBoard uuidv7: %w", err)
		}
		b.ID = newID
	}
	now := time.Now().UTC()
	b.CreatedAt = now
	b.UpdatedAt = now

	if len(b.ViewportState) == 0 {
		b.ViewportState = json.RawMessage(`{"x": 0, "y": 0, "zoom": 1}`)
	}

	query := `
		INSERT INTO note_boards (id, workspace_id, space_id, project_id, title, viewport_state, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.pool.Exec(ctx, query,
		b.ID, b.WorkspaceID, b.SpaceID, b.ProjectID, b.Title, b.ViewportState, b.CreatedAt, b.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("board.CreateBoard exec: %w", err)
	}
	return nil
}

func (r *Repository) UpdateBoard(ctx context.Context, b *NoteBoard) error {
	b.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE note_boards
		SET project_id = $1, title = $2, viewport_state = $3, updated_at = $4
		WHERE workspace_id = $5 AND id = $6 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query,
		b.ProjectID, b.Title, b.ViewportState, b.UpdatedAt, b.WorkspaceID, b.ID,
	)
	if err != nil {
		return fmt.Errorf("board.UpdateBoard exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("board not found or already deleted")
	}
	return nil
}

func (r *Repository) DeleteBoard(ctx context.Context, workspaceID, id uuid.UUID) error {
	now := time.Now().UTC()
	query := `
		UPDATE note_boards
		SET deleted_at = $1, updated_at = $1
		WHERE workspace_id = $2 AND id = $3 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, now, workspaceID, id)
	if err != nil {
		return fmt.Errorf("board.DeleteBoard exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("board not found or already deleted")
	}
	return nil
}

// ----------------- NOTE BLOCKS -----------------

func (r *Repository) ListBlocksByBoard(ctx context.Context, workspaceID, boardID uuid.UUID) ([]NoteBlock, error) {
	query := `
		SELECT id, board_id, workspace_id, type, pos_x, pos_y, width, height, content, created_at, updated_at
		FROM note_blocks
		WHERE workspace_id = $1 AND board_id = $2 AND deleted_at IS NULL
		ORDER BY created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, workspaceID, boardID)
	if err != nil {
		return nil, fmt.Errorf("board.ListBlocksByBoard: %w", err)
	}
	defer rows.Close()

	blocks := make([]NoteBlock, 0)
	for rows.Next() {
		var nb NoteBlock
		err := rows.Scan(
			&nb.ID, &nb.BoardID, &nb.WorkspaceID, &nb.Type, &nb.PosX, &nb.PosY,
			&nb.Width, &nb.Height, &nb.Content, &nb.CreatedAt, &nb.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("board.ListBlocksByBoard scan: %w", err)
		}
		blocks = append(blocks, nb)
	}
	return blocks, nil
}

func (r *Repository) GetBlockByID(ctx context.Context, workspaceID, id uuid.UUID) (*NoteBlock, error) {
	query := `
		SELECT id, board_id, workspace_id, type, pos_x, pos_y, width, height, content, created_at, updated_at
		FROM note_blocks
		WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
	`
	var nb NoteBlock
	err := r.pool.QueryRow(ctx, query, workspaceID, id).Scan(
		&nb.ID, &nb.BoardID, &nb.WorkspaceID, &nb.Type, &nb.PosX, &nb.PosY,
		&nb.Width, &nb.Height, &nb.Content, &nb.CreatedAt, &nb.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("board.GetBlockByID: %w", err)
	}
	return &nb, nil
}

func (r *Repository) CreateBlock(ctx context.Context, nb *NoteBlock) error {
	if nb.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("board.CreateBlock uuidv7: %w", err)
		}
		nb.ID = newID
	}
	now := time.Now().UTC()
	nb.CreatedAt = now
	nb.UpdatedAt = now

	if len(nb.Content) == 0 {
		nb.Content = json.RawMessage(`{}`)
	}

	query := `
		INSERT INTO note_blocks (id, board_id, workspace_id, type, pos_x, pos_y, width, height, content, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.pool.Exec(ctx, query,
		nb.ID, nb.BoardID, nb.WorkspaceID, nb.Type, nb.PosX, nb.PosY, nb.Width, nb.Height, nb.Content, nb.CreatedAt, nb.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("board.CreateBlock exec: %w", err)
	}
	return nil
}

func (r *Repository) UpdateBlock(ctx context.Context, nb *NoteBlock) error {
	nb.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE note_blocks
		SET type = $1, pos_x = $2, pos_y = $3, width = $4, height = $5, content = $6, updated_at = $7
		WHERE workspace_id = $8 AND id = $9 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query,
		nb.Type, nb.PosX, nb.PosY, nb.Width, nb.Height, nb.Content, nb.UpdatedAt, nb.WorkspaceID, nb.ID,
	)
	if err != nil {
		return fmt.Errorf("board.UpdateBlock exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("note block not found or already deleted")
	}
	return nil
}

func (r *Repository) DeleteBlock(ctx context.Context, workspaceID, id uuid.UUID) error {
	now := time.Now().UTC()
	query := `
		UPDATE note_blocks
		SET deleted_at = $1, updated_at = $1
		WHERE workspace_id = $2 AND id = $3 AND deleted_at IS NULL
	`
	res, err := r.pool.Exec(ctx, query, now, workspaceID, id)
	if err != nil {
		return fmt.Errorf("board.DeleteBlock exec: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("note block not found or already deleted")
	}
	return nil
}
