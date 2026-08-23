# RehabVision — AI-Powered Rehabilitation & Movement Intelligence

> **Medical Disclaimer:** RehabVision is an AI-assisted movement tracking, computer vision analysis, and posture feedback platform for rehabilitation monitoring. It does NOT diagnose medical pathologies, provide clinical prescriptions, or replace in-person physical therapy care. Always consult a qualified physiotherapist before beginning any rehabilitation program.

---

## Technical Architecture & Single-Physiotherapist Deployment

RehabVision is configured as a dedicated clinical tele-rehabilitation monitoring system featuring:

1. **Single Seeded Physiotherapist Account**:
   - **Name**: Priya Reddy
   - **Physiotherapist ID**: `2510030295`
   - **Security**: Password securely hashed via bcrypt (`cost=12`) during database migration. No plaintext password is ever committed to source code or displayed in the frontend.
   - **Portal**: Dedicated clinical supervision console at `/physiotherapist/dashboard`.

2. **Multi-User Patient Architecture**:
   - Multiple distinct patient accounts can register and log in independently.
   - **Automatic Assignment**: Every newly registered patient is automatically assigned to Priya Reddy upon account creation in PostgreSQL.
   - **Data Privacy & Isolation**: Patients can only view their own exercise telemetry; unassigned cross-patient access is strictly blocked (`403 Forbidden`).

3. **Pre-Exercise Instruction System ("Before You Begin")**:
   - Mandatory preparation flow: **Patient Dashboard &rarr; Select Exercise &rarr; Exercise Instructions ("Before You Begin") &rarr; Start Session &rarr; Live AI Vision HUD**.
   - Includes step-by-step guidance, starting positions, AI monitoring targets, common mistakes, and video/illustrated demonstrations.

4. **10 Supported Rehabilitation Exercises**:
   - Straight Leg Raise (`leg_raise`)
   - Seated Knee Extension (`knee_extension`)
   - Sit to Stand (`sit_to_stand`)
   - Arm / Shoulder Raise (`arm_raise`)
   - Rehabilitation Squat (`squat`)
   - Neck & Forward Head Alignment (`neck_posture`)
   - Back & Torso Bend Alignment (`torso_bend`)
   - Shoulder Symmetry & Balance (`shoulder_symmetry`)
   - Knee Alignment & Valgus Tracking (`knee_alignment`)
   - Lateral Leg Raise (`lateral_leg_raise`)

---

## Security & RBAC Matrix

| Role | Allowed Routes | Security Controls |
|------|----------------|-------------------|
| **Physiotherapist (Priya Reddy)** | `/physiotherapist/*` | ID `2510030295`, Bcrypt Password, JWT HS256, Care Panel Access |
| **Patients (Multi-user)** | `/patient/*` | Email/ID + Password, Automatic Care Assignment, Isolated Telemetry |
| **API Endpoints** | `/api/v1/*` | Rate Limiting, 10MB Body Limit, Parameterized SQL, SameSite Cookies |

---

## Exact Commands to Start the Application

### 1. Start Python AI Service
```powershell
cd ai_service
pip install -r requirements.txt
python main.py
# Runs on http://127.0.0.1:8090
```

### 2. Start Go Backend
```powershell
cd backend
$env:PATH += ";C:\Program Files\Go\bin"
go run ./cmd/server/
# Runs on http://127.0.0.1:8080 (Seeds Priya Reddy & runs migrations automatically)
```

### 3. Start React Frontend
```powershell
cd frontend
npm install
npm run dev -- --host
# Accessible on http://localhost:5173
```

---

## 3-Minute Demonstration Flow

1. **Step 1: Patient Login & Exercise Preparation (0:00 - 1:15)**
   - Open `http://localhost:5173/login` &rarr; Select **[ PATIENT ]**.
   - Click **Create Patient Account** &rarr; Register a patient (or sign in with existing credentials).
   - In the **Patient Dashboard**, click **Prescribed Clinical Exercises** &rarr; Select **Straight Leg Raise** (or **Neck Posture**).
   - The **Before You Begin** preparation screen opens:
     - Review purpose, starting position, and step-by-step movement instructions.
     - Review what AI monitors & common mistakes.
     - Check the **System Readiness Checklist** (Target reps, webcam availability).
   - Click **Start Live Session**.

2. **Step 2: Live Biomechanical HUD & Session Completion (1:15 - 2:00)**
   - Perform the exercise in front of the camera.
   - The HUD displays real-time **REP COUNT**, **FORM SCORE %**, **ROM °**, and **STATUS** (`GOOD FORM` / `ADJUST FORM`).
   - Click **Complete & Save**.
   - The **SESSION COMPLETE** report appears displaying total reps, correct reps, form score %, and detected movement notes (persisted to PostgreSQL).

3. **Step 3: Physiotherapist Supervision with Priya Reddy (2:00 - 3:00)**
   - Sign out &rarr; Select **[ PHYSIOTHERAPIST ]**.
   - Enter Physiotherapist ID: `2510030295` &bull; Password: (enter configured password).
   - The **Priya Reddy Supervision Console** opens, immediately displaying the newly registered patient and their average form scores.
   - Click on the patient &rarr; Review longitudinal recovery graphs and drill into the completed session telemetry.

---

## Automated Verification Test Results

```powershell
# 1. Priya Reddy & Multi-Patient End-to-End Test
python "scratch/verify_priya_and_patients.py"
# Output: ALL 8 VERIFICATION TESTS PASSED WITH 100% SUCCESS!

# 2. Go Backend Security & Unit Tests
cd backend && go test ./... -v
# Output: 14/14 tests PASS

# 3. Python AI Biomechanics Tests
python -m pytest ai_service/tests/ -v
# Output: 35/35 tests PASS

# 4. React Frontend Production Build
cd frontend && npm run build
# Output: 1879 modules transformed, built clean in 1.11s with 0 errors
```
