package board

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

func (h *Handler) BoardRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListBoards)
	r.Post("/", h.CreateBoard)
	r.Get("/{id}", h.GetBoardByID)
	r.Put("/{id}", h.UpdateBoard)
	r.Delete("/{id}", h.DeleteBoard)

	r.Get("/{id}/blocks", h.ListBlocks)
	r.Post("/{id}/blocks", h.CreateBlock)
	return r
}

func (h *Handler) BlockRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/{id}", h.GetBlockByID)
	r.Put("/{id}", h.UpdateBlock)
	r.Delete("/{id}", h.DeleteBlock)
	return r
}

// ----------------- BOARDS HANDLERS -----------------

func (h *Handler) ListBoards(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())

	var spaceIDPtr *uuid.UUID
	if sID := r.URL.Query().Get("space_id"); sID != "" {
		if parsed, err := uuid.Parse(sID); err == nil {
			spaceIDPtr = &parsed
		}
	}

	var projectIDPtr *uuid.UUID
	if pID := r.URL.Query().Get("project_id"); pID != "" {
		if parsed, err := uuid.Parse(pID); err == nil {
			projectIDPtr = &parsed
		}
	}

	boards, err := h.repo.ListBoards(r.Context(), wsID, spaceIDPtr, projectIDPtr)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to retrieve boards: "+err.Error())
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": boards})
}

func (h *Handler) GetBoardByID(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid board ID")
		return
	}

	board, err := h.repo.GetBoardByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get board: "+err.Error())
		return
	}
	if board == nil {
		httputil.RespondError(w, http.StatusNotFound, "Board not found")
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": board})
}

func (h *Handler) CreateBoard(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	var req CreateBoardRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if req.Title == "" || req.SpaceID == uuid.Nil {
		httputil.RespondError(w, http.StatusBadRequest, "Title and space_id are required")
		return
	}

	board := NoteBoard{
		WorkspaceID:   wsID,
		SpaceID:       req.SpaceID,
		ProjectID:     req.ProjectID,
		Title:         req.Title,
		ViewportState: req.ViewportState,
	}

	if err := h.repo.CreateBoard(r.Context(), &board); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to create board: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusCreated, map[string]any{"data": board})
}

func (h *Handler) UpdateBoard(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid board ID")
		return
	}

	var req UpdateBoardRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	existing, err := h.repo.GetBoardByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get board: "+err.Error())
		return
	}
	if existing == nil {
		httputil.RespondError(w, http.StatusNotFound, "Board not found")
		return
	}

	existing.ProjectID = req.ProjectID
	if req.Title != "" {
		existing.Title = req.Title
	}
	if len(req.ViewportState) > 0 {
		existing.ViewportState = req.ViewportState
	}

	if err := h.repo.UpdateBoard(r.Context(), existing); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to update board: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": existing})
}

func (h *Handler) DeleteBoard(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid board ID")
		return
	}

	if err := h.repo.DeleteBoard(r.Context(), wsID, id); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to delete board: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"message": "Board deleted successfully"})
}

// ----------------- BLOCKS HANDLERS -----------------

func (h *Handler) ListBlocks(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	boardIDStr := chi.URLParam(r, "id")
	boardID, err := uuid.Parse(boardIDStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid board ID")
		return
	}

	blocks, err := h.repo.ListBlocksByBoard(r.Context(), wsID, boardID)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to retrieve blocks: "+err.Error())
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": blocks})
}

func (h *Handler) GetBlockByID(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid block ID")
		return
	}

	block, err := h.repo.GetBlockByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get block: "+err.Error())
		return
	}
	if block == nil {
		httputil.RespondError(w, http.StatusNotFound, "Block not found")
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": block})
}

func (h *Handler) CreateBlock(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	boardIDStr := chi.URLParam(r, "id")
	boardID, err := uuid.Parse(boardIDStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid board ID")
		return
	}

	var req CreateBlockRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if req.Type == "" {
		req.Type = "sticky"
	}

	block := NoteBlock{
		WorkspaceID: wsID,
		BoardID:     boardID,
		Type:        req.Type,
		PosX:        req.PosX,
		PosY:        req.PosY,
		Width:       req.Width,
		Height:      req.Height,
		Content:     req.Content,
	}

	if err := h.repo.CreateBlock(r.Context(), &block); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to create block: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusCreated, map[string]any{"data": block})
}

func (h *Handler) UpdateBlock(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid block ID")
		return
	}

	var req UpdateBlockRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	existing, err := h.repo.GetBlockByID(r.Context(), wsID, id)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to get block: "+err.Error())
		return
	}
	if existing == nil {
		httputil.RespondError(w, http.StatusNotFound, "Block not found")
		return
	}

	if req.Type != "" {
		existing.Type = req.Type
	}
	if req.PosX != nil {
		existing.PosX = *req.PosX
	}
	if req.PosY != nil {
		existing.PosY = *req.PosY
	}
	if req.Width != nil {
		existing.Width = req.Width
	}
	if req.Height != nil {
		existing.Height = req.Height
	}
	if len(req.Content) > 0 {
		existing.Content = req.Content
	}

	if err := h.repo.UpdateBlock(r.Context(), existing); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to update block: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": existing})
}

func (h *Handler) DeleteBlock(w http.ResponseWriter, r *http.Request) {
	wsID := middleware.GetWorkspaceID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid block ID")
		return
	}

	if err := h.repo.DeleteBlock(r.Context(), wsID, id); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to delete block: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{"message": "Block deleted successfully"})
}
