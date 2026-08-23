"""
Model training script for RehabVision form classification.

Trains a separate binary classifier (Correct vs Incorrect) per exercise.
Uses Random Forest — fast to train, interpretable, works well with small datasets.
Falls back to rule-based if insufficient data.

Important: Split is at the VIDEO level, not frame level, to prevent data leakage.
"""
import json
import logging
import pickle
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use('Agg')  # non-interactive backend
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score,
    precision_score, recall_score, f1_score
)
from sklearn.pipeline import Pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROCESSED_DIR = Path(__file__).parent.parent / "processed"
MODELS_DIR = Path(__file__).parent.parent.parent / "ai_service" / "models_trained"

EXERCISES = ["arm_raise", "knee_extension", "sit_to_stand"]
RANDOM_STATE = 42
MIN_SAMPLES_TO_TRAIN = 20
TEST_SPLIT = 0.2


def load_exercise_data(exercise_id: str):
    X_path = PROCESSED_DIR / f"{exercise_id}_X.npy"
    y_path = PROCESSED_DIR / f"{exercise_id}_y.npy"
    if not X_path.exists() or not y_path.exists():
        logger.warning(f"No processed data for {exercise_id}")
        return None, None
    X = np.load(X_path)
    y = np.load(y_path)
    return X, y


def train_exercise_classifier(exercise_id: str, X: np.ndarray, y: np.ndarray) -> dict:
    """Train and evaluate a classifier for one exercise."""
    logger.info(f"\n{'='*50}")
    logger.info(f"Training classifier for: {exercise_id}")
    logger.info(f"Samples: {len(y)} (correct={sum(y)}, incorrect={len(y)-sum(y)})")
    logger.info(f"Feature dim: {X.shape[1]}")

    if len(y) < MIN_SAMPLES_TO_TRAIN:
        logger.warning(f"Insufficient data ({len(y)} < {MIN_SAMPLES_TO_TRAIN}). Skipping training.")
        return {"status": "insufficient_data", "exercise_id": exercise_id}

    # Stratified train/test split (at video level — indices are video-level)
    np.random.seed(RANDOM_STATE)
    n = len(y)
    indices = np.random.permutation(n)
    test_size = max(2, int(n * TEST_SPLIT))
    test_idx = indices[:test_size]
    train_idx = indices[test_size:]

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    # Check for NaN/Inf in features
    X_train = np.nan_to_num(X_train, nan=0.0, posinf=0.0, neginf=0.0)
    X_test = np.nan_to_num(X_test, nan=0.0, posinf=0.0, neginf=0.0)

    logger.info(f"Train: {len(X_train)}, Test: {len(X_test)}")

    # Build pipeline: StandardScaler + RandomForest
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=3,
            class_weight="balanced",
            random_state=RANDOM_STATE,
        ))
    ])

    # Cross-validation on training set
    if len(X_train) >= 5:
        cv = StratifiedKFold(n_splits=min(5, len(X_train) // 2), shuffle=True, random_state=RANDOM_STATE)
        cv_scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="f1_weighted")
        logger.info(f"CV F1 scores: {cv_scores.round(3)} | Mean: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    # Train final model
    pipeline.fit(X_train, y_train)

    # Evaluate on held-out test set
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    rec = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    cm = confusion_matrix(y_test, y_pred)

    logger.info(f"\nTest Results:")
    logger.info(f"  Accuracy:  {acc:.3f}")
    logger.info(f"  Precision: {prec:.3f}")
    logger.info(f"  Recall:    {rec:.3f}")
    logger.info(f"  F1:        {f1:.3f}")
    logger.info(f"  Confusion Matrix:\n{cm}")
    logger.info(f"\n{classification_report(y_test, y_pred, target_names=['incorrect','correct'], zero_division=0)}")

    # Plot confusion matrix
    _plot_confusion_matrix(cm, exercise_id)

    result = {
        "status": "trained",
        "exercise_id": exercise_id,
        "n_train": len(X_train),
        "n_test": len(X_test),
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "confusion_matrix": cm.tolist(),
        "feature_dim": X.shape[1],
        "model_type": "RandomForest(StandardScaler)",
    }

    # Save model
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / f"{exercise_id}_classifier.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(pipeline, f)
    logger.info(f"Model saved: {model_path}")

    return result


def _plot_confusion_matrix(cm: np.ndarray, exercise_id: str):
    """Save confusion matrix plot."""
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(cm, interpolation='nearest', cmap='Blues')
    plt.colorbar(im)
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(['Incorrect', 'Correct'])
    ax.set_yticklabels(['Incorrect', 'Correct'])
    ax.set_ylabel('True label')
    ax.set_xlabel('Predicted label')
    ax.set_title(f'Confusion Matrix — {exercise_id.replace("_", " ").title()}')
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, str(cm[i, j]), ha='center', va='center', fontsize=14,
                    color='white' if cm[i, j] > cm.max() / 2 else 'black')
    plt.tight_layout()
    out = MODELS_DIR / f"{exercise_id}_confusion_matrix.png"
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    plt.savefig(out, dpi=100)
    plt.close()
    logger.info(f"Confusion matrix plot saved: {out}")


def train_all():
    """Train classifiers for all exercises and save a metrics report."""
    results = []
    for exercise_id in EXERCISES:
        X, y = load_exercise_data(exercise_id)
        if X is None:
            results.append({"exercise_id": exercise_id, "status": "no_data"})
            continue
        result = train_exercise_classifier(exercise_id, X, y)
        results.append(result)

    # Save metrics report
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = MODELS_DIR / "metrics_report.json"
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)
    logger.info(f"\nMetrics report saved: {report_path}")

    print("\n=== TRAINING SUMMARY ===")
    for r in results:
        eid = r["exercise_id"]
        status = r.get("status", "unknown")
        if status == "trained":
            print(f"  {eid}: acc={r['accuracy']:.3f} f1={r['f1']:.3f} "
                  f"(n_train={r['n_train']}, n_test={r['n_test']})")
        else:
            print(f"  {eid}: {status}")

    return results


if __name__ == "__main__":
    if not PROCESSED_DIR.exists():
        print("ERROR: Run preprocess_dataset.py first")
        sys.exit(1)
    train_all()
