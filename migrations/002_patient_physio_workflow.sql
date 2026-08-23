-- ==============================================================================
-- REHABVISION MIGRATION 002: Patient-Physiotherapist Workflow
-- ==============================================================================
-- This migration adds the database architecture for:
--   - Body areas (reference lookup)
--   - Specializations (normalized, many-to-many with physiotherapists)
--   - Emergency contacts (per patient)
--   - Physiotherapist invite codes
--   - Patient → Physiotherapist connection requests
--   - Enhanced patient assignments
--   - Row Level Security (RLS) policies
--
-- SAFE: All statements use IF NOT EXISTS / IF EXISTS guards.
-- SAFE: No existing columns are dropped. No existing data is destroyed.
-- ==============================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. REFERENCE TABLE: body_areas
-- ==============================================================================
CREATE TABLE IF NOT EXISTS body_areas (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial body areas
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
-- 3. REFERENCE TABLE: specializations
-- ==============================================================================
CREATE TABLE IF NOT EXISTS specializations (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial specializations
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
-- 4. JUNCTION TABLE: physio_specializations (many-to-many)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS physio_specializations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    physio_id         UUID NOT NULL REFERENCES physiotherapists(id) ON DELETE CASCADE,
    specialization_id UUID NOT NULL REFERENCES specializations(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(physio_id, specialization_id)
);

CREATE INDEX IF NOT EXISTS idx_physio_specializations_physio
    ON physio_specializations(physio_id);
CREATE INDEX IF NOT EXISTS idx_physio_specializations_spec
    ON physio_specializations(specialization_id);

-- ==============================================================================
-- 5. TABLE: emergency_contacts
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

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_patient
    ON emergency_contacts(patient_id);

-- ==============================================================================
-- 6. ALTER TABLE: patients — add body_area_id
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'body_area_id'
    ) THEN
        ALTER TABLE patients ADD COLUMN body_area_id UUID REFERENCES body_areas(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patients_body_area ON patients(body_area_id);

-- ==============================================================================
-- 7. ALTER TABLE: physiotherapists — add invite_code, bio, accepting_patients
-- ==============================================================================
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
END $$;

-- Backfill invite codes for existing physiotherapists that have empty invite_code
UPDATE physiotherapists
SET invite_code = UPPER(SUBSTR(ENCODE(gen_random_bytes(5), 'hex'), 1, 8))
WHERE invite_code = '' OR invite_code IS NULL;

-- Unique index on invite_code (only for non-empty values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_physio_invite_code
    ON physiotherapists(invite_code) WHERE invite_code != '';

CREATE INDEX IF NOT EXISTS idx_physio_accepting
    ON physiotherapists(accepting_patients) WHERE accepting_patients = true;

-- ==============================================================================
-- 8. ALTER TABLE: patient_assignments — add ended_at
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patient_assignments' AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE patient_assignments ADD COLUMN ended_at TIMESTAMPTZ;
    END IF;
END $$;

-- ==============================================================================
-- 9. TABLE: physio_requests — Connection Request Workflow
-- ==============================================================================
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
);

CREATE INDEX IF NOT EXISTS idx_physio_requests_patient
    ON physio_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_physio_requests_physio
    ON physio_requests(physio_id);
CREATE INDEX IF NOT EXISTS idx_physio_requests_status
    ON physio_requests(status);
CREATE INDEX IF NOT EXISTS idx_physio_requests_pending_physio
    ON physio_requests(physio_id, status) WHERE status = 'pending';

-- Prevent duplicate pending requests from same patient to same physio
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_request
    ON physio_requests(patient_id, physio_id) WHERE status = 'pending';

-- Now add request_id FK to patient_assignments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patient_assignments' AND column_name = 'request_id'
    ) THEN
        ALTER TABLE patient_assignments
            ADD COLUMN request_id UUID REFERENCES physio_requests(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patient_assignments_request
    ON patient_assignments(request_id);

-- ==============================================================================
-- 10. TRIGGER: Auto-update updated_at timestamp
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables that have updated_at
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'users', 'patients', 'physiotherapists', 'patient_assignments',
            'emergency_contacts', 'physio_requests'
        ])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ==============================================================================
-- 11. DROP old auto-assign trigger (new workflow: patients choose their physio)
-- ==============================================================================
DROP TRIGGER IF EXISTS trigger_auto_assign_patient ON patients;
DROP FUNCTION IF EXISTS auto_assign_new_patient();

-- ==============================================================================
-- 12. SEED: Assign specializations to existing Priya Reddy
-- ==============================================================================
DO $$
DECLARE
    priya_physio_id UUID;
    ortho_id UUID;
    sports_id UUID;
BEGIN
    SELECT id INTO priya_physio_id
    FROM physiotherapists WHERE license_number = '2510030295' LIMIT 1;

    IF priya_physio_id IS NOT NULL THEN
        SELECT id INTO ortho_id FROM specializations WHERE name = 'orthopedic' LIMIT 1;
        SELECT id INTO sports_id FROM specializations WHERE name = 'sports_rehabilitation' LIMIT 1;

        IF ortho_id IS NOT NULL THEN
            INSERT INTO physio_specializations (physio_id, specialization_id)
            VALUES (priya_physio_id, ortho_id)
            ON CONFLICT (physio_id, specialization_id) DO NOTHING;
        END IF;

        IF sports_id IS NOT NULL THEN
            INSERT INTO physio_specializations (physio_id, specialization_id)
            VALUES (priya_physio_id, sports_id)
            ON CONFLICT (physio_id, specialization_id) DO NOTHING;
        END IF;
    END IF;
END $$;

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Enable RLS on all relevant tables
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

-- ── USERS ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users
    FOR SELECT USING (
        id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_role', true) = 'admin'
    );

DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update ON users
    FOR UPDATE USING (
        id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_role', true) = 'admin'
    );

-- ── PATIENTS ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS patients_select ON patients;
CREATE POLICY patients_select ON patients
    FOR SELECT USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR EXISTS (
            SELECT 1 FROM patient_assignments pa
            JOIN physiotherapists ph ON ph.id = pa.physio_id
            WHERE pa.patient_id = patients.id
              AND ph.user_id = current_setting('app.current_user_id', true)::uuid
              AND pa.status = 'active'
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

DROP POLICY IF EXISTS patients_update ON patients;
CREATE POLICY patients_update ON patients
    FOR UPDATE USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_role', true) = 'admin'
    );

-- ── PHYSIOTHERAPISTS ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS physio_select ON physiotherapists;
CREATE POLICY physio_select ON physiotherapists
    FOR SELECT USING (true);

DROP POLICY IF EXISTS physio_update ON physiotherapists;
CREATE POLICY physio_update ON physiotherapists
    FOR UPDATE USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_role', true) = 'admin'
    );

-- ── EMERGENCY CONTACTS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS emergency_contacts_select ON emergency_contacts;
CREATE POLICY emergency_contacts_select ON emergency_contacts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = emergency_contacts.patient_id
              AND p.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR EXISTS (
            SELECT 1 FROM patient_assignments pa
            JOIN physiotherapists ph ON ph.id = pa.physio_id
            WHERE pa.patient_id = emergency_contacts.patient_id
              AND ph.user_id = current_setting('app.current_user_id', true)::uuid
              AND pa.status = 'active'
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

DROP POLICY IF EXISTS emergency_contacts_insert ON emergency_contacts;
CREATE POLICY emergency_contacts_insert ON emergency_contacts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = emergency_contacts.patient_id
              AND p.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

DROP POLICY IF EXISTS emergency_contacts_update ON emergency_contacts;
CREATE POLICY emergency_contacts_update ON emergency_contacts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = emergency_contacts.patient_id
              AND p.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

DROP POLICY IF EXISTS emergency_contacts_delete ON emergency_contacts;
CREATE POLICY emergency_contacts_delete ON emergency_contacts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = emergency_contacts.patient_id
              AND p.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

-- ── PHYSIO REQUESTS ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS physio_requests_select ON physio_requests;
CREATE POLICY physio_requests_select ON physio_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = physio_requests.patient_id
              AND p.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR EXISTS (
            SELECT 1 FROM physiotherapists ph
            WHERE ph.id = physio_requests.physio_id
              AND ph.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

DROP POLICY IF EXISTS physio_requests_insert ON physio_requests;
CREATE POLICY physio_requests_insert ON physio_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = physio_requests.patient_id
              AND p.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

DROP POLICY IF EXISTS physio_requests_update ON physio_requests;
CREATE POLICY physio_requests_update ON physio_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = physio_requests.patient_id
              AND p.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR EXISTS (
            SELECT 1 FROM physiotherapists ph
            WHERE ph.id = physio_requests.physio_id
              AND ph.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

-- ── PATIENT ASSIGNMENTS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS patient_assignments_select ON patient_assignments;
CREATE POLICY patient_assignments_select ON patient_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = patient_assignments.patient_id
              AND p.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR EXISTS (
            SELECT 1 FROM physiotherapists ph
            WHERE ph.id = patient_assignments.physio_id
              AND ph.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

-- ── REFERENCE TABLES (read-only for all authenticated users) ────────────────
DROP POLICY IF EXISTS specializations_select ON specializations;
CREATE POLICY specializations_select ON specializations
    FOR SELECT USING (true);

DROP POLICY IF EXISTS physio_specializations_select ON physio_specializations;
CREATE POLICY physio_specializations_select ON physio_specializations
    FOR SELECT USING (true);

DROP POLICY IF EXISTS physio_specializations_manage ON physio_specializations;
CREATE POLICY physio_specializations_manage ON physio_specializations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM physiotherapists ph
            WHERE ph.id = physio_specializations.physio_id
              AND ph.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

DROP POLICY IF EXISTS body_areas_select ON body_areas;
CREATE POLICY body_areas_select ON body_areas
    FOR SELECT USING (true);

-- ── EXERCISE SESSIONS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS exercise_sessions_select ON exercise_sessions;
CREATE POLICY exercise_sessions_select ON exercise_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = exercise_sessions.patient_id
              AND p.user_id = current_setting('app.current_user_id', true)::uuid
        )
        OR EXISTS (
            SELECT 1 FROM patient_assignments pa
            JOIN physiotherapists ph ON ph.id = pa.physio_id
            WHERE pa.patient_id = exercise_sessions.patient_id
              AND ph.user_id = current_setting('app.current_user_id', true)::uuid
              AND pa.status = 'active'
        )
        OR current_setting('app.current_role', true) = 'admin'
    );

-- ==============================================================================
-- MIGRATION 002 COMPLETE
-- ==============================================================================
