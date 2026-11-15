package db_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/AphelionGroups/ORCA/internal/platform/storage"
	taskrepo "github.com/AphelionGroups/ORCA/internal/task"
	"github.com/AphelionGroups/ORCA/internal/transfer"
	"github.com/google/uuid"
)

func TestTaskDelegationAPIAndPortableCopy(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	ws, other, space := uuid.New(), uuid.New(), uuid.New()
	for _, workspace := range []uuid.UUID{ws, other} {
		if _, err := pool.Exec(ctx, `INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'Delegation',$2,$3)`, workspace, workspace.String(), uuid.New()); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := pool.Exec(ctx, `INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,'Studio','studio')`, space, ws); err != nil {
		t.Fatal(err)
	}
	repo := taskrepo.NewRepository(pool)
	routes := taskrepo.NewHandler(repo).Routes()
	request := func(method, path string, body any, want int) []byte {
		t.Helper()
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		r := httptest.NewRequest(method, path, bytes.NewReader(data))
		r = r.WithContext(context.WithValue(r.Context(), middleware.WorkspaceIDKey, ws))
		w := httptest.NewRecorder()
		routes.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("%s %s: %d %s", method, path, w.Code, w.Body.String())
		}
		return w.Body.Bytes()
	}
	decode := func(body []byte) *taskrepo.Task {
		t.Helper()
		var result struct {
			Data taskrepo.Task `json:"data"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			t.Fatal(err)
		}
		return &result.Data
	}
	task := decode(request("POST", "/", map[string]any{"title": "Review design", "space_id": space, "delegated_to": "  Dimas  ", "follow_up_date": "2026-11-15", "delegation_note": "  Wait for mobile review  ", "due_date": "2026-11-20T00:00:00Z"}, 201))
	if task.DelegatedTo == nil || *task.DelegatedTo != "Dimas" || task.FollowUpDate == nil || task.FollowUpDate.Format("2006-01-02") != "2026-11-15" || task.DelegationNote == nil || *task.DelegationNote != "Wait for mobile review" {
		t.Fatalf("delegation did not round-trip: %+v", task)
	}
	child := decode(request("POST", "/", map[string]any{"title": "Child", "space_id": space, "parent_task_id": task.ID}, 201))
	if child.DelegatedTo != nil || child.FollowUpDate != nil || child.DelegationNote != nil {
		t.Fatal("child inherited delegation")
	}
	for filter, wantID := range map[string]uuid.UUID{"true": task.ID, "false": child.ID} {
		var result struct {
			Data []taskrepo.Task `json:"data"`
		}
		if err := json.Unmarshal(request("GET", "/?delegated="+filter, nil, 200), &result); err != nil || len(result.Data) != 1 || result.Data[0].ID != wantID {
			t.Fatalf("invalid delegated filter: %s %+v %v", filter, result, err)
		}
	}
	request("GET", "/?delegated=invalid", nil, 400)
	request("PUT", "/"+task.ID.String(), map[string]any{"follow_up_date": "2026-02-31"}, 400)
	request("POST", "/", map[string]any{"title": "Invalid", "space_id": space, "follow_up_date": "2026-11-15"}, 400)
	request("POST", "/", map[string]any{"title": "Invalid", "space_id": space, "delegated_to": "  ", "delegation_note": "orphan"}, 400)
	request("PUT", "/"+task.ID.String(), map[string]any{"delegation_note": strings.Repeat("x", 4001)}, 400)
	done := decode(request("PATCH", "/"+task.ID.String()+"/status", map[string]any{"status": "done", "expected_updated_at": task.UpdatedAt}, 200))
	if done.DelegatedTo == nil || done.FollowUpDate == nil {
		t.Fatal("status change erased delegation context")
	}
	cleared := decode(request("PUT", "/"+task.ID.String(), map[string]any{"delegated_to": nil, "expected_updated_at": done.UpdatedAt}, 200))
	if cleared.DelegatedTo != nil || cleared.FollowUpDate != nil || cleared.DelegationNote != nil || cleared.DueDate == nil || !cleared.DueDate.Equal(*task.DueDate) {
		t.Fatal("removing delegation must clear its metadata and preserve the deadline")
	}
	request("PUT", "/"+task.ID.String(), map[string]any{"title": "stale", "expected_updated_at": done.UpdatedAt}, 409)
	restored := decode(request("PUT", "/"+task.ID.String(), map[string]any{"delegated_to": "Rani", "follow_up_date": "2026-11-18", "delegation_note": "Ready for review", "status": "in_review", "expected_updated_at": cleared.UpdatedAt}, 200))
	if _, err := pool.Exec(ctx, `UPDATE tasks SET delegated_to=NULL WHERE id=$1`, task.ID); err == nil {
		t.Fatal("database accepted an orphan follow-up")
	}
	if got, err := repo.GetByID(ctx, other, task.ID); err != nil || got != nil {
		t.Fatal("delegation crossed tenant boundary")
	}
	store, err := storage.NewLocalStorage(t.TempDir(), "/uploads")
	if err != nil {
		t.Fatal(err)
	}
	service := transfer.NewService(pool, store)
	p, err := service.Export(ctx, ws, transfer.Scope{Kind: "space", ID: space.String()})
	if err != nil {
		t.Fatal(err)
	}
	data, err := transfer.Encode(p)
	if err != nil {
		t.Fatal(err)
	}
	copy, err := service.Import(ctx, other, uuid.New(), data, transfer.Destination{})
	if err != nil {
		t.Fatal(err)
	}
	copied, err := repo.GetByID(ctx, other, uuid.MustParse(copy.IDs[task.ID.String()]))
	if err != nil || copied == nil || copied.DelegatedTo == nil || *copied.DelegatedTo != "Rani" || copied.DelegationNote == nil || *copied.DelegationNote != "Ready for review" || !copied.FollowUpDate.Equal(*restored.FollowUpDate) {
		t.Fatalf("portable copy lost delegation: %+v %v", copied, err)
	}
	for _, row := range p.Entities["tasks"] {
		delete(row, "delegated_to")
		delete(row, "follow_up_date")
		delete(row, "delegation_note")
	}
	legacy, err := transfer.Encode(p)
	if err != nil {
		t.Fatal(err)
	}
	oldCopy, err := service.Import(ctx, other, uuid.New(), legacy, transfer.Destination{})
	if err != nil {
		t.Fatal(err)
	}
	old, err := repo.GetByID(ctx, other, uuid.MustParse(oldCopy.IDs[task.ID.String()]))
	if err != nil || old.DelegatedTo != nil || old.FollowUpDate != nil {
		t.Fatal("old package compatibility failed")
	}
}
