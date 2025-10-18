from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
  accuracy_score,
  classification_report,
  f1_score,
  precision_score,
  recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler

from ..config import ALERT_MODEL_PATH, ARTIFACT_DIR, FIRE_MODEL_PATH
from ..data import FEATURE_COLUMNS, load_dataset


@dataclass(slots=True)
class ClassifierArtifact:
  pipeline: Pipeline
  classes: List[str]

  def save(self, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
      {"pipeline": self.pipeline, "classes": self.classes},
      destination,
      compress=("xz", 3),
    )


def _build_fire_pipeline() -> Pipeline:
  return Pipeline(
    steps=[
      ("scaler", StandardScaler()),
      (
        "estimator",
        LogisticRegression(
          class_weight="balanced",
          max_iter=1000,
          multi_class="auto",
          solver="lbfgs",
        ),
      ),
    ],
  )


def _build_alert_pipeline() -> Pipeline:
  return Pipeline(
    steps=[
      ("scaler", StandardScaler()),
      (
        "estimator",
        LogisticRegression(
          class_weight="balanced",
          max_iter=1000,
          multi_class="multinomial",
          solver="lbfgs",
        ),
      ),
    ],
  )


def _compute_metrics(
  y_true: np.ndarray,
  y_pred: np.ndarray,
  average: str = "binary",
) -> Dict[str, float]:
  return {
    "accuracy": float(accuracy_score(y_true, y_pred)),
    "precision": float(precision_score(y_true, y_pred, average=average, zero_division=0)),
    "recall": float(recall_score(y_true, y_pred, average=average, zero_division=0)),
    "f1": float(f1_score(y_true, y_pred, average=average, zero_division=0)),
  }


def train_models(test_size: float = 0.2, random_state: int = 42) -> Dict[str, Dict[str, float]]:
  dataset = load_dataset()

  # Fire event model
  fire_encoder = LabelEncoder()
  y_fire = fire_encoder.fit_transform(dataset.fire_target)
  X_train, X_test, y_train, y_test = train_test_split(
    dataset.features,
    y_fire,
    test_size=test_size,
    random_state=random_state,
    stratify=y_fire,
  )

  fire_pipeline = _build_fire_pipeline()
  fire_pipeline.fit(X_train, y_train)
  y_pred_fire = fire_pipeline.predict(X_test)
  fire_metrics = _compute_metrics(y_test, y_pred_fire, average="binary")

  fire_artifact = ClassifierArtifact(
    pipeline=fire_pipeline,
    classes=fire_encoder.classes_.tolist(),
  )
  fire_artifact.save(FIRE_MODEL_PATH)

  # Alert level model
  alert_encoder = LabelEncoder()
  y_alert = alert_encoder.fit_transform(dataset.alert_target)
  X_train_a, X_test_a, y_train_a, y_test_a = train_test_split(
    dataset.features,
    y_alert,
    test_size=test_size,
    random_state=random_state,
    stratify=y_alert,
  )

  alert_pipeline = _build_alert_pipeline()
  alert_pipeline.fit(X_train_a, y_train_a)
  y_pred_alert = alert_pipeline.predict(X_test_a)
  alert_metrics = _compute_metrics(y_test_a, y_pred_alert, average="macro")

  alert_artifact = ClassifierArtifact(
    pipeline=alert_pipeline,
    classes=alert_encoder.classes_.tolist(),
  )
  alert_artifact.save(ALERT_MODEL_PATH)

  # Persist metrics for inspection
  metrics_manifest = {
    "feature_columns": FEATURE_COLUMNS,
    "fire_event_metrics": fire_metrics,
    "alert_level_metrics": alert_metrics,
    "alert_level_report": classification_report(
      y_test_a, y_pred_alert, target_names=alert_artifact.classes, zero_division=0
    ),
  }
  ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
  metrics_path = ARTIFACT_DIR / "metrics.json"
  metrics_path.write_text(json.dumps(metrics_manifest, indent=2))

  return {
    "fire_event": fire_metrics,
    "alert_level": alert_metrics,
  }


if __name__ == "__main__":
  metrics = train_models()
  print(json.dumps(metrics, indent=2))
