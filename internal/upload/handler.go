package upload

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/AphelionGroups/ORCA/internal/platform/storage"
)

const (
	MaxUploadSize = 10 * 1024 * 1024 // 10 MB
)

var allowedMimeTypes = map[string]bool{
	"image/jpeg":    true,
	"image/jpg":     true,
	"image/png":     true,
	"image/gif":     true,
	"image/webp":    true,
	"image/svg+xml": true,
}

type Handler struct {
	storage storage.Service
}

func NewHandler(storage storage.Service) *Handler {
	return &Handler{storage: storage}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.UploadFile)
	return r
}

func (h *Handler) UploadFile(w http.ResponseWriter, r *http.Request) {
	// Limit request body
	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)

	if err := r.ParseMultipartForm(MaxUploadSize); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "File exceeds maximum allowed size (10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "No file provided under field 'file'")
		return
	}
	defer file.Close()

	// Sniff Content Type
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && n == 0 {
		httputil.RespondError(w, http.StatusBadRequest, "Failed to read file content")
		return
	}
	contentType := http.DetectContentType(buffer[:n])

	// Override if client provided svg
	if strings.HasSuffix(strings.ToLower(header.Filename), ".svg") {
		contentType = "image/svg+xml"
	}

	if !allowedMimeTypes[contentType] {
		httputil.RespondError(w, http.StatusBadRequest, fmt.Sprintf("Unsupported file format (%s). Only JPEG, PNG, GIF, WebP, and SVG images are allowed.", contentType))
		return
	}

	// Rewind file to beginning
	if _, err := file.Seek(0, 0); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to reset file stream: "+err.Error())
		return
	}

	// Build unique object key: <workspace_id>/images/<uuid7>_<clean_filename>
	wsID := middleware.GetWorkspaceID(r.Context())
	fileUUID, _ := uuid.NewV7()
	cleanExt := filepath.Ext(header.Filename)
	if cleanExt == "" {
		switch contentType {
		case "image/png":
			cleanExt = ".png"
		case "image/webp":
			cleanExt = ".webp"
		case "image/gif":
			cleanExt = ".gif"
		case "image/svg+xml":
			cleanExt = ".svg"
		default:
			cleanExt = ".jpg"
		}
	}

	baseName := strings.TrimSuffix(filepath.Base(header.Filename), cleanExt)
	// Sanitize baseName
	baseName = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			return r
		}
		return '_'
	}, baseName)
	if len(baseName) > 40 {
		baseName = baseName[:40]
	}

	objectKey := fmt.Sprintf("%s/images/%s_%s%s", wsID.String(), fileUUID.String(), baseName, cleanExt)

	// Perform upload to configured storage provider
	fileURL, err := h.storage.Upload(r.Context(), objectKey, file, header.Size, contentType)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Storage upload failed: "+err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"url":          fileURL,
			"object_key":   objectKey,
			"filename":     header.Filename,
			"size":         header.Size,
			"content_type": contentType,
			"driver":       h.storage.Driver(),
		},
	})
}
