from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List

import joblib
import numpy as np
import pandas as pd
from pathlib import Path

from ..config import ALERT_MODEL_PATH, FIRE_MODEL_PATH
from ..data import FEATURE_COLUMNS


@dataclass(slots=True)
class PredictionResult:
  label: str
  confidence: float
  probabilities: Dict[str, float]


@dataclass(slots=True)
class LoadedClassifier:
  pipeline: object
  classes: List[str]

  def predict(self, payload: Dict[str, float]) -> PredictionResult:
    frame = pd.DataFrame([payload], columns=FEATURE_COLUMNS)
    probabilities = self.pipeline.predict_proba(frame)[0]

    if not isinstance(probabilities, np.ndarray):
      probabilities = np.array(probabilities, dtype=float)

    class_probs = {
      label: float(probabilities[index])
      for index, label in enumerate(self.classes)
    }
    best_index = int(np.argmax(probabilities))
    best_label = self.classes[best_index]
    best_confidence = float(probabilities[best_index])

    return PredictionResult(
      label=best_label,
      confidence=best_confidence,
      probabilities=class_probs,
    )


def _load_model(path: str) -> LoadedClassifier:
  model_path = Path(path)
  if not model_path.exists():
    raise FileNotFoundError(
      f"Model artifact not found at {model_path}. Run the training script to generate it."
    )

  artifact = joblib.load(model_path)
  return LoadedClassifier(
    pipeline=artifact["pipeline"],
    classes=list(artifact["classes"]),
  )


@lru_cache(maxsize=1)
def get_fire_classifier() -> LoadedClassifier:
  return _load_model(str(FIRE_MODEL_PATH))


@lru_cache(maxsize=1)
def get_alert_classifier() -> LoadedClassifier:
  return _load_model(str(ALERT_MODEL_PATH))
