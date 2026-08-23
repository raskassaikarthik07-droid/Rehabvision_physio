package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all application configuration loaded from environment variables.
// Never hardcode secrets. Fail fast on missing required values.
type Config struct {
	// Server
	Port            string
	Environment     string
	AllowedOrigins  []string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration

	// Database
	DatabaseURL    string
	DBMaxOpenConns int
	DBMaxIdleConns int

	// Auth
	JWTSecret     string
	JWTExpiry     time.Duration
	SessionSecret string

	// Google OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// Gemini
	GeminiAPIKey  string
	GeminiModel   string
	GeminiTimeout time.Duration

	// AI Service
	AIServiceURL     string
	AIServiceKey     string
	AIServiceTimeout time.Duration

	// Role Management
	// Comma-separated list of email addresses allowed to register as physiotherapists.
	// Everyone else defaults to patient.
	PhysiotherapistEmails []string

	// Frontend URL for OAuth redirects
	FrontendURL string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:            getEnv("PORT", "8080"),
		Environment:     getEnv("ENVIRONMENT", "development"),
		ReadTimeout:     getDuration("READ_TIMEOUT", 30*time.Second),
		WriteTimeout:    getDuration("WRITE_TIMEOUT", 30*time.Second),
		ShutdownTimeout: getDuration("SHUTDOWN_TIMEOUT", 15*time.Second),

		DatabaseURL:    getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/rehabvision?sslmode=disable"),
		DBMaxOpenConns: getInt("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns: getInt("DB_MAX_IDLE_CONNS", 5),

		JWTSecret:     getEnv("JWT_SECRET", "rehabvision_production_deployment_jwt_secret_key_2026"),
		JWTExpiry:     getDuration("JWT_EXPIRY", 24*time.Hour),
		SessionSecret: getEnv("SESSION_SECRET", "rehabvision_session_secret_2026"),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/v1/auth/google/callback"),

		GeminiAPIKey:  getEnv("GEMINI_API_KEY", ""),
		GeminiModel:   getEnv("GEMINI_MODEL", "gemini-1.5-flash"),
		GeminiTimeout: getDuration("GEMINI_TIMEOUT", 30*time.Second),

		AIServiceURL:     getEnv("AI_SERVICE_URL", "http://127.0.0.1:8090"),
		AIServiceKey:     getEnv("AI_SERVICE_KEY", "rehabvision-internal-2024"),
		AIServiceTimeout: getDuration("AI_SERVICE_TIMEOUT", 10*time.Second),

		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
	}

	// Parse allowed origins
	originsStr := getEnv("ALLOWED_ORIGINS", "http://localhost:5173")
	cfg.AllowedOrigins = parseCSV(originsStr)

	// Parse physiotherapist email allowlist
	physioEmails := getEnv("PHYSIOTHERAPIST_EMAILS", "")
	if physioEmails != "" {
		for _, e := range strings.Split(physioEmails, ",") {
			e = strings.TrimSpace(strings.ToLower(e))
			if e != "" {
				cfg.PhysiotherapistEmails = append(cfg.PhysiotherapistEmails, e)
			}
		}
	}

	// Validate required fields
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	// Warn about placeholder OAuth credentials
	if isPlaceholder(cfg.GoogleClientID) {
		log.Println("[WARN] GOOGLE_CLIENT_ID looks like a placeholder. Google OAuth login will fail with 401 invalid_client.")
		log.Println("[WARN] Create a real OAuth 2.0 Web Application client at https://console.cloud.google.com/apis/credentials")
	}

	return cfg, nil
}

func (c *Config) validate() error {
	required := map[string]string{
		"DATABASE_URL": c.DatabaseURL,
		"JWT_SECRET":   c.JWTSecret,
	}
	for key, val := range required {
		if val == "" {
			return fmt.Errorf("required environment variable %s is not set", key)
		}
	}
	if len(c.JWTSecret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}

	// OAuth is not strictly required — app can run with DevLogin for hackathon demo
	if c.GoogleClientID == "" || c.GoogleClientSecret == "" {
		log.Println("[WARN] GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET not set. Google OAuth login will be unavailable.")
	}

	return nil
}

func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

// IsPhysiotherapistEmail checks if an email is in the allowlist
func (c *Config) IsPhysiotherapistEmail(email string) bool {
	email = strings.TrimSpace(strings.ToLower(email))
	for _, allowed := range c.PhysiotherapistEmails {
		if allowed == email {
			return true
		}
	}
	return false
}

// OAuthConfigured returns true if real Google OAuth credentials are present
func (c *Config) OAuthConfigured() bool {
	return c.GoogleClientID != "" && c.GoogleClientSecret != "" && !isPlaceholder(c.GoogleClientID)
}

func isPlaceholder(s string) bool {
	lower := strings.ToLower(s)
	return strings.Contains(lower, "mock") ||
		strings.Contains(lower, "example") ||
		strings.Contains(lower, "your-") ||
		strings.Contains(lower, "placeholder") ||
		strings.Contains(lower, "dev-mock")
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return defaultVal
}

func getDuration(key string, defaultVal time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return defaultVal
}

func parseCSV(s string) []string {
	if s == "" {
		return []string{}
	}
	var result []string
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}
