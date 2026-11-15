package transfer

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func examplePackage() *Package {
	space := uuid.NewString()
	return &Package{Format: "orca", Version: 1, Name: "Example", Scope: Scope{Kind: "space", ID: space}, ExportedAt: time.Now().UTC(), Entities: map[string][]Record{"spaces": {{"id": space, "name": "Example", "slug": "example"}}}, Files: map[string][]byte{}}
}
func zipEntries(t *testing.T, entries [][2]string) []byte {
	t.Helper()
	var out bytes.Buffer
	writer := zip.NewWriter(&out)
	for _, entry := range entries {
		file, err := writer.Create(entry[0])
		if err != nil {
			t.Fatal(err)
		}
		if _, err = file.Write([]byte(entry[1])); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}
func TestPackageValidation(t *testing.T) {
	cases := map[string]func(*Package){
		"future version":    func(p *Package) { p.Version = 2 },
		"unexpected tenant": func(p *Package) { p.Entities["spaces"][0]["workspace_id"] = uuid.NewString() },
		"users":             func(p *Package) { p.Entities["users"] = []Record{} },
		"duplicate ID":      func(p *Package) { p.Entities["spaces"] = append(p.Entities["spaces"], p.Entities["spaces"][0]) },
		"missing board": func(p *Package) {
			p.Entities["note_blocks"] = []Record{{"id": uuid.NewString(), "board_id": uuid.NewString(), "type": "text", "content": map[string]any{"text": "hello"}}}
		},
		"missing attachment": func(p *Package) {
			p.Entities["documents"] = []Record{{"id": uuid.NewString(), "space_id": str(p.Entities["spaces"][0], "id"), "title": "Doc", "content": "![image](/uploads/example/images/image.png)"}}
		},
		"invalid event": func(p *Package) {
			p.Entities["events"] = []Record{{"id": uuid.NewString(), "title": "Event", "start_at": "2026-01-01T10:00:00Z", "end_at": "2026-01-01T09:00:00Z"}}
		},
		"invalid boolean": func(p *Package) {
			p.Entities["tasks"] = []Record{{"id": uuid.NewString(), "space_id": str(p.Entities["spaces"][0], "id"), "title": "Task", "auto_complete_subtasks": "false"}}
		},
		"invalid status": func(p *Package) {
			p.Entities["tasks"] = []Record{{"id": uuid.NewString(), "space_id": str(p.Entities["spaces"][0], "id"), "title": "Task", "status": "unknown"}}
		},
		"cycle": func(p *Package) {
			id := uuid.NewString()
			p.Entities["tasks"] = []Record{{"id": id, "space_id": str(p.Entities["spaces"][0], "id"), "title": "Cycle", "parent_task_id": id}}
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			p := examplePackage()
			mutate(p)
			if err := p.Validate(); err == nil {
				t.Fatal("invalid package accepted")
			}
		})
	}
}
func TestArchivePathsAndCorruption(t *testing.T) {
	p := examplePackage()
	manifest, err := json.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}
	for name, entries := range map[string][][2]string{
		"traversal":     {{"manifest.json", string(manifest)}, {"../outside", "bad"}},
		"absolute":      {{"manifest.json", string(manifest)}, {"/assets/absolute", "bad"}},
		"duplicate":     {{"manifest.json", string(manifest)}, {"manifest.json", string(manifest)}},
		"unexpected":    {{"manifest.json", string(manifest)}, {"passwords.txt", "bad"}},
		"no manifest":   {{"assets/file", "bad"}},
		"trailing JSON": {{"manifest.json", string(manifest) + " {}"}},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := Decode(zipEntries(t, entries)); err == nil {
				t.Fatal("unsafe archive accepted")
			}
		})
	}
	good, err := Encode(p)
	if err != nil {
		t.Fatal(err)
	}
	copy, err := Decode(good)
	if err != nil || copy.Name != p.Name {
		t.Fatalf("valid package rejected: %v", err)
	}
	if _, err := Decode([]byte("not a zip")); err == nil {
		t.Fatal("invalid ZIP accepted")
	}
}

func TestLegacyBlockTextRoundTrip(t *testing.T) {
	p := examplePackage()
	space := str(p.Entities["spaces"][0], "id")
	board := uuid.NewString()
	block := uuid.NewString()
	p.Entities["note_boards"] = []Record{{"id": board, "space_id": space, "title": "Legacy board"}}
	p.Entities["note_blocks"] = []Record{{"id": block, "board_id": board, "type": "text", "content": "Legacy board text"}}
	encoded, err := Encode(p)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := Decode(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if decoded.Entities["note_blocks"][0]["content"] != "Legacy board text" {
		t.Fatal("legacy content changed")
	}
	p.Entities["note_blocks"][0]["content"] = map[string]any{"schema_version": float64(99), "text": "future"}
	if err := p.Validate(); err == nil {
		t.Fatal("unsupported block schema accepted")
	}
}
