# RehabVision Security Policy

## Overview

RehabVision is designed with security as a first-class requirement. This document describes the security model, implemented controls, and known limitations.

---

## Authentication & Authorization

### Authentication
- **Google OAuth 2.0 / OpenID Connect** only — no passwords stored
- OAuth flow uses server-side state parameter (anti-CSRF)
- State is a 32-byte cryptographically random value with 10-minute expiry
- Code-to-token exchange happens on the backend, never in the browser
- JWTs are signed with HS256 using a secret of at least 32 characters

### Authorization
- **Role enforcement is server-side only** — roles come from the database, not client input
- Never trust a role sent by the frontend
- Three roles: `patient`, `physiotherapist`, `admin`
- Patients can only access their own data (IDOR protection via session ownership check)
- Physiotherapists can only access assigned patients
- Protected routes require valid JWT middleware

### JWT
- Algorithm: HS256
- Expiry: 24 hours (configurable)
- Claims: user_id, email, role
- Validated on every protected request

---

## API Security

| Control | Implementation |
|---------|----------------|
| Authentication | JWT Bearer token, validated middleware |
| Authorization | Role-based, enforced server-side |
| CORS | Explicit allowlist via `ALLOWED_ORIGINS` env var |
| Body size limit | 10MB maximum request body |
| Request timeouts | Read/Write timeouts configured on HTTP server |
| Security headers | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection |
| Rate limiting | Basic (future: Redis-based per-user rate limiter) |
| Input validation | Gin binding tags + explicit validation |
| SQL injection | Parameterized queries only (lib/pq) |
| IDOR protection | Session ownership verified before access |

---

## Secrets Management

| Secret | How Managed |
|--------|-------------|
| `JWT_SECRET` | Environment variable only |
| `GOOGLE_CLIENT_ID` | Environment variable only |
| `GOOGLE_CLIENT_SECRET` | Environment variable only |
| `GEMINI_API_KEY` | Environment variable, backend only |
| `AI_SERVICE_KEY` | Environment variable, internal only |
| Database password | In DATABASE_URL env var |

**Never logged:**
- OAuth access tokens
- JWT tokens
- Gemini API key
- Authorization headers
- Cookies
- User sensitive information

---

## Gemini Integration Security

- Gemini API key is **only** in the Go backend environment
- Frontend **never** calls Gemini directly
- Frontend calls Go backend → Go backend calls Gemini
- Only validated, structured metrics are sent to Gemini (no raw camera frames)
- Gemini output is validated before returning to frontend
- Gemini is never used for safety-critical decisions, medical assessment, or numerical measurements
- If Gemini is unavailable, the app falls back gracefully to local text generation

---

## AI Service Security

- Python AI service binds to `127.0.0.1` (loopback only) in local mode
- Protected by internal service key (`X-Service-Key` header)
- CORS restricted to Go backend origin only
- AI service never receives user credentials, OAuth tokens, or API keys
- AI service is not directly reachable from the internet

---

## Data Privacy

- Camera frames are **never stored persistently** — only processed in real-time
- Pose landmarks are processed transiently and not stored in the database by default
- Only aggregated metrics (form score, ROM, rep count) are stored
- User profile data from Google (name, email, picture URL) is stored
- No raw video is stored

---

## Remaining Limitations / Future Work

1. **Rate limiting**: Currently basic — production should use Redis-based per-user limits
2. **State store**: OAuth state uses in-memory map — should use Redis in production
3. **HTTPS**: Not configured in development — **must use HTTPS in production**
4. **Cookie security**: Using JWT in localStorage — HttpOnly cookies are more secure for production
5. **Session invalidation**: JWTs cannot be revoked before expiry — future: add blocklist
6. **File uploads**: Not currently supported — if added, validate MIME type + size strictly
7. **Audit logging**: Security events should be sent to a centralized log aggregator
8. **Dependency pinning**: Dependencies should be audited regularly for CVEs

---

## Responsible Disclosure

This is a hackathon project. For security issues, please contact the development team directly.

---

## Medical & Legal Disclaimer

RehabVision is an exercise monitoring tool built for research and educational purposes.

- It is **NOT** a medical device
- It does **NOT** diagnose medical conditions
- It does **NOT** replace professional physiotherapy
- All measurements are best-effort estimates from computer vision
- Always consult a qualified physiotherapist for clinical guidance
- Do not make clinical decisions based solely on this software
