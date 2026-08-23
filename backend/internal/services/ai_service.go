package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"rehabvision/internal/config"
)

// AIService is the Go-side client for the Python FastAPI AI service.
// All AI inference happens in the Python service; the Go backend proxies and stores results.
type AIService struct {
	baseURL    string
	serviceKey string
	client     *http.Client
}

func NewAIService(cfg *config.Config) *AIService {
	return &AIService{
		baseURL:    cfg.AIServiceURL,
		serviceKey: cfg.AIServiceKey,
		client: &http.Client{
			Timeout: cfg.AIServiceTimeout,
		},
	}
}

// FrameAnalysisRequest mirrors the Python AI service's FrameRequest
type FrameAnalysisRequest struct {
	SessionID   string `json:"session_id"`
	ExerciseID  string `json:"exercise_id"`
	FrameB64    string `json:"frame_b64"`
	FrameIndex  int    `json:"frame_index"`
}

// FrameAnalysisResponse mirrors the Python AI service's FrameResponse
type FrameAnalysisResponse struct {
	SessionID          string    `json:"session_id"`
	ExerciseID         string    `json:"exercise_id"`
	FrameIndex         int       `json:"frame_index"`
	RepCount           int       `json:"rep_count"`
	Phase              string    `json:"phase"`
	PrimaryAngle       float64   `json:"primary_angle"`
	ROMPercentage      float64   `json:"rom_percentage"`
	FormScore          float64   `json:"form_score"`
	SymmetryScore      float64   `json:"symmetry_score"`
	StabilityScore     float64   `json:"stability_score"`
	LandmarkConfidence float64   `json:"landmark_confidence"`
	Issues             []string  `json:"issues"`
	PositiveFeedback   []string  `json:"positive_feedback"`
	MovementQuality    string    `json:"movement_quality"`
	JointAngles        JointAnglesDTO `json:"joint_angles"`
	Landmarks          []LandmarkDTO  `json:"landmarks,omitempty"`
	ProcessingMs       float64   `json:"processing_ms"`
}

type JointAnglesDTO struct {
	LeftShoulderAbduction  float64 `json:"left_shoulder_abduction"`
	RightShoulderAbduction float64 `json:"right_shoulder_abduction"`
	LeftElbow              float64 `json:"left_elbow"`
	RightElbow             float64 `json:"right_elbow"`
	LeftKnee               float64 `json:"left_knee"`
	RightKnee              float64 `json:"right_knee"`
	LeftHip                float64 `json:"left_hip"`
	RightHip               float64 `json:"right_hip"`
	TrunkLean              float64 `json:"trunk_lean"`
}

type LandmarkDTO struct {
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Z          float64 `json:"z"`
	Visibility float64 `json:"visibility"`
}

// SessionSummaryResponse from Python service
type AISessionSummary struct {
	SessionID       string   `json:"session_id"`
	ExerciseID      string   `json:"exercise_id"`
	TotalReps       int      `json:"total_reps"`
	AvgFormScore    float64  `json:"avg_form_score"`
	AvgROMPercent   float64  `json:"avg_rom_percentage"`
	AvgSymmetry     float64  `json:"avg_symmetry"`
	AvgStability    float64  `json:"avg_stability"`
	CommonIssues    []string `json:"common_issues"`
	PeakAngle       float64  `json:"peak_angle"`
	DurationFrames  int      `json:"duration_frames"`
}

// ExerciseInfo from AI service
type AIExerciseInfo struct {
	ID                string   `json:"id"`
	Name              string   `json:"name"`
	Description       string   `json:"description"`
	TargetJoints      []string `json:"target_joints"`
	PrimaryAngleLabel string   `json:"primary_angle_label"`
	TargetReps        int      `json:"target_reps"`
	TargetROMDegrees  int      `json:"target_rom_degrees"`
}

// AnalyzeFrame sends a single frame to the AI service for analysis
func (s *AIService) AnalyzeFrame(ctx context.Context, req FrameAnalysisRequest) (*FrameAnalysisResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/analyze/frame", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Service-Key", s.serviceKey)

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("AI service unavailable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("AI service error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result FrameAnalysisResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("AI service decode error: %w", err)
	}
	return &result, nil
}

// GetSessionSummary fetches aggregate session metrics from the AI service
func (s *AIService) GetSessionSummary(ctx context.Context, sessionID, exerciseID string) (*AISessionSummary, error) {
	reqBody := map[string]string{
		"session_id":  sessionID,
		"exercise_id": exerciseID,
	}
	body, _ := json.Marshal(reqBody)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		s.baseURL+"/analyze/session/summary", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Service-Key", s.serviceKey)

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("AI service unavailable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("AI session not found")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service error: %d", resp.StatusCode)
	}

	var summary AISessionSummary
	if err := json.NewDecoder(resp.Body).Decode(&summary); err != nil {
		return nil, err
	}
	return &summary, nil
}

// Health checks if the AI service is reachable
func (s *AIService) Health(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("AI service unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("AI service unhealthy: %d", resp.StatusCode)
	}
	return nil
}

// ClearSession cleans up in-memory session state in the AI service
func (s *AIService) ClearSession(ctx context.Context, sessionID uuid.UUID) {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete,
		fmt.Sprintf("%s/analyze/session/%s", s.baseURL, sessionID.String()), nil)
	if err != nil {
		return
	}
	req.Header.Set("X-Service-Key", s.serviceKey)
	resp, err := s.client.Do(req)
	if err == nil {
		resp.Body.Close()
	}
}
