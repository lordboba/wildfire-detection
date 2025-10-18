from __future__ import annotations

from dataclasses import dataclass
from typing import List

import pandas as pd

from .config import DATA_FILE


FEATURE_COLUMNS: List[str] = [
  "pm25",
  "pm10",
  "aqi",
  "temperature_f",
  "humidity_percent",
  "wind_speed_mph",
  "no2_ppb",
  "o3_ppb",
  "co_ppm",
]


@dataclass(slots=True)
class Dataset:
  features: pd.DataFrame
  fire_target: pd.Series
  alert_target: pd.Series


def load_dataset() -> Dataset:
  data = pd.read_csv(DATA_FILE)

  features = data[FEATURE_COLUMNS].copy()
  fire_target = data["fire_event_active"].fillna("no").str.strip().str.lower()
  alert_target = data["alert_level"].fillna("unknown").str.strip().str.lower()

  return Dataset(features=features, fire_target=fire_target, alert_target=alert_target)
