package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID  `json:"id"`
	WorkspaceID  uuid.UUID  `json:"workspace_id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	FullName     string     `json:"full_name"`
	AvatarURL    *string    `json:"avatar_url,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty"`
}

type UserProfile struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Email       string    `json:"email"`
	FullName    string    `json:"full_name"`
	AvatarURL   string    `json:"avatar_url"`
	Role        string    `json:"role"`
	CreatedAt   time.Time `json:"created_at"`
}

func (u *User) ToProfile() UserProfile {
	avatar := ""
	if u.AvatarURL != nil {
		avatar = *u.AvatarURL
	}
	return UserProfile{
		ID:          u.ID,
		WorkspaceID: u.WorkspaceID,
		Email:       u.Email,
		FullName:    u.FullName,
		AvatarURL:   avatar,
		Role:        "Owner",
		CreatedAt:   u.CreatedAt,
	}
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type UpdateProfileRequest struct {
	FullName        string  `json:"full_name"`
	Email           string  `json:"email"`
	AvatarURL       *string `json:"avatar_url,omitempty"`
	CurrentPassword string  `json:"current_password,omitempty"`
	NewPassword     string  `json:"new_password,omitempty"`
}

type AuthResponse struct {
	Token       string      `json:"token"`
	User        UserProfile `json:"user"`
	WorkspaceID uuid.UUID   `json:"workspace_id"`
}

type Claims struct {
	UserID      uuid.UUID `json:"user_id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Email       string    `json:"email"`
	jwt.RegisteredClaims
}
