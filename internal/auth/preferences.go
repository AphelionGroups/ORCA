package auth

import (
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"net/http"
	"time"
	_ "time/tzdata"
)

func (h *Handler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	var zone *string
	err := h.repo.pool.QueryRow(r.Context(), `SELECT calendar_timezone FROM users WHERE id=$1 AND workspace_id=$2 AND deleted_at IS NULL`, middleware.GetUserID(r.Context()), middleware.GetWorkspaceID(r.Context())).Scan(&zone)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	httputil.RespondJSON(w, 200, map[string]any{"data": map[string]any{"calendar_timezone": zone}})
}
func (h *Handler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CalendarTimezone string `json:"calendar_timezone"`
	}
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, 400, "Invalid preference payload")
		return
	}
	if _, err := time.LoadLocation(req.CalendarTimezone); err != nil || req.CalendarTimezone == "" || req.CalendarTimezone == "Local" || len(req.CalendarTimezone) > 100 {
		httputil.RespondError(w, 400, "Invalid IANA timezone")
		return
	}
	result, err := h.repo.pool.Exec(r.Context(), `UPDATE users SET calendar_timezone=$1 WHERE id=$2 AND workspace_id=$3 AND deleted_at IS NULL`, req.CalendarTimezone, middleware.GetUserID(r.Context()), middleware.GetWorkspaceID(r.Context()))
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}
	if result.RowsAffected() != 1 {
		httputil.RespondDBError(w, httputil.ErrNotFound)
		return
	}
	httputil.RespondJSON(w, 200, map[string]any{"data": map[string]any{"calendar_timezone": req.CalendarTimezone}})
}
