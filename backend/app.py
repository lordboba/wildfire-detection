from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models.predictor import get_alert_classifier, get_fire_classifier
from .schemas import (
  BatchPredictionPayload,
  BatchPredictionResponse,
  PredictionRow,
  SensorFeatures,
)
from .notifications import maybe_send_fire_alert

app = FastAPI(
  title="Wildfire Predictor API",
  version="1.0.0",
  description=(
    "Predicts fire activity and air quality alert level using campus sensor readings."
  ),
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:3000", "https://localhost:3000"],
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.on_event("startup")
def preload_models() -> None:
  get_fire_classifier()
  get_alert_classifier()


@app.get("/health")
def healthcheck() -> dict[str, str]:
  return {"status": "ok"}


def _predict_row(features: SensorFeatures) -> PredictionRow:
  feature_map = features.model_dump()
  fire_result = get_fire_classifier().predict(feature_map)
  alert_result = get_alert_classifier().predict(feature_map)

  prediction = PredictionRow(
    fire_event_active=fire_result.label,
    fire_probability=fire_result.confidence,
    fire_probabilities=fire_result.probabilities,
    alert_level=alert_result.label,
    alert_confidence=alert_result.confidence,
    alert_probabilities=alert_result.probabilities,
  )

  maybe_send_fire_alert(
    predicted_label=prediction.fire_event_active,
    confidence=prediction.fire_probability,
    features=feature_map,
  )

  return prediction


@app.post("/predict", response_model=BatchPredictionResponse)
def predict_batch(payload: BatchPredictionPayload) -> BatchPredictionResponse:
  if not payload.df_in:
    raise HTTPException(status_code=400, detail="df_in must contain at least one record.")

  predictions = [_predict_row(row) for row in payload.df_in]
  return BatchPredictionResponse(df_out=predictions)
