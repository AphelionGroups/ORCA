package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/AphelionGroups/ORCA/internal/auth"
	"github.com/AphelionGroups/ORCA/internal/platform/config"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
)

func TestAuthRouteMounting(t *testing.T) {
	cfg := config.Load()
	r := chi.NewRouter()

	authRepo := auth.NewRepository(nil)
	authHandler := auth.NewHandler(authRepo, cfg.JWTSecret)

	authMw := middleware.RequireAuth(cfg.JWTSecret, true)

	r.Route("/api/v1", func(api chi.Router) {
		api.Mount("/auth", authHandler.Routes(authMw))

		api.Group(func(tenant chi.Router) {
			tenant.Use(authMw)
		})
	})

	body := bytes.NewBufferString(`{"email":"user@orca.local","password":"orca12345"}`)
	req := httptest.NewRequest("POST", "/api/v1/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	t.Logf("Response Code: %d, Body: %s", rec.Code, rec.Body.String())
	if rec.Code == http.StatusNotFound {
		t.Fatalf("Got 404 for /api/v1/auth/login!")
	}
}
