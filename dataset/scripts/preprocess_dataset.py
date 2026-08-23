"""
Dataset inspection and preprocessing pipeline for RehabVision.

Dataset: Blurred exercise videos (privacy-preserving)
Structure:
  Blurred/Arm Raise Correct/     - 51 videos
  Blurred/Arm Raise Incorrect/   - 55 videos
  Blurred/Knee Extension Correct/ - 44 videos
  Blurred/Knee Extension Incorrect/ - 62 videos
  Blurred/Sit To Stand Correct/  - 79 videos
  Blurred/Sit To Stand Incorrect/ - 48 videos

Pipeline:
1. Extract pose landmarks from each video using MediaPipe
2. Compute biomechanical features per video
3. Train a binary classifier per exercise (Correct vs Incorrect form)
4. Evaluate with proper train/test split at VIDEO level (no leakage)
5. Save model artifacts

Usage:
  python dataset/scripts/preprocess_dataset.py
  python dataset/scripts/train_model.py
"""
import os
import sys
import json
import zipfile
import logging
import random
import pickle
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

# Add parent to path for pose_analyzer
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "ai_service"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATASET_ZIP = Path(__file__).parent.parent.parent / "archive (1).zip"
EXTRACTED_DIR = Path(__file__).parent.parent / "extracted"
PROCESSED_DIR = Path(__file__).parent.parent / "processed"
MODELS_DIR = Path(__file__).parent.parent.parent / "ai_service" / "models_trained"

CATEGORY_MAP = {
    "Blurred/Arm Raise Correct": ("arm_raise", "correct"),
    "Blurred/Arm Raise Incorrect": ("arm_raise", "incorrect"),
    "Blurred/Knee Extension Correct": ("knee_extension", "correct"),
    "Blurred/Knee Extension Incorrect": ("knee_extension", "incorrect"),
    "Blurred/Sit To Stand Correct": ("sit_to_stand", "correct"),
    "Blurred/Sit To Stand Incorrect": ("sit_to_stand", "incorrect"),
}

LABEL_MAP = {"correct": 1, "incorrect": 0}

# Key MediaPipe landmark indices we extract features from
KEY_LANDMARKS = [
    0,   # nose
    11, 12,  # shoulders
    13, 14,  # elbows
    15, 16,  # wrists
    23, 24,  # hips
    25, 26,  # knees
    27, 28,  # ankles
]


def extract_zip_if_needed():
    """Extract the dataset zip only if not already done."""
    if not DATASET_ZIP.exists():
        logger.error(f"Dataset zip not found at {DATASET_ZIP}")
        sys.exit(1)

    EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
    marker = EXTRACTED_DIR / ".extracted"
    if marker.exists():
        logger.info("Dataset already extracted")
        return

    logger.info(f"Extracting {DATASET_ZIP} (this may take a few minutes)...")
    with zipfile.ZipFile(DATASET_ZIP, "r") as zf:
        zf.extractall(EXTRACTED_DIR)
    marker.write_text("done")
    logger.info("Extraction complete")


def get_pose_model():
    """Load MediaPipe Pose model."""
    import mediapipe as mp
    mp_pose = mp.solutions.pose
    return mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ), mp_pose


def extract_video_features(video_path: Path, pose_model, mp_pose, max_frames: int = 60) -> Optional[np.ndarray]:
    """
    Extract biomechanical features from a video.
    Returns feature vector or None if extraction fails.

    Features per frame: normalized x,y of 14 key landmarks = 28 values
    We summarize with mean, std, min, max across frames = 28 * 4 = 112 features
    Plus joint angle statistics = ~20 more features
    Total: ~132 features per video
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.warning(f"Cannot open {video_path}")
        return None

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames < 5:
        cap.release()
        return None

    # Sample up to max_frames evenly
    frame_indices = np.linspace(0, total_frames - 1, min(max_frames, total_frames), dtype=int)

    all_keypoints = []
    all_angles = []
    detected_frames = 0

    for fi in frame_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(fi))
        ret, frame = cap.read()
        if not ret:
            continue

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose_model.process(frame_rgb)

        if results.pose_landmarks:
            lms = results.pose_landmarks.landmark
            # Extract key landmark coordinates (normalized)
            kp = []
            for idx in KEY_LANDMARKS:
                kp.extend([lms[idx].x, lms[idx].y])
            all_keypoints.append(kp)

            # Compute joint angles
            from pose_analyzer import landmarks_to_pose, compute_joint_angles
            landmarks = landmarks_to_pose(lms)
            angles = compute_joint_angles(landmarks)
            angle_vec = [
                angles.left_shoulder_abduction, angles.right_shoulder_abduction,
                angles.left_elbow, angles.right_elbow,
                angles.left_knee, angles.right_knee,
                angles.left_hip, angles.right_hip,
                angles.trunk_lean,
            ]
            all_angles.append(angle_vec)
            detected_frames += 1

    cap.release()

    if detected_frames < 5 or len(all_keypoints) < 5:
        logger.warning(f"Insufficient pose detections in {video_path.name}: {detected_frames}")
        return None

    kp_arr = np.array(all_keypoints)   # (N, 28)
    ang_arr = np.array(all_angles)      # (N, 9)

    # Statistical summary across frames
    kp_features = np.concatenate([
        kp_arr.mean(axis=0),
        kp_arr.std(axis=0),
        kp_arr.min(axis=0),
        kp_arr.max(axis=0),
    ])  # 28 * 4 = 112

    ang_features = np.concatenate([
        ang_arr.mean(axis=0),
        ang_arr.std(axis=0),
        ang_arr.max(axis=0) - ang_arr.min(axis=0),  # ROM
    ])  # 9 * 3 = 27

    # Temporal gradient features (movement smoothness)
    if len(kp_arr) > 1:
        diff = np.diff(kp_arr, axis=0)
        motion_features = np.concatenate([diff.mean(axis=0), diff.std(axis=0)])[:28]
    else:
        motion_features = np.zeros(28)

    feature_vector = np.concatenate([kp_features, ang_features, motion_features])
    return feature_vector.astype(np.float32)


def inspect_dataset():
    """Print dataset statistics without modifying anything."""
    print("\n=== Dataset Inspection ===")
    print(f"Zip file: {DATASET_ZIP}")
    print(f"Size: {DATASET_ZIP.stat().st_size / 1024 / 1024:.1f} MB")

    with zipfile.ZipFile(DATASET_ZIP) as zf:
        all_files = [f for f in zf.namelist() if not f.endswith("/")]
        print(f"Total video files: {len(all_files)}")
        print(f"File types: {set(f.rsplit('.', 1)[-1] for f in all_files)}")
        print()
        print("Categories:")
        for category, (exercise, label) in CATEGORY_MAP.items():
            count = sum(1 for f in all_files if f.startswith(category + "/"))
            print(f"  {category}: {count} videos [{exercise}={label}]")
    print()


def preprocess_dataset():
    """
    Full preprocessing pipeline:
    1. Extract zip
    2. Process all videos with MediaPipe
    3. Save features to disk
    """
    inspect_dataset()
    extract_zip_if_needed()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("Loading MediaPipe Pose model...")
    pose_model, mp_pose = get_pose_model()

    dataset = []  # list of (exercise_id, label, feature_vector)
    failed = 0

    for category_path, (exercise_id, label) in CATEGORY_MAP.items():
        video_dir = EXTRACTED_DIR / category_path
        if not video_dir.exists():
            logger.warning(f"Missing: {video_dir}")
            continue

        videos = list(video_dir.glob("*.mp4")) + list(video_dir.glob("*.mov"))
        logger.info(f"Processing {len(videos)} videos from {category_path}")

        for i, video_path in enumerate(videos):
            features = extract_video_features(video_path, pose_model, mp_pose)
            if features is not None:
                dataset.append({
                    "exercise_id": exercise_id,
                    "label": label,
                    "label_int": LABEL_MAP[label],
                    "video_path": str(video_path),
                    "features": features.tolist(),
                })
            else:
                failed += 1
            if (i + 1) % 10 == 0:
                logger.info(f"  Progress: {i+1}/{len(videos)}")

    pose_model.close()

    logger.info(f"Processed {len(dataset)} videos, {failed} failed")

    # Save
    output_path = PROCESSED_DIR / "features.json"
    with open(output_path, "w") as f:
        json.dump(dataset, f)
    logger.info(f"Features saved to {output_path}")

    # Save numpy arrays per exercise
    for exercise_id in ["arm_raise", "knee_extension", "sit_to_stand"]:
        exercise_data = [d for d in dataset if d["exercise_id"] == exercise_id]
        if not exercise_data:
            continue
        X = np.array([d["features"] for d in exercise_data])
        y = np.array([d["label_int"] for d in exercise_data])
        correct = sum(y)
        incorrect = len(y) - sum(y)
        logger.info(f"{exercise_id}: {len(y)} samples (correct={correct}, incorrect={incorrect}), feature_dim={X.shape[1]}")
        np.save(PROCESSED_DIR / f"{exercise_id}_X.npy", X)
        np.save(PROCESSED_DIR / f"{exercise_id}_y.npy", y)

    return dataset


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect-only", action="store_true")
    args = parser.parse_args()

    if args.inspect_only:
        inspect_dataset()
    else:
        preprocess_dataset()
