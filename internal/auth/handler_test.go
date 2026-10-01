package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
)

func TestBcryptHashOrca12345(t *testing.T) {
	password := "orca12345"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to generate bcrypt hash: %v", err)
	}

	// Verify that password matches generated hash
	if err := bcrypt.CompareHashAndPassword(hash, []byte(password)); err != nil {
		t.Fatalf("bcrypt verification failed: %v", err)
	}

	t.Logf("Valid bcrypt hash for orca12345: %s", string(hash))
}

func TestHandler_Login_Validation(t *testing.T) {
	h := NewHandler(nil, "test_secret")
	router := h.PublicRoutes()

	// Missing email and password
	body := bytes.NewBufferString(`{}`)
	req := httptest.NewRequest("POST", "/login", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for empty login, got %d", rec.Code)
	}
}

func TestHandler_Register_Validation(t *testing.T) {
	h := NewHandler(nil, "test_secret")
	router := h.PublicRoutes()

	// Short password
	body := bytes.NewBufferString(`{"email":"test@example.com","password":"123","full_name":"Test User"}`)
	req := httptest.NewRequest("POST", "/register", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for short password, got %d", rec.Code)
	}
}

func TestGenerateAndVerifyToken(t *testing.T) {
	jwtSecret := "super_secret_test_key_12345"
	h := NewHandler(nil, jwtSecret)

	u := &User{
		ID:          uuid.New(),
		WorkspaceID: uuid.New(),
		Email:       "test@orca.local",
		FullName:    "Test User",
	}

	tokenStr, err := h.generateToken(u)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	if tokenStr == "" {
		t.Fatal("generated token is empty")
	}

	// Test middleware verification
	authMw := middleware.RequireAuth(jwtSecret, false)
	testedHandler := authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid := middleware.GetUserID(r.Context())
		if uid != u.ID {
			t.Fatalf("expected user id %s, got %s", u.ID, uid)
		}
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}))

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	rec := httptest.NewRecorder()

	testedHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
}
