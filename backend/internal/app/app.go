package app

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"rehabvision/internal/auth"
	"rehabvision/internal/config"
	"rehabvision/internal/database"
	"rehabvision/internal/gemini"
	"rehabvision/internal/handlers"
	"rehabvision/internal/middleware"
	"rehabvision/internal/models"
	"rehabvision/internal/repository"
	"rehabvision/internal/services"
)

// BuildRouter constructs and configures the complete Gin engine with all routes, middleware, and handlers.
func BuildRouter(cfg *config.Config, db *database.DB) (*gin.Engine, error) {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	// Repositories
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)

	// Auth
	jwtManager := auth.NewJWTManager(cfg.JWTSecret, cfg.JWTExpiry)
	oauthProvider := auth.NewGoogleProvider(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURL)

	// Services
	aiSvc := services.NewAIService(cfg)
	geminiCli := gemini.NewGeminiClient(cfg.GeminiAPIKey, cfg.GeminiModel, cfg.GeminiTimeout)

	// Handlers
	h := handlers.NewHandler(cfg, userRepo, sessionRepo, jwtManager, oauthProvider, aiSvc, geminiCli, db)

	router := gin.New()
	router.Use(middleware.RequestID())
	router.Use(middleware.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.SecurityHeaders())
	router.Use(middleware.BodyLimit(15 * 1024 * 1024)) // 15MB max body for snapshots

	// CORS configuration
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Request-ID"},
		ExposeHeaders:    []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health Endpoints (GET /health and GET /api/health)
	router.GET("/health", h.Health)
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "rehabvision-production",
		})
	})

	api := router.Group("/api/v1")
	{
		// Primary Password Authentication
		api.POST("/auth/register", h.Register)
		api.POST("/auth/login", h.Login)
		api.POST("/auth/logout", h.Logout)
		api.POST("/auth/dev-login", h.DevLogin)

		// Reference & Public Discovery
		api.GET("/exercises", h.ListExercises)
		api.GET("/reference/body-areas", h.ListBodyAreas)
		api.GET("/reference/specializations", h.ListSpecializations)
		api.GET("/physiotherapists", h.SearchPhysiotherapists)

		// Protected routes
		protected := api.Group("/")
		protected.Use(middleware.Authenticate(jwtManager))
		{
			protected.GET("/me", h.GetMe)
			protected.PUT("/profile/photo", h.UpdateProfilePhoto)

			// Patient specific routes
			patient := protected.Group("/patient")
			patient.Use(middleware.RequireRole(models.RolePatient, models.RoleAdmin))
			{
				patient.PUT("/profile", h.UpdatePatientProfile)
				patient.POST("/requests", h.CreatePhysioRequest)
				patient.GET("/requests", h.ListPatientRequests)
				patient.GET("/prescriptions/active", h.GetActivePrescription)
				patient.GET("/streak", h.GetPatientStreak)
				patient.GET("/analytics", h.GetPatientAnalytics)
			}

			// Sessions (Common / Patient)
			protected.POST("/sessions", h.CreateSession)
			protected.GET("/sessions", h.ListSessions)
			protected.GET("/sessions/:id", h.GetSession)
			protected.POST("/sessions/:id/analyze", h.AnalyzeFrame)
			protected.POST("/sessions/:id/complete", h.CompleteSession)

			// Dashboards
			protected.GET("/dashboard/patient", middleware.RequireRole(models.RolePatient, models.RoleAdmin), h.PatientDashboard)
			protected.GET("/dashboard/physiotherapist", middleware.RequireRole(models.RolePhysiotherapist, models.RoleAdmin), h.PhysioDashboard)

			// Physiotherapist Patient Management & Requests
			physio := protected.Group("/physiotherapist")
			physio.Use(middleware.RequireRole(models.RolePhysiotherapist, models.RoleAdmin))
			{
				physio.GET("/patients", h.ListAssignedPatients)
				physio.POST("/patients/assign", h.AssignPatient)
				physio.GET("/patients/:patientId", h.GetAssignedPatientDetail)
				physio.GET("/patients/:patientId/sessions", h.GetAssignedPatientSessions)
				physio.GET("/patients/:patientId/sessions/:sessionId", h.GetAssignedPatientSessionDetail)
				physio.GET("/patients/:patientId/progress", h.GetAssignedPatientProgress)

				// Requests Queue
				physio.GET("/requests", h.ListPhysioPendingRequests)
				physio.POST("/requests/:id/accept", h.AcceptPhysioRequest)
				physio.POST("/requests/:id/reject", h.RejectPhysioRequest)

				// Prescriptions
				physio.POST("/prescriptions/suggest", h.SuggestAIPrescription)
				physio.POST("/prescriptions", h.CreatePrescription)
			}

			// Emergency Safety Events & Notifications
			protected.POST("/emergency/event", h.RecordEmergencyEvent)
			protected.GET("/notifications", h.ListNotifications)
			protected.POST("/notifications/:id/read", h.MarkNotificationRead)
			protected.POST("/notifications/read-all", h.MarkAllNotificationsRead)

			// Direct Clinical Messaging
			protected.POST("/messages", h.SendMessage)
			protected.GET("/messages", h.ListMessages)

			// Application Ratings & Platform Feedback
			protected.POST("/ratings/app", h.SubmitAppRating)
			protected.GET("/ratings/app", h.GetAppRatings)

			// Physiotherapist Ratings & Clinical Feedback
			protected.POST("/feedback/physio", h.SubmitPhysioFeedback)
			protected.GET("/feedback/physio/:physioId", h.GetPhysioFeedback)

			// AI / Gemini — Server-side only
			protected.POST("/ai/session-summary", h.SessionSummary)
		}
	}

	return router, nil
}
