# RehabVision Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                │
│  React + TypeScript + Tailwind CSS + Vite                          │
│  Pages: Landing → Login → Dashboard → Exercise → Live → Results    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS / REST JSON
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GO BACKEND (Port 8080)                         │
│  Framework: Gin                                                     │
│  Auth: Google OAuth 2.0 + JWT (HS256)                              │
│  Middleware: RequestID, Logger, CORS, SecurityHeaders,              │
│             BodyLimit, Authenticate, RequireRole                    │
│  Handlers: Auth, Sessions, Exercises, Dashboards, Gemini           │
│  Services: AI Service client, Gemini client                         │
│  Repositories: User, Session (PostgreSQL via lib/pq)               │
└──────────┬─────────────────────────────────┬───────────────────────┘
           │ SQL (PostgreSQL wire protocol)   │ HTTP/JSON (internal)
           ▼                                  ▼
┌──────────────────────┐          ┌──────────────────────────────────┐
│   POSTGRESQL (5432)  │          │    PYTHON AI SERVICE (8090)      │
│   Tables:            │          │    Framework: FastAPI             │
│   users              │          │    Pose: MediaPipe Pose           │
│   oauth_accounts     │          │    Analysis:                     │
│   patients           │          │      - Pose estimation           │
│   physiotherapists   │          │      - Joint angle calculation   │
│   patient_assignments│          │      - Exercise state machines   │
│   exercises          │          │      - Rep counting              │
│   exercise_sessions  │          │      - Form scoring              │
│   session_scores     │          │      - Symmetry/stability        │
│   movement_metrics   │          │    Auth: X-Service-Key header    │
│   form_feedback      │          │    (only accessible from Go)     │
│   gemini_summaries   │          └──────────────────────────────────┘
│   auth_sessions      │
└──────────────────────┘
                         ┌──────────────────────────────────────────┐
                         │         GOOGLE GEMINI API                │
                         │  Used by Go backend ONLY                 │
                         │  API key in env vars, NEVER in frontend  │
                         │  Purpose: Text summarization only        │
                         │  Fallback: Local text generation         │
                         └──────────────────────────────────────────┘
```

---

## AI Pipeline

```
Camera Frame (JPEG, base64)
        │
        ▼ via Go backend proxy
┌─────────────────────────────┐
│  Python AI Service          │
│  POST /analyze/frame        │
│                             │
│  1. Decode base64 → BGR     │
│  2. BGR → RGB               │
│  3. MediaPipe Pose.process  │
│       ↓ 33 landmarks        │
│  4. compute_joint_angles()  │
│     - shoulder abduction    │
│     - elbow flexion         │
│     - knee flexion          │
│     - hip flexion           │
│     - trunk lean            │
│  5. compute_symmetry_score()│
│     Left vs right angles   │
│  6. compute_stability_score()│
│     Hip position variance  │
│  7. Exercise state machine  │
│     (ArmRaise / KneeExt /  │
│      SitToStand)            │
│       ↓                     │
│  8. Rep counting            │
│     Phase transitions:      │
│     rest → up → down → rest │
│  9. Form analysis           │
│     Rule-based thresholds:  │
│     - ROM check             │
│     - trunk lean check      │
│     - symmetry check        │
│     - elbow angle check     │
│ 10. Return FrameResponse    │
└─────────────────────────────┘
        │ JSON response
        ▼
Go Backend stores/forwards to Frontend

Session Complete:
        ↓
Go Backend → POST /ai/session-summary → Gemini API
  (structured metrics only, never raw frames)
        ↓
Validated text summary → Frontend
```

---

## Authentication Flow

```
Frontend → POST /api/v1/auth/google
                ↓
        Go Backend generates state, stores in memory
        Returns Google OAuth URL
                ↓
Browser → Google OAuth Page
                ↓
Google → GET /api/v1/auth/google/callback?code=...&state=...
                ↓
        Go Backend:
        1. Validates state (anti-CSRF)
        2. Exchanges code for tokens (Google)
        3. Fetches user info from Google
        4. Upserts user + oauth_account + patient in DB
        5. Generates JWT (HS256, 24h expiry)
        6. Redirects to frontend with JWT in URL param
                ↓
Frontend stores JWT in localStorage
Frontend uses JWT in Authorization: Bearer header
                ↓
Go Backend middleware validates JWT on every protected route
Role enforcement happens server-side from JWT claims
```

---

## Security Architecture

- **No passwords stored** — Google OAuth only
- **JWT signed** with HS256 using server-side secret
- **Role enforcement** server-side (never trust frontend role)
- **CORS** explicit allowlist
- **Security headers** on all responses
- **Body size limit** (10MB max)
- **OAuth state** validated and consumed (anti-CSRF)
- **SQL** parameterized queries only
- **Gemini key** in environment only, never sent to frontend
- **AI Service** secured with internal service key, loopback only

---

## Database Schema

**Entity-Relationship Summary:**

```
users (1) ──── (1) patients ──── (N) exercise_sessions
users (1) ──── (1) physiotherapists
users (1) ──── (N) oauth_accounts
patients (N) ──── (N) physiotherapists [via patient_assignments]
exercise_sessions (1) ──── (1) session_scores
exercise_sessions (1) ──── (N) movement_metrics
exercise_sessions (1) ──── (N) form_feedback
exercise_sessions (1) ──── (1) gemini_summaries
exercises (1) ──── (N) exercise_sessions
```

---

## Dataset

| Property | Value |
|----------|-------|
| Source | Blurred physiotherapy video dataset |
| Privacy | Face-blurred for patient privacy |
| Exercises | Arm Raise, Knee Extension, Sit-to-Stand |
| Total videos | 339 |
| Format | MP4, MOV |
| Total size | ~817MB |
| Labels | Correct / Incorrect per exercise |

**Classifier Approach:**
- Extract pose landmarks from each video via MediaPipe
- Compute statistical summary (mean, std, min, max) per video
- Train Random Forest per exercise (binary: correct vs incorrect)
- Train/test split at video level (no cross-video leakage)
- Metrics: accuracy, precision, recall, F1, confusion matrix

**Core Metrics (deterministic, not ML):**
- Joint angles (trigonometry)
- Rep count (state machine thresholds)
- ROM (peak angle during rep)
- Symmetry (bilateral comparison)
- Stability (hip position variance)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Go 1.26, Gin, JWT, PostgreSQL |
| AI | Python 3.11, FastAPI, MediaPipe, scikit-learn |
| Database | PostgreSQL 16 |
| AI API | Google Gemini (optional) |
| Deployment | Docker, docker-compose |
