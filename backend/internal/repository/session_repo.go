package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"rehabvision/internal/database"
	"rehabvision/internal/models"
)

type SessionRepository struct {
	db *database.DB
}

func NewSessionRepository(db *database.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) Create(ctx context.Context, patientID uuid.UUID, exerciseID string) (*models.ExerciseSession, error) {
	var s models.ExerciseSession
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO exercise_sessions (patient_id, exercise_id) VALUES ($1, $2)
		 RETURNING id, patient_id, exercise_id, started_at, completed_at, status, notes, created_at, updated_at`,
		patientID, exerciseID,
	).Scan(&s.ID, &s.PatientID, &s.ExerciseID, &s.StartedAt, &s.CompletedAt, &s.Status, &s.Notes, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}
	return &s, nil
}

func (r *SessionRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.ExerciseSession, error) {
	var s models.ExerciseSession
	err := r.db.QueryRowContext(ctx,
		`SELECT id, patient_id, exercise_id, started_at, completed_at, status, notes, created_at, updated_at
		 FROM exercise_sessions WHERE id = $1`,
		id,
	).Scan(&s.ID, &s.PatientID, &s.ExerciseID, &s.StartedAt, &s.CompletedAt, &s.Status, &s.Notes, &s.CreatedAt, &s.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("FindByID session: %w", err)
	}
	return &s, nil
}

func (r *SessionRepository) ListForPatient(ctx context.Context, patientID uuid.UUID, limit, offset int) ([]*models.ExerciseSession, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, patient_id, exercise_id, started_at, completed_at, status, notes, created_at, updated_at
		 FROM exercise_sessions WHERE patient_id = $1
		 ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
		patientID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sessions []*models.ExerciseSession
	for rows.Next() {
		var s models.ExerciseSession
		if err := rows.Scan(&s.ID, &s.PatientID, &s.ExerciseID, &s.StartedAt, &s.CompletedAt, &s.Status, &s.Notes, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, &s)
	}
	return sessions, rows.Err()
}

func (r *SessionRepository) Complete(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE exercise_sessions SET status = 'completed', completed_at = $1, updated_at = NOW() WHERE id = $2 AND status = 'active'`,
		now, id)
	return err
}

func (r *SessionRepository) SaveScore(ctx context.Context, score *models.SessionScore) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO session_scores (session_id, total_reps, correct_reps, avg_form_score, avg_rom_percent, avg_symmetry, avg_stability, peak_angle, duration_seconds)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (session_id) DO UPDATE SET
		  total_reps = EXCLUDED.total_reps,
		  correct_reps = EXCLUDED.correct_reps,
		  avg_form_score = EXCLUDED.avg_form_score,
		  avg_rom_percent = EXCLUDED.avg_rom_percent,
		  avg_symmetry = EXCLUDED.avg_symmetry,
		  avg_stability = EXCLUDED.avg_stability,
		  peak_angle = EXCLUDED.peak_angle,
		  duration_seconds = EXCLUDED.duration_seconds`,
		score.SessionID, score.TotalReps, score.CorrectReps, score.AvgFormScore,
		score.AvgROMPercent, score.AvgSymmetry, score.AvgStability, score.PeakAngle, score.DurationSeconds)
	return err
}

func (r *SessionRepository) GetScore(ctx context.Context, sessionID uuid.UUID) (*models.SessionScore, error) {
	var s models.SessionScore
	err := r.db.QueryRowContext(ctx,
		`SELECT id, session_id, total_reps, correct_reps, avg_form_score, avg_rom_percent, avg_symmetry, avg_stability, peak_angle, duration_seconds, computed_at
		 FROM session_scores WHERE session_id = $1`,
		sessionID,
	).Scan(&s.ID, &s.SessionID, &s.TotalReps, &s.CorrectReps, &s.AvgFormScore, &s.AvgROMPercent, &s.AvgSymmetry, &s.AvgStability, &s.PeakAngle, &s.DurationSeconds, &s.ComputedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &s, err
}

func (r *SessionRepository) SaveFormFeedback(ctx context.Context, sessionID uuid.UUID, issues map[string]int) error {
	for desc, freq := range issues {
		_, err := r.db.ExecContext(ctx,
			`INSERT INTO form_feedback (session_id, description, frequency) VALUES ($1, $2, $3)`,
			sessionID, desc, freq)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *SessionRepository) GetFeedback(ctx context.Context, sessionID uuid.UUID) ([]models.FormFeedback, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, session_id, issue_type, description, frequency, created_at
		 FROM form_feedback WHERE session_id = $1`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedback []models.FormFeedback
	for rows.Next() {
		var f models.FormFeedback
		if err := rows.Scan(&f.ID, &f.SessionID, &f.IssueType, &f.Description, &f.Frequency, &f.CreatedAt); err != nil {
			return nil, err
		}
		feedback = append(feedback, f)
	}
	return feedback, rows.Err()
}

func (r *SessionRepository) GetCommonIssues(ctx context.Context, patientID uuid.UUID, limit int) ([]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT ff.description
		 FROM form_feedback ff
		 INNER JOIN exercise_sessions es ON es.id = ff.session_id
		 WHERE es.patient_id = $1
		 GROUP BY ff.description
		 ORDER BY SUM(ff.frequency) DESC
		 LIMIT $2`,
		patientID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var issues []string
	for rows.Next() {
		var desc string
		if err := rows.Scan(&desc); err != nil {
			return nil, err
		}
		issues = append(issues, desc)
	}
	return issues, rows.Err()
}

func (r *SessionRepository) GetPatientID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	var patientID uuid.UUID
	err := r.db.QueryRowContext(ctx,
		`SELECT id FROM patients WHERE user_id = $1`, userID,
	).Scan(&patientID)
	if errors.Is(err, sql.ErrNoRows) {
		return uuid.Nil, ErrNotFound
	}
	return patientID, err
}

func (r *SessionRepository) GetPatientByID(ctx context.Context, patientID uuid.UUID) (*models.Patient, *models.User, error) {
	var u models.User
	var p models.Patient
	err := r.db.QueryRowContext(ctx,
		`SELECT u.id, u.email, u.name, u.picture, u.phone, u.role, u.active, u.created_at, u.updated_at,
		        p.id, p.user_id, p.date_of_birth, p.age, p.gender, p.diagnosis, p.rehab_goals, p.notes, p.assigned_physio_id, p.created_at, p.updated_at
		 FROM patients p
		 INNER JOIN users u ON u.id = p.user_id
		 WHERE p.id = $1`,
		patientID,
	).Scan(
		&u.ID, &u.Email, &u.Name, &u.Picture, &u.Phone, &u.Role, &u.Active, &u.CreatedAt, &u.UpdatedAt,
		&p.ID, &p.UserID, &p.DateOfBirth, &p.Age, &p.Gender, &p.Diagnosis, &p.RehabGoals, &p.Notes, &p.AssignedPhysioID, &p.CreatedAt, &p.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, ErrNotFound
	}
	if err != nil {
		return nil, nil, fmt.Errorf("GetPatientByID: %w", err)
	}
	return &p, &u, nil
}

// ─── Patient Assignment & Physiotherapist Operations ────────────────────────

func (r *SessionRepository) AssignPatient(ctx context.Context, physioID, patientID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO patient_assignments (patient_id, physio_id, status, assigned_at)
		 VALUES ($1, $2, 'active', NOW())
		 ON CONFLICT (patient_id, physio_id) DO UPDATE SET status = 'active', unassigned_at = NULL, assigned_at = NOW(), updated_at = NOW()`,
		patientID, physioID,
	)
	if err != nil {
		return fmt.Errorf("assign patient: %w", err)
	}
	// Also sync assigned_physio_id in patients table
	_, _ = r.db.ExecContext(ctx,
		`UPDATE patients SET assigned_physio_id = (SELECT user_id FROM physiotherapists WHERE id = $1) WHERE id = $2`,
		physioID, patientID,
	)
	return nil
}

func (r *SessionRepository) IsPatientAssignedToPhysio(ctx context.Context, physioID, patientID uuid.UUID) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM patient_assignments
		 WHERE physio_id = $1 AND patient_id = $2 AND status = 'active'`,
		physioID, patientID,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *SessionRepository) ListAssignedPatients(ctx context.Context, physioID uuid.UUID) ([]*models.PatientSummary, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT p.id as patient_id, u.id as user_id, u.name, u.email, u.picture, u.phone, p.age, p.diagnosis, p.rehab_goals, pa.assigned_at,
		        COUNT(es.id) as session_count,
		        COALESCE(AVG(ss.avg_form_score), 0) as avg_form_score,
		        COALESCE(AVG(ss.avg_rom_percent), 0) as avg_rom,
		        MAX(es.started_at) as last_session
		 FROM patient_assignments pa
		 INNER JOIN patients p ON p.id = pa.patient_id
		 INNER JOIN users u ON u.id = p.user_id
		 LEFT JOIN exercise_sessions es ON es.patient_id = p.id
		 LEFT JOIN session_scores ss ON ss.session_id = es.id
		 WHERE pa.physio_id = $1 AND pa.status = 'active'
		 GROUP BY p.id, u.id, u.name, u.email, u.picture, u.phone, p.age, p.diagnosis, p.rehab_goals, pa.assigned_at
		 ORDER BY pa.assigned_at DESC`,
		physioID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.PatientSummary
	for rows.Next() {
		var ps models.PatientSummary
		var lastSession sql.NullTime
		if err := rows.Scan(
			&ps.PatientID, &ps.UserID, &ps.Name, &ps.Email, &ps.Picture, &ps.Phone, &ps.Age, &ps.Diagnosis, &ps.RehabGoals, &ps.AssignedAt,
			&ps.SessionCount, &ps.AvgFormScore, &ps.AvgROM, &lastSession,
		); err != nil {
			return nil, err
		}
		if lastSession.Valid {
			ps.LastSession = &lastSession.Time
		}

		// Calculate recovery status dynamically based on scores
		if ps.AvgFormScore >= 85.0 {
			ps.RecoveryStatus = "Improving"
		} else if ps.AvgFormScore >= 70.0 {
			ps.RecoveryStatus = "Stable"
		} else {
			ps.RecoveryStatus = "Attention Needed"
		}

		list = append(list, &ps)
	}
	return list, rows.Err()
}

func (r *SessionRepository) GetRecentSessionsForPhysio(ctx context.Context, physioID uuid.UUID, limit int) ([]*models.ExerciseSession, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT es.id, es.patient_id, es.exercise_id, es.started_at, es.completed_at, es.status, es.notes, es.created_at, es.updated_at
		 FROM exercise_sessions es
		 INNER JOIN patient_assignments pa ON pa.patient_id = es.patient_id
		 WHERE pa.physio_id = $1 AND pa.status = 'active'
		 ORDER BY es.started_at DESC LIMIT $2`,
		physioID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sessions []*models.ExerciseSession
	for rows.Next() {
		var s models.ExerciseSession
		if err := rows.Scan(&s.ID, &s.PatientID, &s.ExerciseID, &s.StartedAt, &s.CompletedAt, &s.Status, &s.Notes, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, &s)
	}
	return sessions, rows.Err()
}

func (r *SessionRepository) GetPatientSessionsWithScores(ctx context.Context, patientID uuid.UUID, limit, offset int) ([]*models.SessionWithScore, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT es.id, es.patient_id, es.exercise_id, es.started_at, es.completed_at, es.status, es.notes, es.created_at, es.updated_at,
		        ss.id, ss.session_id, ss.total_reps, ss.correct_reps, ss.avg_form_score, ss.avg_rom_percent, ss.avg_symmetry, ss.avg_stability, ss.peak_angle, ss.duration_seconds, ss.computed_at
		 FROM exercise_sessions es
		 LEFT JOIN session_scores ss ON ss.session_id = es.id
		 WHERE es.patient_id = $1
		 ORDER BY es.started_at DESC LIMIT $2 OFFSET $3`,
		patientID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*models.SessionWithScore
	for rows.Next() {
		var sws models.SessionWithScore
		var ssID, ssSessionID sql.NullString
		var totalReps, correctReps, durSec sql.NullInt32
		var formScore, romPct, symm, stab, peakAng sql.NullFloat64
		var compAt sql.NullTime

		if err := rows.Scan(
			&sws.Session.ID, &sws.Session.PatientID, &sws.Session.ExerciseID, &sws.Session.StartedAt, &sws.Session.CompletedAt, &sws.Session.Status, &sws.Session.Notes, &sws.Session.CreatedAt, &sws.Session.UpdatedAt,
			&ssID, &ssSessionID, &totalReps, &correctReps, &formScore, &romPct, &symm, &stab, &peakAng, &durSec, &compAt,
		); err != nil {
			return nil, err
		}

		if ssID.Valid {
			scoreUUID, _ := uuid.Parse(ssID.String)
			sessUUID, _ := uuid.Parse(ssSessionID.String)
			sws.Score = &models.SessionScore{
				ID:              scoreUUID,
				SessionID:       sessUUID,
				TotalReps:       int(totalReps.Int32),
				CorrectReps:     int(correctReps.Int32),
				AvgFormScore:    formScore.Float64,
				AvgROMPercent:   romPct.Float64,
				AvgSymmetry:     symm.Float64,
				AvgStability:    stab.Float64,
				PeakAngle:       peakAng.Float64,
				DurationSeconds: int(durSec.Int32),
				ComputedAt:      compAt.Time,
			}
		}
		results = append(results, &sws)
	}
	return results, rows.Err()
}

func (r *SessionRepository) GetSessionWithDetails(ctx context.Context, sessionID uuid.UUID) (*models.SessionWithScore, error) {
	session, err := r.FindByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	score, _ := r.GetScore(ctx, sessionID)
	feedback, _ := r.GetFeedback(ctx, sessionID)
	_, user, _ := r.GetPatientByID(ctx, session.PatientID)

	return &models.SessionWithScore{
		Session:  *session,
		Score:    score,
		Feedback: feedback,
		User:     user,
	}, nil
}

type ProgressPoint struct {
	Date          string  `json:"date"`
	SessionID     string  `json:"session_id"`
	ExerciseID    string  `json:"exercise_id"`
	FormScore     float64 `json:"form_score"`
	ROMPercent    float64 `json:"rom_percent"`
	Symmetry      float64 `json:"symmetry"`
	Stability     float64 `json:"stability"`
	CorrectRepsPct float64 `json:"correct_reps_pct"`
}

func (r *SessionRepository) GetPatientProgressTimeSeries(ctx context.Context, patientID uuid.UUID, limit int) ([]ProgressPoint, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT es.id, es.exercise_id, es.started_at, ss.avg_form_score, ss.avg_rom_percent, ss.avg_symmetry, ss.avg_stability, ss.total_reps, ss.correct_reps
		 FROM exercise_sessions es
		 INNER JOIN session_scores ss ON ss.session_id = es.id
		 WHERE es.patient_id = $1 AND es.status = 'completed'
		 ORDER BY es.started_at ASC LIMIT $2`,
		patientID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []ProgressPoint
	for rows.Next() {
		var sID, exID string
		var startedAt time.Time
		var form, rom, sym, stab float64
		var totalReps, correctReps int

		if err := rows.Scan(&sID, &exID, &startedAt, &form, &rom, &sym, &stab, &totalReps, &correctReps); err != nil {
			return nil, err
		}

		pct := 100.0
		if totalReps > 0 {
			pct = float64(correctReps) / float64(totalReps) * 100.0
		}

		points = append(points, ProgressPoint{
			Date:           startedAt.Format("Jan 02 15:04"),
			SessionID:      sID,
			ExerciseID:     exID,
			FormScore:      form,
			ROMPercent:     rom,
			Symmetry:       sym,
			Stability:      stab,
			CorrectRepsPct: pct,
		})
	}
	return points, rows.Err()
}

func (r *SessionRepository) ListByPatient(ctx context.Context, patientID uuid.UUID) ([]*models.ExerciseSession, error) {
	return r.ListForPatient(ctx, patientID, 50, 0)
}

func (r *SessionRepository) GetSessionDetails(ctx context.Context, sessionID uuid.UUID) (*models.SessionWithScore, error) {
	return r.GetSessionWithDetails(ctx, sessionID)
}

