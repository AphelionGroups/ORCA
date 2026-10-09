package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/google/uuid"
)

func TestChildCreationWaitsForParentDeletion(t *testing.T) {
	pool := integrationPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	workspace, space := uuid.New(), uuid.New()
	if _, err := pool.Exec(ctx, `INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'test',$2,$3)`, workspace, workspace.String(), uuid.New()); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,'test','test')`, space, workspace); err != nil {
		t.Fatal(err)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	if _, err := tx.Exec(ctx, `UPDATE spaces SET deleted_at=NOW() WHERE id=$1`, space); err != nil {
		t.Fatal(err)
	}
	result := make(chan error, 1)
	go func() {
		_, err := pool.Exec(ctx, `INSERT INTO projects(id,workspace_id,space_id,name)VALUES($1,$2,$3,'concurrent')`, uuid.New(), workspace, space)
		result <- err
	}()
	select {
	case err := <-result:
		t.Fatalf("reference validation did not wait for parent transaction: %v", err)
	case <-time.After(100 * time.Millisecond):
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-result:
		if err == nil {
			t.Fatal("created child under deleted parent")
		}
	case <-ctx.Done():
		t.Fatal("child creation remained blocked after parent commit")
	}
}
