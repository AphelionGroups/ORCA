package link

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListByEntity)
	r.Post("/", h.Create)
	r.Delete("/{id}", h.Delete)
	return r
}

func (h *Handler) ListByEntity(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())

	entityType := r.URL.Query().Get("type")
	entityIDStr := r.URL.Query().Get("id")
	if entityType == "" || entityIDStr == "" {
		httputil.RespondError(w, http.StatusBadRequest, "Both 'type' and 'id' query parameters are required")
		return
	}

	entityID, err := uuid.Parse(entityIDStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid entity ID")
		return
	}

	links, err := h.repo.ListByEntity(r.Context(), wsID, entityType, entityID)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to retrieve entity links: "+err.Error())
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": links})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	var req CreateEntityLinkRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if req.FromType == "" || req.FromID == uuid.Nil || req.ToType == "" || req.ToID == uuid.Nil {
		httputil.RespondError(w, http.StatusBadRequest, "from_type, from_id, to_type, and to_id are required")
		return
	}

	link := EntityLink{
		WorkspaceID:  wsID,
		FromType:     req.FromType,
		FromID:       req.FromID,
		ToType:       req.ToType,
		ToID:         req.ToID,
		RelationType: req.RelationType,
		Metadata:     req.Metadata,
	}

	if err := h.repo.Create(r.Context(), &link); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to create entity link: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusCreated, map[string]any{"data": link})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid link ID")
		return
	}

	if err := h.repo.Delete(r.Context(), wsID, id); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to delete entity link: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"message": "Entity link deleted successfully"})
}
