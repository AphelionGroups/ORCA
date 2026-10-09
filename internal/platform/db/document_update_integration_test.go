package db_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AphelionGroups/ORCA/internal/doc"
	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/google/uuid"
)

func TestDocumentPartialUpdateAndConflicts(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	workspace, space, project := uuid.New(), uuid.New(), uuid.New()
	for _, statement := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'test',$2,$3)`, []any{workspace, workspace.String(), uuid.New()}},
		{`INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,'test','test')`, []any{space, workspace}},
		{`INSERT INTO projects(id,workspace_id,space_id,name)VALUES($1,$2,$3,'test')`, []any{project, workspace, space}},
	} {
		if _, err := pool.Exec(ctx, statement.sql, statement.args...); err != nil {
			t.Fatal(err)
		}
	}
	repo := doc.NewRepository(pool)
	document := doc.Document{WorkspaceID: workspace, SpaceID: space, ProjectID: &project, Title: "Original", Content: "Keep content", IsPinned: true}
	if err := repo.Create(ctx, &document); err != nil {
		t.Fatal(err)
	}
	routes := doc.NewHandler(repo).Routes()
	update := func(body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPut, "/"+document.ID.String(), bytes.NewBufferString(body))
		req = req.WithContext(context.WithValue(req.Context(), middleware.WorkspaceIDKey, workspace))
		result := httptest.NewRecorder()
		routes.ServeHTTP(result, req)
		return result
	}
	result := update(`{"title":"Renamed"}`)
	if result.Code != http.StatusOK {
		t.Fatalf("update: %d %s", result.Code, result.Body)
	}
	current, err := repo.GetByID(ctx, workspace, document.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Content != "Keep content" || !current.IsPinned || current.ProjectID == nil {
		t.Fatal("omitted fields changed")
	}
	staleVersion, _ := json.Marshal(document.UpdatedAt)
	result = update(`{"title":"Stale edit","expected_updated_at":` + string(staleVersion) + `}`)
	if result.Code != http.StatusConflict {
		t.Fatalf("stale document accepted: %d %s", result.Code, result.Body)
	}
	// Even clients without a version cannot overwrite another update after their repository read.
	stale := *current
	current.Title = "Winner"
	if err := repo.Update(ctx, current); err != nil {
		t.Fatal(err)
	}
	stale.Title = "Loser"
	if err := repo.Update(ctx, &stale); !errors.Is(err, httputil.ErrConflict) {
		t.Fatalf("repository lost update: %v", err)
	}
	result = update(`{"content":"","is_pinned":false,"project_id":null}`)
	if result.Code != http.StatusOK {
		t.Fatalf("explicit clearing: %d %s", result.Code, result.Body)
	}
	current, err = repo.GetByID(ctx, workspace, document.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Content != "" || current.IsPinned || current.ProjectID != nil || current.Title != "Winner" {
		t.Fatal("explicit zero/null semantics incorrect")
	}
}
