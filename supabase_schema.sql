-- ==============================================================================
-- REHABVISION PRODUCTION SUPABASE POSTGRESQL SCHEMA & SEED MIGRATION
-- ==============================================================================
-- Target: Supabase PostgreSQL (Compatible with Direct & Transaction Poolers)
-- Instructions: Copy and paste the entire script into Supabase SQL Editor and Run.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Users Table
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
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. OAuth Accounts Table (Compatibility)
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);

-- 4. Auth Sessions Table
CREATE TABLE IF NOT EXISTS auth_sessions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Physiotherapists Table
CREATE TABLE IF NOT EXISTS physiotherapists (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    speciality     TEXT NOT NULL DEFAULT '',
    license_number TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_physio_license ON physiotherapists(license_number);

-- 6. Patients Table
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
);

CREATE INDEX IF NOT EXISTS idx_patients_user ON patients(user_id);

-- 7. Patient Assignments Table (Clinician Care Panel)
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
);

CREATE INDEX IF NOT EXISTS idx_patient_assignments_lookup ON patient_assignments(physio_id, patient_id, status);

-- 8. Clinical Exercises Table
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
);

-- 9. Exercise Sessions Table
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
);

CREATE INDEX IF NOT EXISTS idx_sessions_patient ON exercise_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON exercise_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON exercise_sessions(started_at DESC);

-- 10. Session Scores Table
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
);

CREATE INDEX IF NOT EXISTS idx_session_scores_session ON session_scores(session_id);

-- 11. Form Feedback Alerts Table
CREATE TABLE IF NOT EXISTS form_feedback (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
    issue_type   TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    frequency   INT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_feedback_session ON form_feedback(session_id);

-- 12. Movement Metrics Telemetry Table
CREATE TABLE IF NOT EXISTS movement_metrics (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id           UUID NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
    rep_number           INT NOT NULL DEFAULT 0,
    primary_angle        NUMERIC(6,2) NOT NULL DEFAULT 0,
    knee_angle_left      NUMERIC(6,2) NOT NULL DEFAULT 0,
    knee_angle_right     NUMERIC(6,2) NOT NULL DEFAULT 0,
    shoulder_angle_left  NUMERIC(6,2) NOT NULL DEFAULT 0,
    shoulder_angle_right NUMERIC(6,2) NOT NULL DEFAULT 0,
    hip_angle_left       NUMERIC(6,2) NOT NULL DEFAULT 0,
    hip_angle_right      NUMERIC(6,2) NOT NULL DEFAULT 0,
    trunk_lean           NUMERIC(6,2) NOT NULL DEFAULT 0,
    form_score           NUMERIC(5,2) NOT NULL DEFAULT 0,
    rom_percent          NUMERIC(5,2) NOT NULL DEFAULT 0,
    symmetry             NUMERIC(5,2) NOT NULL DEFAULT 0,
    stability            NUMERIC(5,2) NOT NULL DEFAULT 0,
    recorded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movement_metrics_session ON movement_metrics(session_id);

-- 13. Gemini Summaries Table
CREATE TABLE IF NOT EXISTS gemini_summaries (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id   UUID NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
    summary      TEXT NOT NULL DEFAULT '',
    insights     TEXT NOT NULL DEFAULT '',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_used   TEXT NOT NULL DEFAULT ''
);

-- ==============================================================================
-- SEED DATA: 10 CLINICAL EXERCISES
-- ==============================================================================
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
    active = true;

-- ==============================================================================
-- SEED DATA: SINGLE PHYSIOTHERAPIST (PRIYA REDDY - ID: 2510030295)
-- Bcrypt cost 12 hash of '@1234': $2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
-- ==============================================================================
DO $$
DECLARE
    priya_user_id UUID;
    priya_physio_id UUID;
BEGIN
    INSERT INTO users (email, password_hash, name, picture, phone, role, active)
    VALUES (
        'priya.reddy@rehabvision.io',
        '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        'Priya Reddy',
        '/avatars/physio/priya-reddy.jpg',
        '+91 98765 43210',
        'physiotherapist',
        true
    )
    ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        picture = EXCLUDED.picture,
        phone = EXCLUDED.phone,
        role = 'physiotherapist',
        active = true,
        updated_at = NOW()
    RETURNING id INTO priya_user_id;

    INSERT INTO physiotherapists (user_id, speciality, license_number)
    VALUES (priya_user_id, 'Senior Orthopedic & Sports Physiotherapist', '2510030295')
    ON CONFLICT (user_id) DO UPDATE SET
        speciality = EXCLUDED.speciality,
        license_number = EXCLUDED.license_number,
        updated_at = NOW()
    RETURNING id INTO priya_physio_id;
END $$;

-- ==============================================================================
-- SEED DATA: 5 DEMO PATIENTS ASSIGNED TO PRIYA REDDY
-- ==============================================================================
DO $$
DECLARE
    p_user_id UUID;
    p_pat_id UUID;
    ph_id UUID;
    ph_u_id UUID;
    sess_id UUID;
    pwd_hash TEXT := '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; -- '@1234'
BEGIN
    SELECT id, user_id INTO ph_id, ph_u_id FROM physiotherapists WHERE license_number = '2510030295' LIMIT 1;

    -- Patient 1: Rahul Kumar (PT-0001)
    INSERT INTO users (email, password_hash, name, picture, phone, role, active)
    VALUES ('rahul.kumar@rehabvision.local', pwd_hash, 'Rahul Kumar', '/avatars/patients/patient-01.jpg', '+91 98111 00001', 'patient', true)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, picture = EXCLUDED.picture RETURNING id INTO p_user_id;

    INSERT INTO patients (user_id, age, gender, diagnosis, rehab_goals, assigned_physio_id)
    VALUES (p_user_id, 34, 'Male', 'Post-ACL Reconstruction (Right Knee)', 'Restore 45° straight leg raise and quadriceps motor control', ph_u_id)
    ON CONFLICT (user_id) DO UPDATE SET diagnosis = EXCLUDED.diagnosis RETURNING id INTO p_pat_id;

    INSERT INTO patient_assignments (patient_id, physio_id, status)
    VALUES (p_pat_id, ph_id, 'active')
    ON CONFLICT (patient_id, physio_id) DO UPDATE SET status = 'active';

    IF NOT EXISTS (SELECT 1 FROM exercise_sessions WHERE patient_id = p_pat_id) THEN
        INSERT INTO exercise_sessions (patient_id, exercise_id, status, started_at, completed_at)
        VALUES (p_pat_id, 'leg_raise', 'completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 55 minutes')
        RETURNING id INTO sess_id;

        INSERT INTO session_scores (session_id, total_reps, correct_reps, avg_form_score, avg_rom_percent, avg_symmetry, avg_stability, peak_angle, duration_seconds)
        VALUES (sess_id, 8, 7, 91.50, 44.00, 96.00, 93.00, 44.00, 55);

        INSERT INTO form_feedback (session_id, issue_type, description, frequency)
        VALUES (sess_id, 'knee_lock', 'Minor acceleration on terminal repetition', 1);
    END IF;

    -- Patient 2: Sneha Patel (PT-0002)
    INSERT INTO users (email, password_hash, name, picture, phone, role, active)
    VALUES ('sneha.patel@rehabvision.local', pwd_hash, 'Sneha Patel', '/avatars/patients/patient-02.jpg', '+91 98111 00002', 'patient', true)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, picture = EXCLUDED.picture RETURNING id INTO p_user_id;

    INSERT INTO patients (user_id, age, gender, diagnosis, rehab_goals, assigned_physio_id)
    VALUES (p_user_id, 28, 'Female', 'Cervical Spine Forward Head Posture', 'Correct Craniovertebral Angle and neck alignment', ph_u_id)
    ON CONFLICT (user_id) DO UPDATE SET diagnosis = EXCLUDED.diagnosis RETURNING id INTO p_pat_id;

    INSERT INTO patient_assignments (patient_id, physio_id, status)
    VALUES (p_pat_id, ph_id, 'active')
    ON CONFLICT (patient_id, physio_id) DO UPDATE SET status = 'active';

    IF NOT EXISTS (SELECT 1 FROM exercise_sessions WHERE patient_id = p_pat_id) THEN
        INSERT INTO exercise_sessions (patient_id, exercise_id, status, started_at, completed_at)
        VALUES (p_pat_id, 'neck_posture', 'completed', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 58 minutes')
        RETURNING id INTO sess_id;

        INSERT INTO session_scores (session_id, total_reps, correct_reps, avg_form_score, avg_rom_percent, avg_symmetry, avg_stability, peak_angle, duration_seconds)
        VALUES (sess_id, 1, 1, 88.00, 52.00, 94.00, 90.00, 52.00, 30);
    END IF;

    -- Patient 3: Amit Sharma (PT-0003)
    INSERT INTO users (email, password_hash, name, picture, phone, role, active)
    VALUES ('amit.sharma@rehabvision.local', pwd_hash, 'Amit Sharma', '/avatars/patients/patient-03.jpg', '+91 98111 00003', 'patient', true)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, picture = EXCLUDED.picture RETURNING id INTO p_user_id;

    INSERT INTO patients (user_id, age, gender, diagnosis, rehab_goals, assigned_physio_id)
    VALUES (p_user_id, 46, 'Male', 'Patellofemoral Pain Syndrome', 'Strengthen quadriceps and knee terminal extension', ph_u_id)
    ON CONFLICT (user_id) DO UPDATE SET diagnosis = EXCLUDED.diagnosis RETURNING id INTO p_pat_id;

    INSERT INTO patient_assignments (patient_id, physio_id, status)
    VALUES (p_pat_id, ph_id, 'active')
    ON CONFLICT (patient_id, physio_id) DO UPDATE SET status = 'active';

    IF NOT EXISTS (SELECT 1 FROM exercise_sessions WHERE patient_id = p_pat_id) THEN
        INSERT INTO exercise_sessions (patient_id, exercise_id, status, started_at, completed_at)
        VALUES (p_pat_id, 'knee_extension', 'completed', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 50 minutes')
        RETURNING id INTO sess_id;

        INSERT INTO session_scores (session_id, total_reps, correct_reps, avg_form_score, avg_rom_percent, avg_symmetry, avg_stability, peak_angle, duration_seconds)
        VALUES (sess_id, 10, 9, 94.00, 168.00, 97.00, 95.00, 170.00, 60);
    END IF;

    -- Patient 4: Priya Verma (PT-0004)
    INSERT INTO users (email, password_hash, name, picture, phone, role, active)
    VALUES ('priya.verma@rehabvision.local', pwd_hash, 'Priya Verma', '/avatars/patients/patient-04.jpg', '+91 98111 00004', 'patient', true)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, picture = EXCLUDED.picture RETURNING id INTO p_user_id;

    INSERT INTO patients (user_id, age, gender, diagnosis, rehab_goals, assigned_physio_id)
    VALUES (p_user_id, 31, 'Female', 'Rotator Cuff Tendinopathy (Left Shoulder)', 'Restore 90° shoulder abduction without shrugging', ph_u_id)
    ON CONFLICT (user_id) DO UPDATE SET diagnosis = EXCLUDED.diagnosis RETURNING id INTO p_pat_id;

    INSERT INTO patient_assignments (patient_id, physio_id, status)
    VALUES (p_pat_id, ph_id, 'active')
    ON CONFLICT (patient_id, physio_id) DO UPDATE SET status = 'active';

    IF NOT EXISTS (SELECT 1 FROM exercise_sessions WHERE patient_id = p_pat_id) THEN
        INSERT INTO exercise_sessions (patient_id, exercise_id, status, started_at, completed_at)
        VALUES (p_pat_id, 'arm_raise', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours 50 minutes')
        RETURNING id INTO sess_id;

        INSERT INTO session_scores (session_id, total_reps, correct_reps, avg_form_score, avg_rom_percent, avg_symmetry, avg_stability, peak_angle, duration_seconds)
        VALUES (sess_id, 10, 8, 86.50, 88.00, 92.00, 89.00, 90.00, 50);
    END IF;

    -- Patient 5: Rajesh Nair (PT-0005)
    INSERT INTO users (email, password_hash, name, picture, phone, role, active)
    VALUES ('rajesh.nair@rehabvision.local', pwd_hash, 'Rajesh Nair', '/avatars/patients/patient-05.jpg', '+91 98111 00005', 'patient', true)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, picture = EXCLUDED.picture RETURNING id INTO p_user_id;

    INSERT INTO patients (user_id, age, gender, diagnosis, rehab_goals, assigned_physio_id)
    VALUES (p_user_id, 58, 'Male', 'Post-Op Knee Arthroplasty Mobility', 'Improve functional sit-to-stand weight transfer', ph_u_id)
    ON CONFLICT (user_id) DO UPDATE SET diagnosis = EXCLUDED.diagnosis RETURNING id INTO p_pat_id;

    INSERT INTO patient_assignments (patient_id, physio_id, status)
    VALUES (p_pat_id, ph_id, 'active')
    ON CONFLICT (patient_id, physio_id) DO UPDATE SET status = 'active';

    IF NOT EXISTS (SELECT 1 FROM exercise_sessions WHERE patient_id = p_pat_id) THEN
        INSERT INTO exercise_sessions (patient_id, exercise_id, status, started_at, completed_at)
        VALUES (p_pat_id, 'sit_to_stand', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours 52 minutes')
        RETURNING id INTO sess_id;

        INSERT INTO session_scores (session_id, total_reps, correct_reps, avg_form_score, avg_rom_percent, avg_symmetry, avg_stability, peak_angle, duration_seconds)
        VALUES (sess_id, 5, 4, 89.00, 152.00, 95.00, 91.00, 155.00, 45);
    END IF;
END $$;

-- ==============================================================================
-- 14. REFERENCE TABLE: body_areas
-- ==============================================================================
CREATE TABLE IF NOT EXISTS body_areas (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO body_areas (name, display_name) VALUES
    ('knee',     'Knee'),
    ('shoulder', 'Shoulder'),
    ('back',     'Back'),
    ('neck',     'Neck'),
    ('hip',      'Hip'),
    ('ankle',    'Ankle'),
    ('elbow',    'Elbow'),
    ('other',    'Other')
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name;

-- ==============================================================================
-- 15. REFERENCE TABLE: specializations
-- ==============================================================================
CREATE TABLE IF NOT EXISTS specializations (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name;

-- ==============================================================================
-- 16. JUNCTION TABLE: physio_specializations (many-to-many)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS physio_specializations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    physio_id         UUID NOT NULL REFERENCES physiotherapists(id) ON DELETE CASCADE,
    specialization_id UUID NOT NULL REFERENCES specializations(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(physio_id, specialization_id)
);

CREATE INDEX IF NOT EXISTS idx_physio_specializations_physio ON physio_specializations(physio_id);
CREATE INDEX IF NOT EXISTS idx_physio_specializations_spec ON physio_specializations(specialization_id);

-- ==============================================================================
-- 17. TABLE: emergency_contacts
-- ==============================================================================
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    contact_name  TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    relationship  TEXT NOT NULL DEFAULT '',
    is_primary    BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_patient ON emergency_contacts(patient_id);

-- ==============================================================================
-- 18. SCHEMA ENHANCEMENTS: patients & physiotherapists
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'body_area_id'
    ) THEN
        ALTER TABLE patients ADD COLUMN body_area_id UUID REFERENCES body_areas(id);
    END IF;

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

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patient_assignments' AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE patient_assignments ADD COLUMN ended_at TIMESTAMPTZ;
    END IF;
END $$;

UPDATE physiotherapists
SET invite_code = UPPER(SUBSTR(ENCODE(gen_random_bytes(5), 'hex'), 1, 8))
WHERE invite_code = '' OR invite_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_physio_invite_code ON physiotherapists(invite_code) WHERE invite_code != '';
CREATE INDEX IF NOT EXISTS idx_physio_accepting ON physiotherapists(accepting_patients) WHERE accepting_patients = true;
CREATE INDEX IF NOT EXISTS idx_patients_body_area ON patients(body_area_id);

-- ==============================================================================
-- 19. TABLE: physio_requests — Connection Request Workflow
-- ==============================================================================
CREATE TABLE IF NOT EXISTS physio_requests (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    physio_id         UUID REFERENCES physiotherapists(id) ON DELETE SET NULL,
    request_type      TEXT NOT NULL DEFAULT 'invite_code' CHECK (request_type IN ('invite_code', 'matching')),
    status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    invite_code_used  TEXT,
    body_area_id      UUID REFERENCES body_areas(id),
    specialization_id UUID REFERENCES specializations(id),
    rehab_goal_note   TEXT NOT NULL DEFAULT '',
    rejection_reason  TEXT NOT NULL DEFAULT '',
    responded_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_physio_requests_patient ON physio_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_physio_requests_physio ON physio_requests(physio_id);
CREATE INDEX IF NOT EXISTS idx_physio_requests_status ON physio_requests(status);
CREATE INDEX IF NOT EXISTS idx_physio_requests_pending_physio ON physio_requests(physio_id, status) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_request ON physio_requests(patient_id, physio_id) WHERE status = 'pending';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patient_assignments' AND column_name = 'request_id'
    ) THEN
        ALTER TABLE patient_assignments ADD COLUMN request_id UUID REFERENCES physio_requests(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patient_assignments_request ON patient_assignments(request_id);

-- ==============================================================================
-- 20. TRIGGERS & SEED SPECIALIZATION FOR PRIYA REDDY
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl TEXT;
    priya_physio_id UUID;
    ortho_id UUID;
    sports_id UUID;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['users', 'patients', 'physiotherapists', 'patient_assignments', 'emergency_contacts', 'physio_requests']) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', tbl, tbl);
    END LOOP;

    SELECT id INTO priya_physio_id FROM physiotherapists WHERE license_number = '2510030295' LIMIT 1;
    IF priya_physio_id IS NOT NULL THEN
        SELECT id INTO ortho_id FROM specializations WHERE name = 'orthopedic' LIMIT 1;
        SELECT id INTO sports_id FROM specializations WHERE name = 'sports_rehabilitation' LIMIT 1;
        IF ortho_id IS NOT NULL THEN
            INSERT INTO physio_specializations (physio_id, specialization_id) VALUES (priya_physio_id, ortho_id) ON CONFLICT DO NOTHING;
        END IF;
        IF sports_id IS NOT NULL THEN
            INSERT INTO physio_specializations (physio_id, specialization_id) VALUES (priya_physio_id, sports_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;

-- ==============================================================================
-- 21. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE physiotherapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE specializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_specializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users FOR SELECT USING (id = current_setting('app.current_user_id', true)::uuid OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update ON users FOR UPDATE USING (id = current_setting('app.current_user_id', true)::uuid OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS patients_select ON patients;
CREATE POLICY patients_select ON patients FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::uuid OR EXISTS (SELECT 1 FROM patient_assignments pa JOIN physiotherapists ph ON ph.id = pa.physio_id WHERE pa.patient_id = patients.id AND ph.user_id = current_setting('app.current_user_id', true)::uuid AND pa.status = 'active') OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS patients_update ON patients;
CREATE POLICY patients_update ON patients FOR UPDATE USING (user_id = current_setting('app.current_user_id', true)::uuid OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS physio_select ON physiotherapists;
CREATE POLICY physio_select ON physiotherapists FOR SELECT USING (true);

DROP POLICY IF EXISTS physio_update ON physiotherapists;
CREATE POLICY physio_update ON physiotherapists FOR UPDATE USING (user_id = current_setting('app.current_user_id', true)::uuid OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS emergency_contacts_select ON emergency_contacts;
CREATE POLICY emergency_contacts_select ON emergency_contacts FOR SELECT USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = emergency_contacts.patient_id AND p.user_id = current_setting('app.current_user_id', true)::uuid) OR EXISTS (SELECT 1 FROM patient_assignments pa JOIN physiotherapists ph ON ph.id = pa.physio_id WHERE pa.patient_id = emergency_contacts.patient_id AND ph.user_id = current_setting('app.current_user_id', true)::uuid AND pa.status = 'active') OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS emergency_contacts_insert ON emergency_contacts;
CREATE POLICY emergency_contacts_insert ON emergency_contacts FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM patients p WHERE p.id = emergency_contacts.patient_id AND p.user_id = current_setting('app.current_user_id', true)::uuid) OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS emergency_contacts_update ON emergency_contacts;
CREATE POLICY emergency_contacts_update ON emergency_contacts FOR UPDATE USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = emergency_contacts.patient_id AND p.user_id = current_setting('app.current_user_id', true)::uuid) OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS emergency_contacts_delete ON emergency_contacts;
CREATE POLICY emergency_contacts_delete ON emergency_contacts FOR DELETE USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = emergency_contacts.patient_id AND p.user_id = current_setting('app.current_user_id', true)::uuid) OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS physio_requests_select ON physio_requests;
CREATE POLICY physio_requests_select ON physio_requests FOR SELECT USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = physio_requests.patient_id AND p.user_id = current_setting('app.current_user_id', true)::uuid) OR EXISTS (SELECT 1 FROM physiotherapists ph WHERE ph.id = physio_requests.physio_id AND ph.user_id = current_setting('app.current_user_id', true)::uuid) OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS physio_requests_insert ON physio_requests;
CREATE POLICY physio_requests_insert ON physio_requests FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM patients p WHERE p.id = physio_requests.patient_id AND p.user_id = current_setting('app.current_user_id', true)::uuid) OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS physio_requests_update ON physio_requests;
CREATE POLICY physio_requests_update ON physio_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = physio_requests.patient_id AND p.user_id = current_setting('app.current_user_id', true)::uuid) OR EXISTS (SELECT 1 FROM physiotherapists ph WHERE ph.id = physio_requests.physio_id AND ph.user_id = current_setting('app.current_user_id', true)::uuid) OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS patient_assignments_select ON patient_assignments;
CREATE POLICY patient_assignments_select ON patient_assignments FOR SELECT USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = patient_assignments.patient_id AND p.user_id = current_setting('app.current_user_id', true)::uuid) OR EXISTS (SELECT 1 FROM physiotherapists ph WHERE ph.id = patient_assignments.physio_id AND ph.user_id = current_setting('app.current_user_id', true)::uuid) OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS specializations_select ON specializations;
CREATE POLICY specializations_select ON specializations FOR SELECT USING (true);

DROP POLICY IF EXISTS physio_specializations_select ON physio_specializations;
CREATE POLICY physio_specializations_select ON physio_specializations FOR SELECT USING (true);

DROP POLICY IF EXISTS physio_specializations_manage ON physio_specializations;
CREATE POLICY physio_specializations_manage ON physio_specializations FOR ALL USING (EXISTS (SELECT 1 FROM physiotherapists ph WHERE ph.id = physio_specializations.physio_id AND ph.user_id = current_setting('app.current_user_id', true)::uuid) OR current_setting('app.current_role', true) = 'admin');

DROP POLICY IF EXISTS body_areas_select ON body_areas;
CREATE POLICY body_areas_select ON body_areas FOR SELECT USING (true);

DROP POLICY IF EXISTS exercise_sessions_select ON exercise_sessions;
CREATE POLICY exercise_sessions_select ON exercise_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = exercise_sessions.patient_id AND p.user_id = current_setting('app.current_user_id', true)::uuid) OR EXISTS (SELECT 1 FROM patient_assignments pa JOIN physiotherapists ph ON ph.id = pa.physio_id WHERE pa.patient_id = exercise_sessions.patient_id AND ph.user_id = current_setting('app.current_user_id', true)::uuid AND pa.status = 'active') OR current_setting('app.current_role', true) = 'admin');

-- ==============================================================================
-- SCHEMA MIGRATION COMPLETE
-- ==============================================================================
