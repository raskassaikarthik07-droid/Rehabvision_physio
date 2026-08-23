# RehabVision — Vercel & Supabase Production Deployment Guide

This guide details the exact steps to deploy RehabVision to **Vercel** backed by **Supabase PostgreSQL** for the Malla Reddy Techfusion Hackathon.

Once deployed, the application runs **100% standalone in the cloud** — no local Python, Go, or Vite processes need to be running on your laptop.

---

## 1. Supabase Database Setup (2 Minutes)

1. Go to [Supabase](https://supabase.com) &rarr; Create or open your project.
2. Open the **SQL Editor** from the left navigation panel.
3. Open [`supabase_schema.sql`](./supabase_schema.sql) in this repository, copy the full contents, paste into the SQL Editor, and click **Run**.
4. This will automatically create:
   - All 12 tables (`users`, `patients`, `physiotherapists`, `patient_assignments`, `exercises`, `exercise_sessions`, `session_scores`, `form_feedback`, `movement_metrics`, `gemini_summaries`, etc.)
   - Seeds **Priya Reddy** (ID: `2510030295`, password `@1234` securely hashed with bcrypt cost 12).
   - Seeds the **10 clinical exercises**.
   - Seeds the **5 demo patient profiles** (`Rahul Kumar`, `Sneha Patel`, `Amit Sharma`, `Priya Verma`, `Rajesh Nair`) with completed session telemetry automatically assigned to Priya Reddy.
   - Sets up the trigger to automatically assign any newly registered patient to Priya Reddy.
5. Go to **Project Settings &rarr; Database &rarr; Connection String**:
   - Copy the **URI** (e.g. `postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require` or direct connection on port 5432).

---

## 2. Vercel Deployment (2 Minutes)

### Option A: Using Vercel CLI (Recommended)
```bash
# In the project root directory:
vercel

# Follow prompts:
# - Set up and deploy: Y
# - Which scope: your account
# - Link to existing project: N
# - Project name: rehabvision
# - Directory: ./

# Set the Environment Variables:
vercel env add DATABASE_URL
# Paste your Supabase Connection String (e.g. postgres://postgres:password@...:5432/postgres?sslmode=require)

vercel env add JWT_SECRET
# Enter a secure random 64-char string (e.g. rehabvision_super_secret_jwt_key_2026_prod)

vercel env add GEMINI_API_KEY
# Enter your Google Gemini API Key (optional, for clinical synthesis)

# Deploy to Production:
vercel --prod
```

### Option B: Using Vercel Web Dashboard (GitHub Import)
1. Push this repository to GitHub.
2. In [Vercel Dashboard](https://vercel.com/new), click **Import** on your repo.
3. Configure Project:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
4. Add **Environment Variables**:
   - `DATABASE_URL`: Your Supabase connection string
   - `JWT_SECRET`: Random 64-character secret key
   - `GEMINI_API_KEY`: Your Gemini API Key
5. Click **Deploy**.

---

## 3. Production Architecture Overview

```
                        ┌─────────────────────────────────────────────────────────────┐
                        │                        VERCEL CLOUD                         │
                        │                                                             │
[ Browser Client ] ────►│  • React 19 Frontend (SPA on Edge CDN)                     │
  - Local WebCam Feed   │  • 10 Demonstration Videos (/exercises/videos/*.mp4)        │
  - In-Browser AI Engine│  • Demo Avatars (/avatars/patients/*.jpg)                   │
  - Skeleton & HUD      │  • Vercel Serverless Go API (/api/index.go)                 │
                        └──────────────────────┬──────────────────────────────────────┘
                                               │ (Encrypted Pooler Connection)
                                               ▼
                        ┌─────────────────────────────────────────────────────────────┐
                        │                   SUPABASE POSTGRESQL                       │
                        │                                                             │
                        │  • Users & RBAC (Priya Reddy + Multi-Patient)               │
                        │  • Automatic Patient Care Assignments                       │
                        │  • Exercise Telemetry & Session Records                     │
                        │  • Form Feedback & Recovery Trend Data                      │
                        └─────────────────────────────────────────────────────────────┘
```

---

## 4. Production Smoke-Test Checklist

| Step | Flow | Verified |
|------|------|:--------:|
| 1 | Open public Vercel URL | 🟢 |
| 2 | Login as Patient (`rahul.kumar@rehabvision.local` / `@1234`) or register new patient | 🟢 |
| 3 | Open **Exercise Library** &rarr; Select **Straight Leg Raise** | 🟢 |
| 4 | Watch 6s demonstration video & read step-by-step instructions | 🟢 |
| 5 | Click **[ START SESSION ]** &rarr; Camera activates with in-browser AI skeleton & HUD | 🟢 |
| 6 | Complete session &rarr; Session telemetry saved to Supabase PostgreSQL | 🟢 |
| 7 | Sign out &rarr; Select **[ PHYSIOTHERAPIST ]** | 🟢 |
| 8 | Login as **Priya Reddy** (ID: `2510030295`, Password: `@1234`) | 🟢 |
| 9 | Verify newly registered patient appears in Priya Reddy's supervision panel | 🟢 |
| 10 | Drill down into patient telemetry & form accuracy graphs | 🟢 |
