package db_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/AphelionGroups/ORCA/internal/auth"
	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/AphelionGroups/ORCA/internal/task"
	"github.com/AphelionGroups/ORCA/migrations"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// These tests create and remove only their own uniquely named schema.
func integrationPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("ORCA_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("Set ORCA_TEST_DATABASE_URL to a PostgreSQL 16+ test database")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	schema := "orca_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err = admin.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, err := admin.Exec(context.Background(), `DROP SCHEMA `+schema+` CASCADE`)
		admin.Close()
		if err != nil {
			t.Errorf("cleanup test schema: %v", err)
		}
	})
	return pool
}
func TestMigrationsFreshAndLegacy(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		t.Run(fmt.Sprintf("legacy=%v", legacy), func(t *testing.T) {
			pool := integrationPool(t)
			ctx := context.Background()
			if legacy {
				if _, err := pool.Exec(ctx, migrations.InitSchemaSQL); err != nil {
					t.Fatal(err)
				}
			}
			if err := db.AutoMigrate(ctx, pool); err != nil {
				t.Fatal(err)
			}
			if err := db.AutoMigrate(ctx, pool); err != nil {
				t.Fatalf("repeat migration: %v", err)
			}
			var count int
			if err := pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations`).Scan(&count); err != nil || count != 2 {
				t.Fatalf("versions: %d %v", count, err)
			}
			if err := pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&count); err != nil || count != 0 {
				t.Fatal("production bootstrap contains demo account")
			}
		})
	}
}
func TestRegistrationAndTenantDataIsolation(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	secret := strings.Repeat("s", 32)
	handler := auth.NewHandler(auth.NewRepository(pool), secret)
	authMw := middleware.RequireAuth(secret, false)
	router := chi.NewRouter()
	router.Mount("/auth", handler.Routes(authMw))
	router.Group(func(r chi.Router) {
		r.Use(authMw)
		r.Use(middleware.WorkspaceContext)
		r.Mount("/tasks", task.NewHandler(task.NewRepository(pool)).Routes())
	})
	call := func(method, path, token, header string, payload any) *httptest.ResponseRecorder {
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(method, path, bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		if header != "" {
			req.Header.Set("X-Workspace-ID", header)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	register := func(email string) auth.AuthResponse {
		rec := call("POST", "/auth/register", "", "", map[string]string{"email": email, "password": "test-password-123", "full_name": "Test Owner"})
		if rec.Code != 201 {
			t.Fatalf("register: %d %s", rec.Code, rec.Body.String())
		}
		var response struct {
			Data auth.AuthResponse `json:"data"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		return response.Data
	}
	a, b := register("a@example.test"), register("b@example.test")
	if a.WorkspaceID == b.WorkspaceID {
		t.Fatal("registration shares workspace")
	}
	spaceA, spaceB, projectB, taskB, boardB := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	for _, entry := range []struct {
		ws, space uuid.UUID
		slug      string
	}{{a.WorkspaceID, spaceA, "a"}, {b.WorkspaceID, spaceB, "b"}} {
		if _, err := pool.Exec(ctx, `INSERT INTO spaces(id,workspace_id,name,slug) VALUES($1,$2,$3,$3)`, entry.space, entry.ws, entry.slug); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := pool.Exec(ctx, `INSERT INTO projects(id,workspace_id,space_id,name)VALUES($1,$2,$3,'project')`, projectB, b.WorkspaceID, spaceB); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO tasks(id,workspace_id,space_id,title)VALUES($1,$2,$3,'private B')`, taskB, b.WorkspaceID, spaceB); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO note_boards(id,workspace_id,space_id,title)VALUES($1,$2,$3,'private board')`, boardB, b.WorkspaceID, spaceB); err != nil {
		t.Fatal(err)
	}
	for _, method := range []string{"GET", "PUT", "DELETE"} {
		rec := call(method, "/tasks/"+taskB.String(), a.Token, "", map[string]string{"title": "overwrite"})
		if rec.Code != 404 {
			t.Fatalf("cross tenant %s: %d %s", method, rec.Code, rec.Body.String())
		}
	}
	rec := call("GET", "/tasks", a.Token, b.WorkspaceID.String(), nil)
	if rec.Code != 403 {
		t.Fatalf("header override: %d", rec.Code)
	}
	for _, payload := range []map[string]any{
		{"title": "bad space", "space_id": spaceB},
		{"title": "bad project", "space_id": spaceA, "project_id": projectB},
		{"title": "bad parent", "space_id": spaceA, "parent_task_id": taskB},
	} {
		rec = call("POST", "/tasks", a.Token, "", payload)
		if rec.Code != 400 {
			t.Fatalf("invalid relation: %d %s", rec.Code, rec.Body.String())
		}
	}
	rec = call("POST", "/tasks", a.Token, "", map[string]any{"title": "own task", "space_id": spaceA})
	if rec.Code != 201 {
		t.Fatalf("own task: %d %s", rec.Code, rec.Body.String())
	}
	for _, query := range []string{
		fmt.Sprintf(`INSERT INTO note_blocks(id,workspace_id,board_id,type)VALUES('%s','%s','%s','text')`, uuid.New(), a.WorkspaceID, boardB),
		fmt.Sprintf(`INSERT INTO events(id,workspace_id,linked_task_id,title,start_at,end_at)VALUES('%s','%s','%s','bad',NOW(),NOW())`, uuid.New(), a.WorkspaceID, taskB),
		fmt.Sprintf(`INSERT INTO entity_links(id,workspace_id,from_type,from_id,to_type,to_id)VALUES('%s','%s','task','%s','task','%s')`, uuid.New(), a.WorkspaceID, taskB, taskB),
	} {
		if _, err := pool.Exec(ctx, query); err == nil {
			t.Fatal("cross-tenant database reference accepted")
		}
	}
	var before, after int
	pool.QueryRow(ctx, `SELECT count(*) FROM workspaces`).Scan(&before)
	duplicate := call("POST", "/auth/register", "", "", map[string]string{"email": "A@example.test", "password": "test-password-123", "full_name": "Duplicate"})
	if duplicate.Code != 409 {
		t.Fatal("case-insensitive duplicate allowed")
	}
	pool.QueryRow(ctx, `SELECT count(*) FROM workspaces`).Scan(&after)
	if before != after {
		t.Fatal("failed registration left workspace behind")
	}
	handler.SetRegistrationEnabled(false)
	rec = call("POST", "/auth/register", "", "", map[string]string{})
	if rec.Code != http.StatusForbidden {
		t.Fatal("disabled registration accepted")
	}
}
func TestMigrationRejectsLegacyCrossTenantData(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, migrations.InitSchemaSQL); err != nil {
		t.Fatal(err)
	}
	a, b, owner, space, project := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	for _, id := range []uuid.UUID{a, b} {
		if _, err := pool.Exec(ctx, `INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'test',$2,$3)`, id, id.String(), owner); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := pool.Exec(ctx, `INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,'space','space')`, space, b); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO projects(id,workspace_id,space_id,name)VALUES($1,$2,$3,'invalid legacy')`, project, a, space); err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(ctx, pool); err == nil {
		t.Fatal("invalid legacy data migration succeeded")
	}
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM projects WHERE id=$1)`, project).Scan(&exists); err != nil || !exists {
		t.Fatal("failed migration removed user data")
	}
}
