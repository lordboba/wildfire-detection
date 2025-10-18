from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, Dict

from twilio.base.exceptions import TwilioException
from twilio.rest import Client

from .config import (
  FIRE_ALERT_THRESHOLD,
  TWILIO_FROM,
  TWILIO_SID,
  TWILIO_TOKEN,
  TWILIO_TO,
)

logger = logging.getLogger("wildfire.notifications")
if not logger.handlers:
  handler = logging.StreamHandler()
  formatter = logging.Formatter("[%(asctime)s] %(levelname)s %(message)s")
  handler.setFormatter(formatter)
  logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


@lru_cache(maxsize=1)
def get_twilio_client() -> Client | None:
  if not all([TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, TWILIO_TO]):
    logger.debug("Twilio configuration incomplete; alerts disabled.")
    return None

  try:
    return Client(TWILIO_SID, TWILIO_TOKEN)
  except Exception as exc:
    logger.error("Failed to initialise Twilio client: %s", exc)
    return None


def maybe_send_fire_alert(
  *,
  predicted_label: str,
  confidence: float,
  features: Dict[str, Any],
) -> bool:
  client = get_twilio_client()
  if client is None:
    return False

  is_fire = predicted_label.strip().lower() == "yes"

  if not is_fire:
    logger.debug("Twilio alert suppressed: predicted label is not 'yes'.")
    return False

  if confidence < FIRE_ALERT_THRESHOLD and confidence < 1.0:
    logger.debug(
      "Twilio alert suppressed: confidence %.3f below threshold %.3f.",
      confidence,
      FIRE_ALERT_THRESHOLD,
    )
    return False

  logger.info(
    "Triggering Twilio alert for fire label with confidence %.3f (threshold %.3f).",
    confidence,
    FIRE_ALERT_THRESHOLD,
  )

  body_lines = [
    "⚠️ Wildfire Alert",
    f"Confidence: {confidence:.1%}",
    f"PM2.5: {features.get('pm25')}, PM10: {features.get('pm10')}",
    f"AQI: {features.get('aqi')}, Temp (°F): {features.get('temperature_f')}",
    f"Humidity: {features.get('humidity_percent')}%, Wind: {features.get('wind_speed_mph')} mph",
    f"NO2: {features.get('no2_ppb')} ppb, O3: {features.get('o3_ppb')} ppb, CO: {features.get('co_ppm')} ppm",
  ]
  body = "\n".join(str(line) for line in body_lines)

  try:
    message = client.messages.create(body=body, from_=TWILIO_FROM, to=TWILIO_TO)
    logger.info("Sent Twilio alert message SID=%s", message.sid)
    return True
  except TwilioException as exc:
    logger.error("Failed to send Twilio alert: %s", exc)
    return False
