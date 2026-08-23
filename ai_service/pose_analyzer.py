"""
RehabVision Pose Analyzer
Uses MediaPipe Pose for landmark detection and deterministic biomechanical calculations.
Supports 10 clinical rehabilitation and movement intelligence exercises.
"""
import math
import time
import logging
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

logger = logging.getLogger(__name__)

# MediaPipe landmark indices
LANDMARK = {
    "nose": 0,
    "left_eye_inner": 1, "left_eye": 2, "left_eye_outer": 3,
    "right_eye_inner": 4, "right_eye": 5, "right_eye_outer": 6,
    "left_ear": 7, "right_ear": 8,
    "mouth_left": 9, "mouth_right": 10,
    "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13, "right_elbow": 14,
    "left_wrist": 15, "right_wrist": 16,
    "left_pinky": 17, "right_pinky": 18,
    "left_index": 19, "right_index": 20,
    "left_thumb": 21, "right_thumb": 22,
    "left_hip": 23, "right_hip": 24,
    "left_knee": 25, "right_knee": 26,
    "left_ankle": 27, "right_ankle": 28,
    "left_heel": 29, "right_heel": 30,
    "left_foot_index": 31, "right_foot_index": 32,
}


@dataclass
class PoseLandmark:
    x: float
    y: float
    z: float
    visibility: float


@dataclass
class JointAngles:
    left_shoulder_abduction: float = 0.0
    right_shoulder_abduction: float = 0.0
    left_elbow: float = 0.0
    right_elbow: float = 0.0
    left_knee: float = 0.0
    right_knee: float = 0.0
    left_hip: float = 0.0
    right_hip: float = 0.0
    trunk_lean: float = 0.0
    neck_angle: float = 0.0
    craniovertebral_angle: float = 0.0
    shoulder_height_diff_pct: float = 0.0
    knee_valgus_left: float = 180.0
    knee_valgus_right: float = 180.0
    left_hip_abduction: float = 0.0
    right_hip_abduction: float = 0.0


@dataclass
class BiomechanicalMetrics:
    joint_angles: JointAngles = field(default_factory=JointAngles)
    symmetry_score: float = 100.0
    stability_score: float = 100.0
    rom_percentage: float = 0.0
    landmark_confidence: float = 0.0
    timestamp: float = field(default_factory=time.time)


@dataclass
class FormAnalysis:
    form_score: float = 100.0
    issues: list = field(default_factory=list)
    positive_feedback: list = field(default_factory=list)
    movement_quality: str = "good"


def calculate_angle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark) -> float:
    """Calculate the 2D planar angle at joint B formed by points A-B-C. Returns degrees [0, 180]."""
    ax, ay = a.x - b.x, a.y - b.y
    cx, cy = c.x - b.x, c.y - b.y
    dot = ax * cx + ay * cy
    mag_a = math.sqrt(ax ** 2 + ay ** 2)
    mag_c = math.sqrt(cx ** 2 + cy ** 2)
    if mag_a < 1e-6 or mag_c < 1e-6:
        return 0.0
    cos_angle = max(-1.0, min(1.0, dot / (mag_a * mag_c)))
    return math.degrees(math.acos(cos_angle))


def calculate_angle_with_vertical(a: PoseLandmark, b: PoseLandmark) -> float:
    """Calculate angle of segment A->B relative to the vertical axis (degrees [0, 90])."""
    dx = abs(a.x - b.x)
    dy = abs(a.y - b.y) + 1e-6
    return math.degrees(math.atan2(dx, dy))


def landmarks_to_pose(raw_landmarks) -> list:
    """Convert MediaPipe landmarks to PoseLandmark list."""
    return [
        PoseLandmark(lm.x, lm.y, lm.z, lm.visibility)
        for lm in raw_landmarks
    ]


def get_landmark(landmarks: list, name: str) -> Optional[PoseLandmark]:
    idx = LANDMARK.get(name)
    if idx is None or idx >= len(landmarks):
        return None
    lm = landmarks[idx]
    if lm.visibility < 0.25:
        return None
    return lm


def compute_joint_angles(landmarks: list) -> JointAngles:
    """Compute all biomechanical joint angles and postural metrics from pose landmarks."""
    angles = JointAngles()

    lh = get_landmark(landmarks, "left_hip")
    ls = get_landmark(landmarks, "left_shoulder")
    le = get_landmark(landmarks, "left_elbow")
    if lh and ls and le:
        angles.left_shoulder_abduction = calculate_angle(lh, ls, le)

    rh = get_landmark(landmarks, "right_hip")
    rs = get_landmark(landmarks, "right_shoulder")
    re = get_landmark(landmarks, "right_elbow")
    if rh and rs and re:
        angles.right_shoulder_abduction = calculate_angle(rh, rs, re)

    lw = get_landmark(landmarks, "left_wrist")
    if ls and le and lw:
        angles.left_elbow = calculate_angle(ls, le, lw)

    rw = get_landmark(landmarks, "right_wrist")
    if rs and re and rw:
        angles.right_elbow = calculate_angle(rs, re, rw)

    lhip = get_landmark(landmarks, "left_hip")
    lknee = get_landmark(landmarks, "left_knee")
    lankle = get_landmark(landmarks, "left_ankle")
    if lhip and lknee and lankle:
        angles.left_knee = calculate_angle(lhip, lknee, lankle)
        angles.knee_valgus_left = calculate_angle(lhip, lknee, lankle)

    rhip = get_landmark(landmarks, "right_hip")
    rknee = get_landmark(landmarks, "right_knee")
    rankle = get_landmark(landmarks, "right_ankle")
    if rhip and rknee and rankle:
        angles.right_knee = calculate_angle(rhip, rknee, rankle)
        angles.knee_valgus_right = calculate_angle(rhip, rknee, rankle)

    if ls and lhip and lknee:
        angles.left_hip = calculate_angle(ls, lhip, lknee)

    if rs and rhip and rknee:
        angles.right_hip = calculate_angle(rs, rhip, rknee)

    # Hip abduction for leg raises
    if lhip and rhip and lknee:
        angles.left_hip_abduction = calculate_angle(rhip, lhip, lknee)
    if rhip and lhip and rknee:
        angles.right_hip_abduction = calculate_angle(lhip, rhip, rknee)

    # Trunk Lean (Shoulder midpoint to Hip midpoint relative to vertical)
    if ls and rs and lhip and rhip:
        mid_shoulder = PoseLandmark((ls.x + rs.x) / 2, (ls.y + rs.y) / 2, 0, 1.0)
        mid_hip = PoseLandmark((lhip.x + rhip.x) / 2, (lhip.y + rhip.y) / 2, 0, 1.0)
        angles.trunk_lean = calculate_angle_with_vertical(mid_shoulder, mid_hip)

    # Shoulder Height Asymmetry (Bilateral difference normalized to shoulder width)
    if ls and rs:
        shoulder_width = math.sqrt((ls.x - rs.x)**2 + (ls.y - rs.y)**2) + 1e-6
        height_diff = abs(ls.y - rs.y)
        angles.shoulder_height_diff_pct = min(100.0, (height_diff / shoulder_width) * 100.0)

    # Neck Posture & Craniovertebral Alignment (Ear to Shoulder axis)
    lear = get_landmark(landmarks, "left_ear")
    rear = get_landmark(landmarks, "right_ear")
    nose = get_landmark(landmarks, "nose")

    ear = lear or rear
    shoulder = ls if lear else (rs if rear else None)

    if ear and shoulder:
        # Craniovertebral angle estimate (angle of line between tragus/ear and C7/shoulder relative to horizontal)
        dx = abs(ear.x - shoulder.x)
        dy = abs(ear.y - shoulder.y) + 1e-6
        # A smaller angle (<50°) indicates forward head posture (FHP)
        angles.craniovertebral_angle = math.degrees(math.atan2(dy, dx))
        angles.neck_angle = math.degrees(math.atan2(dx, dy))

    return angles


def compute_symmetry_score(angles: JointAngles) -> float:
    """Compare bilateral joint metrics and return symmetry score [0-100]."""
    comparisons = []
    if angles.left_shoulder_abduction > 0 and angles.right_shoulder_abduction > 0:
        diff = abs(angles.left_shoulder_abduction - angles.right_shoulder_abduction)
        comparisons.append(max(0.0, 100.0 - diff * 2))
    if angles.left_knee > 0 and angles.right_knee > 0:
        diff = abs(angles.left_knee - angles.right_knee)
        comparisons.append(max(0.0, 100.0 - diff * 2))
    if angles.left_hip > 0 and angles.right_hip > 0:
        diff = abs(angles.left_hip - angles.right_hip)
        comparisons.append(max(0.0, 100.0 - diff * 2))
    if angles.shoulder_height_diff_pct > 0:
        comparisons.append(max(0.0, 100.0 - angles.shoulder_height_diff_pct * 3))

    if not comparisons:
        return 90.0
    return float(np.mean(comparisons))


def compute_stability_score(landmarks_history: list) -> float:
    """Estimate stability from variance of hip and trunk positions over recent frames."""
    if len(landmarks_history) < 3:
        return 90.0
    try:
        hip_xs = []
        for lms in landmarks_history[-15:]:
            lh = get_landmark(lms, "left_hip")
            rh = get_landmark(lms, "right_hip")
            if lh and rh:
                hip_xs.append((lh.x + rh.x) / 2)
        if len(hip_xs) < 2:
            return 90.0
        variance = float(np.var(hip_xs))
        score = max(0.0, 100.0 - variance * 4000)
        return min(100.0, score)
    except Exception:
        return 90.0


def compute_landmark_confidence(landmarks: list) -> float:
    """Average visibility of key postural landmarks."""
    key_names = ["left_shoulder", "right_shoulder", "left_hip", "right_hip", "left_knee", "right_knee"]
    visibilities = []
    for name in key_names:
        idx = LANDMARK.get(name)
        if idx is not None and idx < len(landmarks):
            visibilities.append(landmarks[idx].visibility)
    if not visibilities:
        return 0.0
    return float(np.mean(visibilities))
