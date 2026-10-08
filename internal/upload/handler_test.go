package upload

import (
	"bytes"
	"context"
	"encoding/base64"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/AphelionGroups/ORCA/internal/platform/storage"
	"github.com/google/uuid"
	"mime/multipart"
	"net/http/httptest"
	"testing"
)

func TestImageUploadUsesDetectedType(t *testing.T) {
	png, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN0YAAAAASUVORK5CYII=")
	store, err := storage.NewLocalStorage(t.TempDir(), "/uploads")
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandler(store)
	for _, tc := range []struct {
		name string
		data []byte
		want int
	}{{"image.svg", []byte(`<svg onload="alert(1)"></svg>`), 400}, {"image.html", png, 200}, {"image.png", []byte("<html>unsafe</html>"), 400}} {
		t.Run(tc.name, func(t *testing.T) {
			body := new(bytes.Buffer)
			writer := multipart.NewWriter(body)
			part, err := writer.CreateFormFile("file", tc.name)
			if err != nil {
				t.Fatal(err)
			}
			part.Write(tc.data)
			writer.Close()
			req := httptest.NewRequest("POST", "/", body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req = req.WithContext(context.WithValue(req.Context(), middleware.WorkspaceIDKey, uuid.New()))
			rec := httptest.NewRecorder()
			handler.UploadFile(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("want %d got %d: %s", tc.want, rec.Code, rec.Body.String())
			}
			if tc.want == 200 && !bytes.Contains(rec.Body.Bytes(), []byte(".png")) {
				t.Fatal("client extension retained")
			}
		})
	}
}
