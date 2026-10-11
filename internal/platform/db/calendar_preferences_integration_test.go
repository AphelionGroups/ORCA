package db_test

import (
	"context"
	"github.com/AphelionGroups/ORCA/internal/auth"
	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/AphelionGroups/ORCA/migrations"
	"github.com/google/uuid"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCalendarPreferencesAreUserScoped(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	workspace, user := uuid.New(), uuid.New()
	if _, err := pool.Exec(ctx, `INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'preferences',$2,$3)`, workspace, workspace.String(), user); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users(id,workspace_id,email,password_hash,full_name)VALUES($1,$2,$3,'unused','Preferences')`, user, workspace, user.String()+"@test.local"); err != nil {
		t.Fatal(err)
	}
	handler := auth.NewHandler(auth.NewRepository(pool), "unused")
	call := func(body string, scope uuid.UUID) int {
		request := httptest.NewRequest("PUT", "/preferences", strings.NewReader(body))
		request = request.WithContext(context.WithValue(context.WithValue(ctx, middleware.UserIDKey, user), middleware.WorkspaceIDKey, scope))
		response := httptest.NewRecorder()
		handler.UpdatePreferences(response, request)
		return response.Code
	}
	if status := call(`{"calendar_timezone":"Asia/Jakarta"}`, workspace); status != 200 {
		t.Fatalf("save timezone: %d", status)
	}
	if status := call(`{"calendar_timezone":"Unknown/Invalid"}`, workspace); status != 400 {
		t.Fatalf("invalid timezone: %d", status)
	}
	if status := call(`{"calendar_timezone":"UTC"}`, uuid.New()); status != 404 {
		t.Fatalf("foreign workspace update: %d", status)
	}
	var zone string
	if err := pool.QueryRow(ctx, `SELECT calendar_timezone FROM users WHERE id=$1`, user).Scan(&zone); err != nil || zone != "Asia/Jakarta" {
		t.Fatalf("preference changed unexpectedly: %s %v", zone, err)
	}
}

func TestLegacyValidationDoesNotRewriteInvalidActiveData(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, migrations.InitSchemaSQL); err != nil {
		t.Fatal(err)
	}
	workspace, space, task := uuid.New(), uuid.New(), uuid.New()
	if _, err := pool.Exec(ctx, `INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'legacy',$2,$3)`, workspace, workspace.String(), uuid.New()); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,'legacy','legacy')`, space, workspace); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO tasks(id,workspace_id,space_id,title,status)VALUES($1,$2,$3,'legacy','custom-status')`, task, workspace, space); err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(ctx, pool); err == nil {
		t.Fatal("invalid active legacy data was silently accepted")
	}
	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM tasks WHERE id=$1`, task).Scan(&status); err != nil || status != "custom-status" {
		t.Fatalf("legacy value rewritten: %s %v", status, err)
	}
	var created bool
	if err := pool.QueryRow(ctx, `SELECT to_regclass('board_operations') IS NOT NULL`).Scan(&created); err != nil || created {
		t.Fatal("failed migration committed later schema changes")
	}
}
