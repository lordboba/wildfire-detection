from __future__ import annotations

from typing import Dict

from pydantic import BaseModel, Field, field_validator


class SensorFeatures(BaseModel):
  pm25: float = Field(..., description="Particulate matter 2.5µm concentration")
  pm10: float = Field(..., description="Particulate matter 10µm concentration")
  aqi: float = Field(..., description="Air Quality Index")
  temperature_f: float = Field(..., description="Temperature in Fahrenheit")
  humidity_percent: float = Field(..., description="Relative humidity percent")
  wind_speed_mph: float = Field(..., description="Wind speed in miles per hour")
  no2_ppb: float = Field(..., description="Nitrogen dioxide in ppb")
  o3_ppb: float = Field(..., description="Ozone in ppb")
  co_ppm: float = Field(..., description="Carbon monoxide in ppm")

  @field_validator("*", mode="before")
  def ensure_float(cls, value):
    if value is None:
      raise ValueError("Feature values cannot be null")
    return float(value)


class BatchPredictionPayload(BaseModel):
  df_in: list[SensorFeatures]


class PredictionRow(BaseModel):
  fire_event_active: str = Field(..., description="Predicted fire activity label")
  fire_probability: float = Field(..., description="Confidence that a fire is active (0-1)")
  fire_probabilities: Dict[str, float] = Field(..., description="Probability distribution across fire labels")
  alert_level: str = Field(..., description="Predicted air quality alert level")
  alert_confidence: float = Field(..., description="Confidence for predicted alert level (0-1)")
  alert_probabilities: Dict[str, float] = Field(..., description="Probability distribution across alert classes")


class BatchPredictionResponse(BaseModel):
  df_out: list[PredictionRow]
