package db_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/storage"
	"github.com/AphelionGroups/ORCA/internal/transfer"
	"github.com/google/uuid"
)

func TestPortablePackageRoundTrip(t *testing.T) {
	pool := integrationPool(t)
	ctx := context.Background()
	if err := db.AutoMigrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	source, dest, space, otherSpace, targetSpace, project, otherProject, targetProject, parent, child, board, a, b, doc, event, note := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, q, args...); err != nil {
			t.Fatal(err)
		}
	}
	for _, ws := range []uuid.UUID{source, dest} {
		exec(`INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,'Transfer test',$2,$3)`, ws, ws.String(), uuid.New())
	}
	for _, pair := range [][2]uuid.UUID{{space, source}, {otherSpace, source}, {targetSpace, dest}} {
		exec(`INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,'Studio',$3)`, pair[0], pair[1], pair[0].String())
	}
	for _, item := range [][3]uuid.UUID{{project, source, space}, {otherProject, source, otherSpace}, {targetProject, dest, targetSpace}} {
		exec(`INSERT INTO projects(id,workspace_id,space_id,name)VALUES($1,$2,$3,'Launch')`, item[0], item[1], item[2])
	}
	exec(`INSERT INTO tasks(id,workspace_id,space_id,project_id,title,status,auto_complete_subtasks)VALUES($1,$2,$3,$4,'Parent','in_progress',true)`, parent, source, space, project)
	exec(`INSERT INTO tasks(id,workspace_id,space_id,project_id,parent_task_id,title,status,planned_date,due_date)VALUES($1,$2,$3,$4,$5,'Child','done','2026-11-15','2026-11-20T00:00:00Z')`, child, source, space, project, parent)
	exec(`INSERT INTO note_boards(id,workspace_id,space_id,project_id,title,viewport_state)VALUES($1,$2,$3,$4,'Ideas','{"x":12,"y":24,"zoom":1.5}')`, board, source, space, project)
	dir := t.TempDir()
	store, err := storage.NewLocalStorage(dir, "/uploads")
	if err != nil {
		t.Fatal(err)
	}
	gif, _ := base64.StdEncoding.DecodeString("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
	key := source.String() + "/images/example.gif"
	imageURL, err := store.Upload(ctx, key, bytes.NewReader(gif), int64(len(gif)), "image/gif")
	if err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO note_blocks(id,workspace_id,board_id,type,pos_x,pos_y,width,height,content)VALUES($1,$2,$3,'image',80,120,240,160,jsonb_build_object('url',$4::text,'caption','Reference'))`, a, source, board, imageURL)
	exec(`INSERT INTO note_blocks(id,workspace_id,board_id,type,pos_x,pos_y,content)VALUES($1,$2,$3,'sticky',400,200,'{"text":"Test idea"}')`, b, source, board)
	exec(`INSERT INTO documents(id,workspace_id,space_id,project_id,title,content)VALUES($1,$2,$3,$4,'Brief',$5)`, doc, source, space, project, "# Brief\n\n![Reference]("+imageURL+")")
	exec(`INSERT INTO events(id,workspace_id,space_id,linked_task_id,title,start_at,end_at)VALUES($1,$2,$3,$4,'Focus','2026-11-15T09:00:00Z','2026-11-15T10:00:00Z')`, event, source, space, child)
	exec(`INSERT INTO inbox_notes(id,workspace_id,content)VALUES($1,$2,'A new idea')`, note, source)
	exec(`INSERT INTO entity_links(id,workspace_id,from_type,from_id,to_type,to_id,relation_type,metadata)VALUES($1,$2,'note_block',$3,'note_block',$4,'connects_to','{"fromSide":"right","toSide":"left"}')`, uuid.New(), source, a, b)
	exec(`INSERT INTO entity_links(id,workspace_id,from_type,from_id,to_type,to_id,relation_type)VALUES($1,$2,'document',$3,'task',$4,'relates_to')`, uuid.New(), source, doc, child)
	exec(`INSERT INTO entity_links(id,workspace_id,from_type,from_id,to_type,to_id,relation_type)VALUES($1,$2,'task',$3,'project',$4,'relates_to')`, uuid.New(), source, parent, otherProject)
	embed := uuid.New()
	exec(`INSERT INTO note_blocks(id,workspace_id,board_id,type,content)VALUES($1,$2,$3,'task_embed',jsonb_build_object('task_id',$4::text,'text','Child'))`, embed, source, board, child)
	service := transfer.NewService(pool, store)
	for _, scope := range []transfer.Scope{{Kind: "workspace"}, {Kind: "space", ID: space.String()}, {Kind: "project", ID: project.String()}, {Kind: "board", ID: board.String()}, {Kind: "task", ID: parent.String()}, {Kind: "task", ID: child.String()}} {
		t.Run(scope.Kind+scope.ID, func(t *testing.T) {
			p, err := service.Export(ctx, source, scope)
			if err != nil {
				t.Fatal(err)
			}
			archive, err := transfer.Encode(p)
			if err != nil {
				t.Fatal(err)
			}
			decoded, err := transfer.Decode(archive)
			if err != nil {
				t.Fatal(err)
			}
			if scope.Kind != "workspace" && scope.Kind != "space" && len(decoded.Entities["spaces"]) != 0 {
				t.Fatal("narrow export unexpectedly includes parent space")
			}
			destination := transfer.Destination{}
			if scope.Kind != "workspace" && scope.Kind != "space" {
				destination.SpaceID = targetSpace.String()
			}
			if scope.Kind == "board" || scope.Kind == "task" {
				destination.ProjectID = targetProject.String()
			}
			request := uuid.New()
			result, err := service.Import(ctx, dest, request, archive, destination)
			if err != nil {
				t.Fatal(err)
			}
			retry, err := service.Import(ctx, dest, request, archive, destination)
			if err != nil || retry.IDs[scope.ID] != result.IDs[scope.ID] {
				t.Fatalf("retry was not idempotent: %v", err)
			}
			for old, newID := range result.IDs {
				if old == newID {
					t.Fatal("identity was reused")
				}
			}
			if newChild := result.IDs[child.String()]; newChild != "" {
				var planned, due, status string
				var parentID *string
				if err := pool.QueryRow(ctx, `SELECT planned_date::text,due_date::date::text,status,parent_task_id::text FROM tasks WHERE workspace_id=$1 AND id=$2`, dest, newChild).Scan(&planned, &due, &status, &parentID); err != nil {
					t.Fatal(err)
				}
				if planned != "2026-11-15" || due != "2026-11-20" || status != "done" {
					t.Fatal("task dates or status changed")
				}
				if result.IDs[parent.String()] != "" && (parentID == nil || *parentID != result.IDs[parent.String()]) {
					t.Fatal("parent relationship was lost")
				}
				if scope.ID == child.String() && parentID != nil {
					t.Fatal("standalone child retained outside parent")
				}
			}
			if newParent := result.IDs[parent.String()]; newParent != "" {
				var status string
				var automatic bool
				if err := pool.QueryRow(ctx, `SELECT status,completed_by_subtasks FROM tasks WHERE id=$1`, newParent).Scan(&status, &automatic); err != nil || status != "done" || !automatic {
					t.Fatalf("automation state was not preserved: %s %v %v", status, automatic, err)
				}
			}
			if newA := result.IDs[a.String()]; newA != "" {
				var url string
				var x, y, w, h float64
				if err := pool.QueryRow(ctx, `SELECT content->>'url',pos_x,pos_y,width,height FROM note_blocks WHERE id=$1`, newA).Scan(&url, &x, &y, &w, &h); err != nil {
					t.Fatal(err)
				}
				if url == imageURL || x != 80 || y != 120 || w != 240 || h != 160 {
					t.Fatal("asset mapping or board geometry changed")
				}
				assetKey, owned := store.AssetKey(dest.String(), url)
				body, err := store.ReadAsset(ctx, assetKey)
				if !owned || err != nil || !bytes.Equal(body, gif) {
					t.Fatal("attachment copy failed")
				}
				var count int
				if err := pool.QueryRow(ctx, `SELECT count(*) FROM entity_links WHERE workspace_id=$1 AND from_id=$2 AND to_id=$3 AND relation_type='connects_to'`, dest, newA, result.IDs[b.String()]).Scan(&count); err != nil || count != 1 {
					t.Fatal("board connector was not remapped")
				}
			}
			if scope.Kind == "board" {
				found := false
				for _, block := range decoded.Entities["note_blocks"] {
					if block["id"] == embed.String() {
						content, _ := block["content"].(map[string]any)
						text, _ := content["text"].(string)
						if block["type"] != "text" || !strings.Contains(text, "Child") {
							t.Fatal("outside task title was lost")
						}
						found = true
					}
				}
				if !found {
					t.Fatal("embedded block missing")
				}
			}
			if scope.Kind == "project" && len(decoded.Warnings) == 0 {
				t.Fatal("external reference was not explained")
			}
		})
	}
	if _, err := service.Export(ctx, dest, transfer.Scope{Kind: "project", ID: project.String()}); err == nil {
		t.Fatal("cross-tenant export accepted")
	}
	p, err := service.Export(ctx, source, transfer.Scope{Kind: "project", ID: project.String()})
	if err != nil {
		t.Fatal(err)
	}
	archive, err := transfer.Encode(p)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Import(ctx, dest, uuid.New(), archive, transfer.Destination{SpaceID: space.String()}); err == nil {
		t.Fatal("foreign destination accepted")
	}
	// Concurrent retries of one import intent create exactly one set of records.
	request := uuid.New()
	var group sync.WaitGroup
	results := make(chan *transfer.ImportResult, 2)
	failures := make(chan error, 2)
	for i := 0; i < 2; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			r, e := service.Import(ctx, dest, request, archive, transfer.Destination{SpaceID: targetSpace.String()})
			results <- r
			failures <- e
		}()
	}
	group.Wait()
	close(results)
	close(failures)
	for e := range failures {
		if e != nil {
			t.Fatal(e)
		}
	}
	ids := []string{}
	for r := range results {
		ids = append(ids, r.IDs[project.String()])
	}
	if ids[0] != ids[1] {
		t.Fatal("duplicate concurrent import")
	}
	// A database failure after file staging must leave neither records nor files.
	workspacePackage, err := service.Export(ctx, source, transfer.Scope{Kind: "workspace"})
	if err != nil {
		t.Fatal(err)
	}
	workspaceZIP, err := transfer.Encode(workspacePackage)
	if err != nil {
		t.Fatal(err)
	}
	missingWorkspace := uuid.New()
	if _, err := service.Import(ctx, missingWorkspace, uuid.New(), workspaceZIP, transfer.Destination{}); err == nil {
		t.Fatal("expected FK failure")
	}
	found := false
	filepath.WalkDir(dir, func(path string, entry os.DirEntry, err error) error {
		if err == nil && !entry.IsDir() && strings.Contains(path, missingWorkspace.String()) {
			found = true
		}
		return nil
	})
	if found {
		t.Fatal("failed import left staged files")
	}
}
