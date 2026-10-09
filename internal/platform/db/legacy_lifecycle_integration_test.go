package db_test

import (
	"context"
	"testing"

	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/migrations"
	"github.com/google/uuid"
)

func TestMigrationRepairsLegacyDeletedParent(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, migrations.InitSchemaSQL); err != nil {
		t.Fatal(err)
	}
	workspace, space, project, board, block, task := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'legacy',$2,$3)`, workspace, workspace.String(), uuid.New())
	exec(`INSERT INTO spaces(id,workspace_id,name,slug,deleted_at)VALUES($1,$2,'legacy','legacy',NOW())`, space, workspace)
	exec(`INSERT INTO projects(id,workspace_id,space_id,name)VALUES($1,$2,$3,'legacy')`, project, workspace, space)
	exec(`INSERT INTO note_boards(id,workspace_id,space_id,project_id,title)VALUES($1,$2,$3,$4,'legacy')`, board, workspace, space, project)
	exec(`INSERT INTO note_blocks(id,workspace_id,board_id,type)VALUES($1,$2,$3,'sticky')`, block, workspace, board)
	// An invalid legacy task must still be soft-deletable during repair.
	exec(`INSERT INTO tasks(id,workspace_id,space_id,project_id,title,status)VALUES($1,$2,$3,$4,'legacy','old-custom-status')`, task, workspace, space, project)
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"projects", "note_boards", "note_blocks", "tasks"} {
		var active, total int
		if err := pool.QueryRow(ctx, `SELECT count(*) FILTER(WHERE deleted_at IS NULL),count(*) FROM `+table+` WHERE workspace_id=$1`, workspace).Scan(&active, &total); err != nil || active != 0 || total != 1 {
			t.Fatalf("legacy %s: active=%d total=%d err=%v", table, active, total, err)
		}
	}
}
