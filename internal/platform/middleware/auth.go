package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
)

const (
	UserIDKey contextKey = "user_id"
)

type AuthClaims struct {
	UserID      uuid.UUID `json:"user_id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Email       string    `json:"email"`
	jwt.RegisteredClaims
}

// RequireAuth ensures a valid Bearer JWT is provided.
// If allowDevWorkspaceHeader is true and no Authorization header is present,
// it permits legacy/dev requests bearing X-Workspace-ID for local testing scripts.
func RequireAuth(jwtSecret string, allowDevWorkspaceHeader bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				if allowDevWorkspaceHeader && r.Header.Get("X-Workspace-ID") != "" {
					next.ServeHTTP(w, r)
					return
				}
				httputil.RespondError(w, http.StatusUnauthorized, "Missing or invalid authorization token")
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims := &AuthClaims{}

			token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				httputil.RespondError(w, http.StatusUnauthorized, "Unauthorized: token expired or invalid")
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, WorkspaceIDKey, claims.WorkspaceID)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID extracts user id from context
func GetUserID(ctx context.Context) uuid.UUID {
	if val, ok := ctx.Value(UserIDKey).(uuid.UUID); ok && val != uuid.Nil {
		return val
	}
	return uuid.Nil
}
