package db_test

import (
	"context"
	"sync"
	"testing"

	"errors"
	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	taskrepo "github.com/AphelionGroups/ORCA/internal/task"
	"github.com/google/uuid"
)

func TestSubtaskLifecycle(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	ws, space, project := uuid.New(), uuid.New(), uuid.New()
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO workspaces(id,name,slug,owner_id) VALUES($1,'subtasks',$2,$3)`, []any{ws, ws.String(), uuid.New()}},
		{`INSERT INTO spaces(id,workspace_id,name,slug) VALUES($1,$2,'test','test')`, []any{space, ws}},
		{`INSERT INTO projects(id,workspace_id,space_id,name) VALUES($1,$2,$3,'test')`, []any{project, ws, space}},
	} {
		if _, err := pool.Exec(ctx, q.sql, q.args...); err != nil {
			t.Fatal(err)
		}
	}
	repo := taskrepo.NewRepository(pool)
	create := func(title string, parent *uuid.UUID) *taskrepo.Task {
		t.Helper()
		task := &taskrepo.Task{WorkspaceID: ws, SpaceID: space, ParentTaskID: parent, Title: title}
		if parent == nil {
			task.ProjectID = &project
		}
		if err := repo.Create(ctx, task); err != nil {
			t.Fatal(err)
		}
		return task
	}
	get := func(id uuid.UUID) *taskrepo.Task {
		t.Helper()
		task, err := repo.GetByID(ctx, ws, id)
		if err != nil || task == nil {
			t.Fatalf("get task: %v", err)
		}
		return task
	}
	update := func(task *taskrepo.Task) {
		t.Helper()
		if err := repo.Update(ctx, task); err != nil {
			t.Fatal(err)
		}
	}
	assertStatus := func(id uuid.UUID, want string) {
		t.Helper()
		if got := get(id).Status; got != want {
			t.Fatalf("status = %s, want %s", got, want)
		}
	}
	parent := create("parent", nil)
	a := create("first", &parent.ID)
	b := create("second", &parent.ID)
	if a.ProjectID == nil || *a.ProjectID != project || a.ParentTitle == nil || *a.ParentTitle != "parent" {
		t.Fatal("child did not inherit scope/context")
	}
	p := get(parent.ID)
	if p.SubtaskCount != 2 || p.DescendantCount != 2 {
		t.Fatalf("wrong summary: %+v", p)
	}
	a.Status = "done"
	update(a)
	b.Status = "done"
	update(b)
	assertStatus(parent.ID, "todo")
	p = get(parent.ID)
	p.AutoCompleteSubtasks = true
	update(p)
	assertStatus(parent.ID, "done")
	a = get(a.ID)
	a.Status = "in_review"
	update(a)
	assertStatus(parent.ID, "in_progress")
	a.Status = "done"
	update(a)
	assertStatus(parent.ID, "done")
	c := create("new work", &parent.ID)
	assertStatus(parent.ID, "in_progress")
	c.Status = "cancelled"
	update(c)
	assertStatus(parent.ID, "done")
	p = get(parent.ID)
	if p.SubtaskCount != 2 || p.SubtaskDone != 2 || p.DescendantCount != 3 {
		t.Fatal("cancelled child counted as active")
	}
	// Manually completed parents stay completed when a child reopens.
	p.Status = "in_progress"
	update(p)
	p.Status = "done"
	update(p)
	a = get(a.ID)
	a.Status = "todo"
	update(a)
	assertStatus(parent.ID, "done")
	p = get(parent.ID)
	p.Status = "cancelled"
	update(p)
	a.Status = "done"
	update(a)
	assertStatus(parent.ID, "cancelled")
	p = get(parent.ID)
	p.Status = "todo"
	p.AutoCompleteSubtasks = false
	update(p)
	// Concurrent sibling completions reconcile against the committed sibling state.
	a = get(a.ID)
	b = get(b.ID)
	a.Status = "todo"
	b.Status = "todo"
	update(a)
	update(b)
	p = get(parent.ID)
	p.AutoCompleteSubtasks = true
	update(p)
	var group sync.WaitGroup
	errs := make(chan error, 2)
	for _, child := range []*taskrepo.Task{get(a.ID), get(b.ID)} {
		group.Add(1)
		go func(task *taskrepo.Task) { defer group.Done(); task.Status = "done"; errs <- repo.Update(ctx, task) }(child)
	}
	group.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	assertStatus(parent.ID, "done")
	// A stale parent version cannot overwrite automatic completion.
	stale := *p
	stale.Title = "stale"
	if err := repo.Update(ctx, &stale); !errors.Is(err, httputil.ErrConflict) {
		t.Fatalf("stale parent accepted: %v", err)
	}
	nested := &taskrepo.Task{WorkspaceID: ws, SpaceID: space, ParentTaskID: &a.ID, Title: "too deep"}
	if err := repo.Create(ctx, nested); err == nil {
		t.Fatal("nested child accepted")
	}
	crossTenant := &taskrepo.Task{WorkspaceID: uuid.New(), SpaceID: space, ParentTaskID: &parent.ID, Title: "foreign"}
	if err := repo.Create(ctx, crossTenant); err == nil {
		t.Fatal("cross-tenant child accepted")
	}
	a = get(a.ID)
	a.ParentTaskID = nil
	update(a)
	if a.ParentTitle != nil {
		t.Fatal("detached task retained parent")
	}
	list, err := repo.List(ctx, ws, taskrepo.ListFilter{ParentTaskID: &parent.ID})
	if err != nil || len(list) != 2 {
		t.Fatalf("parent filter: %d, %v", len(list), err)
	}
	if err := repo.Delete(ctx, ws, parent.ID); err != nil {
		t.Fatal(err)
	}
	if gone, err := repo.GetByID(ctx, ws, b.ID); err != nil || gone != nil {
		t.Fatal("child survived parent deletion")
	}
	assertStatus(a.ID, "done")
	// No children, or only cancelled children, must never complete an empty parent.
	empty := create("empty", nil)
	empty.AutoCompleteSubtasks = true
	update(empty)
	assertStatus(empty.ID, "todo")
	cancelled := create("cancelled", &empty.ID)
	cancelled.Status = "cancelled"
	update(cancelled)
	assertStatus(empty.ID, "todo")
}
