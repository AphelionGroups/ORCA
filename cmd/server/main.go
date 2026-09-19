package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/AphelionGroups/ORCA/internal/board"
	"github.com/AphelionGroups/ORCA/internal/calendar"
	"github.com/AphelionGroups/ORCA/internal/doc"
	"github.com/AphelionGroups/ORCA/internal/link"
	"github.com/AphelionGroups/ORCA/internal/platform/config"
	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/AphelionGroups/ORCA/internal/project"
	"github.com/AphelionGroups/ORCA/internal/space"
	"github.com/AphelionGroups/ORCA/internal/task"
)

var startTime = time.Now()

func main() {
	cfg := config.Load()

	log.Printf("[ORCA-INIT] Starting ORCA Core API (env=%s, port=%s)", cfg.Env, cfg.Port)

	// Database Connection Pool
	ctx := context.Background()
	dbPool, err := db.NewPostgresPool(ctx, cfg.DatabaseURL, cfg.DBMaxConns, cfg.DBMinConns, cfg.DBMaxConnLifetime)
	if err != nil {
		log.Printf("[ORCA-WARN] Database connection ping failed: %v (will retry on healthcheck)", err)
	} else {
		log.Printf("[ORCA-INIT] Connected to PostgreSQL pool successfully")
	}

	if dbPool != nil {
		defer dbPool.Close()
	}

	// Router Setup
	r := chi.NewRouter()

	// Global Middlewares
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))

	// CORS Configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Workspace-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health Check Endpoint
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "connected"
		if dbPool == nil {
			dbStatus = "not_configured_or_unreachable"
		} else {
			pingCtx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := dbPool.Ping(pingCtx); err != nil {
				dbStatus = fmt.Sprintf("unreachable: %v", err)
			}
		}

		resp := map[string]any{
			"status":   "ok",
			"app":      "ORCA",
			"uptime":   time.Since(startTime).String(),
			"database": dbStatus,
			"time":     time.Now().UTC(),
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	})

	// API Routes Group
	r.Route("/api/v1", func(api chi.Router) {
		api.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"message": "pong",
				"version": "v0.1-alpha",
			})
		})

		// Workspace scoping middleware for all tenant data routes
		api.Group(func(tenant chi.Router) {
			tenant.Use(middleware.WorkspaceContext)

			if dbPool != nil {
				// Repositories
				spaceRepo := space.NewRepository(dbPool.Pool)
				projectRepo := project.NewRepository(dbPool.Pool)
				docRepo := doc.NewRepository(dbPool.Pool)
				taskRepo := task.NewRepository(dbPool.Pool)
				calendarRepo := calendar.NewRepository(dbPool.Pool)
				boardRepo := board.NewRepository(dbPool.Pool)
				linkRepo := link.NewRepository(dbPool.Pool)

				// Handlers
				spaceHandler := space.NewHandler(spaceRepo)
				projectHandler := project.NewHandler(projectRepo)
				docHandler := doc.NewHandler(docRepo)
				taskHandler := task.NewHandler(taskRepo)
				calendarHandler := calendar.NewHandler(calendarRepo)
				boardHandler := board.NewHandler(boardRepo)
				linkHandler := link.NewHandler(linkRepo)

				// Mount domain routes
				tenant.Mount("/spaces", spaceHandler.Routes())
				tenant.Mount("/projects", projectHandler.Routes())
				tenant.Mount("/documents", docHandler.Routes())
				tenant.Mount("/tasks", taskHandler.Routes())
				tenant.Mount("/events", calendarHandler.Routes())
				tenant.Mount("/boards", boardHandler.BoardRoutes())
				tenant.Mount("/blocks", boardHandler.BlockRoutes())
				tenant.Mount("/links", linkHandler.Routes())
			} else {
				tenant.HandleFunc("/*", func(w http.ResponseWriter, r *http.Request) {
					httputil.RespondError(w, http.StatusServiceUnavailable, "Database is not connected. Please start PostgreSQL container.")
				})
			}
		})
	})

	// HTTP Server & Graceful Shutdown
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("[ORCA-READY] Server listening on http://localhost:%s", cfg.Port)
		serverErrors <- srv.ListenAndServe()
	}()

	// Listen for shutdown signals
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[ORCA-FATAL] Server failed: %v", err)
		}
	case sig := <-shutdown:
		log.Printf("[ORCA-SHUTDOWN] Received signal %v, shutting down gracefully...", sig)
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("[ORCA-ERROR] Graceful shutdown failed: %v, forcing close", err)
			_ = srv.Close()
		}
		log.Printf("[ORCA-SHUTDOWN] Server stopped")
	}
}
