package middleware

import (
	"github.com/AphelionGroups/ORCA/internal/platform/httputil"
	"net"
	"net/http"
	"sync"
	"time"
)

type rateWindow struct {
	count int
	until time.Time
}

// AuthRateLimit bounds both attempts and memory. Forwarded headers are not trusted.
func AuthRateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	var mu sync.Mutex
	attempts := make(map[string]rateWindow)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			host, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				host = r.RemoteAddr
			}
			now := time.Now()
			mu.Lock()
			for key, entry := range attempts {
				if !now.Before(entry.until) {
					delete(attempts, key)
				}
			}
			entry, exists := attempts[host]
			if !exists {
				entry = rateWindow{until: now.Add(window)}
			}
			blocked := entry.count >= limit || (!exists && len(attempts) >= 4096)
			if !blocked {
				entry.count++
				attempts[host] = entry
			}
			mu.Unlock()
			if blocked {
				w.Header().Set("Retry-After", "60")
				httputil.RespondError(w, http.StatusTooManyRequests, "Too many authentication attempts; try again later")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
