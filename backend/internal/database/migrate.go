package database

import (
	"fmt"
	"log"

	"rehabvision/internal/auth"
)

// RunMigrations runs all DDL migrations idempotently.
// Uses CREATE TABLE IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS to be safe to run multiple times.
func RunMigrations(db *DB) error {
	migrations := []struct {
		name string
		sql  string
	}{
		{"enable_uuid", `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`},
		{"users", `
			CREATE TABLE IF NOT EXISTS users (
				id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				email         TEXT NOT NULL UNIQUE,
				password_hash TEXT NOT NULL DEFAULT '',
				name          TEXT NOT NULL DEFAULT '',
				picture       TEXT NOT NULL DEFAULT '',
				phone         TEXT NOT NULL DEFAULT '',
				role          TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient','physiotherapist','admin')),
				active        BOOLEAN NOT NULL DEFAULT true,
				created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"users_alter_password_phone", `
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
					ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
				END IF;
				IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
					ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
				END IF;
			END $$;
		`},
		{"oauth_accounts", `
			CREATE TABLE IF NOT EXISTS oauth_accounts (
				id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				provider         TEXT NOT NULL,
				provider_user_id TEXT NOT NULL,
				created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				UNIQUE(provider, provider_user_id)
			)`},
		{"auth_sessions", `
			CREATE TABLE IF NOT EXISTS auth_sessions (
				id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				token      TEXT NOT NULL UNIQUE,
				expires_at TIMESTAMPTZ NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"patients", `
			CREATE TABLE IF NOT EXISTS patients (
				id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				user_id            UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
				date_of_birth      DATE,
				age                INT DEFAULT 0,
				gender             TEXT NOT NULL DEFAULT '',
				diagnosis          TEXT NOT NULL DEFAULT '',
				rehab_goals        TEXT NOT NULL DEFAULT '',
				notes              TEXT NOT NULL DEFAULT '',
				assigned_physio_id UUID REFERENCES users(id),
				created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"patients_alter_fields", `
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='age') THEN
					ALTER TABLE patients ADD COLUMN age INT DEFAULT 0;
				END IF;
				IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='gender') THEN
					ALTER TABLE patients ADD COLUMN gender TEXT NOT NULL DEFAULT '';
				END IF;
				IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='rehab_goals') THEN
					ALTER TABLE patients ADD COLUMN rehab_goals TEXT NOT NULL DEFAULT '';
				END IF;
			END $$;
		`},
		{"physiotherapists", `
			CREATE TABLE IF NOT EXISTS physiotherapists (
				id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
				speciality     TEXT NOT NULL DEFAULT '',
				license_number TEXT NOT NULL DEFAULT '',
				created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"patient_assignments", `
			CREATE TABLE IF NOT EXISTS patient_assignments (
				id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
				physio_id     UUID NOT NULL REFERENCES physiotherapists(id) ON DELETE CASCADE,
				status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
				assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				unassigned_at TIMESTAMPTZ,
				created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				UNIQUE(patient_id, physio_id)
			)`},
		{"patient_assignments_alter_fields", `
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_assignments' AND column_name='status') THEN
					ALTER TABLE patient_assignments ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'));
				END IF;
				IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_assignments' AND column_name='created_at') THEN
					ALTER TABLE patient_assignments ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
				END IF;
				IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_assignments' AND column_name='updated_at') THEN
					ALTER TABLE patient_assignments ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
				END IF;
			END $$;
		`},
		{"exercises", `
			CREATE TABLE IF NOT EXISTS exercises (
				id                   TEXT PRIMARY KEY,
				name                 TEXT NOT NULL,
				category             TEXT NOT NULL DEFAULT 'rehab',
				description          TEXT NOT NULL DEFAULT '',
				target_joints        TEXT NOT NULL DEFAULT '',
				primary_angle_label  TEXT NOT NULL DEFAULT '',
				target_reps          INT NOT NULL DEFAULT 10,
				target_rom_degrees   INT NOT NULL DEFAULT 90,
				active               BOOLEAN NOT NULL DEFAULT true,
				created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"exercises_alter_category", `
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exercises' AND column_name='category') THEN
					ALTER TABLE exercises ADD COLUMN category TEXT NOT NULL DEFAULT 'rehab';
				END IF;
			END $$;
		`},
		{"seed_exercises", `
			INSERT INTO exercises (id, name, category, description, target_joints, primary_angle_label, target_reps, target_rom_degrees)
			VALUES
				('sit_to_stand', 'Sit to Stand', 'lower_body', 'Functional sit-to-stand for lower limb strength, quadriceps activation, and mobility', 'left_knee,right_knee,left_hip,right_hip', 'Knee Angle', 5, 155),
				('knee_extension', 'Seated Knee Extension', 'lower_body', 'Seated knee extension for quadriceps strengthening and patellar tracking', 'left_knee,right_knee', 'Knee Extension Angle', 10, 170),
				('leg_raise', 'Straight Leg Raise', 'lower_body', 'Straight leg raise for hip flexor activation and quadriceps rehabilitation', 'left_hip,right_hip,left_knee,right_knee', 'Hip Angle', 8, 45),
				('arm_raise', 'Arm / Shoulder Raise', 'upper_body', 'Frontal and lateral arm abduction for shoulder mobility and rotator cuff strength', 'left_shoulder,right_shoulder', 'Shoulder Abduction', 10, 90),
				('squat', 'Rehabilitation Squat', 'lower_body', 'Full body biomechanical squat assessing knee flexion, hip depth, and back inclination', 'left_knee,right_knee,left_hip,right_hip', 'Knee Flexion Angle', 10, 100),
				('neck_posture', 'Neck & Forward Head Alignment', 'posture', 'Real-time cervical and craniovertebral posture tracking to detect forward head position', 'nose,left_ear,right_ear,left_shoulder,right_shoulder', 'Craniovertebral Angle', 1, 50),
				('torso_bend', 'Back & Torso Bend Alignment', 'posture', 'Trunk inclination tracking calculating torso bend angle relative to vertical axis', 'left_shoulder,right_shoulder,left_hip,right_hip', 'Torso Inclination Angle', 5, 45),
				('shoulder_symmetry', 'Shoulder Symmetry & Balance', 'upper_body', 'Bilateral shoulder height and elevation symmetry assessment for postural imbalance', 'left_shoulder,right_shoulder', 'Shoulder Balance Delta', 10, 95),
				('knee_alignment', 'Knee Alignment & Valgus Tracking', 'lower_body', 'Frontal plane knee alignment tracking to detect valgus (inward) or varus collapse', 'left_hip,right_hip,left_knee,right_knee,left_ankle,right_ankle', 'Frontal Knee Angle', 8, 175),
				('lateral_leg_raise', 'Lateral Leg Raise', 'lower_body', 'Side-lying or standing hip abduction targeting gluteus medius and pelvic stability', 'left_hip,right_hip,left_ankle,right_ankle', 'Hip Abduction Angle', 8, 40)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				category = EXCLUDED.category,
				description = EXCLUDED.description,
				target_joints = EXCLUDED.target_joints,
				primary_angle_label = EXCLUDED.primary_angle_label,
				target_reps = EXCLUDED.target_reps,
				target_rom_degrees = EXCLUDED.target_rom_degrees,
				active = true`},
		{"exercise_sessions", `
			CREATE TABLE IF NOT EXISTS exercise_sessions (
				id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
				exercise_id  TEXT NOT NULL REFERENCES exercises(id),
				started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				completed_at TIMESTAMPTZ,
				status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
				notes        TEXT NOT NULL DEFAULT '',
				created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"session_scores", `
			CREATE TABLE IF NOT EXISTS session_scores (
				id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				session_id       UUID NOT NULL UNIQUE REFERENCES exercise_sessions(id) ON DELETE CASCADE,
				total_reps       INT NOT NULL DEFAULT 0,
				correct_reps     INT NOT NULL DEFAULT 0,
				avg_form_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
				avg_rom_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
				avg_symmetry     NUMERIC(5,2) NOT NULL DEFAULT 0,
				avg_stability    NUMERIC(5,2) NOT NULL DEFAULT 0,
				peak_angle       NUMERIC(6,2) NOT NULL DEFAULT 0,
				duration_seconds INT NOT NULL DEFAULT 0,
				computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"form_feedback", `
			CREATE TABLE IF NOT EXISTS form_feedback (
				id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				session_id  UUID NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
				issue_type   TEXT NOT NULL DEFAULT '',
				description TEXT NOT NULL DEFAULT '',
				frequency   INT NOT NULL DEFAULT 1,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"movement_metrics", `
			CREATE TABLE IF NOT EXISTS movement_metrics (
				id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				session_id          UUID NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
				rep_number          INT NOT NULL DEFAULT 0,
				primary_angle       NUMERIC(6,2) NOT NULL DEFAULT 0,
				knee_angle_left     NUMERIC(6,2) NOT NULL DEFAULT 0,
				knee_angle_right    NUMERIC(6,2) NOT NULL DEFAULT 0,
				shoulder_angle_left NUMERIC(6,2) NOT NULL DEFAULT 0,
				shoulder_angle_right NUMERIC(6,2) NOT NULL DEFAULT 0,
				hip_angle_left      NUMERIC(6,2) NOT NULL DEFAULT 0,
				hip_angle_right     NUMERIC(6,2) NOT NULL DEFAULT 0,
				trunk_lean          NUMERIC(6,2) NOT NULL DEFAULT 0,
				form_score          NUMERIC(5,2) NOT NULL DEFAULT 0,
				rom_percent         NUMERIC(5,2) NOT NULL DEFAULT 0,
				symmetry            NUMERIC(5,2) NOT NULL DEFAULT 0,
				stability           NUMERIC(5,2) NOT NULL DEFAULT 0,
				recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"gemini_summaries", `
			CREATE TABLE IF NOT EXISTS gemini_summaries (
				id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				session_id   UUID NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
				summary      TEXT NOT NULL DEFAULT '',
				insights     TEXT NOT NULL DEFAULT '',
				generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				model_used   TEXT NOT NULL DEFAULT ''
			)`},
		// ── Migration 002: Patient-Physiotherapist Workflow ──────────────────
		{"body_areas", `
			CREATE TABLE IF NOT EXISTS body_areas (
				id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				name         TEXT NOT NULL UNIQUE,
				display_name TEXT NOT NULL,
				created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"seed_body_areas", `
			INSERT INTO body_areas (name, display_name) VALUES
				('knee',     'Knee'),
				('shoulder', 'Shoulder'),
				('back',     'Back'),
				('neck',     'Neck'),
				('hip',      'Hip'),
				('ankle',    'Ankle'),
				('elbow',    'Elbow'),
				('other',    'Other')
			ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name`},
		{"specializations", `
			CREATE TABLE IF NOT EXISTS specializations (
				id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				name         TEXT NOT NULL UNIQUE,
				display_name TEXT NOT NULL,
				created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"seed_specializations", `
			INSERT INTO specializations (name, display_name) VALUES
				('neuro',                 'Neuro'),
				('orthopedic',            'Orthopedic / Ortho'),
				('knee',                  'Knee'),
				('back',                  'Back'),
				('shoulder',              'Shoulder'),
				('sports_rehabilitation', 'Sports Rehabilitation'),
				('spine',                 'Spine'),
				('posture',               'Posture'),
				('general_rehabilitation','General Rehabilitation')
			ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name`},
		{"physio_specializations", `
			CREATE TABLE IF NOT EXISTS physio_specializations (
				id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				physio_id         UUID NOT NULL REFERENCES physiotherapists(id) ON DELETE CASCADE,
				specialization_id UUID NOT NULL REFERENCES specializations(id) ON DELETE CASCADE,
				created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				UNIQUE(physio_id, specialization_id)
			)`},
		{"emergency_contacts", `
			CREATE TABLE IF NOT EXISTS emergency_contacts (
				id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
				contact_name  TEXT NOT NULL,
				contact_phone TEXT NOT NULL,
				relationship  TEXT NOT NULL DEFAULT '',
				is_primary    BOOLEAN NOT NULL DEFAULT true,
				created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"patients_add_body_area", `
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name = 'patients' AND column_name = 'body_area_id'
				) THEN
					ALTER TABLE patients ADD COLUMN body_area_id UUID REFERENCES body_areas(id);
				END IF;
			END $$`},
		{"physiotherapists_add_invite_code", `
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name = 'physiotherapists' AND column_name = 'invite_code'
				) THEN
					ALTER TABLE physiotherapists ADD COLUMN invite_code TEXT NOT NULL DEFAULT '';
				END IF;
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name = 'physiotherapists' AND column_name = 'bio'
				) THEN
					ALTER TABLE physiotherapists ADD COLUMN bio TEXT NOT NULL DEFAULT '';
				END IF;
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name = 'physiotherapists' AND column_name = 'accepting_patients'
				) THEN
					ALTER TABLE physiotherapists ADD COLUMN accepting_patients BOOLEAN NOT NULL DEFAULT true;
				END IF;
			END $$`},
		{"physiotherapists_backfill_invite_codes", `
			CREATE EXTENSION IF NOT EXISTS "pgcrypto";
			UPDATE physiotherapists
			SET invite_code = UPPER(SUBSTR(ENCODE(gen_random_bytes(5), 'hex'), 1, 8))
			WHERE invite_code = '' OR invite_code IS NULL`},
		{"patient_assignments_add_ended_at", `
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name = 'patient_assignments' AND column_name = 'ended_at'
				) THEN
					ALTER TABLE patient_assignments ADD COLUMN ended_at TIMESTAMPTZ;
				END IF;
			END $$`},
		{"physio_requests", `
			CREATE TABLE IF NOT EXISTS physio_requests (
				id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
				physio_id         UUID REFERENCES physiotherapists(id) ON DELETE SET NULL,
				request_type      TEXT NOT NULL DEFAULT 'invite_code'
				                  CHECK (request_type IN ('invite_code', 'matching')),
				status            TEXT NOT NULL DEFAULT 'pending'
				                  CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
				invite_code_used  TEXT,
				body_area_id      UUID REFERENCES body_areas(id),
				specialization_id UUID REFERENCES specializations(id),
				rehab_goal_note   TEXT NOT NULL DEFAULT '',
				rejection_reason  TEXT NOT NULL DEFAULT '',
				responded_at      TIMESTAMPTZ,
				created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"patient_assignments_add_request_id", `
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name = 'patient_assignments' AND column_name = 'request_id'
				) THEN
					ALTER TABLE patient_assignments ADD COLUMN request_id UUID REFERENCES physio_requests(id);
				END IF;
			END $$`},
		{"updated_at_trigger_function", `
			CREATE OR REPLACE FUNCTION trigger_set_updated_at()
			RETURNS TRIGGER AS $tr$
			BEGIN
				NEW.updated_at = NOW();
				RETURN NEW;
			END;
			$tr$ LANGUAGE plpgsql`},
		{"drop_old_auto_assign_trigger", `
			DROP TRIGGER IF EXISTS trigger_auto_assign_patient ON patients;
			DROP FUNCTION IF EXISTS auto_assign_new_patient()`},
		// ── Migration 003: Prescriptions, Streaks, Emergency Events, Notifications ──
		{"patients_add_mobility_mode", `
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name = 'patients' AND column_name = 'mobility_mode'
				) THEN
					ALTER TABLE patients ADD COLUMN mobility_mode TEXT NOT NULL DEFAULT 'standard'
						CHECK (mobility_mode IN ('standard', 'wheelchair', 'seated_only', 'limited_lower_body'));
				END IF;
			END $$`},
		{"prescriptions", `
			CREATE TABLE IF NOT EXISTS prescriptions (
				id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				patient_id     UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
				physio_id      UUID NOT NULL REFERENCES physiotherapists(id) ON DELETE CASCADE,
				title          TEXT NOT NULL DEFAULT 'Custom Rehabilitation Plan',
				notes          TEXT NOT NULL DEFAULT '',
				status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
				ai_suggested   BOOLEAN NOT NULL DEFAULT false,
				gemini_prompt  TEXT NOT NULL DEFAULT '',
				created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"prescription_exercises", `
			CREATE TABLE IF NOT EXISTS prescription_exercises (
				id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				prescription_id   UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
				exercise_id       TEXT NOT NULL REFERENCES exercises(id),
				order_index       INT NOT NULL DEFAULT 1,
				target_reps       INT NOT NULL DEFAULT 10,
				target_sets       INT NOT NULL DEFAULT 3,
				rest_seconds      INT NOT NULL DEFAULT 45,
				difficulty        TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
				instructions      TEXT NOT NULL DEFAULT '',
				safety_notes      TEXT NOT NULL DEFAULT '',
				form_criteria     TEXT NOT NULL DEFAULT '',
				is_seated_adapted BOOLEAN NOT NULL DEFAULT false,
				created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"patient_streaks", `
			CREATE TABLE IF NOT EXISTS patient_streaks (
				id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				patient_id          UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
				current_streak      INT NOT NULL DEFAULT 0,
				longest_streak      INT NOT NULL DEFAULT 0,
				last_completed_date DATE,
				created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"emergency_events", `
			CREATE TABLE IF NOT EXISTS emergency_events (
				id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
				physio_id            UUID REFERENCES physiotherapists(id) ON DELETE SET NULL,
				emergency_contact_id UUID REFERENCES emergency_contacts(id) ON DELETE SET NULL,
				session_id           UUID REFERENCES exercise_sessions(id) ON DELETE SET NULL,
				stage                INT NOT NULL DEFAULT 1 CHECK (stage IN (1, 2, 3)),
				event_type           TEXT NOT NULL DEFAULT 'face_loss' CHECK (event_type IN ('face_loss', 'fall_suspected', 'manual_panic', 'posture_collapse')),
				detection_state      TEXT NOT NULL DEFAULT 'active',
				escalation_status    TEXT NOT NULL DEFAULT 'triggered' CHECK (escalation_status IN ('triggered', 'acknowledged', 'escalated', 'resolved', 'false_alarm')),
				notes                TEXT NOT NULL DEFAULT '',
				created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				resolved_at          TIMESTAMPTZ
			)`},
		{"notifications", `
			CREATE TABLE IF NOT EXISTS notifications (
				id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				title      TEXT NOT NULL,
				message    TEXT NOT NULL,
				type       TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'request', 'prescription', 'emergency', 'streak', 'session')),
				read       BOOLEAN NOT NULL DEFAULT false,
				link       TEXT NOT NULL DEFAULT '',
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`},
		{"idx_prescriptions_patient", `CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id)`},
		{"idx_prescriptions_physio", `CREATE INDEX IF NOT EXISTS idx_prescriptions_physio ON prescriptions(physio_id)`},
		{"idx_prescriptions_status", `CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status)`},
		{"idx_prescription_exercises_prescription", `CREATE INDEX IF NOT EXISTS idx_prescription_exercises_prescription ON prescription_exercises(prescription_id)`},
		{"idx_patient_streaks_patient", `CREATE INDEX IF NOT EXISTS idx_patient_streaks_patient ON patient_streaks(patient_id)`},
		{"idx_emergency_events_patient", `CREATE INDEX IF NOT EXISTS idx_emergency_events_patient ON emergency_events(patient_id)`},
		{"idx_emergency_events_physio", `CREATE INDEX IF NOT EXISTS idx_emergency_events_physio ON emergency_events(physio_id)`},
		{"idx_emergency_events_stage", `CREATE INDEX IF NOT EXISTS idx_emergency_events_stage ON emergency_events(stage)`},
		{"idx_notifications_user", `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)`},
		// ── Indexes for new tables/columns ───────────────────────────────────
		{"idx_physio_specializations_physio", `CREATE INDEX IF NOT EXISTS idx_physio_specializations_physio ON physio_specializations(physio_id)`},
		{"idx_physio_specializations_spec", `CREATE INDEX IF NOT EXISTS idx_physio_specializations_spec ON physio_specializations(specialization_id)`},
		{"idx_emergency_contacts_patient", `CREATE INDEX IF NOT EXISTS idx_emergency_contacts_patient ON emergency_contacts(patient_id)`},
		{"idx_patients_body_area", `CREATE INDEX IF NOT EXISTS idx_patients_body_area ON patients(body_area_id)`},
		{"idx_physio_invite_code", `CREATE UNIQUE INDEX IF NOT EXISTS idx_physio_invite_code ON physiotherapists(invite_code) WHERE invite_code != ''`},
		{"idx_physio_accepting", `CREATE INDEX IF NOT EXISTS idx_physio_accepting ON physiotherapists(accepting_patients) WHERE accepting_patients = true`},
		{"idx_physio_requests_patient", `CREATE INDEX IF NOT EXISTS idx_physio_requests_patient ON physio_requests(patient_id)`},
		{"idx_physio_requests_physio", `CREATE INDEX IF NOT EXISTS idx_physio_requests_physio ON physio_requests(physio_id)`},
		{"idx_physio_requests_status", `CREATE INDEX IF NOT EXISTS idx_physio_requests_status ON physio_requests(status)`},
		{"idx_physio_requests_pending", `CREATE INDEX IF NOT EXISTS idx_physio_requests_pending_physio ON physio_requests(physio_id, status) WHERE status = 'pending'`},
		{"idx_unique_pending_request", `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_request ON physio_requests(patient_id, physio_id) WHERE status = 'pending'`},
		{"idx_patient_assignments_request", `CREATE INDEX IF NOT EXISTS idx_patient_assignments_request ON patient_assignments(request_id)`},
		// ── Original indexes ─────────────────────────────────────────────────
		{"idx_users_email", `CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email))`},
		{"idx_oauth_accounts_user", `CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id)`},
		{"idx_sessions_patient", `CREATE INDEX IF NOT EXISTS idx_exercise_sessions_patient_id ON exercise_sessions(patient_id)`},
		{"idx_sessions_status", `CREATE INDEX IF NOT EXISTS idx_exercise_sessions_status ON exercise_sessions(status)`},
		{"idx_metrics_session", `CREATE INDEX IF NOT EXISTS idx_movement_metrics_session_id ON movement_metrics(session_id)`},
		{"idx_form_feedback_session", `CREATE INDEX IF NOT EXISTS idx_form_feedback_session_id ON form_feedback(session_id)`},
		{"idx_patient_assignments", `CREATE INDEX IF NOT EXISTS idx_patient_assignments_lookup ON patient_assignments(physio_id, patient_id, status)`},
	}

	for _, m := range migrations {
		if _, err := db.Exec(m.sql); err != nil {
			return fmt.Errorf("migration %s: %w", m.name, err)
		}
		log.Printf("Migration OK: %s", m.name)
	}

	// Seed Priya Reddy (Physiotherapist ID 2510030295)
	if err := seedPriyaReddy(db); err != nil {
		return fmt.Errorf("seed priya reddy: %w", err)
	}

	return nil
}

func seedPriyaReddy(db *DB) error {
	const (
		priyaEmail   = "priya.reddy@rehabvision.io"
		priyaName    = "Priya Reddy"
		priyaID      = "2510030295"
		priyaPhone   = "+91 98765 43210"
		priyaSpec    = "Senior Orthopedic & Sports Physiotherapist"
		rawPassword  = "@1234"
	)

	pwdHash, err := auth.HashPassword(rawPassword)
	if err != nil {
		return fmt.Errorf("hash priya password: %w", err)
	}

	// Insert or update users record for Priya Reddy
	var userID string
	err = db.QueryRow(`
		INSERT INTO users (email, password_hash, name, picture, phone, role, active)
		VALUES ($1, $2, $3, $4, $5, 'physiotherapist', true)
		ON CONFLICT (email) DO UPDATE SET
			password_hash = EXCLUDED.password_hash,
			name = EXCLUDED.name,
			picture = EXCLUDED.picture,
			phone = EXCLUDED.phone,
			role = 'physiotherapist',
			active = true,
			updated_at = NOW()
		RETURNING id::text
	`, priyaEmail, pwdHash, priyaName, "/avatars/physio/priya-reddy.jpg", priyaPhone).Scan(&userID)
	if err != nil {
		return fmt.Errorf("upsert priya user: %w", err)
	}

	// Insert or update physiotherapists record for Priya Reddy with LicenseNumber 2510030295
	_, err = db.Exec(`
		INSERT INTO physiotherapists (user_id, speciality, license_number)
		VALUES ($1::uuid, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET
			speciality = EXCLUDED.speciality,
			license_number = EXCLUDED.license_number,
			updated_at = NOW()
	`, userID, priyaSpec, priyaID)
	if err != nil {
		return fmt.Errorf("upsert priya physiotherapist profile: %w", err)
	}

	log.Printf("[info] Seeded physiotherapist account: %s (License/ID: %s)", priyaName, priyaID)
	return nil
}

func seedDemoPatients(db *DB) error {
	var physioID, physioUserID string
	err := db.QueryRow(`
		SELECT ph.id::text, ph.user_id::text FROM physiotherapists ph
		WHERE ph.license_number = '2510030295'
		LIMIT 1
	`).Scan(&physioID, &physioUserID)
	if err != nil {
		return nil
	}

	demoPatients := []struct {
		email      string
		name       string
		phone      string
		picture    string
		age        int
		gender     string
		diagnosis  string
		rehabGoals string
		exerciseID string
		formScore  float64
		romScore   float64
		reps       int
	}{
		{
			email:      "rahul.kumar@rehabvision.local",
			name:       "Rahul Kumar",
			phone:      "+91 98111 00001",
			picture:    "/avatars/patients/patient-01.jpg",
			age:        34,
			gender:     "Male",
			diagnosis:  "Post-ACL Reconstruction (Right Knee)",
			rehabGoals: "Restore 45° straight leg raise and quadriceps motor control",
			exerciseID: "leg_raise",
			formScore:  91.5,
			romScore:   44.0,
			reps:       8,
		},
		{
			email:      "sneha.patel@rehabvision.local",
			name:       "Sneha Patel",
			phone:      "+91 98111 00002",
			picture:    "/avatars/patients/patient-02.jpg",
			age:        28,
			gender:     "Female",
			diagnosis:  "Cervical Spine Forward Head Posture",
			rehabGoals: "Correct Craniovertebral Angle and neck alignment",
			exerciseID: "neck_posture",
			formScore:  88.0,
			romScore:   52.0,
			reps:       1,
		},
		{
			email:      "amit.sharma@rehabvision.local",
			name:       "Amit Sharma",
			phone:      "+91 98111 00003",
			picture:    "/avatars/patients/patient-03.jpg",
			age:        46,
			gender:     "Male",
			diagnosis:  "Patellofemoral Pain Syndrome",
			rehabGoals: "Strengthen quadriceps and knee terminal extension",
			exerciseID: "knee_extension",
			formScore:  94.0,
			romScore:   168.0,
			reps:       10,
		},
		{
			email:      "priya.verma@rehabvision.local",
			name:       "Priya Verma",
			phone:      "+91 98111 00004",
			picture:    "/avatars/patients/patient-04.jpg",
			age:        31,
			gender:     "Female",
			diagnosis:  "Rotator Cuff Tendinopathy (Left Shoulder)",
			rehabGoals: "Restore 90° shoulder abduction without shrugging",
			exerciseID: "arm_raise",
			formScore:  86.5,
			romScore:   88.0,
			reps:       10,
		},
		{
			email:      "rajesh.nair@rehabvision.local",
			name:       "Rajesh Nair",
			phone:      "+91 98111 00005",
			picture:    "/avatars/patients/patient-05.jpg",
			age:        58,
			gender:     "Male",
			diagnosis:  "Post-Op Knee Arthroplasty Mobility",
			rehabGoals: "Improve functional sit-to-stand weight transfer",
			exerciseID: "sit_to_stand",
			formScore:  89.0,
			romScore:   152.0,
			reps:       5,
		},
	}

	pwdHash, _ := auth.HashPassword("@1234")

	for _, dp := range demoPatients {
		var uID string
		err := db.QueryRow(`
			INSERT INTO users (email, password_hash, name, picture, phone, role, active)
			VALUES ($1, $2, $3, $4, $5, 'patient', true)
			ON CONFLICT (email) DO UPDATE SET
				name = EXCLUDED.name,
				picture = EXCLUDED.picture,
				phone = EXCLUDED.phone,
				active = true,
				updated_at = NOW()
			RETURNING id::text
		`, dp.email, pwdHash, dp.name, dp.picture, dp.phone).Scan(&uID)
		if err != nil {
			continue
		}

		var pID string
		err = db.QueryRow(`
			INSERT INTO patients (user_id, age, gender, diagnosis, rehab_goals, assigned_physio_id)
			VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid)
			ON CONFLICT (user_id) DO UPDATE SET
				age = EXCLUDED.age,
				gender = EXCLUDED.gender,
				diagnosis = EXCLUDED.diagnosis,
				rehab_goals = EXCLUDED.rehab_goals,
				assigned_physio_id = EXCLUDED.assigned_physio_id,
				updated_at = NOW()
			RETURNING id::text
		`, uID, dp.age, dp.gender, dp.diagnosis, dp.rehabGoals, physioUserID).Scan(&pID)
		if err != nil {
			continue
		}

		// Assign to Priya Reddy
		_, _ = db.Exec(`
			INSERT INTO patient_assignments (patient_id, physio_id, status)
			VALUES ($1::uuid, $2::uuid, 'active')
			ON CONFLICT (patient_id, physio_id) DO UPDATE SET
				status = 'active',
				updated_at = NOW()
		`, pID, physioID)

		// Seed 1 completed session if patient doesn't already have one
		var sessCount int
		_ = db.QueryRow(`SELECT COUNT(*) FROM exercise_sessions WHERE patient_id = $1::uuid`, pID).Scan(&sessCount)
		if sessCount == 0 {
			var sessID string
			err = db.QueryRow(`
				INSERT INTO exercise_sessions (patient_id, exercise_id, status, started_at, completed_at)
				VALUES ($1::uuid, $2, 'completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 55 minutes')
				RETURNING id::text
			`, pID, dp.exerciseID).Scan(&sessID)

			if err == nil {
				_, _ = db.Exec(`
					INSERT INTO session_scores (session_id, total_reps, correct_reps, avg_form_score, avg_rom_percent, avg_symmetry, avg_stability, peak_angle, duration_seconds)
					VALUES ($1::uuid, $2, $3, $4, $5, 95.0, 92.0, $6, 65)
					ON CONFLICT (session_id) DO NOTHING
				`, sessID, dp.reps, dp.reps-1, dp.formScore, dp.romScore, dp.romScore)

				_, _ = db.Exec(`
					INSERT INTO form_feedback (session_id, issue_type, description, frequency)
					VALUES ($1::uuid, 'symmetry', 'Slight movement speed acceleration on eccentric phase', 1)
				`, sessID)
			}
		}
	}

	log.Printf("[info] Seeded 5 professional demo patient accounts and clinical sessions assigned to Priya Reddy")
	return nil
}

func autoAssignPatientsToPriyaReddy(db *DB) error {
	var physioID string
	err := db.QueryRow(`
		SELECT ph.id::text FROM physiotherapists ph
		WHERE ph.license_number = '2510030295'
		LIMIT 1
	`).Scan(&physioID)
	if err != nil {
		return nil
	}

	_, err = db.Exec(`
		INSERT INTO patient_assignments (patient_id, physio_id, status)
		SELECT p.id, $1::uuid, 'active'
		FROM patients p
		ON CONFLICT (patient_id, physio_id) DO UPDATE SET
			status = 'active',
			updated_at = NOW()
	`, physioID)
	if err != nil {
		return fmt.Errorf("auto assign patients exec: %w", err)
	}

	return nil
}
