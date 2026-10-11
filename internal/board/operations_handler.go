package board

import (
	"errors"
	"net/http"

	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) Operation(w http.ResponseWriter, r *http.Request) {
	boardID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.RespondError(w, 400, "Invalid board ID")
		return
	}
	var request OperationRequest
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	if err = httputil.ParseJSON(r, &request); err != nil {
		httputil.RespondError(w, 400, "Invalid board operation payload")
		return
	}
	result, err := h.repo.ApplyOperation(r.Context(), middleware.GetWorkspaceID(r.Context()), boardID, request)
	if err != nil {
		respondOperationError(w, err)
		return
	}
	httputil.RespondJSON(w, 200, map[string]any{"data": result})
}
func respondOperationError(w http.ResponseWriter, err error) {
	var invalid *ValidationError
	if errors.As(err, &invalid) {
		httputil.RespondError(w, 400, invalid.Message)
		return
	}
	httputil.RespondDBError(w, err)
}
func (h *Handler) Connections(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.RespondError(w, 400, "Invalid board ID")
		return
	}
	workspace := middleware.GetWorkspaceID(r.Context())
	board, err := h.repo.GetBoardByID(r.Context(), workspace, id)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	if board == nil {
		httputil.RespondDBError(w, httputil.ErrNotFound)
		return
	}
	tx, err := h.repo.pool.Begin(r.Context())
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	defer tx.Rollback(r.Context())
	connections, err := operationConnections(r.Context(), tx, workspace, id)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	httputil.RespondJSON(w, 200, map[string]any{"data": connections})
}
func (h *Handler) Viewport(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.RespondError(w, 400, "Invalid board ID")
		return
	}
	var viewport Viewport
	if err = httputil.ParseJSON(r, &viewport); err != nil {
		httputil.RespondError(w, 400, "Invalid viewport payload")
		return
	}
	if err = h.repo.SaveViewport(r.Context(), middleware.GetWorkspaceID(r.Context()), id, viewport); err != nil {
		respondOperationError(w, err)
		return
	}
	httputil.RespondJSON(w, 200, map[string]any{"data": viewport})
}
