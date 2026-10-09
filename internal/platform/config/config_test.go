package config

import (
	"strings"
	"testing"
)

func TestProductionConfiguration(t *testing.T) {
	for _, tc := range []struct {
		name, secret, env string
		bypass            bool
		valid             bool
	}{
		{"missing secret", "", "production", false, false},
		{"default secret", "orca_super_secret_jwt_key_2026_change_in_production", "production", false, false},
		{"short secret", "short", "production", false, false},
		{"valid secret", strings.Repeat("a", 32), "production", false, true},
		{"production bypass", strings.Repeat("a", 32), "production", true, false},
		{"development", "", "development", false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &Config{Env: tc.env, JWTSecret: tc.secret, AllowDevWorkspaceHeader: tc.bypass, DBMaxConns: 5}
			if (cfg.Validate() == nil) != tc.valid {
				t.Fatal("unexpected validation result")
			}
		})
	}
}
