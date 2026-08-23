package models

import (
	"time"

	"github.com/google/uuid"
)

// Role constants — never trust roles from the frontend
type Role string

const (
	RolePatient         Role = "patient"
	RolePhysiotherapist Role = "physiotherapist"
	RoleAdmin           Role = "admin"
)

// User is the core identity record
type User struct {
	ID           uuid.UUID `db:"id" json:"id"`
	Email        string    `db:"email" json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"` // Never expose password hash in JSON responses
	Name         string    `db:"name" json:"name"`
	Picture      string    `db:"picture" json:"picture"`
	Phone        string    `db:"phone" json:"phone"`
	Role         Role      `db:"role" json:"role"`
	Active       bool      `db:"active" json:"active"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// OAuthAccount links an OAuth provider identity to a User
type OAuthAccount struct {
	ID             uuid.UUID `db:"id"`
	UserID         uuid.UUID `db:"user_id"`
	Provider       string    `db:"provider"`
	ProviderUserID string    `db:"provider_user_id"`
	CreatedAt      time.Time `db:"created_at"`
	UpdatedAt      time.Time `db:"updated_at"`
}

// BodyArea reference lookup model
type BodyArea struct {
	ID          uuid.UUID `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	DisplayName string    `db:"display_name" json:"display_name"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// Specialization reference model
type Specialization struct {
	ID          uuid.UUID `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	DisplayName string    `db:"display_name" json:"display_name"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// EmergencyContact model
type EmergencyContact struct {
	ID           uuid.UUID `db:"id" json:"id"`
	PatientID    uuid.UUID `db:"patient_id" json:"patient_id"`
	ContactName  string    `db:"contact_name" json:"contact_name"`
	ContactPhone string    `db:"contact_phone" json:"contact_phone"`
	Relationship string    `db:"relationship" json:"relationship"`
	IsPrimary    bool      `db:"is_primary" json:"is_primary"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// Patient profile (extends user)
type Patient struct {
	ID               uuid.UUID  `db:"id" json:"id"`
	UserID           uuid.UUID  `db:"user_id" json:"user_id"`
	DateOfBirth      *time.Time `db:"date_of_birth" json:"date_of_birth,omitempty"`
	Age              int        `db:"age" json:"age"`
	Gender           string     `db:"gender" json:"gender"`
	Diagnosis        string     `db:"diagnosis" json:"diagnosis"`
	RehabGoals       string     `db:"rehab_goals" json:"rehab_goals"`
	BodyAreaID       *uuid.UUID `db:"body_area_id" json:"body_area_id,omitempty"`
	MobilityMode     string     `db:"mobility_mode" json:"mobility_mode"` // standard | wheelchair | seated_only | limited_lower_body
	Notes            string     `db:"notes" json:"notes"`
	AssignedPhysioID *uuid.UUID `db:"assigned_physio_id" json:"assigned_physio_id,omitempty"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`
}

// Physiotherapist profile
type Physiotherapist struct {
	ID               uuid.UUID        `db:"id" json:"id"`
	UserID           uuid.UUID        `db:"user_id" json:"user_id"`
	Speciality       string           `db:"speciality" json:"speciality"`
	LicenseNumber    string           `db:"license_number" json:"license_number"`
	InviteCode       string           `db:"invite_code" json:"invite_code"`
	Bio              string           `db:"bio" json:"bio"`
	AcceptingPatients bool            `db:"accepting_patients" json:"accepting_patients"`
	Specializations  []Specialization `json:"specializations,omitempty"`
	User             *User            `json:"user,omitempty"`
	CreatedAt        time.Time        `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time        `db:"updated_at" json:"updated_at"`
}

// PhysioRequest represents patient -> physio connection requests
type PhysioRequest struct {
	ID               uuid.UUID  `db:"id" json:"id"`
	PatientID        uuid.UUID  `db:"patient_id" json:"patient_id"`
	PhysioID         *uuid.UUID `db:"physio_id" json:"physio_id,omitempty"`
	RequestType      string     `db:"request_type" json:"request_type"` // invite_code | matching
	Status           string     `db:"status" json:"status"`             // pending | accepted | rejected | cancelled
	InviteCodeUsed   string     `db:"invite_code_used" json:"invite_code_used,omitempty"`
	BodyAreaID       *uuid.UUID `db:"body_area_id" json:"body_area_id,omitempty"`
	SpecializationID *uuid.UUID `db:"specialization_id" json:"specialization_id,omitempty"`
	RehabGoalNote    string     `db:"rehab_goal_note" json:"rehab_goal_note"`
	RejectionReason  string     `db:"rejection_reason" json:"rejection_reason,omitempty"`
	RespondedAt      *time.Time `db:"responded_at" json:"responded_at,omitempty"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`

	// Enriched fields
	PatientName    string `json:"patient_name,omitempty"`
	PatientPicture string `json:"patient_picture,omitempty"`
	PatientEmail   string `json:"patient_email,omitempty"`
	PatientPhone   string `json:"patient_phone,omitempty"`
	BodyAreaName   string `json:"body_area_name,omitempty"`
	PhysioName     string `json:"physio_name,omitempty"`
}

// PatientAssignment links patients to physiotherapists
type PatientAssignment struct {
	ID           uuid.UUID  `db:"id" json:"id"`
	PatientID    uuid.UUID  `db:"patient_id" json:"patient_id"`
	PhysioID     uuid.UUID  `db:"physio_id" json:"physio_id"`
	Status       string     `db:"status" json:"status"` // active | inactive
	RequestID    *uuid.UUID `db:"request_id" json:"request_id,omitempty"`
	AssignedAt   time.Time  `db:"assigned_at" json:"assigned_at"`
	EndedAt      *time.Time `db:"ended_at" json:"ended_at,omitempty"`
	UnassignedAt *time.Time `db:"unassigned_at" json:"unassigned_at,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
}

// PatientSummary includes patient profile and user details for physiotherapist dashboard
type PatientSummary struct {
	PatientID      uuid.UUID       `json:"patient_id"`
	UserID         uuid.UUID       `json:"user_id"`
	Name           string          `json:"name"`
	Email          string          `json:"email"`
	Picture        string          `json:"picture"`
	Phone          string          `json:"phone"`
	Age            int             `json:"age"`
	Diagnosis      string          `json:"diagnosis"`
	RehabGoals     string          `json:"rehab_goals"`
	BodyArea       string          `json:"body_area,omitempty"`
	MobilityMode   string          `json:"mobility_mode,omitempty"`
	EmergencyContact *EmergencyContact `json:"emergency_contact,omitempty"`
	AssignedAt     time.Time       `json:"assigned_at"`
	SessionCount   int             `json:"session_count"`
	AvgFormScore   float64         `json:"avg_form_score"`
	AvgROM         float64         `json:"avg_rom"`
	AvgPosture     float64         `json:"avg_posture"`
	RecoveryStatus string          `json:"recovery_status"` // Improving | Stable | Attention Needed
	LastSession    *time.Time      `json:"last_session,omitempty"`
}

// Prescription entity
type Prescription struct {
	ID           uuid.UUID              `db:"id" json:"id"`
	PatientID    uuid.UUID              `db:"patient_id" json:"patient_id"`
	PhysioID     uuid.UUID              `db:"physio_id" json:"physio_id"`
	Title        string                 `db:"title" json:"title"`
	Notes        string                 `db:"notes" json:"notes"`
	Status       string                 `db:"status" json:"status"` // draft | active | completed | archived
	AISuggested  bool                   `db:"ai_suggested" json:"ai_suggested"`
	GeminiPrompt string                 `db:"gemini_prompt" json:"gemini_prompt"`
	Exercises    []PrescriptionExercise `json:"exercises,omitempty"`
	PhysioName   string                 `json:"physio_name,omitempty"`
	CreatedAt    time.Time              `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time              `db:"updated_at" json:"updated_at"`
}

// PrescriptionExercise represents one configured exercise inside a prescription
type PrescriptionExercise struct {
	ID              uuid.UUID `db:"id" json:"id"`
	PrescriptionID  uuid.UUID `db:"prescription_id" json:"prescription_id"`
	ExerciseID      string    `db:"exercise_id" json:"exercise_id"`
	OrderIndex      int       `db:"order_index" json:"order_index"`
	TargetReps      int       `db:"target_reps" json:"target_reps"`
	TargetSets      int       `db:"target_sets" json:"target_sets"`
	RestSeconds     int       `db:"rest_seconds" json:"rest_seconds"`
	Difficulty      string    `db:"difficulty" json:"difficulty"`
	Instructions    string    `db:"instructions" json:"instructions"`
	SafetyNotes     string    `db:"safety_notes" json:"safety_notes"`
	FormCriteria    string    `db:"form_criteria" json:"form_criteria"`
	IsSeatedAdapted bool      `db:"is_seated_adapted" json:"is_seated_adapted"`
	Exercise        *Exercise `json:"exercise,omitempty"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

// PatientStreak model
type PatientStreak struct {
	ID                uuid.UUID  `db:"id" json:"id"`
	PatientID         uuid.UUID  `db:"patient_id" json:"patient_id"`
	CurrentStreak     int        `db:"current_streak" json:"current_streak"`
	LongestStreak     int        `db:"longest_streak" json:"longest_streak"`
	LastCompletedDate *time.Time `db:"last_completed_date" json:"last_completed_date,omitempty"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at" json:"updated_at"`
}

// EmergencyEvent model
type EmergencyEvent struct {
	ID                 uuid.UUID  `db:"id" json:"id"`
	PatientID          uuid.UUID  `db:"patient_id" json:"patient_id"`
	PhysioID           *uuid.UUID `db:"physio_id" json:"physio_id,omitempty"`
	EmergencyContactID *uuid.UUID `db:"emergency_contact_id" json:"emergency_contact_id,omitempty"`
	SessionID          *uuid.UUID `db:"session_id" json:"session_id,omitempty"`
	Stage              int        `db:"stage" json:"stage"` // 1 | 2 | 3
	EventType          string     `db:"event_type" json:"event_type"`
	DetectionState     string     `db:"detection_state" json:"detection_state"`
	EscalationStatus   string     `db:"escalation_status" json:"escalation_status"`
	Notes              string     `db:"notes" json:"notes"`
	CreatedAt          time.Time  `db:"created_at" json:"created_at"`
	ResolvedAt         *time.Time `db:"resolved_at" json:"resolved_at,omitempty"`

	// Enriched fields
	PatientName   string `json:"patient_name,omitempty"`
	ContactName   string `json:"contact_name,omitempty"`
	ContactPhone  string `json:"contact_phone,omitempty"`
}

// Notification model
type Notification struct {
	ID        uuid.UUID `db:"id" json:"id"`
	UserID    uuid.UUID `db:"user_id" json:"user_id"`
	Title     string    `db:"title" json:"title"`
	Message   string    `db:"message" json:"message"`
	Type      string    `db:"type" json:"type"`
	Read      bool      `db:"read" json:"read"`
	Link      string    `db:"link" json:"link"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// Exercise definition
type Exercise struct {
	ID                string    `db:"id" json:"id"`
	Name              string    `db:"name" json:"name"`
	Category          string    `db:"category" json:"category"`
	Description       string    `db:"description" json:"description"`
	TargetJoints      string    `db:"target_joints" json:"target_joints"`
	PrimaryAngleLabel string    `db:"primary_angle_label" json:"primary_angle_label"`
	TargetReps        int       `db:"target_reps" json:"target_reps"`
	TargetROMDegrees  int       `db:"target_rom_degrees" json:"target_rom_degrees"`
	Active            bool      `db:"active" json:"active"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
}

// ExerciseSession represents one session of exercise
type ExerciseSession struct {
	ID          uuid.UUID  `db:"id" json:"id"`
	PatientID   uuid.UUID  `db:"patient_id" json:"patient_id"`
	ExerciseID  string     `db:"exercise_id" json:"exercise_id"`
	StartedAt   time.Time  `db:"started_at" json:"started_at"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	Status      string     `db:"status" json:"status"` // active | completed | abandoned
	Notes       string     `db:"notes" json:"notes"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

// SessionWithScore combines session details with evaluated scores
type SessionWithScore struct {
	Session  ExerciseSession `json:"session"`
	Score    *SessionScore   `json:"score,omitempty"`
	Feedback []FormFeedback  `json:"feedback,omitempty"`
	User     *User           `json:"user,omitempty"`
}

// SessionScore holds computed scores for a session
type SessionScore struct {
	ID              uuid.UUID `db:"id" json:"id"`
	SessionID       uuid.UUID `db:"session_id" json:"session_id"`
	TotalReps       int       `db:"total_reps" json:"total_reps"`
	CorrectReps     int       `db:"correct_reps" json:"correct_reps"`
	AvgFormScore    float64   `db:"avg_form_score" json:"avg_form_score"`
	AvgROMPercent   float64   `db:"avg_rom_percent" json:"avg_rom_percent"`
	AvgSymmetry     float64   `db:"avg_symmetry" json:"avg_symmetry"`
	AvgStability    float64   `db:"avg_stability" json:"avg_stability"`
	PeakAngle       float64   `db:"peak_angle" json:"peak_angle"`
	DurationSeconds int       `db:"duration_seconds" json:"duration_seconds"`
	ComputedAt      time.Time `db:"computed_at" json:"computed_at"`
}

// FormFeedback stores detected form issues per session
type FormFeedback struct {
	ID          uuid.UUID `db:"id" json:"id"`
	SessionID   uuid.UUID `db:"session_id" json:"session_id"`
	IssueType   string    `db:"issue_type" json:"issue_type"`
	Description string    `db:"description" json:"description"`
	Frequency   int       `db:"frequency" json:"frequency"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// MovementMetric stores per-frame or per-rep metrics
type MovementMetric struct {
	ID             uuid.UUID `db:"id" json:"id"`
	SessionID      uuid.UUID `db:"session_id" json:"session_id"`
	RepNumber      int       `db:"rep_number" json:"rep_number"`
	PrimaryAngle   float64   `db:"primary_angle" json:"primary_angle"`
	KneeAngleLeft  float64   `db:"knee_angle_left" json:"knee_angle_left"`
	KneeAngleRight float64   `db:"knee_angle_right" json:"knee_angle_right"`
	ShoulderAngleL float64   `db:"shoulder_angle_left" json:"shoulder_angle_left"`
	ShoulderAngleR float64   `db:"shoulder_angle_right" json:"shoulder_angle_right"`
	HipAngleLeft   float64   `db:"hip_angle_left" json:"hip_angle_left"`
	HipAngleRight  float64   `db:"hip_angle_right" json:"hip_angle_right"`
	TrunkLean      float64   `db:"trunk_lean" json:"trunk_lean"`
	FormScore      float64   `db:"form_score" json:"form_score"`
	ROMPercent     float64   `db:"rom_percent" json:"rom_percent"`
	Symmetry       float64   `db:"symmetry" json:"symmetry"`
	Stability      float64   `db:"stability" json:"stability"`
	RecordedAt     time.Time `db:"recorded_at" json:"recorded_at"`
}

// GeminiSummary stores AI-generated session summaries
type GeminiSummary struct {
	ID          uuid.UUID `db:"id" json:"id"`
	SessionID   uuid.UUID `db:"session_id" json:"session_id"`
	Summary     string    `db:"summary" json:"summary"`
	Insights    string    `db:"insights" json:"insights"`
	GeneratedAt time.Time `db:"generated_at" json:"generated_at"`
	ModelUsed   string    `db:"model_used" json:"model_used"`
}

// Analytics aggregate representations
type AnalyticsPoint struct {
	Date            string  `json:"date"`
	DayLabel        string  `json:"day_label"`
	FormScore       float64 `json:"form_score"`
	PostureScore    float64 `json:"posture_score"`
	AccuracyScore   float64 `json:"accuracy_score"`
	RepsCompleted   int     `json:"reps_completed"`
	DurationMinutes float64 `json:"duration_minutes"`
	SessionCount    int     `json:"session_count"`
}

type PatientAnalyticsReport struct {
	TotalSessions       int              `json:"total_sessions"`
	TotalReps           int              `json:"total_reps"`
	AvgFormScore        float64          `json:"avg_form_score"`
	AvgPostureScore     float64          `json:"avg_posture_score"`
	AvgAccuracy         float64          `json:"avg_accuracy"`
	AdherenceRate       float64          `json:"adherence_rate"`
	CurrentStreak       int              `json:"current_streak"`
	LongestStreak       int              `json:"longest_streak"`
	WeeklyTrend         []AnalyticsPoint `json:"weekly_trend"`
	ExerciseBreakdown   []struct {
		ExerciseName string  `json:"exercise_name"`
		Sessions     int     `json:"sessions"`
		AvgScore     float64 `json:"avg_score"`
	} `json:"exercise_breakdown"`
}

// AuthSession tracks server-side sessions (for OAuth state)
type AuthSession struct {
	ID        uuid.UUID `db:"id"`
	UserID    uuid.UUID `db:"user_id"`
	Token     string    `db:"token"`
	ExpiresAt time.Time `db:"expires_at"`
	CreatedAt time.Time `db:"created_at"`
}

// Message represents direct clinical messaging between a patient and physiotherapist
type Message struct {
	ID         uuid.UUID  `db:"id" json:"id"`
	SenderID   uuid.UUID  `db:"sender_id" json:"sender_id"`
	ReceiverID uuid.UUID  `db:"receiver_id" json:"receiver_id"`
	PatientID  *uuid.UUID `db:"patient_id" json:"patient_id,omitempty"`
	PhysioID   *uuid.UUID `db:"physio_id" json:"physio_id,omitempty"`
	Content    string     `db:"content" json:"content"`
	ReadAt     *time.Time `db:"read_at" json:"read_at,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	SenderName string     `json:"sender_name,omitempty"`
	SenderRole string     `json:"sender_role,omitempty"`
}

// AppRating represents user rating & review for the RehabVision application
type AppRating struct {
	ID        uuid.UUID `db:"id" json:"id"`
	UserID    uuid.UUID `db:"user_id" json:"user_id"`
	Rating    int       `db:"rating" json:"rating"`
	Category  string    `db:"category" json:"category"`
	Feedback  string    `db:"feedback" json:"feedback"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UserName  string    `json:"user_name,omitempty"`
}

// PhysioFeedback represents patient ratings and clinical feedback for a physiotherapist
type PhysioFeedback struct {
	ID                    uuid.UUID `db:"id" json:"id"`
	PatientID             uuid.UUID `db:"patient_id" json:"patient_id"`
	PhysioID              uuid.UUID `db:"physio_id" json:"physio_id"`
	Rating                int       `db:"rating" json:"rating"`
	TreatmentSatisfaction int       `db:"treatment_satisfaction" json:"treatment_satisfaction"`
	Responsiveness        int       `db:"responsiveness" json:"responsiveness"`
	Comments              string    `db:"comments" json:"comments"`
	CreatedAt             time.Time `db:"created_at" json:"created_at"`
	PatientName           string    `json:"patient_name,omitempty"`
}

