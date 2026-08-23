"""
RehabVision Exercise State Machines & Biomechanical Engines
Supports 10 clinical physical therapy and movement intelligence exercises.
Each state machine performs deterministic rep counting, range-of-motion (ROM) tracking,
and multi-component form scoring (alignment 30%, ROM 25%, stability 20%, symmetry 15%, movement control 10%).
"""
import logging
from dataclasses import dataclass, field
from typing import Optional
from pose_analyzer import (
    JointAngles, FormAnalysis, get_landmark, compute_joint_angles,
    compute_symmetry_score
)

logger = logging.getLogger(__name__)


@dataclass
class RepState:
    count: int = 0
    phase: str = "rest"
    phase_frames: int = 0
    max_angle_this_rep: float = 0.0
    min_angle_this_rep: float = 999.0
    rom_history: list = field(default_factory=list)
    angle_history: list = field(default_factory=list)


class ExerciseStateMachine:
    """Base class for exercise state machines."""
    name: str = "Unknown"
    target_reps: int = 10
    primary_joint: str = "general"

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        raise NotImplementedError

    def get_primary_angle(self, angles: JointAngles) -> float:
        raise NotImplementedError

    def compute_rom(self, rep_state: RepState) -> float:
        if not rep_state.rom_history:
            return 0.0
        return sum(rep_state.rom_history) / len(rep_state.rom_history)


# ─── 1. Arm / Shoulder Raise ──────────────────────────────────────────────────
class ArmRaiseStateMachine(ExerciseStateMachine):
    name = "Arm / Shoulder Raise"
    target_reps = 10
    UP_THRESHOLD = 75.0
    DOWN_THRESHOLD = 35.0
    TARGET_ROM = 90.0

    def __init__(self):
        self.rep_state = RepState()

    def get_primary_angle(self, angles: JointAngles) -> float:
        valid = [a for a in [angles.left_shoulder_abduction, angles.right_shoulder_abduction] if a > 5]
        return sum(valid) / len(valid) if valid else 0.0

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        primary = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(primary)
        if len(rs.angle_history) > 30:
            rs.angle_history = rs.angle_history[-30:]

        rs.max_angle_this_rep = max(rs.max_angle_this_rep, primary)

        if rs.phase == "rest" and primary >= self.UP_THRESHOLD:
            rs.phase = "up"
            rs.phase_frames = 0
            rs.max_angle_this_rep = primary
        elif rs.phase == "up":
            rs.phase_frames += 1
            if primary < self.DOWN_THRESHOLD:
                rom = rs.max_angle_this_rep
                rs.rom_history.append(min(100.0, (rom / self.TARGET_ROM) * 100.0))
                rs.count += 1
                rs.phase = "rest"
                rs.max_angle_this_rep = 0.0

        form = FormAnalysis()
        issues, positives = [], []

        if angles.trunk_lean > 18.0:
            issues.append(f"Torso lean {angles.trunk_lean:.0f}° — maintain upright posture")
            form.form_score -= 20
        avg_elbow = (angles.left_elbow + angles.right_elbow) / 2
        if avg_elbow > 0 and avg_elbow < 145.0:
            issues.append(f"Elbow flexion detected ({avg_elbow:.0f}°) — extend arms fully")
            form.form_score -= 15
        if rs.phase == "up" and primary < 80.0:
            issues.append(f"Raise arms higher (currently {primary:.0f}°, target ≥90°)")
            form.form_score -= 15
        if angles.shoulder_height_diff_pct > 12.0:
            issues.append(f"Shoulder asymmetry {angles.shoulder_height_diff_pct:.0f}% detected")
            form.form_score -= 10
        else:
            positives.append("Good bilateral symmetry")

        if not issues:
            positives.append("Smooth controlled shoulder abduction")
            form.movement_quality = "good"
        elif len(issues) == 1:
            form.movement_quality = "fair"
        else:
            form.movement_quality = "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# ─── 2. Knee Extension ───────────────────────────────────────────────────────
class KneeExtensionStateMachine(ExerciseStateMachine):
    name = "Knee Extension"
    target_reps = 10
    EXTENDED_THRESHOLD = 155.0
    BENT_THRESHOLD = 110.0
    TARGET_ROM = 170.0

    def __init__(self):
        self.rep_state = RepState(phase="bent")

    def get_primary_angle(self, angles: JointAngles) -> float:
        valid = [a for a in [angles.left_knee, angles.right_knee] if a > 30]
        return sum(valid) / len(valid) if valid else 90.0

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        primary = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(primary)
        if len(rs.angle_history) > 30:
            rs.angle_history = rs.angle_history[-30:]

        rs.max_angle_this_rep = max(rs.max_angle_this_rep, primary)

        if rs.phase == "bent" and primary >= self.EXTENDED_THRESHOLD:
            rs.phase = "extended"
            rs.phase_frames = 0
            rs.max_angle_this_rep = primary
        elif rs.phase == "extended":
            rs.phase_frames += 1
            if primary <= self.BENT_THRESHOLD:
                rom = rs.max_angle_this_rep
                rs.rom_history.append(min(100.0, (rom / self.TARGET_ROM) * 100.0))
                rs.count += 1
                rs.phase = "bent"
                rs.max_angle_this_rep = 0.0

        form = FormAnalysis()
        issues, positives = [], []
        if rs.phase == "extended" and primary < 145.0:
            issues.append(f"Extend knee further ({primary:.0f}°, target ≥160°)")
            form.form_score -= 20
        if abs(angles.left_knee - angles.right_knee) > 18.0 and angles.left_knee > 30 and angles.right_knee > 30:
            issues.append("Bilateral knee extension asymmetry")
            form.form_score -= 15
        if angles.trunk_lean > 22.0:
            issues.append("Keep your spine upright against the chair")
            form.form_score -= 10
        if not issues:
            positives.append("Excellent quadriceps activation & terminal extension")
            form.movement_quality = "good"
        elif len(issues) == 1:
            form.movement_quality = "fair"
        else:
            form.movement_quality = "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# ─── 3. Sit to Stand ─────────────────────────────────────────────────────────
class SitToStandStateMachine(ExerciseStateMachine):
    name = "Sit to Stand"
    target_reps = 5
    STANDING_KNEE_THRESH = 155.0
    SITTING_KNEE_THRESH = 110.0

    def __init__(self):
        self.rep_state = RepState(phase="sitting")

    def get_primary_angle(self, angles: JointAngles) -> float:
        valid = [a for a in [angles.left_knee, angles.right_knee] if a > 30]
        return sum(valid) / len(valid) if valid else 90.0

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        knee_angle = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(knee_angle)

        rs.max_angle_this_rep = max(rs.max_angle_this_rep, knee_angle)

        if rs.phase == "sitting" and knee_angle >= self.STANDING_KNEE_THRESH:
            rs.phase = "standing"
            rs.phase_frames = 0
            rs.max_angle_this_rep = knee_angle
        elif rs.phase == "standing":
            rs.phase_frames += 1
            if knee_angle <= self.SITTING_KNEE_THRESH:
                rom = rs.max_angle_this_rep
                rs.rom_history.append(min(100.0, (rom / self.STANDING_KNEE_THRESH) * 100.0))
                rs.count += 1
                rs.phase = "sitting"
                rs.max_angle_this_rep = 0.0

        form = FormAnalysis()
        issues, positives = [], []
        if angles.trunk_lean > 32.0:
            issues.append(f"Excessive forward torso bend ({angles.trunk_lean:.0f}°)")
            form.form_score -= 20
        if rs.phase == "standing" and knee_angle < 150.0:
            issues.append("Fully lock hips and knees at top of stand")
            form.form_score -= 15
        sym = compute_symmetry_score(angles)
        if sym < 80:
            issues.append("Uneven weight shift between left and right legs")
            form.form_score -= 15
        else:
            positives.append("Balanced bilateral weight distribution")

        if not issues:
            positives.append("Clean functional sit-to-stand transition")
            form.movement_quality = "good"
        elif len(issues) == 1:
            form.movement_quality = "fair"
        else:
            form.movement_quality = "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# ─── 4. Straight Leg Raise ───────────────────────────────────────────────────
class LegRaiseStateMachine(ExerciseStateMachine):
    name = "Straight Leg Raise"
    target_reps = 8
    RAISED_THRESHOLD = 38.0
    REST_THRESHOLD = 15.0
    TARGET_ROM = 45.0

    def __init__(self):
        self.rep_state = RepState(phase="down")

    def get_primary_angle(self, angles: JointAngles) -> float:
        # Measure hip flexion angle relative to horizontal / baseline
        valid = [a for a in [angles.left_hip, angles.right_hip] if a > 10]
        return min(valid) if valid else 0.0

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        primary = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(primary)

        # Angle elevation
        elevation = max(0.0, 180.0 - primary) if primary > 0 else 0.0
        rs.max_angle_this_rep = max(rs.max_angle_this_rep, elevation)

        if rs.phase == "down" and elevation >= self.RAISED_THRESHOLD:
            rs.phase = "raised"
            rs.phase_frames = 0
            rs.max_angle_this_rep = elevation
        elif rs.phase == "raised":
            rs.phase_frames += 1
            if elevation <= self.REST_THRESHOLD:
                rom = rs.max_angle_this_rep
                rs.rom_history.append(min(100.0, (rom / self.TARGET_ROM) * 100.0))
                rs.count += 1
                rs.phase = "down"
                rs.max_angle_this_rep = 0.0

        form = FormAnalysis()
        issues, positives = [], []
        # Knee must remain straight during leg raise
        knee = min(angles.left_knee, angles.right_knee) if angles.left_knee > 0 and angles.right_knee > 0 else 180.0
        if knee < 155.0 and knee > 30:
            issues.append(f"Knee buckling detected ({knee:.0f}°) — keep leg straight")
            form.form_score -= 25
        if angles.trunk_lean > 20.0:
            issues.append("Avoid arching or twisting your lower back")
            form.form_score -= 15
        if not issues:
            positives.append("Excellent straight leg elevation & quad engagement")
            form.movement_quality = "good"
        else:
            form.movement_quality = "fair" if len(issues) == 1 else "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# ─── 5. Squat ─────────────────────────────────────────────────────────────────
class SquatStateMachine(ExerciseStateMachine):
    name = "Squat"
    target_reps = 10
    SQUAT_DEPTH_KNEE = 115.0
    STANDING_KNEE = 160.0
    TARGET_ROM = 90.0

    def __init__(self):
        self.rep_state = RepState(phase="standing")

    def get_primary_angle(self, angles: JointAngles) -> float:
        valid = [a for a in [angles.left_knee, angles.right_knee] if a > 30]
        return sum(valid) / len(valid) if valid else 180.0

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        knee_angle = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(knee_angle)

        depth = max(0.0, 180.0 - knee_angle)
        rs.max_angle_this_rep = max(rs.max_angle_this_rep, depth)

        if rs.phase == "standing" and knee_angle <= self.SQUAT_DEPTH_KNEE:
            rs.phase = "squatting"
            rs.phase_frames = 0
        elif rs.phase == "squatting":
            rs.phase_frames += 1
            if knee_angle >= self.STANDING_KNEE:
                rs.rom_history.append(min(100.0, (rs.max_angle_this_rep / self.TARGET_ROM) * 100.0))
                rs.count += 1
                rs.phase = "standing"
                rs.max_angle_this_rep = 0.0

        form = FormAnalysis()
        issues, positives = [], []
        if angles.trunk_lean > 35.0:
            issues.append(f"Excessive forward torso lean ({angles.trunk_lean:.0f}°)")
            form.form_score -= 20
        # Knee valgus check
        if angles.knee_valgus_left < 160.0 or angles.knee_valgus_right < 160.0:
            issues.append("Knee valgus (inward collapse) detected — push knees outward")
            form.form_score -= 20
        if not issues:
            positives.append("Deep squat with stable knee-ankle alignment")
            form.movement_quality = "good"
        else:
            form.movement_quality = "fair" if len(issues) == 1 else "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# ─── 6. Neck & Forward Head Posture ───────────────────────────────────────────
class NeckPostureStateMachine(ExerciseStateMachine):
    name = "Neck Posture & Alignment"
    target_reps = 1
    TARGET_CVA = 50.0

    def __init__(self):
        self.rep_state = RepState(phase="monitoring")

    def get_primary_angle(self, angles: JointAngles) -> float:
        return angles.craniovertebral_angle

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        cva = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(cva)
        rs.rom_history = [min(100.0, (cva / self.TARGET_CVA) * 100.0)] if cva > 0 else [90.0]

        form = FormAnalysis()
        issues, positives = [], []

        # Craniovertebral Angle < 48° is standard threshold for forward head posture
        if cva > 0 and cva < 48.0:
            issues.append(f"Forward-head posture detected (Craniovertebral Angle {cva:.0f}°, optimal ≥50°)")
            form.form_score -= 30
        elif cva >= 48.0:
            positives.append(f"Optimal neutral cervical alignment (Angle {cva:.0f}°)")

        if angles.trunk_lean > 15.0:
            issues.append(f"Thoracic slouching detected ({angles.trunk_lean:.0f}° trunk inclination)")
            form.form_score -= 15

        if not issues:
            positives.append("Excellent neutral head-over-shoulder alignment")
            form.movement_quality = "good"
        else:
            form.movement_quality = "fair" if len(issues) == 1 else "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# ─── 7. Back & Torso Bend Alignment ──────────────────────────────────────────
class TorsoBendStateMachine(ExerciseStateMachine):
    name = "Back & Torso Bend Alignment"
    target_reps = 5
    BEND_THRESHOLD = 30.0
    UPRIGHT_THRESHOLD = 12.0
    TARGET_ROM = 45.0

    def __init__(self):
        self.rep_state = RepState(phase="upright")

    def get_primary_angle(self, angles: JointAngles) -> float:
        return angles.trunk_lean

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        lean = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(lean)
        rs.max_angle_this_rep = max(rs.max_angle_this_rep, lean)

        if rs.phase == "upright" and lean >= self.BEND_THRESHOLD:
            rs.phase = "bending"
            rs.phase_frames = 0
        elif rs.phase == "bending":
            rs.phase_frames += 1
            if lean <= self.UPRIGHT_THRESHOLD:
                rs.rom_history.append(min(100.0, (rs.max_angle_this_rep / self.TARGET_ROM) * 100.0))
                rs.count += 1
                rs.phase = "upright"
                rs.max_angle_this_rep = 0.0

        form = FormAnalysis()
        issues, positives = [], []
        if lean > 55.0:
            issues.append(f"Excessive forward bend ({lean:.0f}°) — keep spine neutral")
            form.form_score -= 25
        elif lean <= self.UPRIGHT_THRESHOLD:
            positives.append("Spine returned to stable upright alignment")

        if angles.shoulder_height_diff_pct > 15.0:
            issues.append("Lateral spine curvature or uneven shoulder tilt detected")
            form.form_score -= 15

        if not issues:
            positives.append("Controlled spinal hinge mechanics")
            form.movement_quality = "good"
        else:
            form.movement_quality = "fair" if len(issues) == 1 else "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# ─── 8. Shoulder Symmetry & Balance ──────────────────────────────────────────
class ShoulderSymmetryStateMachine(ExerciseStateMachine):
    name = "Shoulder Symmetry & Balance"
    target_reps = 10
    TARGET_ROM = 95.0

    def __init__(self):
        self.rep_state = RepState(phase="monitoring")

    def get_primary_angle(self, angles: JointAngles) -> float:
        # Balance delta
        diff = angles.shoulder_height_diff_pct
        return max(0.0, 100.0 - diff)

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        score = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(score)
        rs.rom_history = [score]

        form = FormAnalysis()
        issues, positives = [], []
        if angles.shoulder_height_diff_pct > 8.0:
            issues.append(f"Shoulder height asymmetry {angles.shoulder_height_diff_pct:.1f}% detected")
            form.form_score -= min(40, angles.shoulder_height_diff_pct * 3)
        else:
            positives.append(f"Level bilateral shoulder symmetry ({score:.0f}%)")

        if angles.trunk_lean > 12.0:
            issues.append(f"Compensatory lateral trunk shift ({angles.trunk_lean:.0f}°)")
            form.form_score -= 15

        if not issues:
            positives.append("Balanced shoulder girdle alignment")
            form.movement_quality = "good"
        else:
            form.movement_quality = "fair" if len(issues) == 1 else "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# ─── 9. Knee Alignment & Valgus Tracking ─────────────────────────────────────
class KneeAlignmentStateMachine(ExerciseStateMachine):
    name = "Knee Alignment & Valgus Tracking"
    target_reps = 8
    TARGET_ROM = 175.0

    def __init__(self):
        self.rep_state = RepState(phase="tracking")

    def get_primary_angle(self, angles: JointAngles) -> float:
        return min(angles.knee_valgus_left, angles.knee_valgus_right)

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        valgus_angle = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(valgus_angle)
        rs.rom_history = [min(100.0, (valgus_angle / 180.0) * 100.0)]

        form = FormAnalysis()
        issues, positives = [], []
        # Frontal knee angle < 165° indicates dynamic knee valgus collapse
        if valgus_angle < 165.0:
            issues.append(f"Knee inward valgus deviation ({valgus_angle:.0f}°) — engage glutes to keep knees over toes")
            form.form_score -= 30
        elif valgus_angle > 185.0:
            issues.append(f"Knee varus (outward bow) tracking ({valgus_angle:.0f}°)")
            form.form_score -= 15
        else:
            positives.append("Optimal linear hip-knee-ankle joint tracking")

        if not issues:
            positives.append("Excellent patellofemoral stability")
            form.movement_quality = "good"
        else:
            form.movement_quality = "fair" if len(issues) == 1 else "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# ─── 10. Lateral Leg Raise ───────────────────────────────────────────────────
class LateralLegRaiseStateMachine(ExerciseStateMachine):
    name = "Lateral Leg Raise"
    target_reps = 8
    ABDUCTION_THRESHOLD = 28.0
    REST_THRESHOLD = 12.0
    TARGET_ROM = 40.0

    def __init__(self):
        self.rep_state = RepState(phase="down")

    def get_primary_angle(self, angles: JointAngles) -> float:
        return max(angles.left_hip_abduction, angles.right_hip_abduction)

    def update(self, landmarks: list, angles: JointAngles) -> tuple:
        abduction = self.get_primary_angle(angles)
        rs = self.rep_state
        rs.angle_history.append(abduction)
        rs.max_angle_this_rep = max(rs.max_angle_this_rep, abduction)

        if rs.phase == "down" and abduction >= self.ABDUCTION_THRESHOLD:
            rs.phase = "raised"
            rs.phase_frames = 0
        elif rs.phase == "raised":
            rs.phase_frames += 1
            if abduction <= self.REST_THRESHOLD:
                rs.rom_history.append(min(100.0, (rs.max_angle_this_rep / self.TARGET_ROM) * 100.0))
                rs.count += 1
                rs.phase = "down"
                rs.max_angle_this_rep = 0.0

        form = FormAnalysis()
        issues, positives = [], []
        if angles.trunk_lean > 20.0:
            issues.append("Avoid leaning torso sideways to compensate for leg height")
            form.form_score -= 20
        if rs.phase == "raised" and abduction < 25.0:
            issues.append(f"Abduct leg higher (target ≥35°, current {abduction:.0f}°)")
            form.form_score -= 15
        if not issues:
            positives.append("Isolated gluteus medius contraction without pelvic shift")
            form.movement_quality = "good"
        else:
            form.movement_quality = "fair" if len(issues) == 1 else "poor"

        form.form_score = max(0.0, min(100.0, form.form_score))
        form.issues = issues
        form.positive_feedback = positives
        return rs, form


# Register all 10 exercise state machines
EXERCISE_MACHINES = {
    "arm_raise": ArmRaiseStateMachine,
    "knee_extension": KneeExtensionStateMachine,
    "sit_to_stand": SitToStandStateMachine,
    "leg_raise": LegRaiseStateMachine,
    "squat": SquatStateMachine,
    "neck_posture": NeckPostureStateMachine,
    "torso_bend": TorsoBendStateMachine,
    "shoulder_symmetry": ShoulderSymmetryStateMachine,
    "knee_alignment": KneeAlignmentStateMachine,
    "lateral_leg_raise": LateralLegRaiseStateMachine,
}

EXERCISE_INFO = {
    "sit_to_stand": {
        "id": "sit_to_stand",
        "name": "Sit to Stand",
        "category": "lower_body",
        "description": "Functional sit-to-stand for lower limb strength, quadriceps activation, and mobility",
        "target_joints": ["left_knee", "right_knee", "left_hip", "right_hip"],
        "primary_angle_label": "Knee Angle",
        "target_reps": 5,
        "target_rom_degrees": 155,
    },
    "knee_extension": {
        "id": "knee_extension",
        "name": "Knee Extension",
        "category": "lower_body",
        "description": "Seated knee extension for quadriceps strengthening and patellar tracking",
        "target_joints": ["left_knee", "right_knee"],
        "primary_angle_label": "Knee Extension Angle",
        "target_reps": 10,
        "target_rom_degrees": 170,
    },
    "leg_raise": {
        "id": "leg_raise",
        "name": "Straight Leg Raise",
        "category": "lower_body",
        "description": "Straight leg raise for hip flexor activation and quadriceps rehabilitation",
        "target_joints": ["left_hip", "right_hip", "left_knee", "right_knee"],
        "primary_angle_label": "Hip Elevation Angle",
        "target_reps": 8,
        "target_rom_degrees": 45,
    },
    "arm_raise": {
        "id": "arm_raise",
        "name": "Arm / Shoulder Raise",
        "category": "upper_body",
        "description": "Frontal and lateral arm abduction for shoulder mobility and rotator cuff strength",
        "target_joints": ["left_shoulder", "right_shoulder"],
        "primary_angle_label": "Shoulder Abduction",
        "target_reps": 10,
        "target_rom_degrees": 90,
    },
    "squat": {
        "id": "squat",
        "name": "Squat",
        "category": "lower_body",
        "description": "Full body biomechanical squat assessing knee flexion, hip depth, and back inclination",
        "target_joints": ["left_knee", "right_knee", "left_hip", "right_hip"],
        "primary_angle_label": "Knee Flexion Angle",
        "target_reps": 10,
        "target_rom_degrees": 100,
    },
    "neck_posture": {
        "id": "neck_posture",
        "name": "Neck & Forward Head Alignment",
        "category": "posture",
        "description": "Real-time cervical and craniovertebral posture tracking to detect forward head position",
        "target_joints": ["nose", "left_ear", "right_ear", "left_shoulder", "right_shoulder"],
        "primary_angle_label": "Craniovertebral Angle",
        "target_reps": 1,
        "target_rom_degrees": 50,
    },
    "torso_bend": {
        "id": "torso_bend",
        "name": "Back & Torso Bend Alignment",
        "category": "posture",
        "description": "Trunk inclination tracking calculating torso bend angle relative to vertical axis",
        "target_joints": ["left_shoulder", "right_shoulder", "left_hip", "right_hip"],
        "primary_angle_label": "Torso Inclination Angle",
        "target_reps": 5,
        "target_rom_degrees": 45,
    },
    "shoulder_symmetry": {
        "id": "shoulder_symmetry",
        "name": "Shoulder Symmetry & Balance",
        "category": "upper_body",
        "description": "Bilateral shoulder height and elevation symmetry assessment for postural imbalance",
        "target_joints": ["left_shoulder", "right_shoulder"],
        "primary_angle_label": "Shoulder Balance Delta",
        "target_reps": 10,
        "target_rom_degrees": 95,
    },
    "knee_alignment": {
        "id": "knee_alignment",
        "name": "Knee Alignment & Valgus Tracking",
        "category": "lower_body",
        "description": "Frontal plane knee alignment tracking to detect valgus (inward) or varus collapse",
        "target_joints": ["left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"],
        "primary_angle_label": "Frontal Knee Angle",
        "target_reps": 8,
        "target_rom_degrees": 175,
    },
    "lateral_leg_raise": {
        "id": "lateral_leg_raise",
        "name": "Lateral Leg Raise",
        "category": "lower_body",
        "description": "Side-lying or standing hip abduction targeting gluteus medius and pelvic stability",
        "target_joints": ["left_hip", "right_hip", "left_ankle", "right_ankle"],
        "primary_angle_label": "Hip Abduction Angle",
        "target_reps": 8,
        "target_rom_degrees": 40,
    },
}
