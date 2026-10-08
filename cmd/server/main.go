package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/AphelionGroups/ORCA/internal/auth"
	"github.com/AphelionGroups/ORCA/internal/board"
	"github.com/AphelionGroups/ORCA/internal/calendar"
	"github.com/AphelionGroups/ORCA/internal/doc"
	"github.com/AphelionGroups/ORCA/internal/inbox"
	"github.com/AphelionGroups/ORCA/internal/link"
	"github.com/AphelionGroups/ORCA/internal/platform/config"
	"github.com/AphelionGroups/ORCA/internal/platform/db"
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
	"github.com/AphelionGroups/ORCA/internal/platform/storage"
	"github.com/AphelionGroups/ORCA/internal/project"
	"github.com/AphelionGroups/ORCA/internal/space"
	"github.com/AphelionGroups/ORCA/internal/task"
	"github.com/AphelionGroups/ORCA/internal/upload"
)

var startTime = time.Now()

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("[ORCA-FATAL] Invalid configuration: %v", err)
	}

	log.Printf("[ORCA-INIT] Starting ORCA Core API (env=%s, port=%s, storage=%s)", cfg.Env, cfg.Port, cfg.StorageDriver)

	// Database Connection Pool
	ctx := context.Background()
	dbPool, err := db.NewPostgresPool(ctx, cfg.DatabaseURL, cfg.DBMaxConns, cfg.DBMinConns, cfg.DBMaxConnLifetime)
	if err != nil {
		if cfg.Env == "production" {
			log.Fatalf("[ORCA-FATAL] Database unavailable: %v", err)
		}
		log.Printf("[ORCA-WARN] Database connection ping failed: %v (will retry on healthcheck)", err)
	} else {
		log.Printf("[ORCA-INIT] Connected to PostgreSQL pool successfully")

		// 1. Automatic Database Migrations on Startup
		if cfg.AutoMigrate {
			if err := db.AutoMigrate(ctx, dbPool.Pool); err != nil {
				log.Fatalf("[ORCA-FATAL] Migration failed: %v", err)
			}
		}
	}

	if dbPool != nil {
		defer dbPool.Close()
	}

	// 2. Object Storage Initialization (Supabase, R2, AWS, MinIO, or Local)
	storageSvc, err := storage.InitStorage(ctx, cfg)
	if err != nil {
		log.Fatalf("[ORCA-FATAL] Storage initialization failed: %v", err)
	}

	// Router Setup
	r := chi.NewRouter()

	// Global Middlewares
	r.Use(chimiddleware.RequestID)
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

	// Local Storage Static Serving (if local storage driver is used)
	if localStore, ok := storageSvc.(*storage.LocalStorage); ok {
		r.Handle("/uploads/*", uploadedAssetsHandler(localStore.BaseDir()))
	}

	// Health Check Endpoint
	r.Get("/livez", func(w http.ResponseWriter, r *http.Request) {
		httputil.RespondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	var database databasePinger
	if dbPool != nil {
		database = dbPool
	}
	r.Get("/healthz", readinessHandler(database, storageSvc))

	// API Routes Group
	r.Route("/api/v1", func(api chi.Router) {
		api.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"message": "pong",
				"version": "v0.1-alpha",
			})
		})

		// Initialize Auth Handler
		var authRepo *auth.Repository
		if dbPool != nil {
			authRepo = auth.NewRepository(dbPool.Pool)
		} else {
			authRepo = auth.NewRepository(nil)
		}
		authHandler := auth.NewHandler(authRepo, cfg.JWTSecret)
		authHandler.SetRegistrationEnabled(cfg.AllowRegistration)
		authMw := middleware.RequireAuth(cfg.JWTSecret, cfg.Env == "development" && cfg.AllowDevWorkspaceHeader)

		// Mount Auth routes (Login, Register public; /me, /profile protected)
		api.Mount("/auth", authHandler.Routes(authMw))

		// Workspace and Auth scoping middleware for all tenant data routes
		api.Group(func(tenant chi.Router) {
			// Require Bearer token authentication (with dev fallback for X-Workspace-ID in development)
			tenant.Use(authMw)
			tenant.Use(middleware.WorkspaceContext)

			if dbPool != nil {
				// Repositories
				spaceRepo := space.NewRepository(dbPool.Pool)
				projectRepo := project.NewRepository(dbPool.Pool)
				docRepo := doc.NewRepository(dbPool.Pool)
				inboxRepo := inbox.NewRepository(dbPool.Pool)
				taskRepo := task.NewRepository(dbPool.Pool)
				calendarRepo := calendar.NewRepository(dbPool.Pool)
				boardRepo := board.NewRepository(dbPool.Pool)
				linkRepo := link.NewRepository(dbPool.Pool)

				// Handlers
				spaceHandler := space.NewHandler(spaceRepo)
				projectHandler := project.NewHandler(projectRepo)
				docHandler := doc.NewHandler(docRepo)
				inboxHandler := inbox.NewHandler(inboxRepo)
				taskHandler := task.NewHandler(taskRepo)
				calendarHandler := calendar.NewHandler(calendarRepo)
				boardHandler := board.NewHandler(boardRepo)
				linkHandler := link.NewHandler(linkRepo)
				uploadHandler := upload.NewHandler(storageSvc)

				// Alias profile routes directly under /api/v1/profile
				tenant.Get("/profile", authHandler.Me)
				tenant.Put("/profile", authHandler.UpdateProfile)

				// Uploads endpoint
				tenant.Mount("/upload", uploadHandler.Routes())

				// Domain routes
				tenant.Mount("/spaces", spaceHandler.Routes())
				tenant.Mount("/projects", projectHandler.Routes())
				tenant.Mount("/documents", docHandler.Routes())
				tenant.Mount("/inbox", inboxHandler.Routes())
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
