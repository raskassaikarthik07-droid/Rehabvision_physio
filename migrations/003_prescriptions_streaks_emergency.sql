-- ==============================================================================
-- REHABVISION MIGRATION 003: Prescriptions, Streaks, Emergency Events, Notifications
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ALTER TABLE: patients — add mobility_mode (accessibility/wheelchair support)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'mobility_mode'
    ) THEN
        ALTER TABLE patients ADD COLUMN mobility_mode TEXT NOT NULL DEFAULT 'standard'
            CHECK (mobility_mode IN ('standard', 'wheelchair', 'seated_only', 'limited_lower_body'));
    END IF;
END $$;

-- 2. TABLE: prescriptions
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
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_physio ON prescriptions(physio_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);

-- 3. TABLE: prescription_exercises
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
);

CREATE INDEX IF NOT EXISTS idx_prescription_exercises_prescription ON prescription_exercises(prescription_id);

-- 4. TABLE: patient_streaks
CREATE TABLE IF NOT EXISTS patient_streaks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
    current_streak      INT NOT NULL DEFAULT 0,
    longest_streak      INT NOT NULL DEFAULT 0,
    last_completed_date DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_streaks_patient ON patient_streaks(patient_id);

-- 5. TABLE: emergency_events
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
);

CREATE INDEX IF NOT EXISTS idx_emergency_events_patient ON emergency_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_events_physio ON emergency_events(physio_id);
CREATE INDEX IF NOT EXISTS idx_emergency_events_stage ON emergency_events(stage);

-- 6. TABLE: notifications
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    message    TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'request', 'prescription', 'emergency', 'streak', 'session')),
    read       BOOLEAN NOT NULL DEFAULT false,
    link       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

-- Apply updated_at trigger to new tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['prescriptions', 'patient_streaks']) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', tbl, tbl);
    END LOOP;
END $$;
