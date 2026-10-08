package calendar

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
	r.Delete("/{id}", h.Delete)
	return r
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())

	var startAtPtr *time.Time
	if startStr := r.URL.Query().Get("start"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startAtPtr = &t
		} else if t, err := time.Parse("2006-01-02", startStr); err == nil {
			startAtPtr = &t
		}
	}

	var endAtPtr *time.Time
	if endStr := r.URL.Query().Get("end"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endAtPtr = &t
		} else if t, err := time.Parse("2006-01-02", endStr); err == nil {
			// end of day
			t = t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			endAtPtr = &t
		}
	}

	var spaceIDPtr *uuid.UUID
	if sID := r.URL.Query().Get("space_id"); sID != "" {
		if parsed, err := uuid.Parse(sID); err == nil {
			spaceIDPtr = &parsed
		}
	}

	events, err := h.repo.List(r.Context(), wsID, startAtPtr, endAtPtr, spaceIDPtr)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": events})
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid event ID")
		return
	}

	event, err := h.repo.GetByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	if event == nil {
		httputil.RespondError(w, http.StatusNotFound, "Event not found")
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": event})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	var req CreateEventRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if req.Title == "" {
		httputil.RespondError(w, http.StatusBadRequest, "Title is required")
		return
	}
	if req.StartAt.IsZero() || req.EndAt.IsZero() {
		httputil.RespondError(w, http.StatusBadRequest, "Start and end time are required")
		return
	}

	if !req.EndAt.After(req.StartAt) {
		httputil.RespondError(w, http.StatusBadRequest, "End time must follow start time")
		return
	}
	event := Event{
		WorkspaceID:      wsID,
		SpaceID:          req.SpaceID,
		LinkedTaskID:     req.LinkedTaskID,
		Title:            req.Title,
		Description:      req.Description,
		StartAt:          req.StartAt,
		EndAt:            req.EndAt,
		IsAllDay:         req.IsAllDay,
		ExternalProvider: req.ExternalProvider,
		ExternalEventID:  req.ExternalEventID,
	}

	if err := h.repo.Create(r.Context(), &event); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusCreated, map[string]any{"data": event})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid event ID")
		return
	}

	var req UpdateEventRequest
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
		httputil.RespondError(w, http.StatusNotFound, "Event not found")
		return
	}
	if err := httputil.CheckVersion(req.ExpectedUpdatedAt, existing.UpdatedAt); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	if req.SpaceID.Set {
		existing.SpaceID = req.SpaceID.Value
	}
	if req.LinkedTaskID.Set {
		existing.LinkedTaskID = req.LinkedTaskID.Value
	}
	if req.Title != "" {
		existing.Title = req.Title
	}
	if req.Description.Set {
		existing.Description = req.Description.Value
	}
	if !req.StartAt.IsZero() {
		existing.StartAt = req.StartAt
	}
	if !req.EndAt.IsZero() {
		existing.EndAt = req.EndAt
	}
	if req.IsAllDay != nil {
		existing.IsAllDay = *req.IsAllDay
	}
	if req.ExternalProvider.Set {
		existing.ExternalProvider = req.ExternalProvider.Value
	}
	if req.ExternalEventID.Set {
		existing.ExternalEventID = req.ExternalEventID.Value
	}

	if !existing.EndAt.After(existing.StartAt) {
		httputil.RespondError(w, http.StatusBadRequest, "End time must follow start time")
		return
	}
	if err := h.repo.Update(r.Context(), existing); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": existing})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid event ID")
		return
	}

	if err := h.repo.Delete(r.Context(), wsID, id); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"message": "Event deleted successfully"})
}
