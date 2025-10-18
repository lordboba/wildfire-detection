from __future__ import annotations

import os
from pathlib import Path
from typing import Final

PROJECT_ROOT: Final[Path] = Path(__file__).resolve().parent.parent
DATA_FILE: Final[Path] = PROJECT_ROOT / "data" / "UCLA_Air_Quality_Yearly_with_Fires.csv"
ARTIFACT_DIR: Final[Path] = PROJECT_ROOT / "backend" / "artifacts"
FIRE_MODEL_PATH: Final[Path] = ARTIFACT_DIR / "fire_event_model.joblib"
ALERT_MODEL_PATH: Final[Path] = ARTIFACT_DIR / "alert_level_model.joblib"

FIRE_ALERT_THRESHOLD: Final[float] = float(os.getenv("FIRE_ALERT_THRESHOLD", "0.8"))
TWILIO_SID: Final[str | None] = os.getenv("TWILIO_SID")
TWILIO_TOKEN: Final[str | None] = os.getenv("TWILIO_TOKEN")
TWILIO_FROM: Final[str | None] = os.getenv("TWILIO_FROM")
TWILIO_TO: Final[str | None] = os.getenv("TWILIO_TO")
