package doc

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
	if spaceIDStr := r.URL.Query().Get("space_id"); spaceIDStr != "" {
		if parsed, err := uuid.Parse(spaceIDStr); err == nil {
			spaceIDPtr = &parsed
		}
	}

	var projectIDPtr *uuid.UUID
	if projectIDStr := r.URL.Query().Get("project_id"); projectIDStr != "" {
		if parsed, err := uuid.Parse(projectIDStr); err == nil {
			projectIDPtr = &parsed
		}
	}

	docs, err := h.repo.List(r.Context(), wsID, spaceIDPtr, projectIDPtr)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to retrieve documents: "+err.Error())
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": docs})
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid document ID")
		return
	}

	doc, err := h.repo.GetByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get document: "+err.Error())
		return
	}
	if doc == nil {
		httputil.RespondError(w, http.StatusNotFound, "Document not found")
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": doc})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	var req CreateDocumentRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if req.Title == "" || req.SpaceID == uuid.Nil {
		httputil.RespondError(w, http.StatusBadRequest, "Title and space_id are required")
		return
	}

	doc := Document{
		WorkspaceID: wsID,
		SpaceID:     req.SpaceID,
		ProjectID:   req.ProjectID,
		Title:       req.Title,
		DocType:     req.DocType,
		Content:     req.Content,
		IsPinned:    req.IsPinned,
	}

	if err := h.repo.Create(r.Context(), &doc); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to create document: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusCreated, map[string]any{"data": doc})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid document ID")
		return
	}

	var req UpdateDocumentRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	existing, err := h.repo.GetByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get document: "+err.Error())
		return
	}
	if existing == nil {
		httputil.RespondError(w, http.StatusNotFound, "Document not found")
		return
	}

	existing.ProjectID = req.ProjectID
	if req.Title != "" {
		existing.Title = req.Title
	}
	if req.DocType != "" {
		existing.DocType = req.DocType
	}
	existing.Content = req.Content
	existing.IsPinned = req.IsPinned

	if err := h.repo.Update(r.Context(), existing); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to update document: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": existing})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid document ID")
		return
	}

	if err := h.repo.Delete(r.Context(), wsID, id); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to delete document: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"message": "Document deleted successfully"})
}
