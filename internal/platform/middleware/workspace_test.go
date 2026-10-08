package middleware

import (
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTenantAuthentication(t *testing.T) {
	ws, other := uuid.New(), uuid.New()
	secret := "test-secret"
	for _, tc := range []struct {
		name, header, issuer, method string
		expiry, dev, noToken         bool
		want                         int
	}{
		{name: "JWT workspace preserved without header", issuer: "orca-os", method: "HS256", expiry: true, want: 200},
		{name: "matching header", header: ws.String(), issuer: "orca-os", method: "HS256", expiry: true, want: 200},
		{name: "cross tenant", header: other.String(), issuer: "orca-os", method: "HS256", expiry: true, want: 403},
		{name: "invalid header", header: "invalid", issuer: "orca-os", method: "HS256", expiry: true, want: 400},
		{name: "header alone rejected", header: ws.String(), noToken: true, want: 401},
		{name: "explicit development bypass", header: ws.String(), noToken: true, dev: true, want: 200},
		{name: "wrong issuer", issuer: "other", method: "HS256", expiry: true, want: 401},
		{name: "missing expiry", issuer: "orca-os", method: "HS256", want: 401},
		{name: "wrong algorithm", issuer: "orca-os", method: "HS384", expiry: true, want: 401},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req.Header.Set("X-Workspace-ID", tc.header)
			if !tc.noToken {
				claims := AuthClaims{UserID: uuid.New(), WorkspaceID: ws, RegisteredClaims: jwt.RegisteredClaims{Issuer: tc.issuer}}
				if tc.expiry {
					claims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(time.Hour))
				}
				token, err := jwt.NewWithClaims(jwt.GetSigningMethod(tc.method), claims).SignedString([]byte(secret))
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("Authorization", "Bearer "+token)
			}
			called := false
			handler := RequireAuth(secret, tc.dev)(WorkspaceContext(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				if GetWorkspaceID(r.Context()) != ws {
					t.Error("tenant changed")
				}
				w.WriteHeader(200)
			})))
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("want %d got %d", tc.want, rec.Code)
			}
			if tc.want != 200 && called {
				t.Fatal("unauthorized domain handler called")
			}
		})
	}
}
func TestAuthRateLimit(t *testing.T) {
	handler := AuthRateLimit(2, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("POST", "/login", nil)
		req.RemoteAddr = "127.0.0.1:1000"
		req.Header.Set("X-Forwarded-For", uuid.NewString())
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		want := 200
		if i == 2 {
			want = 429
		}
		if rec.Code != want {
			t.Fatalf("attempt %d: %d", i, rec.Code)
		}
	}
	req := httptest.NewRequest("POST", "/login", nil)
	req.RemoteAddr = "127.0.0.2:1000"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatal("independent client blocked")
	}
}
