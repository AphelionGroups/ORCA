package db_test

import (
	"context"
	"errors"
	"testing"

	"github.com/AphelionGroups/ORCA/internal/board"
	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/google/uuid"
)

func TestBoardOperationsAtomicHistoryAndScope(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	workspace, space, b1, b2, a, b, c := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'test',$2,$3)`, workspace, workspace.String(), uuid.New())
	exec(`INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,'test','test')`, space, workspace)
	for _, id := range []uuid.UUID{b1, b2} {
		exec(`INSERT INTO note_boards(id,workspace_id,space_id,title)VALUES($1,$2,$3,'test')`, id, workspace, space)
	}
	for _, id := range []uuid.UUID{a, b} {
		exec(`INSERT INTO note_blocks(id,workspace_id,board_id,type)VALUES($1,$2,$3,'card')`, id, workspace, b1)
	}
	exec(`INSERT INTO note_blocks(id,workspace_id,board_id,type)VALUES($1,$2,$3,'card')`, c, workspace, b2)
	repo := board.NewRepository(pool)
	create := board.OperationRequest{ID: uuid.New(), Mode: "apply", Connections: []board.ConnectionMutation{{Action: "create", Connection: board.Connection{FromID: a, ToID: b, FromSide: "right", ToSide: "left"}}}}
	graph, err := repo.ApplyOperation(ctx, workspace, b1, create)
	if err != nil || len(graph.Connections) != 1 {
		t.Fatalf("create connector: %v", err)
	}
	linkID := graph.Connections[0].ID
	manuallyDeletedLink := uuid.New()
	exec(`INSERT INTO entity_links(id,workspace_id,from_type,from_id,to_type,to_id,relation_type,deleted_at)VALUES($1,$2,'note_block',$3,'note_block',$4,'connects_to',NOW())`, manuallyDeletedLink, workspace, b, a)
	again, err := repo.ApplyOperation(ctx, workspace, b1, create)
	if err != nil || len(again.Connections) != 1 || again.Connections[0].ID != linkID {
		t.Fatalf("retry duplicated connector: %v", err)
	}
	deletion := board.OperationRequest{ID: uuid.New(), Mode: "apply", Blocks: []board.BlockMutation{{ID: a, Action: "delete"}, {ID: b, Action: "delete"}}}
	graph, err = repo.ApplyOperation(ctx, workspace, b1, deletion)
	if err != nil || len(graph.Blocks) != 0 || len(graph.Connections) != 0 {
		t.Fatalf("delete graph: %v", err)
	}
	graph, err = repo.ApplyOperation(ctx, workspace, b1, board.OperationRequest{ID: deletion.ID, Mode: "undo"})
	if err != nil || len(graph.Blocks) != 2 || len(graph.Connections) != 1 || graph.Connections[0].ID != linkID {
		t.Fatalf("undo lost connector identity: %v", err)
	}
	var remainsDeleted bool
	if err = pool.QueryRow(ctx, `SELECT deleted_at IS NOT NULL FROM entity_links WHERE id=$1`, manuallyDeletedLink).Scan(&remainsDeleted); err != nil || !remainsDeleted {
		t.Fatal("undo restored a previously deleted connector")
	}
	graph, err = repo.ApplyOperation(ctx, workspace, b1, board.OperationRequest{ID: deletion.ID, Mode: "redo"})
	if err != nil || len(graph.Blocks) != 0 {
		t.Fatalf("redo: %v", err)
	}
	if _, err = repo.ApplyOperation(ctx, workspace, b1, board.OperationRequest{ID: deletion.ID, Mode: "undo"}); err != nil {
		t.Fatal(err)
	}
	// Earlier history must remain usable after later operations are undone.
	if _, err = repo.ApplyOperation(ctx, workspace, b1, board.OperationRequest{ID: create.ID, Mode: "undo"}); err != nil {
		t.Fatalf("consecutive undo: %v", err)
	}
	if _, err = repo.ApplyOperation(ctx, workspace, b1, board.OperationRequest{ID: create.ID, Mode: "redo"}); err != nil {
		t.Fatalf("consecutive redo: %v", err)
	}
	duplicate := board.OperationRequest{ID: uuid.New(), Mode: "apply", Connections: []board.ConnectionMutation{{Action: "create", Connection: board.Connection{ID: uuid.New(), FromID: a, ToID: b}}}}
	if _, err = repo.ApplyOperation(ctx, workspace, b1, duplicate); !errors.Is(err, httputil.ErrConflict) {
		t.Fatalf("mismatched connector identity: %v", err)
	}
	invalid := board.OperationRequest{ID: uuid.New(), Mode: "apply", Blocks: []board.BlockMutation{{ID: a, Action: "delete"}, {ID: c, Action: "delete"}}}
	if _, err = repo.ApplyOperation(ctx, workspace, b1, invalid); err == nil {
		t.Fatal("cross-board batch accepted")
	}
	var active bool
	if err = pool.QueryRow(ctx, `SELECT deleted_at IS NULL FROM note_blocks WHERE id=$1`, a).Scan(&active); err != nil || !active {
		t.Fatal("partial batch was committed")
	}
	foreign := board.OperationRequest{ID: uuid.New(), Mode: "apply", Connections: []board.ConnectionMutation{{Action: "create", Connection: board.Connection{FromID: a, ToID: c}}}}
	if _, err = repo.ApplyOperation(ctx, workspace, b1, foreign); err == nil {
		t.Fatal("cross-board connector accepted")
	}
	if _, err = repo.ApplyOperation(ctx, uuid.New(), b1, create); !errors.Is(err, httputil.ErrNotFound) {
		t.Fatalf("tenant operation leaked: %v", err)
	}
	x := 44.0
	move := board.OperationRequest{ID: uuid.New(), Mode: "apply", Blocks: []board.BlockMutation{{ID: a, Action: "update", Patch: board.UpdateBlockRequest{PosX: &x}}}}
	if _, err = repo.ApplyOperation(ctx, workspace, b1, move); err != nil {
		t.Fatal(err)
	}
	exec(`UPDATE note_blocks SET pos_x=80,updated_at=clock_timestamp() WHERE id=$1`, a)
	if _, err = repo.ApplyOperation(ctx, workspace, b1, board.OperationRequest{ID: move.ID, Mode: "undo"}); !errors.Is(err, httputil.ErrConflict) {
		t.Fatalf("stale undo overwrote edit: %v", err)
	}
	var before string
	if err = pool.QueryRow(ctx, `SELECT updated_at::text FROM note_boards WHERE id=$1`, b1).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if err = repo.SaveViewport(ctx, workspace, b1, board.Viewport{X: 30, Y: -50, Zoom: 0.9}); err != nil {
		t.Fatal(err)
	}
	var after string
	if err = pool.QueryRow(ctx, `SELECT updated_at::text FROM note_boards WHERE id=$1`, b1).Scan(&after); err != nil || before != after {
		t.Fatal("viewport changed board metadata version")
	}
}
