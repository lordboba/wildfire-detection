import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import {
  HOURLY_METRIC_FIELDS,
  type AirQualityRecord,
  type HourlyAverages,
  type HourlyMetricKey,
} from "@/types/airQuality";

const NUMERIC_FIELDS = new Set([
  "latitude",
  "longitude",
  "pm25",
  "pm10",
  "aqi",
  "temperature_f",
  "humidity_percent",
  "wind_speed_mph",
  "no2_ppb",
  "o3_ppb",
  "co_ppm",
]);

type RawRecord = Record<string, unknown>;

const DATA_FILE = path.join(
  process.cwd(),
  "..",
  "data",
  "UCLA_Air_Quality_Yearly_with_Fires.csv",
);

let cachedRecords: AirQualityRecord[] | null = null;
let cachedDates: string[] | null = null;
let cachedFileUpdatedAt = 0;

function loadFromDisk(): AirQualityRecord[] {
  const fileStats = fs.statSync(DATA_FILE);
  const updatedAt = fileStats.mtimeMs;

  if (cachedRecords && cachedFileUpdatedAt === updatedAt) {
    return cachedRecords;
  }

  const fileContents = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = Papa.parse<RawRecord>(fileContents, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: (field) => NUMERIC_FIELDS.has(field),
    transform: (value) => (typeof value === "string" ? value.trim() : value),
  });

  const records: AirQualityRecord[] = [];

  for (const entry of parsed.data) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const timestampRaw = String(entry.timestamp ?? "").trim();
    if (!timestampRaw) {
      continue;
    }

    const [datePart, timePart] = timestampRaw.split(" ");
    if (!datePart || !timePart) {
      continue;
    }

    const [hourPart] = timePart.split(":");
    const hour = Number.parseInt(hourPart ?? "", 10);
    if (Number.isNaN(hour)) {
      continue;
    }

    const record: AirQualityRecord = {
      sensor_id: String(entry.sensor_id ?? ""),
      sensor_name: String(entry.sensor_name ?? ""),
      latitude: Number(entry.latitude ?? 0),
      longitude: Number(entry.longitude ?? 0),
      timestamp: timestampRaw,
      date: datePart,
      hour,
      pm25: Number(entry.pm25 ?? 0),
      pm10: Number(entry.pm10 ?? 0),
      aqi: Number(entry.aqi ?? 0),
      temperature_f: Number(entry.temperature_f ?? 0),
      humidity_percent: Number(entry.humidity_percent ?? 0),
      wind_speed_mph: Number(entry.wind_speed_mph ?? 0),
      wind_direction: String(entry.wind_direction ?? ""),
      no2_ppb: Number(entry.no2_ppb ?? 0),
      o3_ppb: Number(entry.o3_ppb ?? 0),
      co_ppm: Number(entry.co_ppm ?? 0),
      status: String(entry.status ?? ""),
      alert_level: String(entry.alert_level ?? ""),
      fire_event_active: String(entry.fire_event_active ?? ""),
      fire_id: String(entry.fire_id ?? ""),
    };

    records.push(record);
  }

  records.sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return a.sensor_id.localeCompare(b.sensor_id);
    }
    return a.timestamp.localeCompare(b.timestamp);
  });

  cachedRecords = records;
  cachedFileUpdatedAt = updatedAt;
  cachedDates = null;

  return cachedRecords;
}

export function getAllRecords(): AirQualityRecord[] {
  return loadFromDisk();
}

export function getAvailableDates(): string[] {
  if (cachedDates) {
    return cachedDates;
  }

  const records = getAllRecords();
  const unique = new Set<string>();
  for (const row of records) {
    unique.add(row.date);
  }

  cachedDates = Array.from(unique).sort((a, b) => a.localeCompare(b));
  return cachedDates;
}

export function getRowsByDate(date: string): AirQualityRecord[] {
  const records = getAllRecords();
  return records.filter((row) => row.date === date);
}

export function getHourlyAverages(date: string): HourlyAverages[] {
  const rows = getRowsByDate(date);
  const accumulator = new Map<
    number,
    {
      count: number;
      totals: Record<HourlyMetricKey, number>;
    }
  >();

  for (const row of rows) {
    const existing =
      accumulator.get(row.hour) ??
      {
        count: 0,
        totals: {
          pm25: 0,
          pm10: 0,
          aqi: 0,
          temperature_f: 0,
          humidity_percent: 0,
          wind_speed_mph: 0,
          no2_ppb: 0,
          o3_ppb: 0,
          co_ppm: 0,
        },
      };

    existing.count += 1;
    for (const { key } of HOURLY_METRIC_FIELDS) {
      existing.totals[key] += row[key];
    }

    accumulator.set(row.hour, existing);
  }

  const result: HourlyAverages[] = [];

  for (const [hour, { count, totals }] of accumulator) {
    if (count === 0) {
      continue;
    }

    result.push({
      hour,
      label: `${hour.toString().padStart(2, "0")}:00`,
      pm25: totals.pm25 / count,
      pm10: totals.pm10 / count,
      aqi: totals.aqi / count,
      temperature_f: totals.temperature_f / count,
      humidity_percent: totals.humidity_percent / count,
      wind_speed_mph: totals.wind_speed_mph / count,
      no2_ppb: totals.no2_ppb / count,
      o3_ppb: totals.o3_ppb / count,
      co_ppm: totals.co_ppm / count,
    });
  }

  result.sort((a, b) => a.hour - b.hour);
  return result;
}
