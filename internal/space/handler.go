package space

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
	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Get("/{id}", h.GetByID)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	return r
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	spaces, err := h.repo.List(r.Context(), wsID)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to retrieve spaces: "+err.Error())
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": spaces})
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}

	space, err := h.repo.GetByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get space: "+err.Error())
		return
	}
	if space == nil {
		httputil.RespondError(w, http.StatusNotFound, "Space not found")
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": space})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	var req CreateSpaceRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if req.Name == "" || req.Slug == "" {
		httputil.RespondError(w, http.StatusBadRequest, "Name and slug are required")
		return
	}

	space := Space{
		WorkspaceID: wsID,
		Name:        req.Name,
		Slug:        req.Slug,
		Icon:        req.Icon,
		Color:       req.Color,
		SortOrder:   req.SortOrder,
	}

	if err := h.repo.Create(r.Context(), &space); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to create space: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusCreated, map[string]any{"data": space})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}

	var req UpdateSpaceRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	existing, err := h.repo.GetByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get space: "+err.Error())
		return
	}
	if existing == nil {
		httputil.RespondError(w, http.StatusNotFound, "Space not found")
		return
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Icon != "" {
		existing.Icon = req.Icon
	}
	if req.Color != "" {
		existing.Color = req.Color
	}
	existing.SortOrder = req.SortOrder

	if err := h.repo.Update(r.Context(), existing); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to update space: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": existing})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}

	if err := h.repo.Delete(r.Context(), wsID, id); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to delete space: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"message": "Space deleted successfully"})
}
