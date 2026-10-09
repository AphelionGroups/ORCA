package main

import (
	"context"
	"errors"
	"github.com/AphelionGroups/ORCA/internal/platform/storage"
	"net/http/httptest"
	"testing"
)

type fakeDatabase struct{ err error }

func (d fakeDatabase) Ping(context.Context) error { return d.err }
func TestReadiness(t *testing.T) {
	store, err := storage.NewLocalStorage(t.TempDir(), "/uploads")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name  string
		db    databasePinger
		store storage.Service
		want  int
	}{
		{"ready", fakeDatabase{}, store, 200}, {"database down", fakeDatabase{errors.New("down")}, store, 503}, {"database missing", nil, store, 503}, {"storage missing", fakeDatabase{}, nil, 503},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			readinessHandler(tc.db, tc.store)(rec, httptest.NewRequest("GET", "/healthz", nil))
			if rec.Code != tc.want {
				t.Fatalf("want %d got %d", tc.want, rec.Code)
			}
		})
	}
}
