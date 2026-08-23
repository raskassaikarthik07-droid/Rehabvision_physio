package handlers_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"rehabvision/internal/auth"
	"rehabvision/internal/middleware"
	"rehabvision/internal/models"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ─── JWT Tests ────────────────────────────────────────────────────────────────

func TestJWTGenerateAndValidate(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", 1*time.Hour)
	user := &models.User{
		Email: "test@example.com",
		Name:  "Test User",
		Role:  models.RolePatient,
	}

	token, err := mgr.Generate(user)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if token == "" {
		t.Fatal("Expected non-empty token")
	}

	claims, err := mgr.Validate(token)
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if claims.Email != user.Email {
		t.Errorf("Email mismatch: got %s, want %s", claims.Email, user.Email)
	}
	if claims.Role != user.Role {
		t.Errorf("Role mismatch: got %s, want %s", claims.Role, user.Role)
	}
}

func TestJWTExpiredToken(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", -1*time.Second)
	user := &models.User{
		Email: "test@example.com",
		Role:  models.RolePatient,
	}

	token, err := mgr.Generate(user)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	_, err = mgr.Validate(token)
	if err == nil {
		t.Fatal("Expected error for expired token")
	}
}

func TestJWTInvalidSignature(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", 1*time.Hour)
	mgr2 := auth.NewJWTManager("different-secret-key-also-32chars-long-!", 1*time.Hour)

	user := &models.User{Email: "test@example.com", Role: models.RolePatient}
	token, _ := mgr.Generate(user)

	_, err := mgr2.Validate(token)
	if err == nil {
		t.Fatal("Expected error for token signed with different key")
	}
}

func TestJWTTamperedToken(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", 1*time.Hour)
	user := &models.User{Email: "test@example.com", Role: models.RolePatient}
	token, _ := mgr.Generate(user)

	// Tamper with the token
	parts := strings.Split(token, ".")
	if len(parts) == 3 {
		parts[1] = parts[1] + "tampered"
		tampered := strings.Join(parts, ".")
		_, err := mgr.Validate(tampered)
		if err == nil {
			t.Fatal("Expected error for tampered token")
		}
	}
}

func TestJWTRolePreservation(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", 1*time.Hour)
	roles := []models.Role{models.RolePatient, models.RolePhysiotherapist, models.RoleAdmin}

	for _, role := range roles {
		user := &models.User{Email: "test@example.com", Role: role}
		token, _ := mgr.Generate(user)
		claims, err := mgr.Validate(token)
		if err != nil {
			t.Errorf("Validate for role %s: %v", role, err)
			continue
		}
		if claims.Role != role {
			t.Errorf("Role mismatch for %s: got %s", role, claims.Role)
		}
	}
}

// ─── Middleware Tests ─────────────────────────────────────────────────────────

func TestAuthMiddlewareMissingToken(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", 1*time.Hour)
	router := gin.New()
	router.Use(middleware.Authenticate(mgr))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", w.Code)
	}
}

func TestAuthMiddlewareInvalidToken(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", 1*time.Hour)
	router := gin.New()
	router.Use(middleware.Authenticate(mgr))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer this.is.invalid")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", w.Code)
	}
}

func TestAuthMiddlewareValidToken(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", 1*time.Hour)
	router := gin.New()
	router.Use(middleware.Authenticate(mgr))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	user := &models.User{Email: "test@example.com", Role: models.RolePatient}
	token, _ := mgr.Generate(user)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", w.Code)
	}
}

func TestRequireRoleMiddleware(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", 1*time.Hour)

	router := gin.New()
	router.Use(middleware.Authenticate(mgr))
	router.GET("/physio-only",
		middleware.RequireRole(models.RolePhysiotherapist),
		func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	// Test with patient role — should be forbidden
	patient := &models.User{Email: "patient@example.com", Role: models.RolePatient}
	patientToken, _ := mgr.Generate(patient)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/physio-only", nil)
	req.Header.Set("Authorization", "Bearer "+patientToken)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403, got %d (patient accessing physio route)", w.Code)
	}

	// Test with physio role — should succeed
	physio := &models.User{Email: "physio@example.com", Role: models.RolePhysiotherapist}
	physioToken, _ := mgr.Generate(physio)

	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/physio-only", nil)
	req2.Header.Set("Authorization", "Bearer "+physioToken)
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("Expected 200 for physio, got %d", w2.Code)
	}
}

func TestRequireRoleAdminAccess(t *testing.T) {
	mgr := auth.NewJWTManager("this-is-a-long-enough-secret-for-testing-32ch", 1*time.Hour)

	router := gin.New()
	router.Use(middleware.Authenticate(mgr))
	router.GET("/admin-or-physio",
		middleware.RequireRole(models.RolePhysiotherapist, models.RoleAdmin),
		func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	admin := &models.User{Email: "admin@example.com", Role: models.RoleAdmin}
	adminToken, _ := mgr.Generate(admin)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin-or-physio", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 for admin, got %d", w.Code)
	}
}

// ─── Security Middleware Tests ────────────────────────────────────────────────

func TestSecurityHeaders(t *testing.T) {
	router := gin.New()
	router.Use(middleware.SecurityHeaders())
	router.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{}) })

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Error("Missing X-Content-Type-Options header")
	}
	if w.Header().Get("X-Frame-Options") != "DENY" {
		t.Error("Missing X-Frame-Options header")
	}
}

func TestRequestID(t *testing.T) {
	router := gin.New()
	router.Use(middleware.RequestID())
	router.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{}) })

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Header().Get("X-Request-ID") == "" {
		t.Error("Missing X-Request-ID header")
	}
}

func TestBodyLimitMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(middleware.BodyLimit(10)) // 10 bytes max
	router.POST("/test", func(c *gin.Context) {
		var body map[string]string
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, gin.H{})
	})

	// Send oversized body
	largeBody := strings.Repeat("a", 1000)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/test", strings.NewReader(`{"data":"`+largeBody+`"}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	// Should reject the oversized body
	if w.Code == http.StatusOK {
		t.Error("Expected error for oversized body")
	}
}

// ─── OAuth State Tests ────────────────────────────────────────────────────────

func TestOAuthStateGeneration(t *testing.T) {
	state1, err := auth.GenerateState()
	if err != nil {
		t.Fatalf("GenerateState: %v", err)
	}
	state2, err := auth.GenerateState()
	if err != nil {
		t.Fatalf("GenerateState: %v", err)
	}

	if state1 == "" {
		t.Error("Expected non-empty state")
	}
	if state1 == state2 {
		t.Error("States should be unique")
	}
	if len(state1) < 20 {
		t.Errorf("State too short: %d chars", len(state1))
	}
}
