package httputil

import (
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgconn"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDatabaseErrorsDoNotLeakDetails(t *testing.T) {
	for _, tc := range []struct {
		name   string
		err    error
		status int
	}{
		{"foreign key", fmt.Errorf("wrapped: %w", &pgconn.PgError{Code: "23503", Message: "private database detail"}), 400},
		{"duplicate", &pgconn.PgError{Code: "23505", Message: "private database detail"}, 409},
		{"missing", ErrNotFound, 404}, {"internal", errors.New("private database detail"), 500},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			RespondDBError(rec, tc.err)
			if rec.Code != tc.status {
				t.Fatalf("want %d got %d", tc.status, rec.Code)
			}
			if strings.Contains(rec.Body.String(), "private database detail") {
				t.Fatal("internal detail leaked")
			}
		})
	}
}
