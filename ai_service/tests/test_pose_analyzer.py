"""
Tests for RehabVision AI service components.
Run with: pytest ai_service/tests/test_pose_analyzer.py -v
"""
import math
import sys
from pathlib import Path
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from pose_analyzer import (
    PoseLandmark, calculate_angle, compute_joint_angles,
    compute_symmetry_score, compute_stability_score,
    compute_landmark_confidence, JointAngles, LANDMARK
)
from exercise_machines import (
    ArmRaiseStateMachine, KneeExtensionStateMachine, SitToStandStateMachine,
    EXERCISE_MACHINES, EXERCISE_INFO
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_landmark(x, y, z=0.0, visibility=0.9) -> PoseLandmark:
    return PoseLandmark(x=x, y=y, z=z, visibility=visibility)


def make_full_landmarks(config: dict) -> list:
    """Create a full 33-landmark list with defaults."""
    defaults = {i: PoseLandmark(0.5, 0.5, 0.0, 0.1) for i in range(33)}
    # Set visible landmarks from config
    for name, (x, y) in config.items():
        idx = LANDMARK.get(name)
        if idx is not None:
            defaults[idx] = PoseLandmark(x=x, y=y, z=0.0, visibility=0.95)
    return [defaults[i] for i in range(33)]


# ─── Test calculate_angle ─────────────────────────────────────────────────────

class TestCalculateAngle:
    def test_90_degree_angle(self):
        """Classic right angle: A at top, B at origin, C to the right."""
        a = make_landmark(0, 1)    # up
        b = make_landmark(0, 0)    # origin (joint)
        c = make_landmark(1, 0)    # right
        angle = calculate_angle(a, b, c)
        assert abs(angle - 90.0) < 1.0, f"Expected 90°, got {angle:.2f}°"

    def test_180_degree_angle(self):
        """Straight line: points collinear."""
        a = make_landmark(-1, 0)
        b = make_landmark(0, 0)
        c = make_landmark(1, 0)
        angle = calculate_angle(a, b, c)
        assert abs(angle - 180.0) < 1.0, f"Expected 180°, got {angle:.2f}°"

    def test_0_degree_angle(self):
        """Fully folded: both rays in same direction."""
        a = make_landmark(1, 0)
        b = make_landmark(0, 0)
        c = make_landmark(1, 0)
        angle = calculate_angle(a, b, c)
        # Same point for A and C, angle approaches 0
        assert angle < 5.0

    def test_45_degree_angle(self):
        a = make_landmark(0, 1)
        b = make_landmark(0, 0)
        c = make_landmark(1, 1)
        angle = calculate_angle(a, b, c)
        assert abs(angle - 45.0) < 2.0, f"Expected ~45°, got {angle:.2f}°"

    def test_degenerate_zero_vectors(self):
        """Should return 0.0 rather than crashing."""
        a = make_landmark(0, 0)
        b = make_landmark(0, 0)
        c = make_landmark(0, 0)
        angle = calculate_angle(a, b, c)
        assert angle == 0.0

    def test_result_in_range(self):
        """Angle must always be in [0, 180]."""
        for _ in range(50):
            a = make_landmark(np.random.uniform(-1, 1), np.random.uniform(-1, 1))
            b = make_landmark(np.random.uniform(-1, 1), np.random.uniform(-1, 1))
            c = make_landmark(np.random.uniform(-1, 1), np.random.uniform(-1, 1))
            angle = calculate_angle(a, b, c)
            assert 0.0 <= angle <= 180.0, f"Angle out of range: {angle}"


# ─── Test compute_joint_angles ────────────────────────────────────────────────

class TestComputeJointAngles:
    def _make_standing_landmarks(self) -> list:
        """Person standing upright with arms at sides."""
        return make_full_landmarks({
            "left_shoulder": (0.35, 0.25),
            "right_shoulder": (0.65, 0.25),
            "left_elbow": (0.30, 0.45),
            "right_elbow": (0.70, 0.45),
            "left_wrist": (0.28, 0.65),
            "right_wrist": (0.72, 0.65),
            "left_hip": (0.38, 0.55),
            "right_hip": (0.62, 0.55),
            "left_knee": (0.38, 0.75),
            "right_knee": (0.62, 0.75),
            "left_ankle": (0.38, 0.95),
            "right_ankle": (0.62, 0.95),
        })

    def test_returns_joint_angles_object(self):
        lms = self._make_standing_landmarks()
        angles = compute_joint_angles(lms)
        assert isinstance(angles, JointAngles)

    def test_standing_knee_angles_near_straight(self):
        """Standing person should have knee angles near 180°."""
        lms = self._make_standing_landmarks()
        angles = compute_joint_angles(lms)
        assert angles.left_knee > 130, f"Left knee should be near straight, got {angles.left_knee:.1f}°"
        assert angles.right_knee > 130, f"Right knee should be near straight, got {angles.right_knee:.1f}°"

    def test_low_visibility_excluded(self):
        """Low-visibility landmarks should not contribute."""
        lms = self._make_standing_landmarks()
        # Set left knee to low visibility
        lms[LANDMARK["left_knee"]] = PoseLandmark(0.38, 0.75, 0.0, 0.1)
        angles = compute_joint_angles(lms)
        # Left knee should be 0 (excluded)
        assert angles.left_knee == 0.0

    def test_arm_raised_shoulder_angle(self):
        """Raised arm should produce larger shoulder abduction angle."""
        # Arm raised (wrist above shoulder level)
        lms_raised = make_full_landmarks({
            "left_shoulder": (0.35, 0.40),
            "right_shoulder": (0.65, 0.40),
            "left_elbow": (0.20, 0.25),
            "right_elbow": (0.80, 0.25),
            "left_wrist": (0.10, 0.10),
            "right_wrist": (0.90, 0.10),
            "left_hip": (0.38, 0.65),
            "right_hip": (0.62, 0.65),
            "left_knee": (0.38, 0.80),
            "right_knee": (0.62, 0.80),
            "left_ankle": (0.38, 0.95),
            "right_ankle": (0.62, 0.95),
        })
        angles_raised = compute_joint_angles(lms_raised)

        # Arms at sides
        lms_down = make_full_landmarks({
            "left_shoulder": (0.35, 0.40),
            "right_shoulder": (0.65, 0.40),
            "left_elbow": (0.33, 0.55),
            "right_elbow": (0.67, 0.55),
            "left_wrist": (0.32, 0.70),
            "right_wrist": (0.68, 0.70),
            "left_hip": (0.38, 0.65),
            "right_hip": (0.62, 0.65),
            "left_knee": (0.38, 0.80),
            "right_knee": (0.62, 0.80),
            "left_ankle": (0.38, 0.95),
            "right_ankle": (0.62, 0.95),
        })
        angles_down = compute_joint_angles(lms_down)

        assert angles_raised.left_shoulder_abduction > angles_down.left_shoulder_abduction, \
            "Raised arm should have greater shoulder angle"


# ─── Test Symmetry Score ──────────────────────────────────────────────────────

class TestSymmetryScore:
    def test_perfect_symmetry(self):
        angles = JointAngles(
            left_shoulder_abduction=90, right_shoulder_abduction=90,
            left_knee=160, right_knee=160,
        )
        score = compute_symmetry_score(angles)
        assert score == 100.0

    def test_large_asymmetry(self):
        angles = JointAngles(
            left_shoulder_abduction=90, right_shoulder_abduction=45,
        )
        score = compute_symmetry_score(angles)
        assert score < 30, f"Large asymmetry should give low score, got {score}"

    def test_score_in_range(self):
        for _ in range(20):
            angles = JointAngles(
                left_shoulder_abduction=np.random.uniform(0, 180),
                right_shoulder_abduction=np.random.uniform(0, 180),
                left_knee=np.random.uniform(90, 180),
                right_knee=np.random.uniform(90, 180),
            )
            score = compute_symmetry_score(angles)
            assert 0.0 <= score <= 100.0

    def test_no_valid_angles(self):
        """With no valid bilateral angles, should return default ~90."""
        angles = JointAngles()
        score = compute_symmetry_score(angles)
        assert score == 90.0


# ─── Test Stability Score ─────────────────────────────────────────────────────

class TestStabilityScore:
    def _make_stable_history(self, n=15) -> list:
        """Very small hip variation = high stability."""
        result = []
        for _ in range(n):
            lms = make_full_landmarks({
                "left_hip": (0.37 + np.random.uniform(-0.001, 0.001), 0.55),
                "right_hip": (0.63 + np.random.uniform(-0.001, 0.001), 0.55),
            })
            result.append(lms)
        return result

    def _make_unstable_history(self, n=15) -> list:
        """Large hip variation = low stability."""
        np.random.seed(42)  # Fixed seed for reproducibility
        result = []
        for _ in range(n):
            lms = make_full_landmarks({
                "left_hip": (0.37 + np.random.uniform(-0.2, 0.2), 0.55),
                "right_hip": (0.63 + np.random.uniform(-0.2, 0.2), 0.55),
            })
            result.append(lms)
        return result

    def test_stable_motion(self):
        history = self._make_stable_history()
        score = compute_stability_score(history)
        assert score > 85.0, f"Stable motion should score > 85, got {score:.1f}"

    def test_unstable_motion(self):
        history = self._make_unstable_history()
        score = compute_stability_score(history)
        # Stable motion scores ~97+, unstable should score notably less
        # With ±0.2 range, variance ~0.013, score ~100 - 65 = 35
        assert score < 95.0, f"Unstable motion should score < 95, got {score:.1f}"

    def test_insufficient_history(self):
        score = compute_stability_score([])
        assert score == 90.0

    def test_score_in_range(self):
        history = self._make_unstable_history()
        score = compute_stability_score(history)
        assert 0.0 <= score <= 100.0


# ─── Test Exercise State Machines ─────────────────────────────────────────────

class TestArmRaiseStateMachine:
    def _make_arm_raised_angles(self, abduction=90.0) -> JointAngles:
        return JointAngles(
            left_shoulder_abduction=abduction,
            right_shoulder_abduction=abduction,
            left_elbow=170, right_elbow=170,
            trunk_lean=5,
        )

    def _make_arm_down_angles(self) -> JointAngles:
        return JointAngles(
            left_shoulder_abduction=20,
            right_shoulder_abduction=20,
            left_elbow=170, right_elbow=170,
            trunk_lean=5,
        )

    def test_initial_state(self):
        machine = ArmRaiseStateMachine()
        assert machine.rep_state.count == 0
        assert machine.rep_state.phase == "rest"

    def test_rep_counted_on_raise_and_lower(self):
        machine = ArmRaiseStateMachine()
        lms = make_full_landmarks({
            "left_shoulder": (0.35, 0.4), "right_shoulder": (0.65, 0.4),
            "left_hip": (0.38, 0.65), "right_hip": (0.62, 0.65),
        })

        # Simulate raise (above threshold)
        for _ in range(3):
            rs, form = machine.update(lms, self._make_arm_raised_angles(90))

        # Simulate lower (below threshold)
        for _ in range(3):
            rs, form = machine.update(lms, self._make_arm_down_angles())

        assert machine.rep_state.count == 1, f"Expected 1 rep, got {machine.rep_state.count}"

    def test_no_rep_if_arm_not_raised_enough(self):
        machine = ArmRaiseStateMachine()
        lms = make_full_landmarks({})
        # Only partial raise, stays below threshold
        for _ in range(10):
            rs, form = machine.update(lms, JointAngles(left_shoulder_abduction=50, right_shoulder_abduction=50))
        assert machine.rep_state.count == 0

    def test_form_analysis_returns_object(self):
        machine = ArmRaiseStateMachine()
        lms = make_full_landmarks({})
        rs, form = machine.update(lms, self._make_arm_raised_angles(90))
        assert hasattr(form, "form_score")
        assert hasattr(form, "issues")
        assert hasattr(form, "positive_feedback")
        assert 0.0 <= form.form_score <= 100.0

    def test_trunk_lean_issue_detected(self):
        machine = ArmRaiseStateMachine()
        lms = make_full_landmarks({})
        # Excessive trunk lean
        angles = JointAngles(
            left_shoulder_abduction=90, right_shoulder_abduction=90,
            trunk_lean=35.0
        )
        rs, form = machine.update(lms, angles)
        lean_issues = [i for i in form.issues if "lean" in i.lower() or "trunk" in i.lower() or "back" in i.lower()]
        assert len(lean_issues) > 0, "Should detect trunk lean issue"

    def test_multiple_reps(self):
        machine = ArmRaiseStateMachine()
        lms = make_full_landmarks({})
        for _ in range(3):
            # Raise
            for _ in range(3):
                machine.update(lms, self._make_arm_raised_angles(90))
            # Lower
            for _ in range(3):
                machine.update(lms, self._make_arm_down_angles())
        assert machine.rep_state.count == 3


class TestKneeExtensionStateMachine:
    def test_rep_counted(self):
        machine = KneeExtensionStateMachine()
        lms = make_full_landmarks({})
        # Extend
        for _ in range(3):
            machine.update(lms, JointAngles(left_knee=160, right_knee=160))
        # Return to bent
        for _ in range(3):
            machine.update(lms, JointAngles(left_knee=90, right_knee=90))
        assert machine.rep_state.count == 1

    def test_initial_phase_is_bent(self):
        machine = KneeExtensionStateMachine()
        assert machine.rep_state.phase == "bent"

    def test_rom_percentage_calculated(self):
        machine = KneeExtensionStateMachine()
        lms = make_full_landmarks({})
        for _ in range(3):
            machine.update(lms, JointAngles(left_knee=165, right_knee=165))
        for _ in range(3):
            machine.update(lms, JointAngles(left_knee=90, right_knee=90))
        rom = machine.compute_rom(machine.rep_state)
        assert 0 <= rom <= 100, f"ROM % should be 0-100, got {rom}"


class TestSitToStandStateMachine:
    def test_rep_counted(self):
        machine = SitToStandStateMachine()
        lms = make_full_landmarks({})
        # Stand up
        for _ in range(3):
            machine.update(lms, JointAngles(left_knee=165, right_knee=165, left_hip=150, right_hip=150))
        # Sit down
        for _ in range(3):
            machine.update(lms, JointAngles(left_knee=90, right_knee=90, left_hip=100, right_hip=100))
        assert machine.rep_state.count == 1


# ─── Test EXERCISE_MACHINES registry ─────────────────────────────────────────

class TestExerciseRegistry:
    def test_all_exercises_registered(self):
        assert "arm_raise" in EXERCISE_MACHINES
        assert "knee_extension" in EXERCISE_MACHINES
        assert "sit_to_stand" in EXERCISE_MACHINES

    def test_all_exercise_info_present(self):
        assert "arm_raise" in EXERCISE_INFO
        assert "knee_extension" in EXERCISE_INFO
        assert "sit_to_stand" in EXERCISE_INFO

    def test_exercise_info_has_required_fields(self):
        for eid, info in EXERCISE_INFO.items():
            assert "id" in info
            assert "name" in info
            assert "description" in info
            assert "target_reps" in info
            assert "target_rom_degrees" in info

    def test_machines_instantiable(self):
        for eid, cls in EXERCISE_MACHINES.items():
            machine = cls()
            assert hasattr(machine, "rep_state")
            assert hasattr(machine, "update")
            assert hasattr(machine, "get_primary_angle")


# ─── Test landmark confidence ─────────────────────────────────────────────────

class TestLandmarkConfidence:
    def test_high_confidence_visible_landmarks(self):
        lms = make_full_landmarks({
            "left_shoulder": (0.35, 0.25),
            "right_shoulder": (0.65, 0.25),
            "left_hip": (0.38, 0.55),
            "right_hip": (0.62, 0.55),
            "left_knee": (0.38, 0.75),
            "right_knee": (0.62, 0.75),
        })
        conf = compute_landmark_confidence(lms)
        assert conf > 0.85, f"Expected high confidence, got {conf:.2f}"

    def test_low_confidence_invisible_landmarks(self):
        lms = [PoseLandmark(0.5, 0.5, 0.0, 0.05) for _ in range(33)]
        conf = compute_landmark_confidence(lms)
        assert conf < 0.2, f"Expected low confidence, got {conf:.2f}"

    def test_empty_landmarks(self):
        conf = compute_landmark_confidence([])
        assert conf == 0.0
