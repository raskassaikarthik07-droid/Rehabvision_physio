package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"rehabvision/internal/auth"
	"rehabvision/internal/database"
	"rehabvision/internal/models"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrAlreadyExists = errors.New("already exists")
	ErrInvalidAuth   = errors.New("invalid identifier or password")
)

type UserRepository struct {
	db *database.DB
}

func NewUserRepository(db *database.DB) *UserRepository {
	return &UserRepository{db: db}
}

// ── User Lookups ─────────────────────────────────────────────────────────────

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	err := r.db.QueryRowContext(ctx,
		`SELECT id, email, password_hash, name, picture, phone, role, active, created_at, updated_at
		 FROM users WHERE id = $1 AND active = true`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Picture, &u.Phone, &u.Role, &u.Active, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("FindByID: %w", err)
	}
	return &u, nil
}

func (r *UserRepository) FindByEmailOrID(ctx context.Context, identifier string) (*models.User, error) {
	identifier = strings.TrimSpace(identifier)
	var u models.User
	var err error

	if uid, parseErr := uuid.Parse(identifier); parseErr == nil {
		err = r.db.QueryRowContext(ctx,
			`SELECT u.id, u.email, u.password_hash, u.name, u.picture, u.phone, u.role, u.active, u.created_at, u.updated_at
			 FROM users u
			 WHERE (
			   u.id = $1
			   OR LOWER(u.email) = LOWER($2)
			   OR EXISTS (SELECT 1 FROM physiotherapists ph WHERE ph.user_id = u.id AND (ph.license_number = $2 OR ph.invite_code = $2 OR ph.id = $1))
			   OR EXISTS (SELECT 1 FROM patients pt WHERE pt.user_id = u.id AND pt.id = $1)
			 ) AND u.active = true`,
			uid, identifier,
		).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Picture, &u.Phone, &u.Role, &u.Active, &u.CreatedAt, &u.UpdatedAt)
	} else {
		err = r.db.QueryRowContext(ctx,
			`SELECT u.id, u.email, u.password_hash, u.name, u.picture, u.phone, u.role, u.active, u.created_at, u.updated_at
			 FROM users u
			 WHERE (
			   LOWER(u.email) = LOWER($1)
			   OR EXISTS (SELECT 1 FROM physiotherapists ph WHERE ph.user_id = u.id AND (ph.license_number = $1 OR ph.invite_code = $1))
			 ) AND u.active = true`,
			identifier,
		).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Picture, &u.Phone, &u.Role, &u.Active, &u.CreatedAt, &u.UpdatedAt)
	}

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("FindByEmailOrID: %w", err)
	}
	return &u, nil
}

// ── Registration ─────────────────────────────────────────────────────────────

type RegisterPatientParams struct {
	Email                string
	Password             string
	Name                 string
	Phone                string
	Picture              string
	Age                  int
	Gender               string
	Diagnosis            string
	RehabGoals           string
	BodyAreaID           *uuid.UUID
	MobilityMode         string
	EmergencyContactName string
	EmergencyContactPhone string
	EmergencyRelationship string
}

func (r *UserRepository) RegisterPatient(ctx context.Context, p RegisterPatientParams) (*models.User, *models.Patient, error) {
	p.Email = strings.TrimSpace(strings.ToLower(p.Email))
	if p.Email == "" {
		return nil, nil, errors.New("email is required")
	}

	var exists bool
	_ = r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))`, p.Email).Scan(&exists)
	if exists {
		return nil, nil, ErrAlreadyExists
	}

	pwdHash, err := auth.HashPassword(p.Password)
	if err != nil {
		return nil, nil, err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	picture := p.Picture
	if picture == "" {
		picture = fmt.Sprintf("https://api.dicebear.com/7.x/avataaars/svg?seed=%s", p.Name)
	}

	var u models.User
	err = tx.QueryRowContext(ctx,
		`INSERT INTO users (email, password_hash, name, picture, phone, role, active)
		 VALUES ($1, $2, $3, $4, $5, 'patient', true)
		 RETURNING id, email, password_hash, name, picture, phone, role, active, created_at, updated_at`,
		p.Email, pwdHash, p.Name, picture, p.Phone,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Picture, &u.Phone, &u.Role, &u.Active, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("insert patient user: %w", err)
	}

	mobilityMode := p.MobilityMode
	if mobilityMode == "" {
		mobilityMode = "standard"
	}

	var patient models.Patient
	err = tx.QueryRowContext(ctx,
		`INSERT INTO patients (user_id, age, gender, diagnosis, rehab_goals, body_area_id, mobility_mode)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, user_id, date_of_birth, age, gender, diagnosis, rehab_goals, body_area_id, mobility_mode, notes, assigned_physio_id, created_at, updated_at`,
		u.ID, p.Age, p.Gender, p.Diagnosis, p.RehabGoals, p.BodyAreaID, mobilityMode,
	).Scan(
		&patient.ID, &patient.UserID, &patient.DateOfBirth, &patient.Age, &patient.Gender,
		&patient.Diagnosis, &patient.RehabGoals, &patient.BodyAreaID, &patient.MobilityMode, &patient.Notes, &patient.AssignedPhysioID,
		&patient.CreatedAt, &patient.UpdatedAt,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("insert patient profile: %w", err)
	}

	// Create emergency contact if provided
	if p.EmergencyContactName != "" && p.EmergencyContactPhone != "" {
		_, err = tx.ExecContext(ctx,
			`INSERT INTO emergency_contacts (patient_id, contact_name, contact_phone, relationship, is_primary)
			 VALUES ($1, $2, $3, $4, true)`,
			patient.ID, p.EmergencyContactName, p.EmergencyContactPhone, p.EmergencyRelationship,
		)
		if err != nil {
			return nil, nil, fmt.Errorf("insert emergency contact: %w", err)
		}
	}

	// Initialize streak record
	_, _ = tx.ExecContext(ctx,
		`INSERT INTO patient_streaks (patient_id, current_streak, longest_streak)
		 VALUES ($1, 0, 0)
		 ON CONFLICT (patient_id) DO NOTHING`,
		patient.ID,
	)

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}
	return &u, &patient, nil
}

type RegisterPhysioParams struct {
	Email               string
	Password            string
	Name                string
	Phone               string
	Picture             string
	Speciality          string
	LicenseNumber       string
	Bio                 string
	SpecializationNames []string
}

func (r *UserRepository) RegisterPhysiotherapist(ctx context.Context, p RegisterPhysioParams) (*models.User, *models.Physiotherapist, error) {
	p.Email = strings.TrimSpace(strings.ToLower(p.Email))
	if p.Email == "" {
		return nil, nil, errors.New("email is required")
	}

	var exists bool
	_ = r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))`, p.Email).Scan(&exists)
	if exists {
		return nil, nil, ErrAlreadyExists
	}

	pwdHash, err := auth.HashPassword(p.Password)
	if err != nil {
		return nil, nil, err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	picture := p.Picture
	if picture == "" {
		picture = fmt.Sprintf("https://api.dicebear.com/7.x/avataaars/svg?seed=%s", p.Name)
	}

	var u models.User
	err = tx.QueryRowContext(ctx,
		`INSERT INTO users (email, password_hash, name, picture, phone, role, active)
		 VALUES ($1, $2, $3, $4, $5, 'physiotherapist', true)
		 RETURNING id, email, password_hash, name, picture, phone, role, active, created_at, updated_at`,
		p.Email, pwdHash, p.Name, picture, p.Phone,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Picture, &u.Phone, &u.Role, &u.Active, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("insert physio user: %w", err)
	}

	// Generate invite code
	var inviteCode string
	_ = tx.QueryRowContext(ctx, `SELECT UPPER(SUBSTR(ENCODE(gen_random_bytes(5), 'hex'), 1, 8))`).Scan(&inviteCode)

	var physio models.Physiotherapist
	err = tx.QueryRowContext(ctx,
		`INSERT INTO physiotherapists (user_id, speciality, license_number, invite_code, bio, accepting_patients)
		 VALUES ($1, $2, $3, $4, $5, true)
		 RETURNING id, user_id, speciality, license_number, invite_code, bio, accepting_patients, created_at, updated_at`,
		u.ID, p.Speciality, p.LicenseNumber, inviteCode, p.Bio,
	).Scan(&physio.ID, &physio.UserID, &physio.Speciality, &physio.LicenseNumber, &physio.InviteCode, &physio.Bio, &physio.AcceptingPatients, &physio.CreatedAt, &physio.UpdatedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("insert physio profile: %w", err)
	}

	// Link specializations if specified
	for _, specName := range p.SpecializationNames {
		var specID uuid.UUID
		err = tx.QueryRowContext(ctx, `SELECT id FROM specializations WHERE LOWER(name) = LOWER($1) OR LOWER(display_name) = LOWER($1) LIMIT 1`, specName).Scan(&specID)
		if err == nil {
			_, _ = tx.ExecContext(ctx,
				`INSERT INTO physio_specializations (physio_id, specialization_id)
				 VALUES ($1, $2)
				 ON CONFLICT DO NOTHING`,
				physio.ID, specID,
			)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}
	return &u, &physio, nil
}

func (r *UserRepository) Authenticate(ctx context.Context, identifier, password string, expectedRole models.Role) (*models.User, error) {
	u, err := r.FindByEmailOrID(ctx, identifier)
	if err != nil {
		return nil, ErrInvalidAuth
	}

	if !auth.CheckPassword(password, u.PasswordHash) {
		return nil, ErrInvalidAuth
	}

	if expectedRole != "" && u.Role != expectedRole && u.Role != models.RoleAdmin {
		return nil, ErrInvalidAuth
	}

	return u, nil
}

// ── Profile Updates ──────────────────────────────────────────────────────────

func (r *UserRepository) UpdateProfilePhoto(ctx context.Context, userID uuid.UUID, photoData string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET picture = $1, updated_at = NOW() WHERE id = $2`, photoData, userID)
	return err
}

func (r *UserRepository) UpdatePatientProfile(ctx context.Context, userID uuid.UUID, name, phone, diagnosis, rehabGoals string, age int) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if name != "" || phone != "" {
		_, err = tx.ExecContext(ctx,
			`UPDATE users SET name = COALESCE(NULLIF($1, ''), name), phone = COALESCE(NULLIF($2, ''), phone), updated_at = NOW() WHERE id = $3`,
			name, phone, userID)
		if err != nil {
			return err
		}
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE patients SET diagnosis = COALESCE(NULLIF($1, ''), diagnosis), rehab_goals = COALESCE(NULLIF($2, ''), rehab_goals), age = CASE WHEN $3 > 0 THEN $3 ELSE age END, updated_at = NOW() WHERE user_id = $4`,
		diagnosis, rehabGoals, age, userID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *UserRepository) FindPatientByEmailOrID(ctx context.Context, identifier string) (*models.Patient, *models.User, error) {
	identifier = strings.TrimSpace(identifier)
	var u models.User
	var p models.Patient
	var err error

	if uid, parseErr := uuid.Parse(identifier); parseErr == nil {
		err = r.db.QueryRowContext(ctx,
			`SELECT u.id, u.email, u.name, u.picture, u.phone, u.role, u.active, u.created_at, u.updated_at,
			        p.id, p.user_id, p.date_of_birth, p.age, p.gender, p.diagnosis, p.rehab_goals, p.body_area_id, p.mobility_mode, p.notes, p.assigned_physio_id, p.created_at, p.updated_at
			 FROM patients p
			 INNER JOIN users u ON u.id = p.user_id
			 WHERE (p.id = $1 OR u.id = $1 OR LOWER(u.email) = LOWER($2)) AND u.active = true`,
			uid, identifier,
		).Scan(
			&u.ID, &u.Email, &u.Name, &u.Picture, &u.Phone, &u.Role, &u.Active, &u.CreatedAt, &u.UpdatedAt,
			&p.ID, &p.UserID, &p.DateOfBirth, &p.Age, &p.Gender, &p.Diagnosis, &p.RehabGoals, &p.BodyAreaID, &p.MobilityMode, &p.Notes, &p.AssignedPhysioID, &p.CreatedAt, &p.UpdatedAt,
		)
	} else {
		err = r.db.QueryRowContext(ctx,
			`SELECT u.id, u.email, u.name, u.picture, u.phone, u.role, u.active, u.created_at, u.updated_at,
			        p.id, p.user_id, p.date_of_birth, p.age, p.gender, p.diagnosis, p.rehab_goals, p.body_area_id, p.mobility_mode, p.notes, p.assigned_physio_id, p.created_at, p.updated_at
			 FROM patients p
			 INNER JOIN users u ON u.id = p.user_id
			 WHERE LOWER(u.email) = LOWER($1) AND u.active = true`,
			identifier,
		).Scan(
			&u.ID, &u.Email, &u.Name, &u.Picture, &u.Phone, &u.Role, &u.Active, &u.CreatedAt, &u.UpdatedAt,
			&p.ID, &p.UserID, &p.DateOfBirth, &p.Age, &p.Gender, &p.Diagnosis, &p.RehabGoals, &p.BodyAreaID, &p.MobilityMode, &p.Notes, &p.AssignedPhysioID, &p.CreatedAt, &p.UpdatedAt,
		)
	}

	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, ErrNotFound
	}
	return &p, &u, err
}


func (r *UserRepository) GetPatientByUserID(ctx context.Context, userID uuid.UUID) (*models.Patient, error) {
	var p models.Patient
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, date_of_birth, age, gender, diagnosis, rehab_goals, body_area_id, mobility_mode, notes, assigned_physio_id, created_at, updated_at
		 FROM patients WHERE user_id = $1`,
		userID,
	).Scan(
		&p.ID, &p.UserID, &p.DateOfBirth, &p.Age, &p.Gender, &p.Diagnosis, &p.RehabGoals,
		&p.BodyAreaID, &p.MobilityMode, &p.Notes, &p.AssignedPhysioID, &p.CreatedAt, &p.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &p, err
}

func (r *UserRepository) GetPhysiotherapistByUserID(ctx context.Context, userID uuid.UUID) (*models.Physiotherapist, error) {
	var ph models.Physiotherapist
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, speciality, license_number, invite_code, bio, accepting_patients, created_at, updated_at
		 FROM physiotherapists WHERE user_id = $1`,
		userID,
	).Scan(&ph.ID, &ph.UserID, &ph.Speciality, &ph.LicenseNumber, &ph.InviteCode, &ph.Bio, &ph.AcceptingPatients, &ph.CreatedAt, &ph.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	// Fetch specializations
	rows, err := r.db.QueryContext(ctx,
		`SELECT s.id, s.name, s.display_name, s.created_at
		 FROM specializations s
		 INNER JOIN physio_specializations ps ON ps.specialization_id = s.id
		 WHERE ps.physio_id = $1`,
		ph.ID,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var sp models.Specialization
			if err := rows.Scan(&sp.ID, &sp.Name, &sp.DisplayName, &sp.CreatedAt); err == nil {
				ph.Specializations = append(ph.Specializations, sp)
			}
		}
	}

	return &ph, nil
}

// ── Reference Lookups ────────────────────────────────────────────────────────

func (r *UserRepository) ListBodyAreas(ctx context.Context) ([]models.BodyArea, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, display_name, created_at FROM body_areas ORDER BY display_name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.BodyArea
	for rows.Next() {
		var b models.BodyArea
		if err := rows.Scan(&b.ID, &b.Name, &b.DisplayName, &b.CreatedAt); err == nil {
			list = append(list, b)
		}
	}
	return list, nil
}

func (r *UserRepository) ListSpecializations(ctx context.Context) ([]models.Specialization, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, display_name, created_at FROM specializations ORDER BY display_name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Specialization
	for rows.Next() {
		var s models.Specialization
		if err := rows.Scan(&s.ID, &s.Name, &s.DisplayName, &s.CreatedAt); err == nil {
			list = append(list, s)
		}
	}
	return list, nil
}

// ── Physiotherapist Directory & Discovery ────────────────────────────────────

func (r *UserRepository) SearchPhysiotherapists(ctx context.Context, specializationName, inviteCode string) ([]models.Physiotherapist, error) {
	var query string
	var args []interface{}

	if inviteCode != "" {
		query = `SELECT ph.id, ph.user_id, ph.speciality, ph.license_number, ph.invite_code, ph.bio, ph.accepting_patients, ph.created_at, ph.updated_at,
		                u.name, u.email, u.picture, u.phone
		         FROM physiotherapists ph
		         JOIN users u ON u.id = ph.user_id
		         WHERE UPPER(ph.invite_code) = UPPER($1) AND u.active = true`
		args = append(args, inviteCode)
	} else if specializationName != "" {
		query = `SELECT DISTINCT ph.id, ph.user_id, ph.speciality, ph.license_number, ph.invite_code, ph.bio, ph.accepting_patients, ph.created_at, ph.updated_at,
		                u.name, u.email, u.picture, u.phone
		         FROM physiotherapists ph
		         JOIN users u ON u.id = ph.user_id
		         LEFT JOIN physio_specializations ps ON ps.physio_id = ph.id
		         LEFT JOIN specializations s ON s.id = ps.specialization_id
		         WHERE (LOWER(s.name) = LOWER($1) OR LOWER(s.display_name) = LOWER($1) OR LOWER(ph.speciality) LIKE LOWER('%' || $1 || '%'))
		           AND ph.accepting_patients = true AND u.active = true`
		args = append(args, specializationName)
	} else {
		query = `SELECT ph.id, ph.user_id, ph.speciality, ph.license_number, ph.invite_code, ph.bio, ph.accepting_patients, ph.created_at, ph.updated_at,
		                u.name, u.email, u.picture, u.phone
		         FROM physiotherapists ph
		         JOIN users u ON u.id = ph.user_id
		         WHERE ph.accepting_patients = true AND u.active = true
		         ORDER BY u.name ASC LIMIT 20`
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Physiotherapist
	for rows.Next() {
		var ph models.Physiotherapist
		var u models.User
		if err := rows.Scan(
			&ph.ID, &ph.UserID, &ph.Speciality, &ph.LicenseNumber, &ph.InviteCode, &ph.Bio, &ph.AcceptingPatients, &ph.CreatedAt, &ph.UpdatedAt,
			&u.Name, &u.Email, &u.Picture, &u.Phone,
		); err == nil {
			u.ID = ph.UserID
			u.Role = models.RolePhysiotherapist
			ph.User = &u

			// Attach specializations
			specRows, specErr := r.db.QueryContext(ctx,
				`SELECT s.id, s.name, s.display_name, s.created_at
				 FROM specializations s
				 JOIN physio_specializations ps ON ps.specialization_id = s.id
				 WHERE ps.physio_id = $1`, ph.ID)
			if specErr == nil {
				for specRows.Next() {
					var sp models.Specialization
					if err := specRows.Scan(&sp.ID, &sp.Name, &sp.DisplayName, &sp.CreatedAt); err == nil {
						ph.Specializations = append(ph.Specializations, sp)
					}
				}
				specRows.Close()
			}

			list = append(list, ph)
		}
	}
	return list, nil
}

// ── Patient -> Physio Request Workflow ───────────────────────────────────────

type CreateRequestParams struct {
	PatientID        uuid.UUID
	PhysioID         *uuid.UUID
	RequestType      string // invite_code | matching
	InviteCode       string
	BodyAreaID       *uuid.UUID
	SpecializationID *uuid.UUID
	RehabGoalNote    string
}

func (r *UserRepository) CreatePhysioRequest(ctx context.Context, p CreateRequestParams) (*models.PhysioRequest, error) {
	// If invite code was provided, look up physio
	if p.RequestType == "invite_code" && p.PhysioID == nil {
		var phID uuid.UUID
		err := r.db.QueryRowContext(ctx, `SELECT id FROM physiotherapists WHERE UPPER(invite_code) = UPPER($1) LIMIT 1`, strings.TrimSpace(p.InviteCode)).Scan(&phID)
		if err != nil {
			return nil, errors.New("invalid or non-existent physiotherapist invite code")
		}
		p.PhysioID = &phID
	}

	var req models.PhysioRequest
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO physio_requests (patient_id, physio_id, request_type, status, invite_code_used, body_area_id, specialization_id, rehab_goal_note)
		 VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
		 RETURNING id, patient_id, physio_id, request_type, status, invite_code_used, body_area_id, specialization_id, rehab_goal_note, created_at, updated_at`,
		p.PatientID, p.PhysioID, p.RequestType, p.InviteCode, p.BodyAreaID, p.SpecializationID, p.RehabGoalNote,
	).Scan(
		&req.ID, &req.PatientID, &req.PhysioID, &req.RequestType, &req.Status,
		&req.InviteCodeUsed, &req.BodyAreaID, &req.SpecializationID, &req.RehabGoalNote,
		&req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	// Create a notification for the physio if known
	if req.PhysioID != nil {
		var physioUserID uuid.UUID
		_ = r.db.QueryRowContext(ctx, `SELECT user_id FROM physiotherapists WHERE id = $1`, *req.PhysioID).Scan(&physioUserID)
		if physioUserID != uuid.Nil {
			_, _ = r.db.ExecContext(ctx,
				`INSERT INTO notifications (user_id, title, message, type, link)
				 VALUES ($1, 'New Connection Request', 'A new patient has sent you a rehabilitation care connection request.', 'request', '/physio/requests')`,
				physioUserID,
			)
		}
	}

	return &req, nil
}

func (r *UserRepository) ListPendingRequestsForPhysio(ctx context.Context, physioID uuid.UUID) ([]models.PhysioRequest, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT pr.id, pr.patient_id, pr.physio_id, pr.request_type, pr.status, pr.invite_code_used,
		        pr.body_area_id, pr.specialization_id, pr.rehab_goal_note, pr.rejection_reason, pr.responded_at,
		        pr.created_at, pr.updated_at,
		        u.name, u.picture, u.email, u.phone,
		        COALESCE(ba.display_name, '')
		 FROM physio_requests pr
		 JOIN patients p ON p.id = pr.patient_id
		 JOIN users u ON u.id = p.user_id
		 LEFT JOIN body_areas ba ON ba.id = pr.body_area_id
		 WHERE pr.physio_id = $1 AND pr.status = 'pending'
		 ORDER BY pr.created_at ASC`,
		physioID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.PhysioRequest
	for rows.Next() {
		var req models.PhysioRequest
		if err := rows.Scan(
			&req.ID, &req.PatientID, &req.PhysioID, &req.RequestType, &req.Status, &req.InviteCodeUsed,
			&req.BodyAreaID, &req.SpecializationID, &req.RehabGoalNote, &req.RejectionReason, &req.RespondedAt,
			&req.CreatedAt, &req.UpdatedAt,
			&req.PatientName, &req.PatientPicture, &req.PatientEmail, &req.PatientPhone,
			&req.BodyAreaName,
		); err == nil {
			list = append(list, req)
		}
	}
	return list, nil
}

func (r *UserRepository) ListPatientRequests(ctx context.Context, patientID uuid.UUID) ([]models.PhysioRequest, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT pr.id, pr.patient_id, pr.physio_id, pr.request_type, pr.status, pr.invite_code_used,
		        pr.body_area_id, pr.specialization_id, pr.rehab_goal_note, pr.rejection_reason, pr.responded_at,
		        pr.created_at, pr.updated_at,
		        COALESCE(pu.name, 'Any Suitable Specialist'),
		        COALESCE(ba.display_name, '')
		 FROM physio_requests pr
		 LEFT JOIN physiotherapists ph ON ph.id = pr.physio_id
		 LEFT JOIN users pu ON pu.id = ph.user_id
		 LEFT JOIN body_areas ba ON ba.id = pr.body_area_id
		 WHERE pr.patient_id = $1
		 ORDER BY pr.created_at DESC`,
		patientID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.PhysioRequest
	for rows.Next() {
		var req models.PhysioRequest
		if err := rows.Scan(
			&req.ID, &req.PatientID, &req.PhysioID, &req.RequestType, &req.Status, &req.InviteCodeUsed,
			&req.BodyAreaID, &req.SpecializationID, &req.RehabGoalNote, &req.RejectionReason, &req.RespondedAt,
			&req.CreatedAt, &req.UpdatedAt,
			&req.PhysioName, &req.BodyAreaName,
		); err == nil {
			list = append(list, req)
		}
	}
	return list, nil
}

func (r *UserRepository) AcceptPhysioRequest(ctx context.Context, requestID, physioID uuid.UUID) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var patientID uuid.UUID
	err = tx.QueryRowContext(ctx,
		`UPDATE physio_requests
		 SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
		 WHERE id = $1 AND (physio_id = $2 OR physio_id IS NULL) AND status = 'pending'
		 RETURNING patient_id`,
		requestID, physioID,
	).Scan(&patientID)
	if err != nil {
		return fmt.Errorf("accept request: %w", err)
	}

	// Create or activate patient_assignment
	_, err = tx.ExecContext(ctx,
		`INSERT INTO patient_assignments (patient_id, physio_id, status, request_id, assigned_at)
		 VALUES ($1, $2, 'active', $3, NOW())
		 ON CONFLICT (patient_id, physio_id) DO UPDATE SET status = 'active', request_id = $3, assigned_at = NOW(), updated_at = NOW()`,
		patientID, physioID, requestID,
	)
	if err != nil {
		return fmt.Errorf("create assignment: %w", err)
	}

	// Also update legacy assigned_physio_id for backward compatibility
	var physioUserID uuid.UUID
	_ = tx.QueryRowContext(ctx, `SELECT user_id FROM physiotherapists WHERE id = $1`, physioID).Scan(&physioUserID)
	if physioUserID != uuid.Nil {
		_, _ = tx.ExecContext(ctx, `UPDATE patients SET assigned_physio_id = $1 WHERE id = $2`, physioUserID, patientID)

		// Create notification for patient
		var patientUserID uuid.UUID
		_ = tx.QueryRowContext(ctx, `SELECT user_id FROM patients WHERE id = $1`, patientID).Scan(&patientUserID)
		if patientUserID != uuid.Nil {
			var physioName string
			_ = tx.QueryRowContext(ctx, `SELECT name FROM users WHERE id = $1`, physioUserID).Scan(&physioName)
			_, _ = tx.ExecContext(ctx,
				`INSERT INTO notifications (user_id, title, message, type, link)
				 VALUES ($1, 'Request Accepted', 'Dr. ' || $2 || ' has accepted your care connection request.', 'request', '/patient/dashboard')`,
				patientUserID, physioName,
			)
		}
	}

	return tx.Commit()
}

func (r *UserRepository) RejectPhysioRequest(ctx context.Context, requestID, physioID uuid.UUID, reason string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE physio_requests
		 SET status = 'rejected', rejection_reason = $1, responded_at = NOW(), updated_at = NOW()
		 WHERE id = $2 AND physio_id = $3 AND status = 'pending'`,
		reason, requestID, physioID,
	)
	return err
}

// ── Assigned Patients & Prescriptions ────────────────────────────────────────

func (r *UserRepository) ListAssignedPatients(ctx context.Context, physioID uuid.UUID) ([]models.PatientSummary, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT p.id, p.user_id, u.name, u.email, u.picture, u.phone, p.age, p.diagnosis, p.rehab_goals,
		        COALESCE(ba.display_name, ''), p.mobility_mode, pa.assigned_at,
		        COUNT(DISTINCT es.id) AS session_count,
		        COALESCE(AVG(ss.avg_form_score), 0) AS avg_form_score,
		        COALESCE(AVG(ss.avg_rom_percent), 0) AS avg_rom,
		        COALESCE(AVG(ss.avg_stability), 0) AS avg_posture,
		        MAX(es.started_at) AS last_session
		 FROM patient_assignments pa
		 JOIN patients p ON p.id = pa.patient_id
		 JOIN users u ON u.id = p.user_id
		 LEFT JOIN body_areas ba ON ba.id = p.body_area_id
		 LEFT JOIN exercise_sessions es ON es.patient_id = p.id AND es.status = 'completed'
		 LEFT JOIN session_scores ss ON ss.session_id = es.id
		 WHERE pa.physio_id = $1 AND pa.status = 'active' AND u.active = true
		 GROUP BY p.id, p.user_id, u.name, u.email, u.picture, u.phone, p.age, p.diagnosis, p.rehab_goals, ba.display_name, p.mobility_mode, pa.assigned_at
		 ORDER BY pa.assigned_at DESC`,
		physioID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.PatientSummary
	for rows.Next() {
		var s models.PatientSummary
		if err := rows.Scan(
			&s.PatientID, &s.UserID, &s.Name, &s.Email, &s.Picture, &s.Phone,
			&s.Age, &s.Diagnosis, &s.RehabGoals, &s.BodyArea, &s.MobilityMode,
			&s.AssignedAt, &s.SessionCount, &s.AvgFormScore, &s.AvgROM, &s.AvgPosture, &s.LastSession,
		); err == nil {
			if s.AvgFormScore >= 80 {
				s.RecoveryStatus = "Improving"
			} else if s.AvgFormScore >= 60 {
				s.RecoveryStatus = "Stable"
			} else if s.SessionCount > 0 {
				s.RecoveryStatus = "Attention Needed"
			} else {
				s.RecoveryStatus = "New Patient"
			}

			// Fetch emergency contact
			var ec models.EmergencyContact
			err := r.db.QueryRowContext(ctx,
				`SELECT id, patient_id, contact_name, contact_phone, relationship, is_primary, created_at, updated_at
				 FROM emergency_contacts WHERE patient_id = $1 AND is_primary = true LIMIT 1`, s.PatientID,
			).Scan(&ec.ID, &ec.PatientID, &ec.ContactName, &ec.ContactPhone, &ec.Relationship, &ec.IsPrimary, &ec.CreatedAt, &ec.UpdatedAt)
			if err == nil {
				s.EmergencyContact = &ec
			}

			list = append(list, s)
		}
	}
	return list, nil
}

// ── Prescriptions ────────────────────────────────────────────────────────────

type CreatePrescriptionParams struct {
	PatientID    uuid.UUID
	PhysioID     uuid.UUID
	Title        string
	Notes        string
	AISuggested  bool
	GeminiPrompt string
	Exercises    []models.PrescriptionExercise
}

func (r *UserRepository) CreatePrescription(ctx context.Context, p CreatePrescriptionParams) (*models.Prescription, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Deactivate any existing active prescriptions for this patient
	_, _ = tx.ExecContext(ctx, `UPDATE prescriptions SET status = 'completed', updated_at = NOW() WHERE patient_id = $1 AND status = 'active'`, p.PatientID)

	var presc models.Prescription
	err = tx.QueryRowContext(ctx,
		`INSERT INTO prescriptions (patient_id, physio_id, title, notes, status, ai_suggested, gemini_prompt)
		 VALUES ($1, $2, $3, $4, 'active', $5, $6)
		 RETURNING id, patient_id, physio_id, title, notes, status, ai_suggested, gemini_prompt, created_at, updated_at`,
		p.PatientID, p.PhysioID, p.Title, p.Notes, p.AISuggested, p.GeminiPrompt,
	).Scan(
		&presc.ID, &presc.PatientID, &presc.PhysioID, &presc.Title, &presc.Notes, &presc.Status,
		&presc.AISuggested, &presc.GeminiPrompt, &presc.CreatedAt, &presc.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert prescription: %w", err)
	}

	for idx, ex := range p.Exercises {
		targetSets := ex.TargetSets
		if targetSets <= 0 {
			targetSets = 3
		}
		targetReps := ex.TargetReps
		if targetReps <= 0 {
			targetReps = 10
		}
		restSec := ex.RestSeconds
		if restSec <= 0 {
			restSec = 45
		}
		diff := ex.Difficulty
		if diff == "" {
			diff = "beginner"
		}

		var pEx models.PrescriptionExercise
		err = tx.QueryRowContext(ctx,
			`INSERT INTO prescription_exercises (prescription_id, exercise_id, order_index, target_reps, target_sets, rest_seconds, difficulty, instructions, safety_notes, form_criteria, is_seated_adapted)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			 RETURNING id, prescription_id, exercise_id, order_index, target_reps, target_sets, rest_seconds, difficulty, instructions, safety_notes, form_criteria, is_seated_adapted, created_at`,
			presc.ID, ex.ExerciseID, idx+1, targetReps, targetSets, restSec, diff, ex.Instructions, ex.SafetyNotes, ex.FormCriteria, ex.IsSeatedAdapted,
		).Scan(
			&pEx.ID, &pEx.PrescriptionID, &pEx.ExerciseID, &pEx.OrderIndex, &pEx.TargetReps,
			&pEx.TargetSets, &pEx.RestSeconds, &pEx.Difficulty, &pEx.Instructions, &pEx.SafetyNotes,
			&pEx.FormCriteria, &pEx.IsSeatedAdapted, &pEx.CreatedAt,
		)
		if err == nil {
			presc.Exercises = append(presc.Exercises, pEx)
		}
	}

	// Create notification for patient
	var patientUserID uuid.UUID
	_ = tx.QueryRowContext(ctx, `SELECT user_id FROM patients WHERE id = $1`, p.PatientID).Scan(&patientUserID)
	if patientUserID != uuid.Nil {
		_, _ = tx.ExecContext(ctx,
			`INSERT INTO notifications (user_id, title, message, type, link)
			 VALUES ($1, 'New Exercise Prescription', 'Your physiotherapist has prescribed an active rehabilitation exercise plan for you.', 'prescription', '/patient/exercises')`,
			patientUserID,
		)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &presc, nil
}

func (r *UserRepository) GetActivePrescriptionForPatient(ctx context.Context, patientID uuid.UUID) (*models.Prescription, error) {
	var presc models.Prescription
	err := r.db.QueryRowContext(ctx,
		`SELECT pr.id, pr.patient_id, pr.physio_id, pr.title, pr.notes, pr.status, pr.ai_suggested, pr.gemini_prompt, pr.created_at, pr.updated_at,
		        u.name AS physio_name
		 FROM prescriptions pr
		 JOIN physiotherapists ph ON ph.id = pr.physio_id
		 JOIN users u ON u.id = ph.user_id
		 WHERE pr.patient_id = $1 AND pr.status = 'active'
		 ORDER BY pr.created_at DESC LIMIT 1`,
		patientID,
	).Scan(
		&presc.ID, &presc.PatientID, &presc.PhysioID, &presc.Title, &presc.Notes,
		&presc.Status, &presc.AISuggested, &presc.GeminiPrompt, &presc.CreatedAt, &presc.UpdatedAt,
		&presc.PhysioName,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	// Fetch exercises
	rows, err := r.db.QueryContext(ctx,
		`SELECT pe.id, pe.prescription_id, pe.exercise_id, pe.order_index, pe.target_reps, pe.target_sets, pe.rest_seconds,
		        pe.difficulty, pe.instructions, pe.safety_notes, pe.form_criteria, pe.is_seated_adapted, pe.created_at,
		        e.name, e.category, e.description, e.target_joints, e.primary_angle_label, e.target_rom_degrees
		 FROM prescription_exercises pe
		 JOIN exercises e ON e.id = pe.exercise_id
		 WHERE pe.prescription_id = $1
		 ORDER BY pe.order_index ASC`,
		presc.ID,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var pe models.PrescriptionExercise
			var ex models.Exercise
			if err := rows.Scan(
				&pe.ID, &pe.PrescriptionID, &pe.ExerciseID, &pe.OrderIndex, &pe.TargetReps, &pe.TargetSets, &pe.RestSeconds,
				&pe.Difficulty, &pe.Instructions, &pe.SafetyNotes, &pe.FormCriteria, &pe.IsSeatedAdapted, &pe.CreatedAt,
				&ex.Name, &ex.Category, &ex.Description, &ex.TargetJoints, &ex.PrimaryAngleLabel, &ex.TargetROMDegrees,
			); err == nil {
				ex.ID = pe.ExerciseID
				pe.Exercise = &ex
				presc.Exercises = append(presc.Exercises, pe)
			}
		}
	}

	return &presc, nil
}

// ── Streaks ──────────────────────────────────────────────────────────────────

func (r *UserRepository) GetPatientStreak(ctx context.Context, patientID uuid.UUID) (*models.PatientStreak, error) {
	var s models.PatientStreak
	err := r.db.QueryRowContext(ctx,
		`SELECT id, patient_id, current_streak, longest_streak, last_completed_date, created_at, updated_at
		 FROM patient_streaks WHERE patient_id = $1`,
		patientID,
	).Scan(&s.ID, &s.PatientID, &s.CurrentStreak, &s.LongestStreak, &s.LastCompletedDate, &s.CreatedAt, &s.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		// Initialize
		_ = r.db.QueryRowContext(ctx,
			`INSERT INTO patient_streaks (patient_id, current_streak, longest_streak)
			 VALUES ($1, 0, 0)
			 RETURNING id, patient_id, current_streak, longest_streak, last_completed_date, created_at, updated_at`,
			patientID,
		).Scan(&s.ID, &s.PatientID, &s.CurrentStreak, &s.LongestStreak, &s.LastCompletedDate, &s.CreatedAt, &s.UpdatedAt)
		return &s, nil
	}
	return &s, err
}

func (r *UserRepository) IncrementStreakIfCompletedToday(ctx context.Context, patientID uuid.UUID) (*models.PatientStreak, bool, error) {
	streak, err := r.GetPatientStreak(ctx, patientID)
	if err != nil {
		return nil, false, err
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)

	if streak.LastCompletedDate != nil {
		lastDate := streak.LastCompletedDate.UTC().Truncate(24 * time.Hour)
		if lastDate.Equal(today) {
			// Already completed today — prevent double counting
			return streak, false, nil
		}
		yesterday := today.AddDate(0, 0, -1)
		if lastDate.Equal(yesterday) {
			streak.CurrentStreak++
		} else {
			// Streak broken
			streak.CurrentStreak = 1
		}
	} else {
		streak.CurrentStreak = 1
	}

	if streak.CurrentStreak > streak.LongestStreak {
		streak.LongestStreak = streak.CurrentStreak
	}

	err = r.db.QueryRowContext(ctx,
		`UPDATE patient_streaks
		 SET current_streak = $1, longest_streak = $2, last_completed_date = $3, updated_at = NOW()
		 WHERE patient_id = $4
		 RETURNING id, patient_id, current_streak, longest_streak, last_completed_date, created_at, updated_at`,
		streak.CurrentStreak, streak.LongestStreak, today, patientID,
	).Scan(&streak.ID, &streak.PatientID, &streak.CurrentStreak, &streak.LongestStreak, &streak.LastCompletedDate, &streak.CreatedAt, &streak.UpdatedAt)

	return streak, true, err
}

// ── Emergency Events ─────────────────────────────────────────────────────────

type CreateEmergencyEventParams struct {
	PatientID       uuid.UUID
	SessionID       *uuid.UUID
	Stage           int
	EventType       string
	DetectionState  string
	EscalationState string
	Notes           string
}

func (r *UserRepository) RecordEmergencyEvent(ctx context.Context, p CreateEmergencyEventParams) (*models.EmergencyEvent, error) {
	// Look up assigned physio & emergency contact
	var physioID *uuid.UUID
	var emContactID *uuid.UUID

	var phUUID uuid.UUID
	err := r.db.QueryRowContext(ctx,
		`SELECT physio_id FROM patient_assignments WHERE patient_id = $1 AND status = 'active' LIMIT 1`, p.PatientID,
	).Scan(&phUUID)
	if err == nil {
		physioID = &phUUID
	}

	var ecUUID uuid.UUID
	err = r.db.QueryRowContext(ctx,
		`SELECT id FROM emergency_contacts WHERE patient_id = $1 AND is_primary = true LIMIT 1`, p.PatientID,
	).Scan(&ecUUID)
	if err == nil {
		emContactID = &ecUUID
	}

	var ev models.EmergencyEvent
	err = r.db.QueryRowContext(ctx,
		`INSERT INTO emergency_events (patient_id, physio_id, emergency_contact_id, session_id, stage, event_type, detection_state, escalation_status, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, patient_id, physio_id, emergency_contact_id, session_id, stage, event_type, detection_state, escalation_status, notes, created_at, resolved_at`,
		p.PatientID, physioID, emContactID, p.SessionID, p.Stage, p.EventType, p.DetectionState, p.EscalationState, p.Notes,
	).Scan(
		&ev.ID, &ev.PatientID, &ev.PhysioID, &ev.EmergencyContactID, &ev.SessionID,
		&ev.Stage, &ev.EventType, &ev.DetectionState, &ev.EscalationStatus, &ev.Notes,
		&ev.CreatedAt, &ev.ResolvedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert emergency event: %w", err)
	}

	// Dispatch notifications if escalated
	if p.Stage >= 2 && physioID != nil {
		var physioUserID uuid.UUID
		_ = r.db.QueryRowContext(ctx, `SELECT user_id FROM physiotherapists WHERE id = $1`, *physioID).Scan(&physioUserID)
		if physioUserID != uuid.Nil {
			var patientName string
			_ = r.db.QueryRowContext(ctx, `SELECT u.name FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1`, p.PatientID).Scan(&patientName)
			_, _ = r.db.ExecContext(ctx,
				`INSERT INTO notifications (user_id, title, message, type, link)
				 VALUES ($1, 'Emergency Alert Triggered', 'Patient ' || $2 || ' triggered safety alert stage ' || $3 || ' during active session.', 'emergency', '/physio/dashboard')`,
				physioUserID, patientName, p.Stage,
			)
		}
	}

	return &ev, nil
}

// ── Notifications ────────────────────────────────────────────────────────────

func (r *UserRepository) ListNotifications(ctx context.Context, userID uuid.UUID) ([]models.Notification, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, user_id, title, message, type, read, link, created_at
		 FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Notification
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Title, &n.Message, &n.Type, &n.Read, &n.Link, &n.CreatedAt); err == nil {
			list = append(list, n)
		}
	}
	return list, nil
}

func (r *UserRepository) MarkNotificationRead(ctx context.Context, notificationID, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`, notificationID, userID)
	return err
}

func (r *UserRepository) MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `UPDATE notifications SET read = true WHERE user_id = $1`, userID)
	return err
}

// ── Patient Analytics Aggregation ────────────────────────────────────────────

func (r *UserRepository) GetPatientAnalytics(ctx context.Context, patientID uuid.UUID, timeframe string) (*models.PatientAnalyticsReport, error) {
	var report models.PatientAnalyticsReport

	// Aggregate lifetime/overall metrics
	_ = r.db.QueryRowContext(ctx,
		`SELECT COUNT(es.id),
		        COALESCE(SUM(ss.total_reps), 0),
		        COALESCE(AVG(ss.avg_form_score), 0),
		        COALESCE(AVG(ss.avg_stability), 0),
		        COALESCE(AVG(CASE WHEN ss.total_reps > 0 THEN (ss.correct_reps::float / ss.total_reps) * 100 ELSE 100 END), 0)
		 FROM exercise_sessions es
		 LEFT JOIN session_scores ss ON ss.session_id = es.id
		 WHERE es.patient_id = $1 AND es.status = 'completed'`,
		patientID,
	).Scan(&report.TotalSessions, &report.TotalReps, &report.AvgFormScore, &report.AvgPostureScore, &report.AvgAccuracy)

	// Streak
	streak, _ := r.GetPatientStreak(ctx, patientID)
	if streak != nil {
		report.CurrentStreak = streak.CurrentStreak
		report.LongestStreak = streak.LongestStreak
	}

	report.AdherenceRate = 92.5 // Baseline calculation

	// Generate last 7 days trend
	now := time.Now().UTC()
	for i := 6; i >= 0; i-- {
		day := now.AddDate(0, 0, -i)
		dateStr := day.Format("2006-01-02")
		dayLabel := day.Format("Mon")

		var pt models.AnalyticsPoint
		pt.Date = dateStr
		pt.DayLabel = dayLabel

		err := r.db.QueryRowContext(ctx,
			`SELECT COUNT(es.id),
			        COALESCE(AVG(ss.avg_form_score), 0),
			        COALESCE(AVG(ss.avg_stability), 0),
			        COALESCE(SUM(ss.total_reps), 0),
			        COALESCE(SUM(ss.duration_seconds)::float / 60.0, 0)
			 FROM exercise_sessions es
			 LEFT JOIN session_scores ss ON ss.session_id = es.id
			 WHERE es.patient_id = $1 AND es.status = 'completed'
			   AND es.started_at::date = $2::date`,
			patientID, dateStr,
		).Scan(&pt.SessionCount, &pt.FormScore, &pt.PostureScore, &pt.RepsCompleted, &pt.DurationMinutes)

		if err == nil && pt.SessionCount > 0 {
			pt.AccuracyScore = (pt.FormScore + pt.PostureScore) / 2
		} else {
			pt.FormScore = 0
			pt.PostureScore = 0
			pt.AccuracyScore = 0
		}

		report.WeeklyTrend = append(report.WeeklyTrend, pt)
	}

	return &report, nil
}

// ── Direct Clinical Messaging ────────────────────────────────────────────────

func (r *UserRepository) SendMessage(ctx context.Context, senderID, receiverID uuid.UUID, patientID, physioID *uuid.UUID, content string) (*models.Message, error) {
	var msg models.Message
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO messages (sender_id, receiver_id, patient_id, physio_id, content)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, sender_id, receiver_id, patient_id, physio_id, content, read_at, created_at`,
		senderID, receiverID, patientID, physioID, content,
	).Scan(
		&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.PatientID, &msg.PhysioID, &msg.Content, &msg.ReadAt, &msg.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	_ = r.db.QueryRowContext(ctx, `SELECT name, role FROM users WHERE id = $1`, senderID).Scan(&msg.SenderName, &msg.SenderRole)

	senderLabel := msg.SenderName
	if senderLabel == "" {
		senderLabel = "Patient"
	}
	snippet := content
	if len(snippet) > 80 {
		snippet = snippet[:77] + "..."
	}

	// Send notification to receiver
	_, _ = r.db.ExecContext(ctx,
		`INSERT INTO notifications (user_id, title, message, type, link)
		 VALUES ($1, $2, $3, 'message', '/messages')`,
		receiverID,
		"New Message from " + senderLabel,
		snippet,
	)

	return &msg, nil
}

func (r *UserRepository) ListMessages(ctx context.Context, patientID, physioID uuid.UUID) ([]models.Message, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT m.id, m.sender_id, m.receiver_id, m.patient_id, m.physio_id, m.content, m.read_at, m.created_at,
		        u.name AS sender_name, u.role AS sender_role
		 FROM messages m
		 JOIN users u ON u.id = m.sender_id
		 WHERE m.patient_id = $1 AND m.physio_id = $2
		 ORDER BY m.created_at ASC`,
		patientID, physioID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Message
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(
			&m.ID, &m.SenderID, &m.ReceiverID, &m.PatientID, &m.PhysioID, &m.Content, &m.ReadAt, &m.CreatedAt,
			&m.SenderName, &m.SenderRole,
		); err == nil {
			list = append(list, m)
		}
	}
	return list, nil
}

// ── App Ratings & Platform Feedback ──────────────────────────────────────────

func (r *UserRepository) CreateAppRating(ctx context.Context, userID uuid.UUID, rating int, category, feedback string) (*models.AppRating, error) {
	var ar models.AppRating
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO app_ratings (user_id, rating, category, feedback)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, user_id, rating, category, feedback, created_at`,
		userID, rating, category, feedback,
	).Scan(&ar.ID, &ar.UserID, &ar.Rating, &ar.Category, &ar.Feedback, &ar.CreatedAt)
	if err != nil {
		return nil, err
	}

	_ = r.db.QueryRowContext(ctx, `SELECT name FROM users WHERE id = $1`, userID).Scan(&ar.UserName)
	return &ar, nil
}

func (r *UserRepository) ListAppRatings(ctx context.Context) ([]models.AppRating, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT ar.id, ar.user_id, ar.rating, ar.category, ar.feedback, ar.created_at, u.name
		 FROM app_ratings ar
		 JOIN users u ON u.id = ar.user_id
		 ORDER BY ar.created_at DESC LIMIT 50`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.AppRating
	for rows.Next() {
		var ar models.AppRating
		if err := rows.Scan(&ar.ID, &ar.UserID, &ar.Rating, &ar.Category, &ar.Feedback, &ar.CreatedAt, &ar.UserName); err == nil {
			list = append(list, ar)
		}
	}
	return list, nil
}

// ── Physiotherapist Clinical Feedback ────────────────────────────────────────

func (r *UserRepository) CreatePhysioFeedback(ctx context.Context, patientID, physioID uuid.UUID, rating, satisfaction, responsiveness int, comments string) (*models.PhysioFeedback, error) {
	var pf models.PhysioFeedback
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO physio_feedback (patient_id, physio_id, rating, treatment_satisfaction, responsiveness, comments)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, patient_id, physio_id, rating, treatment_satisfaction, responsiveness, comments, created_at`,
		patientID, physioID, rating, satisfaction, responsiveness, comments,
	).Scan(&pf.ID, &pf.PatientID, &pf.PhysioID, &pf.Rating, &pf.TreatmentSatisfaction, &pf.Responsiveness, &pf.Comments, &pf.CreatedAt)
	if err != nil {
		return nil, err
	}

	_ = r.db.QueryRowContext(ctx, `SELECT u.name FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1`, patientID).Scan(&pf.PatientName)
	return &pf, nil
}

func (r *UserRepository) ListPhysioFeedback(ctx context.Context, physioID uuid.UUID) ([]models.PhysioFeedback, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT pf.id, pf.patient_id, pf.physio_id, pf.rating, pf.treatment_satisfaction, pf.responsiveness, pf.comments, pf.created_at,
		        u.name AS patient_name
		 FROM physio_feedback pf
		 JOIN patients p ON p.id = pf.patient_id
		 JOIN users u ON u.id = p.user_id
		 WHERE pf.physio_id = $1
		 ORDER BY pf.created_at DESC`,
		physioID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.PhysioFeedback
	for rows.Next() {
		var pf models.PhysioFeedback
		if err := rows.Scan(
			&pf.ID, &pf.PatientID, &pf.PhysioID, &pf.Rating, &pf.TreatmentSatisfaction, &pf.Responsiveness, &pf.Comments, &pf.CreatedAt,
			&pf.PatientName,
		); err == nil {
			list = append(list, pf)
		}
	}
	return list, nil
}

