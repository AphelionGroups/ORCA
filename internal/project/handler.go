package project

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

	var spaceIDPtr *uuid.UUID
	spaceIDStr := r.URL.Query().Get("space_id")
	if spaceIDStr != "" {
		if parsed, err := uuid.Parse(spaceIDStr); err == nil {
			spaceIDPtr = &parsed
		}
	}

	projects, err := h.repo.List(r.Context(), wsID, spaceIDPtr)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to retrieve projects: "+err.Error())
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": projects})
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	project, err := h.repo.GetByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get project: "+err.Error())
		return
	}
	if project == nil {
		httputil.RespondError(w, http.StatusNotFound, "Project not found")
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": project})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	var req CreateProjectRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if req.Name == "" || req.SpaceID == uuid.Nil {
		httputil.RespondError(w, http.StatusBadRequest, "Name and space_id are required")
		return
	}

	project := Project{
		WorkspaceID:   wsID,
		SpaceID:       req.SpaceID,
		Name:          req.Name,
		Description:   req.Description,
		Status:        req.Status,
		TargetDate:    req.TargetDate,
		KanbanColumns: req.KanbanColumns,
	}

	if err := h.repo.Create(r.Context(), &project); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to create project: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusCreated, map[string]any{"data": project})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	var req UpdateProjectRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	existing, err := h.repo.GetByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get project: "+err.Error())
		return
	}
	if existing == nil {
		httputil.RespondError(w, http.StatusNotFound, "Project not found")
		return
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	existing.Description = req.Description
	if req.Status != "" {
		existing.Status = req.Status
	}
	existing.TargetDate = req.TargetDate
	if len(req.KanbanColumns) > 0 {
		existing.KanbanColumns = req.KanbanColumns
	}

	if err := h.repo.Update(r.Context(), existing); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to update project: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": existing})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if err := h.repo.Delete(r.Context(), wsID, id); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to delete project: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"message": "Project deleted successfully"})
}
