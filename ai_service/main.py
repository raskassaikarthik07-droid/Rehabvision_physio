"""
RehabVision AI Service — FastAPI server.
Provides endpoints for:
  - /health
  - /analyze/frame  (single frame pose analysis)
  - /analyze/session (batch session analysis)
  - /exercises (list supported exercises)

The Go backend proxies requests to this service.
This service NEVER receives OAuth tokens, API keys, or user credentials.
All sensitive data stays in the Go backend.
"""
import os
import io
import base64
import logging
import time
from contextlib import asynccontextmanager
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Local imports
from pose_analyzer import (
    landmarks_to_pose, compute_joint_angles, compute_symmetry_score,
    compute_stability_score, compute_landmark_confidence, PoseLandmark
)
from exercise_machines import EXERCISE_MACHINES, EXERCISE_INFO, RepState

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}'
)
logger = logging.getLogger(__name__)

# ─── MediaPipe (lazy loaded to reduce startup time) ──────────────────────────
mp_pose = None
pose_model = None

def get_pose_model():
    global mp_pose, pose_model
    if pose_model is None:
        try:
            import mediapipe as mp
            mp_pose = mp.solutions.pose
            pose_model = mp_pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                smooth_landmarks=True,
                enable_segmentation=False,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            logger.info("MediaPipe Pose model loaded")
        except Exception as e:
            logger.error(f"Failed to load MediaPipe: {e}")
            pose_model = None
    return pose_model, mp_pose


# ─── Session state (in-memory per session_id, lightweight) ───────────────────
session_states: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("RehabVision AI Service starting")
    get_pose_model()  # warm up
    yield
    logger.info("RehabVision AI Service shutting down")
    if pose_model:
        pose_model.close()


app = FastAPI(
    title="RehabVision AI Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# Only accept connections from the Go backend (localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Service-Key"],
)

SERVICE_KEY = os.environ.get("AI_SERVICE_KEY", "rehabvision-internal-2024")


def verify_service_key(request: Request):
    key = request.headers.get("X-Service-Key", "")
    if key != SERVICE_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ─── Request / Response Models ────────────────────────────────────────────────

class FrameRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)
    exercise_id: str = Field(..., min_length=1, max_length=32)
    frame_b64: str = Field(..., description="Base64-encoded JPEG frame")
    frame_index: int = Field(0, ge=0)


class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float
    visibility: float


class JointAnglesOut(BaseModel):
    left_shoulder_abduction: float
    right_shoulder_abduction: float
    left_elbow: float
    right_elbow: float
    left_knee: float
    right_knee: float
    left_hip: float
    right_hip: float
    trunk_lean: float


class FrameResponse(BaseModel):
    session_id: str
    exercise_id: str
    frame_index: int
    rep_count: int
    phase: str
    primary_angle: float
    rom_percentage: float
    form_score: float
    symmetry_score: float
    stability_score: float
    landmark_confidence: float
    issues: list[str]
    positive_feedback: list[str]
    movement_quality: str
    joint_angles: JointAnglesOut
    landmarks: Optional[list[LandmarkPoint]] = None
    processing_ms: float


class SessionSummaryRequest(BaseModel):
    session_id: str
    exercise_id: str


class SessionSummaryResponse(BaseModel):
    session_id: str
    exercise_id: str
    total_reps: int
    avg_form_score: float
    avg_rom_percentage: float
    avg_symmetry: float
    avg_stability: float
    common_issues: list[str]
    peak_angle: float
    duration_frames: int


class ExerciseInfo(BaseModel):
    id: str
    name: str
    description: str
    target_joints: list[str]
    primary_angle_label: str
    target_reps: int
    target_rom_degrees: int


# ─── Helpers ─────────────────────────────────────────────────────────────────

def decode_frame(frame_b64: str) -> np.ndarray:
    """Decode base64 JPEG to numpy BGR array."""
    try:
        data = base64.b64decode(frame_b64)
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image")
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid frame data: {e}")


def get_or_create_session(session_id: str, exercise_id: str):
    key = f"{session_id}:{exercise_id}"
    if key not in session_states:
        if exercise_id not in EXERCISE_MACHINES:
            raise HTTPException(status_code=400, detail=f"Unknown exercise: {exercise_id}")
        session_states[key] = {
            "machine": EXERCISE_MACHINES[exercise_id](),
            "landmarks_history": [],
            "form_scores": [],
            "symmetry_scores": [],
            "stability_scores": [],
            "issues_count": {},
            "frame_count": 0,
            "peak_angle": 0.0,
        }
    return session_states[key]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    model_ok = get_pose_model()[0] is not None
    return {
        "status": "ok" if model_ok else "degraded",
        "service": "rehabvision-ai",
        "mediapipe_loaded": model_ok,
    }


@app.get("/exercises", response_model=list[ExerciseInfo])
async def list_exercises():
    return [ExerciseInfo(**info) for info in EXERCISE_INFO.values()]


@app.post("/analyze/frame", response_model=FrameResponse)
async def analyze_frame(req: FrameRequest, request: Request):
    verify_service_key(request)
    t0 = time.perf_counter()

    model, mp_p = get_pose_model()
    if model is None:
        raise HTTPException(status_code=503, detail="Pose model not available")

    # Decode frame
    img_bgr = decode_frame(req.frame_b64)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    # Run pose estimation
    results = model.process(img_rgb)

    state = get_or_create_session(req.session_id, req.exercise_id)
    machine = state["machine"]

    if not results.pose_landmarks:
        # No pose detected — return last known state
        t1 = time.perf_counter()
        rs: RepState = machine.rep_state
        return FrameResponse(
            session_id=req.session_id,
            exercise_id=req.exercise_id,
            frame_index=req.frame_index,
            rep_count=rs.count,
            phase=rs.phase,
            primary_angle=0.0,
            rom_percentage=machine.compute_rom(rs),
            form_score=0.0,
            symmetry_score=0.0,
            stability_score=0.0,
            landmark_confidence=0.0,
            issues=["No pose detected — ensure you are visible to the camera"],
            positive_feedback=[],
            movement_quality="unknown",
            joint_angles=JointAnglesOut(
                left_shoulder_abduction=0, right_shoulder_abduction=0,
                left_elbow=0, right_elbow=0, left_knee=0, right_knee=0,
                left_hip=0, right_hip=0, trunk_lean=0,
            ),
            processing_ms=(time.perf_counter() - t0) * 1000,
        )

    # Convert landmarks
    raw = results.pose_landmarks.landmark
    landmarks = landmarks_to_pose(raw)
    state["landmarks_history"].append(landmarks)
    if len(state["landmarks_history"]) > 60:
        state["landmarks_history"] = state["landmarks_history"][-60:]

    # Compute biomechanics
    angles = compute_joint_angles(landmarks)
    symmetry = compute_symmetry_score(angles)
    stability = compute_stability_score(state["landmarks_history"])
    confidence = compute_landmark_confidence(landmarks)

    # Run exercise state machine
    rep_state, form = machine.update(landmarks, angles)

    # Track primary angle for ROM/peak
    primary = machine.get_primary_angle(angles)
    if primary > state["peak_angle"]:
        state["peak_angle"] = primary

    # Track metrics
    state["form_scores"].append(form.form_score)
    state["symmetry_scores"].append(symmetry)
    state["stability_scores"].append(stability)
    state["frame_count"] += 1
    for issue in form.issues:
        state["issues_count"][issue] = state["issues_count"].get(issue, 0) + 1

    rom_pct = machine.compute_rom(rep_state)

    # Return landmarks as normalized coords (no PII in frames)
    lm_out = [
        LandmarkPoint(x=lm.x, y=lm.y, z=lm.z, visibility=lm.visibility)
        for lm in landmarks
    ]

    t1 = time.perf_counter()
    return FrameResponse(
        session_id=req.session_id,
        exercise_id=req.exercise_id,
        frame_index=req.frame_index,
        rep_count=rep_state.count,
        phase=rep_state.phase,
        primary_angle=primary,
        rom_percentage=rom_pct,
        form_score=form.form_score,
        symmetry_score=symmetry,
        stability_score=stability,
        landmark_confidence=confidence,
        issues=form.issues,
        positive_feedback=form.positive_feedback,
        movement_quality=form.movement_quality,
        joint_angles=JointAnglesOut(
            left_shoulder_abduction=angles.left_shoulder_abduction,
            right_shoulder_abduction=angles.right_shoulder_abduction,
            left_elbow=angles.left_elbow,
            right_elbow=angles.right_elbow,
            left_knee=angles.left_knee,
            right_knee=angles.right_knee,
            left_hip=angles.left_hip,
            right_hip=angles.right_hip,
            trunk_lean=angles.trunk_lean,
        ),
        landmarks=lm_out,
        processing_ms=(t1 - t0) * 1000,
    )


@app.post("/analyze/session/summary", response_model=SessionSummaryResponse)
async def session_summary(req: SessionSummaryRequest, request: Request):
    verify_service_key(request)
    key = f"{req.session_id}:{req.exercise_id}"
    state = session_states.get(key)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    machine = state["machine"]
    rs: RepState = machine.rep_state

    avg_form = sum(state["form_scores"]) / len(state["form_scores"]) if state["form_scores"] else 0
    avg_sym = sum(state["symmetry_scores"]) / len(state["symmetry_scores"]) if state["symmetry_scores"] else 0
    avg_stab = sum(state["stability_scores"]) / len(state["stability_scores"]) if state["stability_scores"] else 0
    avg_rom = machine.compute_rom(rs)

    # Top 3 most common issues
    sorted_issues = sorted(state["issues_count"].items(), key=lambda x: -x[1])
    common_issues = [issue for issue, _ in sorted_issues[:3]]

    # Clean up session state
    del session_states[key]

    return SessionSummaryResponse(
        session_id=req.session_id,
        exercise_id=req.exercise_id,
        total_reps=rs.count,
        avg_form_score=round(avg_form, 1),
        avg_rom_percentage=round(avg_rom, 1),
        avg_symmetry=round(avg_sym, 1),
        avg_stability=round(avg_stab, 1),
        common_issues=common_issues,
        peak_angle=round(state["peak_angle"], 1),
        duration_frames=state["frame_count"],
    )


@app.delete("/analyze/session/{session_id}")
async def clear_session(session_id: str, request: Request):
    verify_service_key(request)
    keys_to_delete = [k for k in session_states if k.startswith(f"{session_id}:")]
    for k in keys_to_delete:
        del session_states[k]
    return {"cleared": len(keys_to_delete)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("AI_SERVICE_PORT", 8090))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False, log_level="info")
