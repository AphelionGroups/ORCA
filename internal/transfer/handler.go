package transfer

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct{ service *Service }

func NewHandler(service *Service) *Handler { return &Handler{service} }
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/export", h.Export)
	r.Post("/preview", h.Preview)
	r.Post("/import", h.Import)
	return r
}
func failure(w http.ResponseWriter, err error) {
	if strings.HasPrefix(err.Error(), "ORCA package:") {
		httputil.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	httputil.RespondDBError(w, err)
}
func (h *Handler) Export(w http.ResponseWriter, r *http.Request) {
	p, err := h.service.Export(r.Context(), middleware.GetWorkspaceID(r.Context()), Scope{r.URL.Query().Get("kind"), r.URL.Query().Get("id")})
	if err != nil {
		failure(w, err)
		return
	}
	data, err := Encode(p)
	if err != nil {
		failure(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="orca-`+p.Scope.Kind+`.orca.zip"`)
	w.Header().Set("Cache-Control", "no-store")
	w.Write(data)
}
func packageFile(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxPackageBytes+(1<<20))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		return nil, invalid("choose a package up to 128 MB")
	}
	defer r.MultipartForm.RemoveAll()
	file, _, err := r.FormFile("file")
	if err != nil {
		return nil, invalid("package file is required")
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, MaxPackageBytes+1))
	if err != nil || len(data) > MaxPackageBytes {
		return nil, invalid("cannot read package (maximum 128 MB)")
	}
	return data, nil
}
func (h *Handler) Preview(w http.ResponseWriter, r *http.Request) {
	data, err := packageFile(w, r)
	if err != nil {
		failure(w, err)
		return
	}
	p, err := Decode(data)
	if err != nil {
		failure(w, err)
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": p.preview(len(data))})
}
func (h *Handler) Import(w http.ResponseWriter, r *http.Request) {
	data, err := packageFile(w, r)
	if err != nil {
		failure(w, err)
		return
	}
	requestID, err := uuid.Parse(r.FormValue("request_id"))
	if err != nil || requestID == uuid.Nil {
		failure(w, invalid("valid import request ID is required"))
		return
	}
	result, err := h.service.Import(r.Context(), middleware.GetWorkspaceID(r.Context()), requestID, data, Destination{r.FormValue("space_id"), r.FormValue("project_id")})
	if err != nil {
		if errors.Is(err, httputil.ErrConflict) {
			httputil.RespondDBError(w, err)
		} else {
			failure(w, err)
		}
		return
	}
	httputil.RespondJSON(w, http.StatusOK, map[string]any{"data": result})
}
