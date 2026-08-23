# Exercise Demonstration Videos & Profile Asset Attributions

This document records the provenance, licensing, and attribution metadata for all video and image assets used within the RehabVision clinical tele-rehabilitation monitoring platform.

---

## 1. Exercise Demonstration Videos (`public/exercises/videos/`)

All video demonstrations are generated deterministically as 6-second (180 frames @ 30 FPS) biomechanical kinematic reference sequences rendered using Python and OpenCV.

| Exercise ID | Video Filename | Duration | Biomechanical Movement | Creator / Provenance | License |
|-------------|----------------|----------|------------------------|----------------------|---------|
| `leg_raise` | `straight-leg-raise.mp4` / `leg-raise.mp4` | 6.0s | Supine hip flexion 0°–45° with extended knee | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |
| `knee_extension` | `knee-extension.mp4` | 6.0s | Seated quadriceps extension 90°–165° | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |
| `sit_to_stand` | `sit-to-stand.mp4` | 6.0s | Functional chair sit-to-stand knee angle 90°–155° | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |
| `arm_raise` | `arm-raise.mp4` | 6.0s | Bilateral shoulder abduction 0°–90° | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |
| `squat` | `squat.mp4` | 6.0s | Biomechanical squat depth 175°–100° knee flexion | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |
| `neck_posture` | `neck-posture.mp4` | 6.0s | Cervical Craniovertebral Angle (CVA) alignment | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |
| `torso_bend` | `back-bend.mp4` / `torso-bend.mp4` | 6.0s | Standing hip hinge 0°–40° trunk inclination | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |
| `shoulder_symmetry` | `shoulder-symmetry.mp4` | 6.0s | Bilateral shoulder girdle level calibration | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |
| `knee_alignment` | `knee-alignment.mp4` | 6.0s | Frontal plane knee valgus tracking 178°–170° | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |
| `lateral_leg_raise` | `lateral-leg-raise.mp4` | 6.0s | Hip abduction 0°–35° for gluteus medius | RehabVision Team (Python/OpenCV Kinematics) | MIT / Open Source |

---

## 2. Patient & Physiotherapist Profile Portraits (`public/avatars/`)

All patient and clinician portraits are synthetic healthcare demonstration avatars created for evaluation purposes. No personal data or real patients' medical data is included.

| Profile Name | Role | ID / Identifier | Avatar Asset Path | License |
|--------------|------|-----------------|-------------------|---------|
| Dr. Priya Reddy | Physiotherapist | `2510030295` | `public/avatars/physio/priya-reddy.jpg` | Project-Generated / MIT |
| Rahul Kumar | Patient (Demo) | `PT-0001` | `public/avatars/patients/patient-01.jpg` | Project-Generated / MIT |
| Sneha Patel | Patient (Demo) | `PT-0002` | `public/avatars/patients/patient-02.jpg` | Project-Generated / MIT |
| Amit Sharma | Patient (Demo) | `PT-0003` | `public/avatars/patients/patient-03.jpg` | Project-Generated / MIT |
| Priya Verma | Patient (Demo) | `PT-0004` | `public/avatars/patients/patient-04.jpg` | Project-Generated / MIT |
| Rajesh Nair | Patient (Demo) | `PT-0005` | `public/avatars/patients/patient-05.jpg` | Project-Generated / MIT |

---

## 3. Fallback Handling Policy

If an external or local video/avatar asset fails to load over the network:
1. Videos automatically fall back to an illustrated biomechanical reference guide card (zero broken video players).
2. Profile avatars automatically fall back to clean 2-letter initials badges (e.g. `PR`, `RK`, `SP`) rendered with high-contrast SVG styling.
