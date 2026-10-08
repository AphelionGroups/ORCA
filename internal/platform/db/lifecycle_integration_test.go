package db_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/AphelionGroups/ORCA/internal/board"
	"github.com/AphelionGroups/ORCA/internal/calendar"
	"github.com/AphelionGroups/ORCA/internal/inbox"
	"github.com/AphelionGroups/ORCA/internal/link"
	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	projectrepo "github.com/AphelionGroups/ORCA/internal/project"
	spacerepo "github.com/AphelionGroups/ORCA/internal/space"
	taskrepo "github.com/AphelionGroups/ORCA/internal/task"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func TestLifecycleAndConcurrentConversion(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	workspace, space, project, boardID, block, parent, child, event, note := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, query, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'test',$2,$3)`, workspace, workspace.String(), uuid.New())
	exec(`INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,'test','test')`, space, workspace)
	exec(`INSERT INTO projects(id,workspace_id,space_id,name)VALUES($1,$2,$3,'test')`, project, workspace, space)
	exec(`INSERT INTO note_boards(id,workspace_id,space_id,project_id,title)VALUES($1,$2,$3,$4,'test')`, boardID, workspace, space, project)
	exec(`INSERT INTO note_blocks(id,workspace_id,board_id,type)VALUES($1,$2,$3,'sticky')`, block, workspace, boardID)
	exec(`INSERT INTO tasks(id,workspace_id,space_id,project_id,title)VALUES($1,$2,$3,$4,'parent')`, parent, workspace, space, project)
	exec(`INSERT INTO tasks(id,workspace_id,space_id,parent_task_id,title)VALUES($1,$2,$3,$4,'child')`, child, workspace, space, parent)
	exec(`INSERT INTO events(id,workspace_id,space_id,linked_task_id,title,start_at,end_at)VALUES($1,$2,$3,$4,'test',NOW(),NOW()+interval '1 hour')`, event, workspace, space, parent)
	for _, query := range []string{
		`UPDATE tasks SET status='invalid' WHERE id=$1`,
		`UPDATE tasks SET priority='invalid' WHERE id=$1`,
		`UPDATE tasks SET estimated_minutes=-1 WHERE id=$1`,
	} {
		if _, err := pool.Exec(ctx, query, parent); err == nil {
			t.Fatalf("invalid task accepted: %s", query)
		}
	}
	if _, err := pool.Exec(ctx, `UPDATE tasks SET parent_task_id=$1 WHERE id=$2`, child, parent); err == nil {
		t.Fatal("cyclic hierarchy accepted")
	}
	if _, err := pool.Exec(ctx, `UPDATE events SET end_at=start_at WHERE id=$1`, event); err == nil {
		t.Fatal("invalid event interval accepted")
	}
	// Exercise every read/merge/write repository with its version precondition.
	tasks := taskrepo.NewRepository(pool)
	taskRecord, err := tasks.GetByID(ctx, workspace, parent)
	if err != nil {
		t.Fatal(err)
	}
	taskRecord.Title = "Updated parent"
	if err := tasks.Update(ctx, taskRecord); err != nil {
		t.Fatal(err)
	}
	calendars := calendar.NewRepository(pool)
	eventRecord, err := calendars.GetByID(ctx, workspace, event)
	if err != nil {
		t.Fatal(err)
	}
	eventRecord.Title = "Updated event"
	if err := calendars.Update(ctx, eventRecord); err != nil {
		t.Fatal(err)
	}
	projects := projectrepo.NewRepository(pool)
	projectRecord, err := projects.GetByID(ctx, workspace, project)
	if err != nil {
		t.Fatal(err)
	}
	projectRecord.Name = "Updated project"
	if err := projects.Update(ctx, projectRecord); err != nil {
		t.Fatal(err)
	}
	spaces := spacerepo.NewRepository(pool)
	spaceRecord, err := spaces.GetByID(ctx, workspace, space)
	if err != nil {
		t.Fatal(err)
	}
	spaceRecord.Name = "Updated space"
	if err := spaces.Update(ctx, spaceRecord); err != nil {
		t.Fatal(err)
	}
	blocks := board.NewRepository(pool)
	boardRecord, err := blocks.GetBoardByID(ctx, workspace, boardID)
	if err != nil {
		t.Fatal(err)
	}
	boardRecord.Title = "Updated board"
	if err := blocks.UpdateBoard(ctx, boardRecord); err != nil {
		t.Fatal(err)
	}
	blockRecord, err := blocks.GetBlockByID(ctx, workspace, block)
	if err != nil {
		t.Fatal(err)
	}
	blockRecord.PosX = 20
	if err := blocks.UpdateBlock(ctx, blockRecord); err != nil {
		t.Fatal(err)
	}
	if err := blocks.DeleteBlock(ctx, workspace, block); err != nil {
		t.Fatal(err)
	}
	if _, err := blocks.RestoreBlock(ctx, uuid.New(), block); !errors.Is(err, httputil.ErrNotFound) {
		t.Fatalf("cross-tenant restore: %v", err)
	}
	restored, err := blocks.RestoreBlock(ctx, workspace, block)
	if err != nil || restored.ID != block {
		t.Fatalf("restore failed: %v", err)
	}
	links := link.NewRepository(pool)
	relation := link.EntityLink{WorkspaceID: workspace, FromType: "note_block", FromID: block, ToType: "task", ToID: parent, RelationType: "relates_to"}
	if err := links.Create(ctx, &relation); err != nil {
		t.Fatal(err)
	}
	duplicate := relation
	duplicate.ID = uuid.Nil
	if err := links.Create(ctx, &duplicate); err != nil || duplicate.ID != relation.ID {
		t.Fatalf("duplicate link returned a different ID: %v", err)
	}
	if err := links.Delete(ctx, workspace, relation.ID); err != nil {
		t.Fatal(err)
	}
	if err := links.Create(ctx, &duplicate); err != nil || duplicate.ID != relation.ID {
		t.Fatalf("link recreation lost identity: %v", err)
	}
	// Retry of a partially completed history operation is idempotent.
	if _, err := blocks.RestoreBlock(ctx, workspace, block); err != nil {
		t.Fatalf("repeated restore: %v", err)
	}
	exec(`INSERT INTO inbox_notes(id,workspace_id,content)VALUES($1,$2,'Concurrent conversion')`, note, workspace)
	repo := inbox.NewRepository(pool)
	results := make(chan error, 2)
	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := repo.ConvertToTask(ctx, workspace, note, inbox.ConvertToTaskRequest{SpaceID: space})
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	success, missing := 0, 0
	for err := range results {
		if err == nil {
			success++
		} else if errors.Is(err, pgx.ErrNoRows) {
			missing++
		} else {
			t.Fatal(err)
		}
	}
	if success != 1 || missing != 1 {
		t.Fatalf("conversion results: %d successes, %d missing", success, missing)
	}
	failedNote := uuid.New()
	exec(`INSERT INTO inbox_notes(id,workspace_id,content)VALUES($1,$2,'Keep on failure')`, failedNote, workspace)
	if _, err := repo.ConvertToTask(ctx, workspace, failedNote, inbox.ConvertToTaskRequest{SpaceID: uuid.New()}); err == nil {
		t.Fatal("invalid conversion accepted")
	}
	noteRecord, err := repo.GetByID(ctx, workspace, failedNote)
	if err != nil {
		t.Fatal(err)
	}
	noteRecord.Content = "Retained edited note"
	if err := repo.Update(ctx, noteRecord); err != nil {
		t.Fatal(err)
	}
	var retained bool
	if err := pool.QueryRow(ctx, `SELECT deleted_at IS NULL FROM inbox_notes WHERE id=$1`, failedNote).Scan(&retained); err != nil || !retained {
		t.Fatalf("failed conversion lost source note: %v", err)
	}
	exec(`UPDATE tasks SET deleted_at=NOW() WHERE id=$1`, parent)
	var linkDeleted bool
	if err := pool.QueryRow(ctx, `SELECT deleted_at IS NOT NULL FROM entity_links WHERE id=$1`, relation.ID).Scan(&linkDeleted); err != nil || !linkDeleted {
		t.Fatalf("link survived deleted endpoint: %v", err)
	}
	var deleted, unlinked bool
	if err := pool.QueryRow(ctx, `SELECT deleted_at IS NOT NULL FROM tasks WHERE id=$1`, child).Scan(&deleted); err != nil || !deleted {
		t.Fatalf("child survived deletion: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT linked_task_id IS NULL AND deleted_at IS NULL FROM events WHERE id=$1`, event).Scan(&unlinked); err != nil || !unlinked {
		t.Fatalf("event not detached: %v", err)
	}
	exec(`UPDATE spaces SET deleted_at=NOW() WHERE id=$1`, space)
	for _, table := range []string{"projects", "documents", "note_boards", "note_blocks", "tasks", "events"} {
		var count int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM `+table+` WHERE workspace_id=$1 AND deleted_at IS NULL`, workspace).Scan(&count); err != nil || count != 0 {
			t.Fatalf("active %s after cascade: %d %v", table, count, err)
		}
	}
	if _, err := blocks.RestoreBlock(ctx, workspace, block); err == nil {
		t.Fatal("restored block with deleted parent")
	}
}
