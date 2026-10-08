package httputil

import (
	"errors"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrNotFound = errors.New("resource not found")
var ErrConflict = errors.New("resource changed since it was read")

func RespondDBError(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrConflict) {
		RespondError(w, http.StatusConflict, "Data changed. Refresh before retrying; your edits have not been saved.")
		return
	}
	if errors.Is(err, ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
		RespondError(w, http.StatusNotFound, "Resource not found")
		return
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23503", "23514", "22P02":
			RespondError(w, http.StatusBadRequest, "Invalid or unavailable related data")
			return
		case "23505":
			RespondError(w, http.StatusConflict, "Data already exists")
			return
		}
	}
	log.Printf("[ORCA-ERROR] Database operation failed: %v", err)
	RespondError(w, http.StatusInternalServerError, "Unable to complete the operation")
}
