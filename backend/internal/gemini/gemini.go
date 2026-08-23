package gemini

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"rehabvision/internal/models"
)

// GeminiClient calls the Gemini REST API.
// The API key is NEVER exposed to the frontend — it stays in this server-side service.
type GeminiClient struct {
	apiKey  string
	model   string
	timeout time.Duration
	client  *http.Client
}

func NewGeminiClient(apiKey, model string, timeout time.Duration) *GeminiClient {
	return &GeminiClient{
		apiKey:  apiKey,
		model:   model,
		timeout: timeout,
		client:  &http.Client{Timeout: timeout + 5*time.Second},
	}
}

// SessionMetrics is the structured input to Gemini — only validated metrics, no raw frames
type SessionMetrics struct {
	ExerciseID      string   `json:"exercise_id"`
	ExerciseName    string   `json:"exercise_name"`
	TotalReps       int      `json:"total_reps"`
	CorrectReps     int      `json:"correct_reps"`
	AvgFormScore    float64  `json:"avg_form_score"`
	AvgROMPercent   float64  `json:"avg_rom_percent"`
	AvgSymmetry     float64  `json:"avg_symmetry"`
	AvgStability    float64  `json:"avg_stability"`
	PeakAngle       float64  `json:"peak_angle_degrees"`
	CommonIssues    []string `json:"common_issues"`
	DurationSeconds int      `json:"duration_seconds"`
}

// GeminiSummaryResponse is what we return to the frontend (validated output)
type GeminiSummaryResponse struct {
	Summary   string `json:"summary"`
	Insights  string `json:"insights"`
	Available bool   `json:"available"`
	ModelUsed string `json:"model_used"`
}

type PrescriptionPatientContext struct {
	Name         string `json:"name"`
	Age          int    `json:"age"`
	Diagnosis    string `json:"diagnosis"`
	RehabGoals   string `json:"rehab_goals"`
	BodyArea     string `json:"body_area"`
	MobilityMode string `json:"mobility_mode"` // standard | wheelchair | seated_only
}

type SuggestedExercisePlan struct {
	Title        string                        `json:"title"`
	ClinicalRationale string                   `json:"clinical_rationale"`
	Exercises    []models.PrescriptionExercise `json:"exercises"`
	Available    bool                          `json:"available"`
}

// geminiRequest mirrors the Gemini REST API request format
type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

// GenerateSessionSummary calls Gemini with structured session metrics and returns a safe summary.
func (g *GeminiClient) GenerateSessionSummary(ctx context.Context, metrics SessionMetrics) (*GeminiSummaryResponse, error) {
	if g.apiKey == "" {
		return g.fallbackSummary(metrics), nil
	}

	prompt := g.buildPrompt(metrics)

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return g.fallbackSummary(metrics), nil
	}

	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		g.model, g.apiKey,
	)

	ctx, cancel := context.WithTimeout(ctx, g.timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return g.fallbackSummary(metrics), nil
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return g.fallbackSummary(metrics), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return g.fallbackSummary(metrics), nil
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return g.fallbackSummary(metrics), nil
	}

	var gemResp geminiResponse
	if err := json.Unmarshal(body, &gemResp); err != nil {
		return g.fallbackSummary(metrics), nil
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return g.fallbackSummary(metrics), nil
	}

	rawText := gemResp.Candidates[0].Content.Parts[0].Text
	summary, insights := g.parseResponse(rawText)

	if isMedicalDiagnosis(rawText) {
		return g.fallbackSummary(metrics), nil
	}

	return &GeminiSummaryResponse{
		Summary:   summary,
		Insights:  insights,
		Available: true,
		ModelUsed: g.model,
	}, nil
}

// GeneratePrescriptionPlan creates an evidence-based exercise routine adapted to patient mobility
func (g *GeminiClient) GeneratePrescriptionPlan(ctx context.Context, p PrescriptionPatientContext) (*SuggestedExercisePlan, error) {
	if g.apiKey == "" {
		return g.fallbackPrescription(p), nil
	}

	prompt := fmt.Sprintf(`You are an AI Clinical Physiotherapy Assistant aiding a licensed physical therapist.
Suggest a personalized rehabilitation routine for this patient.

Patient Profile:
- Name: %s
- Age: %d
- Primary Diagnosis / Injury: %s
- Target Goal: %s
- Focus Body Area: %s
- Mobility Status: %s

CRITICAL SAFETY & ACCESSIBILITY RULES:
1. If mobility status is "wheelchair" or "seated_only" or "limited_lower_body", ONLY prescribe seated or upper-body exercises (e.g. arm_raise, neck_posture, torso_bend, shoulder_symmetry, seated knee_extension). NEVER prescribe standing squats or sit-to-stand.
2. Select 2 to 4 exercises from our validated system library: [arm_raise, leg_raise, knee_extension, sit_to_stand, squat, neck_posture, torso_bend, shoulder_symmetry, knee_alignment, lateral_leg_raise].
3. Respond ONLY with valid JSON conforming to this schema (no markdown fences, no explanatory text outside JSON):
{
  "title": "Protocol Title",
  "clinical_rationale": "Brief clinical rationale for the physiotherapist to review",
  "exercises": [
    {
      "exercise_id": "arm_raise",
      "target_reps": 10,
      "target_sets": 3,
      "rest_seconds": 45,
      "difficulty": "beginner",
      "instructions": "Specific movement cue",
      "safety_notes": "Safety precautions",
      "form_criteria": "Keep shoulders level and back straight",
      "is_seated_adapted": true
    }
  ]
}`, p.Name, p.Age, p.Diagnosis, p.RehabGoals, p.BodyArea, p.MobilityMode)

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return g.fallbackPrescription(p), nil
	}

	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		g.model, g.apiKey,
	)

	ctx, cancel := context.WithTimeout(ctx, g.timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return g.fallbackPrescription(p), nil
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return g.fallbackPrescription(p), nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return g.fallbackPrescription(p), nil
	}

	var gemResp geminiResponse
	if err := json.Unmarshal(body, &gemResp); err != nil || len(gemResp.Candidates) == 0 {
		return g.fallbackPrescription(p), nil
	}

	rawText := gemResp.Candidates[0].Content.Parts[0].Text
	rawText = strings.TrimPrefix(rawText, "```json")
	rawText = strings.TrimPrefix(rawText, "```")
	rawText = strings.TrimSuffix(rawText, "```")
	rawText = strings.TrimSpace(rawText)

	var plan SuggestedExercisePlan
	if err := json.Unmarshal([]byte(rawText), &plan); err != nil || len(plan.Exercises) == 0 {
		return g.fallbackPrescription(p), nil
	}

	plan.Available = true
	return &plan, nil
}

func (g *GeminiClient) fallbackPrescription(p PrescriptionPatientContext) *SuggestedExercisePlan {
	isWheelchair := p.MobilityMode == "wheelchair" || p.MobilityMode == "seated_only" || p.MobilityMode == "limited_lower_body"

	var exercises []models.PrescriptionExercise
	title := fmt.Sprintf("Targeted %s Rehabilitation Protocol", strings.Title(p.BodyArea))
	rationale := "Initial progressive adaptation program focusing on motor control, bilateral symmetry, and active range of motion."

	if isWheelchair {
		title = fmt.Sprintf("Seated / Adaptive %s Care Protocol", strings.Title(p.BodyArea))
		rationale = "Adapted seated protocol engineered for wheelchair stability, thoracic posture alignment, and upper limb functional mobility."
		exercises = []models.PrescriptionExercise{
			{
				ExerciseID:      "neck_posture",
				OrderIndex:      1,
				TargetReps:      5,
				TargetSets:      2,
				RestSeconds:     30,
				Difficulty:      "beginner",
				Instructions:    "Perform seated cervical alignment retraction while stabilizing back against chair.",
				SafetyNotes:     "Avoid rapid neck extension; maintain smooth controlled pacing.",
				FormCriteria:    "Maintain Craniovertebral Angle >= 50 degrees.",
				IsSeatedAdapted: true,
			},
			{
				ExerciseID:      "shoulder_symmetry",
				OrderIndex:      2,
				TargetReps:      10,
				TargetSets:      3,
				RestSeconds:     45,
				Difficulty:      "beginner",
				Instructions:    "Engage scapular retraction and bilateral shoulder levelling.",
				SafetyNotes:     "Keep core braced and avoid unilateral tilting.",
				FormCriteria:    "Bilateral height delta <= 5%.",
				IsSeatedAdapted: true,
			},
			{
				ExerciseID:      "arm_raise",
				OrderIndex:      3,
				TargetReps:      10,
				TargetSets:      3,
				RestSeconds:     45,
				Difficulty:      "intermediate",
				Instructions:    "Seated frontal and coronal plane arm elevation to 90 degrees.",
				SafetyNotes:     "Stop if subacromial impingement or sharp pain occurs.",
				FormCriteria:    "Target 90 degrees abduction with upright spine posture.",
				IsSeatedAdapted: true,
			},
		}
	} else if strings.EqualFold(p.BodyArea, "knee") || strings.EqualFold(p.BodyArea, "leg") {
		exercises = []models.PrescriptionExercise{
			{
				ExerciseID:      "leg_raise",
				OrderIndex:      1,
				TargetReps:      8,
				TargetSets:      3,
				RestSeconds:     45,
				Difficulty:      "beginner",
				Instructions:    "Supine straight leg elevation engaging quadriceps and hip flexors.",
				SafetyNotes:     "Keep knee locked straight during elevation.",
				FormCriteria:    "Target 45 degrees elevation without lumbar arching.",
				IsSeatedAdapted: false,
			},
			{
				ExerciseID:      "knee_extension",
				OrderIndex:      2,
				TargetReps:      10,
				TargetSets:      3,
				RestSeconds:     45,
				Difficulty:      "beginner",
				Instructions:    "Seated terminal knee extension for patellofemoral tracking.",
				SafetyNotes:     "Hold 1 second at full extension.",
				FormCriteria:    "Achieve >= 160 degrees extension angle.",
				IsSeatedAdapted: true,
			},
			{
				ExerciseID:      "sit_to_stand",
				OrderIndex:      3,
				TargetReps:      5,
				TargetSets:      2,
				RestSeconds:     60,
				Difficulty:      "intermediate",
				Instructions:    "Functional sit-to-stand weight transfer with equal bilateral weight bearing.",
				SafetyNotes:     "Ensure stable chair support.",
				FormCriteria:    "Symmetric knee tracking without valgus collapse.",
				IsSeatedAdapted: false,
			},
		}
	} else {
		// General / Spine / Shoulder
		exercises = []models.PrescriptionExercise{
			{
				ExerciseID:      "arm_raise",
				OrderIndex:      1,
				TargetReps:      10,
				TargetSets:      3,
				RestSeconds:     45,
				Difficulty:      "beginner",
				Instructions:    "Frontal arm raise with controlled eccentric return.",
				SafetyNotes:     "Do not hyperextend spine.",
				FormCriteria:    "Target 90 degrees elevation with vertical torso.",
				IsSeatedAdapted: false,
			},
			{
				ExerciseID:      "torso_bend",
				OrderIndex:      2,
				TargetReps:      5,
				TargetSets:      2,
				RestSeconds:     45,
				Difficulty:      "beginner",
				Instructions:    "Controlled trunk inclination tracking alignment.",
				SafetyNotes:     "Bend from hips rather than rounding spine excessively.",
				FormCriteria:    "Keep spine neutral through movement.",
				IsSeatedAdapted: false,
			},
			{
				ExerciseID:      "shoulder_symmetry",
				OrderIndex:      3,
				TargetReps:      10,
				TargetSets:      3,
				RestSeconds:     45,
				Difficulty:      "beginner",
				Instructions:    "Postural balance and shoulder leveling calibration.",
				SafetyNotes:     "Maintain relaxed breathing.",
				FormCriteria:    "Symmetry score >= 90%.",
				IsSeatedAdapted: true,
			},
		}
	}

	return &SuggestedExercisePlan{
		Title:             title,
		ClinicalRationale: rationale,
		Exercises:         exercises,
		Available:         false,
	}
}

func (g *GeminiClient) buildPrompt(m SessionMetrics) string {
	issuesList := strings.Join(m.CommonIssues, "; ")
	if issuesList == "" {
		issuesList = "none detected"
	}

	return fmt.Sprintf(`You are a rehabilitation exercise assistant helping a physiotherapist review a patient's session.

IMPORTANT RULES:
1. Do NOT diagnose any medical condition.
2. Do NOT invent or change any measurements — use only the metrics provided below.
3. Do NOT recommend stopping treatment or making clinical decisions.
4. Always recommend consulting a qualified physiotherapist for clinical advice.
5. Keep the tone supportive and encouraging.
6. Response must have two clearly labeled sections: SUMMARY and INSIGHTS.

SESSION METRICS (these are measured values — do not alter them):
- Exercise: %s
- Total Repetitions: %d
- Form Score: %.1f/100
- Range of Motion: %.1f%%
- Symmetry Score: %.1f/100
- Stability Score: %.1f/100
- Peak Joint Angle: %.1f degrees
- Session Duration: %d seconds
- Common Form Issues: %s

Write a brief, friendly SUMMARY (2-3 sentences) describing the session performance based on the metrics above.
Then write INSIGHTS (2-4 bullet points) for the physiotherapist about patterns observed in the data.
Do not add any metrics not listed above.`,
		m.ExerciseName, m.TotalReps, m.AvgFormScore, m.AvgROMPercent,
		m.AvgSymmetry, m.AvgStability, m.PeakAngle, m.DurationSeconds, issuesList,
	)
}

func (g *GeminiClient) parseResponse(text string) (summary, insights string) {
	text = strings.TrimSpace(text)
	lines := strings.Split(text, "\n")

	var summaryLines, insightLines []string
	currentSection := ""

	for _, line := range lines {
		upper := strings.ToUpper(strings.TrimSpace(line))
		if strings.Contains(upper, "SUMMARY") {
			currentSection = "summary"
			continue
		}
		if strings.Contains(upper, "INSIGHT") {
			currentSection = "insights"
			continue
		}
		switch currentSection {
		case "summary":
			summaryLines = append(summaryLines, line)
		case "insights":
			insightLines = append(insightLines, line)
		}
	}

	summary = strings.TrimSpace(strings.Join(summaryLines, "\n"))
	insights = strings.TrimSpace(strings.Join(insightLines, "\n"))

	if summary == "" {
		mid := len(lines) / 2
		if mid > 0 {
			summary = strings.TrimSpace(strings.Join(lines[:mid], "\n"))
			insights = strings.TrimSpace(strings.Join(lines[mid:], "\n"))
		} else {
			summary = text
		}
	}

	if len(summary) > 2000 {
		summary = summary[:2000] + "..."
	}
	if len(insights) > 3000 {
		insights = insights[:3000] + "..."
	}

	return summary, insights
}

func (g *GeminiClient) fallbackSummary(m SessionMetrics) *GeminiSummaryResponse {
	formQuality := "good"
	if m.AvgFormScore >= 80 {
		formQuality = "excellent"
	} else if m.AvgFormScore >= 60 {
		formQuality = "fair"
	} else if m.AvgFormScore < 60 {
		formQuality = "needs improvement"
	}

	summary := fmt.Sprintf(
		"Session completed with %d repetitions of %s. "+
			"Average form quality was %s (%.0f/100) with %.0f%% range of motion achieved.",
		m.TotalReps, m.ExerciseName, formQuality, m.AvgFormScore, m.AvgROMPercent,
	)

	insights := "• Session metrics were recorded successfully.\n"
	if len(m.CommonIssues) > 0 {
		insights += fmt.Sprintf("• Most frequent form issue: %s\n", m.CommonIssues[0])
	}
	insights += fmt.Sprintf("• Symmetry score: %.0f/100 — review for bilateral imbalances if below 80.\n", m.AvgSymmetry)
	insights += "• Please consult a qualified physiotherapist for clinical recommendations."

	return &GeminiSummaryResponse{
		Summary:   summary,
		Insights:  insights,
		Available: false,
		ModelUsed: "fallback",
	}
}

func isMedicalDiagnosis(text string) bool {
	diagnosisTerms := []string{
		"diagnosed with", "you have", "pathology", "condition is",
		"medical condition", "disease", "disorder confirmed",
	}
	lower := strings.ToLower(text)
	for _, term := range diagnosisTerms {
		if strings.Contains(lower, term) {
			return true
		}
	}
	return false
}
