export interface AirQualityRecord {
  sensor_id: string;
  sensor_name: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  date: string;
  hour: number;
  pm25: number;
  pm10: number;
  aqi: number;
  temperature_f: number;
  humidity_percent: number;
  wind_speed_mph: number;
  wind_direction: string;
  no2_ppb: number;
  o3_ppb: number;
  co_ppm: number;
  status: string;
  alert_level: string;
  fire_event_active: string;
  fire_id: string;
}

export interface HourlyAverages {
  hour: number;
  label: string;
  pm25: number;
  pm10: number;
  aqi: number;
  temperature_f: number;
  humidity_percent: number;
  wind_speed_mph: number;
  no2_ppb: number;
  o3_ppb: number;
  co_ppm: number;
}

export const HOURLY_METRIC_FIELDS = [
  { key: "pm25", label: "PM2.5 (µg/m³)" },
  { key: "pm10", label: "PM10 (µg/m³)" },
  { key: "aqi", label: "AQI" },
  { key: "temperature_f", label: "Temperature (°F)" },
  { key: "humidity_percent", label: "Humidity (%)" },
  { key: "wind_speed_mph", label: "Wind Speed (mph)" },
  { key: "no2_ppb", label: "NO₂ (ppb)" },
  { key: "o3_ppb", label: "O₃ (ppb)" },
  { key: "co_ppm", label: "CO (ppm)" },
] as const;

export type HourlyMetricKey = (typeof HOURLY_METRIC_FIELDS)[number]["key"];
