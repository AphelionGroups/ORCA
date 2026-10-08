package task

import (
	"net/http"
	"time"

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
	r.Patch("/{id}/status", h.UpdateStatus)
	r.Delete("/{id}", h.Delete)
	return r
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())

	var filter ListFilter

	if sID := r.URL.Query().Get("space_id"); sID != "" {
		if parsed, err := uuid.Parse(sID); err == nil {
			filter.SpaceID = &parsed
		}
	}

	if r.URL.Query().Get("inbox") == "true" {
		filter.InboxOnly = true
	} else if pID := r.URL.Query().Get("project_id"); pID != "" {
		if parsed, err := uuid.Parse(pID); err == nil {
			filter.ProjectID = &parsed
		}
	}

	if dateStr := r.URL.Query().Get("planned_date"); dateStr != "" {
		if t, err := time.Parse("2006-01-02", dateStr); err == nil {
			filter.PlannedDate = &t
		}
	}

	filter.Status = r.URL.Query().Get("status")

	tasks, err := h.repo.List(r.Context(), wsID, filter)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": tasks})
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid task ID")
		return
	}

	task, err := h.repo.GetByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	if task == nil {
		httputil.RespondError(w, http.StatusNotFound, "Task not found")
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": task})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	var req CreateTaskRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if err := ValidateAttributes(req.Status, req.Priority, req.EstimatedMinutes); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Title == "" || req.SpaceID == uuid.Nil {
		httputil.RespondError(w, http.StatusBadRequest, "Title and space_id are required")
		return
	}

	task := Task{
		WorkspaceID:      wsID,
		SpaceID:          req.SpaceID,
		ProjectID:        req.ProjectID,
		ParentTaskID:     req.ParentTaskID,
		Title:            req.Title,
		Description:      req.Description,
		Status:           req.Status,
		Priority:         req.Priority,
		DueDate:          req.DueDate,
		EstimatedMinutes: req.EstimatedMinutes,
	}

	if req.PlannedDate != nil && *req.PlannedDate != "" {
		t, err := time.Parse("2006-01-02", *req.PlannedDate)
		if err != nil {
			httputil.RespondError(w, http.StatusBadRequest, "Invalid planned_date")
			return
		}
		task.PlannedDate = &t
	}

	if err := h.repo.Create(r.Context(), &task); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusCreated, map[string]any{"data": task})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid task ID")
		return
	}

	var req UpdateTaskRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	existing, err := h.repo.GetByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	if existing == nil {
		httputil.RespondError(w, http.StatusNotFound, "Task not found")
		return
	}

	if req.SpaceID != nil {
		existing.SpaceID = *req.SpaceID
	}
	if req.ProjectID.Set {
		existing.ProjectID = req.ProjectID.Value
	}
	if req.ParentTaskID.Set {
		existing.ParentTaskID = req.ParentTaskID.Value
	}
	if req.Title != "" {
		existing.Title = req.Title
	}
	if req.Description.Set {
		existing.Description = req.Description.Value
	}
	if req.Status != "" {
		existing.Status = req.Status
	}
	if req.Priority != "" {
		existing.Priority = req.Priority
	}
	if req.DueDate.Set {
		existing.DueDate = req.DueDate.Value
	}
	if req.PlannedDate.Set {
		if req.PlannedDate.Value == nil || *req.PlannedDate.Value == "" {
			existing.PlannedDate = nil
		} else if parsed, err := time.Parse("2006-01-02", *req.PlannedDate.Value); err == nil {
			existing.PlannedDate = &parsed
		} else {
			httputil.RespondError(w, http.StatusBadRequest, "Invalid planned date")
			return
		}
	}

	if req.EstimatedMinutes.Set {
		existing.EstimatedMinutes = req.EstimatedMinutes.Value
	}

	if err := ValidateAttributes(existing.Status, existing.Priority, existing.EstimatedMinutes); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.repo.Update(r.Context(), existing); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": existing})
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid task ID")
		return
	}

	var req UpdateTaskStatusRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if err := ValidateAttributes(req.Status, "", nil); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Status == "" {
		httputil.RespondError(w, http.StatusBadRequest, "Status is required")
		return
	}

	if err := h.repo.UpdateStatus(r.Context(), wsID, id, req.Status); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"status": req.Status})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid task ID")
		return
	}

	if err := h.repo.Delete(r.Context(), wsID, id); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"message": "Task deleted successfully"})
}
