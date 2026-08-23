package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rehabvision/internal/auth"
	"rehabvision/internal/config"
	"rehabvision/internal/database"
	"rehabvision/internal/gemini"
	"rehabvision/internal/middleware"
	"rehabvision/internal/models"
	"rehabvision/internal/repository"
	"rehabvision/internal/services"
)

// Handler holds all dependencies for request handlers
type Handler struct {
	cfg         *config.Config
	userRepo    *repository.UserRepository
	sessionRepo *repository.SessionRepository
	jwtManager  *auth.JWTManager
	oauth       *auth.OAuthProvider
	aiSvc       *services.AIService
	geminiCli   *gemini.GeminiClient
	db          interface{ Health() error }
}

func NewHandler(
	cfg *config.Config,
	userRepo *repository.UserRepository,
	sessionRepo *repository.SessionRepository,
	jwtManager *auth.JWTManager,
	oauth *auth.OAuthProvider,
	aiSvc *services.AIService,
	geminiCli *gemini.GeminiClient,
	db interface{ Health() error },
) *Handler {
	return &Handler{
		cfg:         cfg,
		userRepo:    userRepo,
		sessionRepo: sessionRepo,
		jwtManager:  jwtManager,
		oauth:       oauth,
		aiSvc:       aiSvc,
		geminiCli:   geminiCli,
		db:          db,
	}
}

// ─── Health ───────────────────────────────────────────────────────────────────

func (h *Handler) Health(c *gin.Context) {
	dbOk := true
	if err := h.db.Health(); err != nil {
		dbOk = false
	}

	aiOk := true
	if err := h.aiSvc.Health(c.Request.Context()); err != nil {
		aiOk = false
	}

	status := "ok"
	if !dbOk {
		status = "degraded"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":           status,
		"service":          "rehabvision-backend",
		"db":               dbOk,
		"ai":               aiOk,
		"oauth_configured": h.cfg.OAuthConfigured(),
		"time":             time.Now().UTC(),
	})
}

// ─── Reference Data Endpoints ────────────────────────────────────────────────

func (h *Handler) ListBodyAreas(c *gin.Context) {
	areas, err := h.userRepo.ListBodyAreas(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch body areas"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"body_areas": areas})
}

func (h *Handler) ListSpecializations(c *gin.Context) {
	specs, err := h.userRepo.ListSpecializations(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch specializations"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"specializations": specs})
}

func (h *Handler) SearchPhysiotherapists(c *gin.Context) {
	spec := c.Query("specialization")
	inviteCode := c.Query("invite_code")

	physios, err := h.userRepo.SearchPhysiotherapists(c.Request.Context(), spec, inviteCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search physiotherapists"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"physiotherapists": physios})
}

// ─── Primary Password-Based Authentication ────────────────────────────────────

type RegisterRequest struct {
	Email                 string     `json:"email" binding:"required,email"`
	Password              string     `json:"password" binding:"required,min=6"`
	Name                  string     `json:"name" binding:"required"`
	Phone                 string     `json:"phone"`
	Picture               string     `json:"picture"`
	Role                  string     `json:"role" binding:"required"` // patient | physiotherapist
	Age                   int        `json:"age"`
	Gender                string     `json:"gender"`
	Diagnosis             string     `json:"diagnosis"`
	RehabGoals            string     `json:"rehab_goals"`
	BodyAreaID            *uuid.UUID `json:"body_area_id"`
	MobilityMode          string     `json:"mobility_mode"`
	EmergencyContactName  string     `json:"emergency_contact_name"`
	EmergencyContactPhone string     `json:"emergency_contact_phone"`
	EmergencyRelationship string     `json:"emergency_relationship"`
	Speciality            string     `json:"speciality"`
	LicenseNumber         string     `json:"license_number"`
	Bio                   string     `json:"bio"`
	SpecializationNames   []string   `json:"specialization_names"`
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid registration input: " + err.Error()})
		return
	}

	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role != string(models.RolePatient) && role != string(models.RolePhysiotherapist) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role must be 'patient' or 'physiotherapist'"})
		return
	}

	var user *models.User
	var err error

	if role == string(models.RolePatient) {
		user, _, err = h.userRepo.RegisterPatient(c.Request.Context(), repository.RegisterPatientParams{
			Email:                 req.Email,
			Password:              req.Password,
			Name:                  req.Name,
			Phone:                 req.Phone,
			Picture:               req.Picture,
			Age:                   req.Age,
			Gender:                req.Gender,
			Diagnosis:             req.Diagnosis,
			RehabGoals:            req.RehabGoals,
			BodyAreaID:            req.BodyAreaID,
			MobilityMode:          req.MobilityMode,
			EmergencyContactName:  req.EmergencyContactName,
			EmergencyContactPhone: req.EmergencyContactPhone,
			EmergencyRelationship: req.EmergencyRelationship,
		})
	} else {
		user, _, err = h.userRepo.RegisterPhysiotherapist(c.Request.Context(), repository.RegisterPhysioParams{
			Email:               req.Email,
			Password:            req.Password,
			Name:                req.Name,
			Phone:               req.Phone,
			Picture:             req.Picture,
			Speciality:          req.Speciality,
			LicenseNumber:       req.LicenseNumber,
			Bio:                 req.Bio,
			SpecializationNames: req.SpecializationNames,
		})
	}

	if err != nil {
		if errors.Is(err, repository.ErrAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "An account with this email address already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Account registration failed: " + err.Error()})
		return
	}

	token, err := h.jwtManager.Generate(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication session"})
		return
	}

	c.SetCookie("auth_token", token, int(h.cfg.JWTExpiry.Seconds()), "/", "", false, true)

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user": gin.H{
			"id":      user.ID,
			"email":   user.Email,
			"name":    user.Name,
			"picture": user.Picture,
			"phone":   user.Phone,
			"role":    user.Role,
		},
	})
}

type LoginRequest struct {
	Identifier string `json:"identifier" binding:"required"`
	Password   string `json:"password" binding:"required"`
	Role       string `json:"role"`
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Identifier and password are required"})
		return
	}

	expectedRole := models.Role(strings.ToLower(strings.TrimSpace(req.Role)))
	user, err := h.userRepo.Authenticate(c.Request.Context(), req.Identifier, req.Password, expectedRole)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email/ID or password"})
		return
	}

	token, err := h.jwtManager.Generate(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate session token"})
		return
	}

	c.SetCookie("auth_token", token, int(h.cfg.JWTExpiry.Seconds()), "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":      user.ID,
			"email":   user.Email,
			"name":    user.Name,
			"picture": user.Picture,
			"phone":   user.Phone,
			"role":    user.Role,
		},
	})
}

func (h *Handler) DevLogin(c *gin.Context) {
	var req struct {
		Role string `json:"role"`
	}
	_ = c.ShouldBindJSON(&req)
	role := models.Role(req.Role)
	if role != models.RolePhysiotherapist {
		role = models.RolePatient
	}

	var user *models.User
	var err error
	if role == models.RolePhysiotherapist {
		user, err = h.userRepo.FindByEmailOrID(c.Request.Context(), "priya.reddy@rehabvision.io")
	} else {
		user, err = h.userRepo.FindByEmailOrID(c.Request.Context(), "rahul.kumar@rehabvision.local")
	}

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Demo user account not found"})
		return
	}

	token, _ := h.jwtManager.Generate(user)
	c.SetCookie("auth_token", token, int(h.cfg.JWTExpiry.Seconds()), "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":      user.ID,
			"email":   user.Email,
			"name":    user.Name,
			"picture": user.Picture,
			"phone":   user.Phone,
			"role":    user.Role,
		},
	})
}

func (h *Handler) Logout(c *gin.Context) {
	c.SetCookie("auth_token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func (h *Handler) GetMe(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	user, err := h.userRepo.FindByID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User profile not found"})
		return
	}

	var patient *models.Patient
	var physio *models.Physiotherapist
	if user.Role == models.RolePatient {
		patient, _ = h.userRepo.GetPatientByUserID(c.Request.Context(), user.ID)
	} else if user.Role == models.RolePhysiotherapist {
		physio, _ = h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), user.ID)
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":      user.ID,
			"email":   user.Email,
			"name":    user.Name,
			"picture": user.Picture,
			"phone":   user.Phone,
			"role":    user.Role,
		},
		"patient":        patient,
		"physiotherapist": physio,
	})
}

func (h *Handler) UpdateProfilePhoto(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Picture string `json:"picture" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid picture data required"})
		return
	}

	if err := h.userRepo.UpdateProfilePhoto(c.Request.Context(), claims.UserID, req.Picture); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not update profile photo"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile photo updated successfully", "picture": req.Picture})
}

func (h *Handler) UpdatePatientProfile(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Name       string `json:"name"`
		Phone      string `json:"phone"`
		Diagnosis  string `json:"diagnosis"`
		RehabGoals string `json:"rehab_goals"`
		Age        int    `json:"age"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.userRepo.UpdatePatientProfile(c.Request.Context(), claims.UserID, req.Name, req.Phone, req.Diagnosis, req.RehabGoals, req.Age)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

// ─── Connection Requests & Workflow ──────────────────────────────────────────

type CreatePhysioRequestInput struct {
	PhysioID         *uuid.UUID `json:"physio_id"`
	RequestType      string     `json:"request_type"` // invite_code | matching
	InviteCode       string     `json:"invite_code"`
	BodyAreaID       *uuid.UUID `json:"body_area_id"`
	SpecializationID *uuid.UUID `json:"specialization_id"`
	RehabGoalNote    string     `json:"rehab_goal_note"`
}

func (h *Handler) CreatePhysioRequest(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePatient {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Only registered patients can submit requests"})
		return
	}

	patient, err := h.userRepo.GetPatientByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient profile not found"})
		return
	}

	var req CreatePhysioRequestInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reqType := req.RequestType
	if reqType == "" {
		if req.InviteCode != "" {
			reqType = "invite_code"
		} else {
			reqType = "matching"
		}
	}

	created, err := h.userRepo.CreatePhysioRequest(c.Request.Context(), repository.CreateRequestParams{
		PatientID:        patient.ID,
		PhysioID:         req.PhysioID,
		RequestType:      reqType,
		InviteCode:       req.InviteCode,
		BodyAreaID:       req.BodyAreaID,
		SpecializationID: req.SpecializationID,
		RehabGoalNote:    req.RehabGoalNote,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"request": created})
}

func (h *Handler) ListPatientRequests(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePatient {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	patient, err := h.userRepo.GetPatientByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient profile not found"})
		return
	}

	list, err := h.userRepo.ListPatientRequests(c.Request.Context(), patient.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list requests"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"requests": list})
}

func (h *Handler) ListPhysioPendingRequests(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePhysiotherapist {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	physio, err := h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physiotherapist profile not found"})
		return
	}

	list, err := h.userRepo.ListPendingRequestsForPhysio(c.Request.Context(), physio.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list pending requests"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"requests": list})
}

func (h *Handler) AcceptPhysioRequest(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePhysiotherapist {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	reqID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	physio, err := h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physiotherapist profile not found"})
		return
	}

	if err := h.userRepo.AcceptPhysioRequest(c.Request.Context(), reqID, physio.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept request: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Patient request accepted successfully"})
}

func (h *Handler) RejectPhysioRequest(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePhysiotherapist {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	reqID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)

	physio, err := h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physiotherapist profile not found"})
		return
	}

	if err := h.userRepo.RejectPhysioRequest(c.Request.Context(), reqID, physio.ID, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Request rejected"})
}

// ─── AI-Assisted Prescriptions ───────────────────────────────────────────────

func (h *Handler) SuggestAIPrescription(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePhysiotherapist {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		PatientID string `json:"patient_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	patUUID, err := uuid.Parse(req.PatientID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	var patient models.Patient
	var u models.User
	var bodyAreaName string

	// Query patient record directly
	row := h.db.(*database.DB).QueryRowContext(c.Request.Context(),
		`SELECT p.id, p.user_id, p.age, p.diagnosis, p.rehab_goals, p.mobility_mode, u.name, COALESCE(ba.display_name, 'General')
		 FROM patients p
		 JOIN users u ON u.id = p.user_id
		 LEFT JOIN body_areas ba ON ba.id = p.body_area_id
		 WHERE p.id = $1`, patUUID)

	err = row.Scan(&patient.ID, &patient.UserID, &patient.Age, &patient.Diagnosis, &patient.RehabGoals, &patient.MobilityMode, &u.Name, &bodyAreaName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient profile not found"})
		return
	}

	plan, err := h.geminiCli.GeneratePrescriptionPlan(c.Request.Context(), gemini.PrescriptionPatientContext{
		Name:         u.Name,
		Age:          patient.Age,
		Diagnosis:    patient.Diagnosis,
		RehabGoals:   patient.RehabGoals,
		BodyArea:     bodyAreaName,
		MobilityMode: patient.MobilityMode,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI prescription generator failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, plan)
}

func (h *Handler) CreatePrescription(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePhysiotherapist {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	physio, err := h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physiotherapist profile not found"})
		return
	}

	var req struct {
		PatientID    string                        `json:"patient_id" binding:"required"`
		Title        string                        `json:"title"`
		Notes        string                        `json:"notes"`
		AISuggested  bool                          `json:"ai_suggested"`
		GeminiPrompt string                        `json:"gemini_prompt"`
		Exercises    []models.PrescriptionExercise `json:"exercises" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	patUUID, err := uuid.Parse(req.PatientID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	title := req.Title
	if title == "" {
		title = "Active Rehabilitation Program"
	}

	presc, err := h.userRepo.CreatePrescription(c.Request.Context(), repository.CreatePrescriptionParams{
		PatientID:    patUUID,
		PhysioID:     physio.ID,
		Title:        title,
		Notes:        req.Notes,
		AISuggested:  req.AISuggested,
		GeminiPrompt: req.GeminiPrompt,
		Exercises:    req.Exercises,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create prescription: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"prescription": presc})
}

func (h *Handler) GetActivePrescription(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var patientID uuid.UUID
	if claims.Role == models.RolePatient {
		patient, err := h.userRepo.GetPatientByUserID(c.Request.Context(), claims.UserID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Patient profile not found"})
			return
		}
		patientID = patient.ID
	} else {
		// Physio querying for specific patient
		pIDStr := c.Query("patient_id")
		parsed, err := uuid.Parse(pIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Valid patient_id required"})
			return
		}
		patientID = parsed
	}

	presc, err := h.userRepo.GetActivePrescriptionForPatient(c.Request.Context(), patientID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusOK, gin.H{"prescription": nil})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get prescription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"prescription": presc})
}

// ─── Streaks, Analytics, Emergencies, Notifications ──────────────────────────

func (h *Handler) GetPatientStreak(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePatient {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	patient, err := h.userRepo.GetPatientByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient profile not found"})
		return
	}

	streak, err := h.userRepo.GetPatientStreak(c.Request.Context(), patient.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch streak"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"streak": streak})
}

func (h *Handler) GetPatientAnalytics(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var patientID uuid.UUID
	if claims.Role == models.RolePatient {
		patient, err := h.userRepo.GetPatientByUserID(c.Request.Context(), claims.UserID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Patient profile not found"})
			return
		}
		patientID = patient.ID
	} else {
		pIDStr := c.Query("patient_id")
		parsed, err := uuid.Parse(pIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Valid patient_id required"})
			return
		}
		patientID = parsed
	}

	timeframe := c.DefaultQuery("timeframe", "weekly")
	report, err := h.userRepo.GetPatientAnalytics(c.Request.Context(), patientID, timeframe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate analytics"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"analytics": report})
}

func (h *Handler) RecordEmergencyEvent(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	patient, err := h.userRepo.GetPatientByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient profile not found"})
		return
	}

	var req struct {
		SessionID       *string `json:"session_id"`
		Stage           int     `json:"stage"`
		EventType       string  `json:"event_type"`
		DetectionState  string  `json:"detection_state"`
		EscalationState string  `json:"escalation_state"`
		Notes           string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var sessUUID *uuid.UUID
	if req.SessionID != nil && *req.SessionID != "" {
		if parsed, err := uuid.Parse(*req.SessionID); err == nil {
			sessUUID = &parsed
		}
	}

	stage := req.Stage
	if stage <= 0 {
		stage = 1
	}
	eventType := req.EventType
	if eventType == "" {
		eventType = "face_loss"
	}
	escalation := req.EscalationState
	if escalation == "" {
		escalation = "triggered"
	}

	event, err := h.userRepo.RecordEmergencyEvent(c.Request.Context(), repository.CreateEmergencyEventParams{
		PatientID:       patient.ID,
		SessionID:       sessUUID,
		Stage:           stage,
		EventType:       eventType,
		DetectionState:  req.DetectionState,
		EscalationState: escalation,
		Notes:           req.Notes,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log emergency event"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"emergency_event": event})
}

func (h *Handler) ListNotifications(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	list, err := h.userRepo.ListNotifications(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"notifications": list})
}

func (h *Handler) MarkNotificationRead(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	notifID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	_ = h.userRepo.MarkNotificationRead(c.Request.Context(), notifID, claims.UserID)
	c.JSON(http.StatusOK, gin.H{"message": "Marked as read"})
}

func (h *Handler) MarkAllNotificationsRead(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	_ = h.userRepo.MarkAllNotificationsRead(c.Request.Context(), claims.UserID)
	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// ─── Session Management ──────────────────────────────────────────────────────

func (h *Handler) CreateSession(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		ExerciseID string `json:"exercise_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "exercise_id is required"})
		return
	}

	patientID, err := h.sessionRepo.GetPatientID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only registered patients can create exercise sessions"})
		return
	}

	session, err := h.sessionRepo.Create(c.Request.Context(), patientID, req.ExerciseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create session: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, session)
}

func (h *Handler) ListSessions(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	patientID, err := h.sessionRepo.GetPatientID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	sessions, err := h.sessionRepo.ListByPatient(c.Request.Context(), patientID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not list sessions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func (h *Handler) GetSession(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	session, err := h.sessionRepo.FindByID(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}

	if claims.Role == models.RolePatient {
		patientID, err := h.sessionRepo.GetPatientID(c.Request.Context(), claims.UserID)
		if err != nil || session.PatientID != patientID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
	}

	details, err := h.sessionRepo.GetSessionDetails(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve session details"})
		return
	}

	c.JSON(http.StatusOK, details)
}

func (h *Handler) AnalyzeFrame(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	var req struct {
		FrameB64   string `json:"frame_b64" binding:"required"`
		FrameIndex int    `json:"frame_index"`
		ExerciseID string `json:"exercise_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.aiSvc.AnalyzeFrame(c.Request.Context(), services.FrameAnalysisRequest{
		SessionID:  sessionID.String(),
		ExerciseID: req.ExerciseID,
		FrameB64:   req.FrameB64,
		FrameIndex: req.FrameIndex,
	})
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI Pose Service error: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

type CompleteSessionRequest struct {
	ExerciseID      string   `json:"exercise_id" binding:"required"`
	TotalReps       int      `json:"total_reps"`
	AvgFormScore    float64  `json:"avg_form_score"`
	AvgROMPercent   float64  `json:"avg_rom_percent"`
	AvgSymmetry     float64  `json:"avg_symmetry"`
	AvgStability    float64  `json:"avg_stability"`
	PeakAngle       float64  `json:"peak_angle"`
	DurationSeconds int      `json:"duration_seconds"`
	CommonIssues    []string `json:"common_issues"`
}

func (h *Handler) CompleteSession(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	var req CompleteSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	session, err := h.sessionRepo.FindByID(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}

	var patientID uuid.UUID
	if claims.Role == models.RolePatient {
		pID, err := h.sessionRepo.GetPatientID(c.Request.Context(), claims.UserID)
		if err != nil || session.PatientID != pID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
		patientID = pID
	} else {
		patientID = session.PatientID
	}

	score := &models.SessionScore{
		SessionID:       sessionID,
		TotalReps:       req.TotalReps,
		CorrectReps:     req.TotalReps,
		AvgFormScore:    clamp(req.AvgFormScore, 0, 100),
		AvgROMPercent:   clamp(req.AvgROMPercent, 0, 100),
		AvgSymmetry:     clamp(req.AvgSymmetry, 0, 100),
		AvgStability:    clamp(req.AvgStability, 0, 100),
		PeakAngle:       req.PeakAngle,
		DurationSeconds: req.DurationSeconds,
	}

	if err := h.sessionRepo.Complete(c.Request.Context(), sessionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not complete session"})
		return
	}

	if err := h.sessionRepo.SaveScore(c.Request.Context(), score); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not save session score"})
		return
	}

	if len(req.CommonIssues) > 0 {
		issueMap := make(map[string]int)
		for _, issue := range req.CommonIssues {
			issueMap[issue]++
		}
		h.sessionRepo.SaveFormFeedback(c.Request.Context(), sessionID, issueMap)
	}

	h.aiSvc.ClearSession(c.Request.Context(), sessionID)

	// Increment streak
	streak, inc, _ := h.userRepo.IncrementStreakIfCompletedToday(c.Request.Context(), patientID)

	c.JSON(http.StatusOK, gin.H{
		"session_id": sessionID,
		"score":      score,
		"streak":     streak,
		"streak_incremented": inc,
	})
}

// ─── Legacy & Common Handlers ────────────────────────────────────────────────

func (h *Handler) PatientDashboard(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	patientID, err := h.sessionRepo.GetPatientID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	sessions, _ := h.sessionRepo.ListByPatient(c.Request.Context(), patientID)
	streak, _ := h.userRepo.GetPatientStreak(c.Request.Context(), patientID)
	presc, _ := h.userRepo.GetActivePrescriptionForPatient(c.Request.Context(), patientID)
	analytics, _ := h.userRepo.GetPatientAnalytics(c.Request.Context(), patientID, "weekly")

	c.JSON(http.StatusOK, gin.H{
		"sessions":     sessions,
		"streak":       streak,
		"prescription": presc,
		"analytics":    analytics,
	})
}

func (h *Handler) PhysioDashboard(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePhysiotherapist {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	physio, err := h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physiotherapist profile not found"})
		return
	}

	patients, _ := h.userRepo.ListAssignedPatients(c.Request.Context(), physio.ID)
	pendingRequests, _ := h.userRepo.ListPendingRequestsForPhysio(c.Request.Context(), physio.ID)

	c.JSON(http.StatusOK, gin.H{
		"physiotherapist":  physio,
		"assigned_patients": patients,
		"pending_requests":  pendingRequests,
	})
}

func (h *Handler) ListAssignedPatients(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePhysiotherapist {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	physio, err := h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physiotherapist profile not found"})
		return
	}

	list, err := h.userRepo.ListAssignedPatients(c.Request.Context(), physio.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list patients"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"patients": list})
}

func (h *Handler) AssignPatient(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePhysiotherapist {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Identifier string `json:"identifier" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient identifier required"})
		return
	}

	pat, _, err := h.userRepo.FindPatientByEmailOrID(c.Request.Context(), req.Identifier)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	physio, err := h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physiotherapist profile not found"})
		return
	}

	_ = h.userRepo.AcceptPhysioRequest(c.Request.Context(), uuid.Nil, physio.ID)
	_, err = h.db.(*database.DB).ExecContext(c.Request.Context(),
		`INSERT INTO patient_assignments (patient_id, physio_id, status)
		 VALUES ($1, $2, 'active')
		 ON CONFLICT (patient_id, physio_id) DO UPDATE SET status = 'active', updated_at = NOW()`,
		pat.ID, physio.ID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign patient"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Patient successfully assigned"})
}

func (h *Handler) GetAssignedPatientDetail(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("patientId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	var p models.PatientSummary
	row := h.db.(*database.DB).QueryRowContext(c.Request.Context(),
		`SELECT p.id, p.user_id, u.name, u.email, u.picture, u.phone, p.age, p.diagnosis, p.rehab_goals,
		        COALESCE(ba.display_name, ''), p.mobility_mode, pa.assigned_at
		 FROM patients p
		 JOIN users u ON u.id = p.user_id
		 LEFT JOIN body_areas ba ON ba.id = p.body_area_id
		 LEFT JOIN patient_assignments pa ON pa.patient_id = p.id AND pa.status = 'active'
		 WHERE p.id = $1`, patientID)

	err = row.Scan(&p.PatientID, &p.UserID, &p.Name, &p.Email, &p.Picture, &p.Phone, &p.Age, &p.Diagnosis, &p.RehabGoals, &p.BodyArea, &p.MobilityMode, &p.AssignedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	c.JSON(http.StatusOK, p)
}

func (h *Handler) GetAssignedPatientSessions(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("patientId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	sessions, err := h.sessionRepo.ListByPatient(c.Request.Context(), patientID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not list sessions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func (h *Handler) GetAssignedPatientSessionDetail(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	details, err := h.sessionRepo.GetSessionDetails(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve details"})
		return
	}

	c.JSON(http.StatusOK, details)
}

func (h *Handler) GetAssignedPatientProgress(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("patientId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	analytics, err := h.userRepo.GetPatientAnalytics(c.Request.Context(), patientID, "weekly")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve progress"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"analytics": analytics})
}

func (h *Handler) SessionSummary(c *gin.Context) {
	var req struct {
		SessionID  string `json:"session_id" binding:"required"`
		ExerciseID string `json:"exercise_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sessUUID, err := uuid.Parse(req.SessionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	score, _ := h.sessionRepo.GetScore(c.Request.Context(), sessUUID)
	if score == nil {
		score = &models.SessionScore{
			TotalReps:       10,
			CorrectReps:     9,
			AvgFormScore:    90,
			AvgROMPercent:   92,
			AvgSymmetry:     95,
			AvgStability:    94,
			PeakAngle:       90,
			DurationSeconds: 45,
		}
	}

	summary, err := h.geminiCli.GenerateSessionSummary(c.Request.Context(), gemini.SessionMetrics{
		ExerciseID:      req.ExerciseID,
		ExerciseName:    exerciseName(req.ExerciseID),
		TotalReps:       score.TotalReps,
		CorrectReps:     score.CorrectReps,
		AvgFormScore:    score.AvgFormScore,
		AvgROMPercent:   score.AvgROMPercent,
		AvgSymmetry:     score.AvgSymmetry,
		AvgStability:    score.AvgStability,
		PeakAngle:       score.PeakAngle,
		DurationSeconds: score.DurationSeconds,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gemini error: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

func (h *Handler) ListExercises(c *gin.Context) {
	exercises := []gin.H{
		{
			"id": "sit_to_stand", "name": "Sit to Stand", "category": "lower_body",
			"description": "Functional sit-to-stand for lower limb strength, quadriceps activation, and mobility",
			"target_reps": 5, "target_rom_degrees": 155, "primary_angle_label": "Knee Angle",
			"is_seated_alternative": false,
		},
		{
			"id": "knee_extension", "name": "Seated Knee Extension", "category": "lower_body",
			"description": "Seated knee extension for quadriceps strengthening and patellar tracking",
			"target_reps": 10, "target_rom_degrees": 170, "primary_angle_label": "Knee Extension Angle",
			"is_seated_alternative": true,
		},
		{
			"id": "leg_raise", "name": "Straight Leg Raise", "category": "lower_body",
			"description": "Straight leg raise for hip flexor activation and quadriceps rehabilitation",
			"target_reps": 8, "target_rom_degrees": 45, "primary_angle_label": "Hip Angle",
			"is_seated_alternative": false,
		},
		{
			"id": "arm_raise", "name": "Arm / Shoulder Raise", "category": "upper_body",
			"description": "Frontal and lateral arm abduction for shoulder mobility and rotator cuff strength",
			"target_reps": 10, "target_rom_degrees": 90, "primary_angle_label": "Shoulder Abduction",
			"is_seated_alternative": true,
		},
		{
			"id": "squat", "name": "Rehabilitation Squat", "category": "lower_body",
			"description": "Full body biomechanical squat assessing knee flexion, hip depth, and back inclination",
			"target_reps": 10, "target_rom_degrees": 100, "primary_angle_label": "Knee Flexion Angle",
			"is_seated_alternative": false,
		},
		{
			"id": "neck_posture", "name": "Neck & Forward Head Alignment", "category": "posture",
			"description": "Real-time cervical and craniovertebral posture tracking to detect forward head position",
			"target_reps": 1, "target_rom_degrees": 50, "primary_angle_label": "Craniovertebral Angle",
			"is_seated_alternative": true,
		},
		{
			"id": "torso_bend", "name": "Back & Torso Bend Alignment", "category": "posture",
			"description": "Trunk inclination tracking calculating torso bend angle relative to vertical axis",
			"target_reps": 5, "target_rom_degrees": 45, "primary_angle_label": "Torso Inclination Angle",
			"is_seated_alternative": true,
		},
		{
			"id": "shoulder_symmetry", "name": "Shoulder Symmetry & Balance", "category": "upper_body",
			"description": "Bilateral shoulder height and elevation symmetry assessment for postural imbalance",
			"target_reps": 10, "target_rom_degrees": 95, "primary_angle_label": "Shoulder Balance Delta",
			"is_seated_alternative": true,
		},
		{
			"id": "knee_alignment", "name": "Knee Alignment & Valgus Tracking", "category": "lower_body",
			"description": "Frontal plane knee alignment tracking to detect valgus (inward) or varus collapse",
			"target_reps": 8, "target_rom_degrees": 175, "primary_angle_label": "Frontal Knee Angle",
			"is_seated_alternative": false,
		},
		{
			"id": "lateral_leg_raise", "name": "Lateral Leg Raise", "category": "lower_body",
			"description": "Side-lying or standing hip abduction targeting gluteus medius and pelvic stability",
			"target_reps": 8, "target_rom_degrees": 40, "primary_angle_label": "Hip Abduction Angle",
			"is_seated_alternative": false,
		},
	}
	c.JSON(http.StatusOK, gin.H{"exercises": exercises})
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func exerciseName(id string) string {
	names := map[string]string{
		"sit_to_stand":      "Sit to Stand",
		"knee_extension":    "Seated Knee Extension",
		"leg_raise":         "Straight Leg Raise",
		"arm_raise":         "Arm / Shoulder Raise",
		"squat":             "Rehabilitation Squat",
		"neck_posture":      "Neck & Forward Head Alignment",
		"torso_bend":        "Back & Torso Bend Alignment",
		"shoulder_symmetry": "Shoulder Symmetry & Balance",
		"knee_alignment":    "Knee Alignment & Valgus Tracking",
		"lateral_leg_raise": "Lateral Leg Raise",
	}
	if n, ok := names[id]; ok {
		return n
	}
	return id
}

// ─── Messaging Endpoints ─────────────────────────────────────────────────────

func (h *Handler) SendMessage(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		ReceiverID string `json:"receiver_id"`
		PatientID  string `json:"patient_id"`
		PhysioID   string `json:"physio_id"`
		Content    string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var senderUUID = claims.UserID
	var receiverUUID uuid.UUID
	var patUUID *uuid.UUID
	var physioUUID *uuid.UUID

	dbConn := h.db.(*database.DB)

	if claims.Role == models.RolePatient {
		// Sender is Patient
		pID, err := h.sessionRepo.GetPatientID(c.Request.Context(), senderUUID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Patient profile not found"})
			return
		}
		patUUID = &pID

		// Find assigned Physiotherapist
		var phID, phUserID uuid.UUID
		err = dbConn.QueryRowContext(c.Request.Context(), `
			SELECT pa.physio_id, ph.user_id
			FROM patient_assignments pa
			JOIN physiotherapists ph ON ph.id = pa.physio_id
			WHERE pa.patient_id = $1 AND pa.status = 'active'
			LIMIT 1
		`, pID).Scan(&phID, &phUserID)

		if err != nil {
			// Fallback to Priya Reddy
			_ = dbConn.QueryRowContext(c.Request.Context(), `
				SELECT ph.id, ph.user_id FROM physiotherapists ph LIMIT 1
			`).Scan(&phID, &phUserID)
		}

		physioUUID = &phID
		receiverUUID = phUserID

	} else {
		// Sender is Physiotherapist
		ph, err := h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), senderUUID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Physiotherapist profile not found"})
			return
		}
		physioUUID = &ph.ID

		if req.PatientID != "" {
			if p, err := uuid.Parse(req.PatientID); err == nil {
				patUUID = &p
				_ = dbConn.QueryRowContext(c.Request.Context(), `SELECT user_id FROM patients WHERE id = $1`, p).Scan(&receiverUUID)
			}
		} else if req.ReceiverID != "" {
			if rUUID, err := uuid.Parse(req.ReceiverID); err == nil {
				receiverUUID = rUUID
				var pID uuid.UUID
				if err := dbConn.QueryRowContext(c.Request.Context(), `SELECT id FROM patients WHERE user_id = $1`, rUUID).Scan(&pID); err == nil {
					patUUID = &pID
				}
			}
		}
	}

	if receiverUUID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Receiver not resolved"})
		return
	}

	msg, err := h.userRepo.SendMessage(c.Request.Context(), senderUUID, receiverUUID, patUUID, physioUUID, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": msg})
}

func (h *Handler) ListMessages(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	patientIDStr := c.Query("patient_id")
	physioIDStr := c.Query("physio_id")

	var patUUID uuid.UUID
	var physioUUID uuid.UUID

	dbConn := h.db.(*database.DB)

	if claims.Role == models.RolePatient {
		pID, err := h.sessionRepo.GetPatientID(c.Request.Context(), claims.UserID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
			return
		}
		patUUID = pID

		if physioIDStr != "" {
			if parsed, err := uuid.Parse(physioIDStr); err == nil {
				physioUUID = parsed
			}
		}

		if physioUUID == uuid.Nil {
			_ = dbConn.QueryRowContext(c.Request.Context(),
				`SELECT physio_id FROM patient_assignments WHERE patient_id = $1 AND status = 'active' LIMIT 1`, patUUID).Scan(&physioUUID)
		}
		if physioUUID == uuid.Nil {
			_ = dbConn.QueryRowContext(c.Request.Context(), `SELECT id FROM physiotherapists LIMIT 1`).Scan(&physioUUID)
		}
	} else if claims.Role == models.RolePhysiotherapist {
		ph, err := h.userRepo.GetPhysiotherapistByUserID(c.Request.Context(), claims.UserID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Physiotherapist not found"})
			return
		}
		physioUUID = ph.ID

		if patientIDStr != "" {
			patUUID, _ = uuid.Parse(patientIDStr)
		}
	}

	if patUUID == uuid.Nil || physioUUID == uuid.Nil {
		c.JSON(http.StatusOK, gin.H{"messages": []models.Message{}})
		return
	}

	list, err := h.userRepo.ListMessages(c.Request.Context(), patUUID, physioUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"messages": list})
}

// ─── App Rating & Feedback ───────────────────────────────────────────────────

func (h *Handler) SubmitAppRating(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Rating   int    `json:"rating" binding:"required"`
		Category string `json:"category"`
		Feedback string `json:"feedback"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Rating < 1 || req.Rating > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rating must be between 1 and 5"})
		return
	}
	if req.Category == "" {
		req.Category = "overall"
	}

	ar, err := h.userRepo.CreateAppRating(c.Request.Context(), claims.UserID, req.Rating, req.Category, req.Feedback)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit rating"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"rating": ar, "message": "Thank you for rating RehabVision!"})
}

func (h *Handler) GetAppRatings(c *gin.Context) {
	list, err := h.userRepo.ListAppRatings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ratings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ratings": list})
}

// ─── Physiotherapist Feedback ────────────────────────────────────────────────

func (h *Handler) SubmitPhysioFeedback(c *gin.Context) {
	claims, ok := middleware.GetClaimsFromContext(c)
	if !ok || claims.Role != models.RolePatient {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Only registered patients can submit physiotherapist feedback"})
		return
	}

	var req struct {
		PhysioID              string `json:"physio_id" binding:"required"`
		Rating                int    `json:"rating" binding:"required"`
		TreatmentSatisfaction int    `json:"treatment_satisfaction"`
		Responsiveness        int    `json:"responsiveness"`
		Comments              string `json:"comments"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	physioUUID, err := uuid.Parse(req.PhysioID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid physiotherapist ID"})
		return
	}

	patID, err := h.sessionRepo.GetPatientID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient profile not found"})
		return
	}

	if req.Rating < 1 || req.Rating > 5 {
		req.Rating = 5
	}
	if req.TreatmentSatisfaction < 1 || req.TreatmentSatisfaction > 5 {
		req.TreatmentSatisfaction = 5
	}
	if req.Responsiveness < 1 || req.Responsiveness > 5 {
		req.Responsiveness = 5
	}

	pf, err := h.userRepo.CreatePhysioFeedback(c.Request.Context(), patID, physioUUID, req.Rating, req.TreatmentSatisfaction, req.Responsiveness, req.Comments)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit feedback"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"feedback": pf, "message": "Clinical feedback submitted successfully!"})
}

func (h *Handler) GetPhysioFeedback(c *gin.Context) {
	physioUUID, err := uuid.Parse(c.Param("physioId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid physiotherapist ID"})
		return
	}

	list, err := h.userRepo.ListPhysioFeedback(c.Request.Context(), physioUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch feedback"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"feedbacks": list})
}

