package auth

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"github.com/AphelionGroups/ORCA/internal/platform/middleware"
)

type Handler struct {
	repo                *Repository
	jwtSecret           string
	registrationEnabled bool
	authLimit           func(http.Handler) http.Handler
}

func NewHandler(repo *Repository, jwtSecret string) *Handler {
	return &Handler{
		repo:                repo,
		jwtSecret:           jwtSecret,
		registrationEnabled: true,
		authLimit:           middleware.AuthRateLimit(30, time.Minute),
	}
}

func (h *Handler) Routes(authMiddleware func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Group(func(public chi.Router) {
		public.Use(h.authLimit)
		public.Post("/login", h.Login)
		public.Post("/register", h.Register)
	})

	// Protected routes
	r.Group(func(protected chi.Router) {
		if authMiddleware != nil {
			protected.Use(authMiddleware)
		}
		protected.Get("/me", h.Me)
		protected.Put("/profile", h.UpdateProfile)
		protected.Post("/change-password", h.ChangePassword)
	})

	return r
}

func (h *Handler) PublicRoutes() chi.Router {
	r := chi.NewRouter()
	r.Group(func(public chi.Router) {
		public.Use(h.authLimit)
		public.Post("/login", h.Login)
		public.Post("/register", h.Register)
	})
	return r
}

func (h *Handler) ProtectedRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/me", h.Me)
	r.Put("/profile", h.UpdateProfile)
	r.Post("/change-password", h.ChangePassword)
	return r
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		httputil.RespondError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	if h.repo == nil || h.repo.pool == nil {
		httputil.RespondError(w, http.StatusServiceUnavailable, "Database is not connected. Please verify PostgreSQL connection.")
		return
	}

	user, err := h.repo.GetByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.RespondError(w, http.StatusUnauthorized, "Invalid email or password")
			return
		}
		httputil.RespondDBError(w, err)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		httputil.RespondError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	token, err := h.generateToken(user)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"data": AuthResponse{
			Token:       token,
			User:        user.ToProfile(),
			WorkspaceID: user.WorkspaceID,
		},
	})
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if !h.registrationEnabled {
		httputil.RespondError(w, http.StatusForbidden, "Registration is disabled")
		return
	}
	var req RegisterRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	req.FullName = strings.TrimSpace(req.FullName)
	if req.Email == "" || req.Password == "" || req.FullName == "" {
		httputil.RespondError(w, http.StatusBadRequest, "Full name, email, and password are required")
		return
	}

	if len(req.Password) < 6 {
		httputil.RespondError(w, http.StatusBadRequest, "Password must be at least 6 characters")
		return
	}

	if h.repo == nil || h.repo.pool == nil {
		httputil.RespondError(w, http.StatusServiceUnavailable, "Database is not connected. Please verify PostgreSQL connection.")
		return
	}

	// Check if user already exists
	existing, lookupErr := h.repo.GetByEmail(r.Context(), req.Email)
	if lookupErr != nil && !errors.Is(lookupErr, ErrUserNotFound) {
		httputil.RespondError(w, http.StatusServiceUnavailable, "Registration is temporarily unavailable")
		return
	}
	if existing != nil {
		httputil.RespondError(w, http.StatusConflict, "Email is already registered")
		return
	}

	wsID, err := uuid.NewV7()
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, "Failed to create workspace ID")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	newUserID, err := uuid.NewV7()
	if err != nil {
		newUserID = uuid.New()
	}

	user := &User{
		ID:           newUserID,
		WorkspaceID:  wsID,
		Email:        req.Email,
		PasswordHash: string(hash),
		FullName:     req.FullName,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := h.repo.CreateWithWorkspace(r.Context(), user); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	token, err := h.generateToken(user)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusCreated, map[string]any{
		"data": AuthResponse{
			Token:       token,
			User:        user.ToProfile(),
			WorkspaceID: user.WorkspaceID,
		},
	})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == uuid.Nil {
		httputil.RespondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := h.repo.GetByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.RespondError(w, http.StatusNotFound, "User not found")
			return
		}
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"data": user.ToProfile(),
	})
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == uuid.Nil {
		httputil.RespondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req UpdateProfileRequest
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	req.FullName = strings.TrimSpace(req.FullName)
	req.Email = strings.TrimSpace(req.Email)
	if req.FullName == "" || req.Email == "" {
		httputil.RespondError(w, http.StatusBadRequest, "Full name and email are required")
		return
	}

	// If changing password as part of profile update
	if req.NewPassword != "" {
		if req.CurrentPassword == "" {
			httputil.RespondError(w, http.StatusBadRequest, "Current password is required to set a new password")
			return
		}
		if len(req.NewPassword) < 6 {
			httputil.RespondError(w, http.StatusBadRequest, "New password must be at least 6 characters")
			return
		}

		user, err := h.repo.GetByID(r.Context(), userID)
		if err != nil {
			httputil.RespondDBError(w, err)
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
			httputil.RespondError(w, http.StatusBadRequest, "Incorrect current password")
			return
		}

		newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			httputil.RespondDBError(w, err)
			return
		}

		if err := h.repo.UpdatePassword(r.Context(), userID, string(newHash)); err != nil {
			httputil.RespondDBError(w, err)
			return
		}
	}

	if err := h.repo.UpdateProfile(r.Context(), userID, req.FullName, req.Email, req.AvatarURL); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	updated, err := h.repo.GetByID(r.Context(), userID)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"data": updated.ToProfile(),
	})
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == uuid.Nil {
		httputil.RespondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := httputil.ParseJSON(r, &req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	if len(req.NewPassword) < 6 {
		httputil.RespondError(w, http.StatusBadRequest, "New password must be at least 6 characters")
		return
	}

	user, err := h.repo.GetByID(r.Context(), userID)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Incorrect current password")
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	if err := h.repo.UpdatePassword(r.Context(), userID, string(newHash)); err != nil {
		httputil.RespondDBError(w, err)
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"message": "Password updated successfully",
	})
}

func (h *Handler) generateToken(u *User) (string, error) {
	claims := middleware.AuthClaims{
		UserID:      u.ID,
		WorkspaceID: u.WorkspaceID,
		Email:       u.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "orca-os",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}

func (h *Handler) SetRegistrationEnabled(enabled bool) { h.registrationEnabled = enabled }
