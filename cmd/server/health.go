package main

import (
	"context"
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/storage"
	"net/http"
	"time"
)

type databasePinger interface{ Ping(context.Context) error }

func readinessHandler(database databasePinger, store storage.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := http.StatusOK
		dbStatus := "connected"
		health := "ok"
		driver := "unavailable"
		if store != nil {
			driver = store.Driver()
		} else {
			status = http.StatusServiceUnavailable
		}
		if database == nil {
			dbStatus = "unavailable"
			status = http.StatusServiceUnavailable
		} else {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := database.Ping(ctx); err != nil {
				dbStatus = "unavailable"
				status = http.StatusServiceUnavailable
			}
		}
		if status != http.StatusOK {
			health = "unavailable"
		}
		httputil.RespondJSON(w, status, map[string]any{"status": health, "app": "ORCA", "database": dbStatus, "storage": driver, "uptime": time.Since(startTime).String(), "time": time.Now().UTC()})
	}
}
