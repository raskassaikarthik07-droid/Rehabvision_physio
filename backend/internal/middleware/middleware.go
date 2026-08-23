package middleware

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"rehabvision/internal/auth"
	"rehabvision/internal/models"
)

const (
	ClaimsKey = "claims"
)

// RequestID adds a unique request ID to each request
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := uuid.New().String()
		c.Set("request_id", id)
		c.Header("X-Request-ID", id)
		c.Next()
	}
}

// Logger logs structured request info
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start)
		rid, _ := c.Get("request_id")
		log.Printf(`{"request_id":%q,"method":%q,"path":%q,"status":%d,"latency_ms":%d}`,
			rid, c.Request.Method, c.Request.URL.Path, c.Writer.Status(), latency.Milliseconds())
	}
}

// SecurityHeaders adds security headers to every response
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Content-Security-Policy", "default-src 'self'")
		c.Next()
	}
}

// BodyLimit limits request body size
func BodyLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

// Authenticate validates JWT from Authorization header or cookie
func Authenticate(jwtManager *auth.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractToken(c)
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		claims, err := jwtManager.Validate(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		c.Set(ClaimsKey, claims)
		c.Next()
	}
}

// RequireRole enforces a specific role
func RequireRole(roles ...models.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := getClaims(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		for _, r := range roles {
			if claims.Role == r {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

func extractToken(c *gin.Context) string {
	// Try Authorization header first
	header := c.GetHeader("Authorization")
	if strings.HasPrefix(header, "Bearer ") {
		return strings.TrimPrefix(header, "Bearer ")
	}
	// Fallback: cookie
	if cookie, err := c.Cookie("auth_token"); err == nil {
		return cookie
	}
	return ""
}

func getClaims(c *gin.Context) (*auth.Claims, bool) {
	val, exists := c.Get(ClaimsKey)
	if !exists {
		return nil, false
	}
	claims, ok := val.(*auth.Claims)
	return claims, ok
}

// GetClaimsFromContext is exported for handlers
func GetClaimsFromContext(c *gin.Context) (*auth.Claims, bool) {
	return getClaims(c)
}
