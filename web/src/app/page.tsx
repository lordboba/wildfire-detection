'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  HOURLY_METRIC_FIELDS,
  type AirQualityRecord,
  type HourlyAverages,
  type HourlyMetricKey,
} from "@/types/airQuality";
import {
  FireHeatmap,
  type HeatmapPoint,
} from "@/components/FireHeatmap";

const METRIC_COLORS: Record<HourlyMetricKey, string> = {
  pm25: "#ef4444",
  pm10: "#f97316",
  aqi: "#22c55e",
  temperature_f: "#3b82f6",
  humidity_percent: "#6366f1",
  wind_speed_mph: "#14b8a6",
  no2_ppb: "#ec4899",
  o3_ppb: "#8b5cf6",
  co_ppm: "#facc15",
};

const DEFAULT_METRICS: HourlyMetricKey[] = [
  "pm25",
  "pm10",
  "aqi",
  "temperature_f",
];

const PAGE_SIZE_OPTIONS = [5, 10, 50] as const;

const MODEL_KEYS: HourlyMetricKey[] = HOURLY_METRIC_FIELDS.map(
  (field) => field.key,
);

interface AirQualityApiResponse {
  hourly: HourlyAverages[];
  rows: AirQualityRecord[];
}

type CopyStatus = "idle" | "success" | "error";

interface BackendPredictionRow {
  fire_event_active: string;
  fire_probability: number;
  fire_probabilities: Record<string, number>;
  alert_level: string;
  alert_confidence: number;
  alert_probabilities: Record<string, number>;
}

function buildModelPayload(row: AirQualityRecord) {
  const payloadRecord: Record<string, number> = {};
  for (const key of MODEL_KEYS) {
    payloadRecord[key] = Number(row[key]);
  }
  return { df_in: [payloadRecord] };
}

function formatNumber(value: number) {
  if (Number.isNaN(value)) {
    return "—";
  }

  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }

  return value.toFixed(1);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

const TABLE_COLUMNS: Array<{
  key: keyof AirQualityRecord | HourlyMetricKey;
  label: string;
  isNumeric?: boolean;
}> = [
  { key: "timestamp", label: "Timestamp" },
  { key: "sensor_name", label: "Sensor" },
  { key: "pm25", label: "PM2.5", isNumeric: true },
  { key: "pm10", label: "PM10", isNumeric: true },
  { key: "aqi", label: "AQI", isNumeric: true },
  { key: "temperature_f", label: "Temp (°F)", isNumeric: true },
  { key: "humidity_percent", label: "Humidity (%)", isNumeric: true },
  { key: "wind_speed_mph", label: "Wind (mph)", isNumeric: true },
  { key: "no2_ppb", label: "NO₂ (ppb)", isNumeric: true },
  { key: "o3_ppb", label: "O₃ (ppb)", isNumeric: true },
  { key: "co_ppm", label: "CO (ppm)", isNumeric: true },
  { key: "fire_event_active", label: "Fire Active" },
];

export default function DashboardPage() {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [hourlyData, setHourlyData] = useState<HourlyAverages[]>([]);
  const [rows, setRows] = useState<AirQualityRecord[]>([]);
  const [selectedRow, setSelectedRow] = useState<AirQualityRecord | null>(null);
  const [selectedMetrics, setSelectedMetrics] =
    useState<HourlyMetricKey[]>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [modelOutputText, setModelOutputText] = useState("");
  const [modelOutputError, setModelOutputError] = useState<string | null>(null);
  const [predictionPercent, setPredictionPercent] = useState<number | null>(
    null,
  );
  const [apiPrediction, setApiPrediction] = useState<BackendPredictionRow | null>(null);
  const [apiPredictionError, setApiPredictionError] = useState<string | null>(null);
  const [apiPredictionLoading, setApiPredictionLoading] = useState(false);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(
    PAGE_SIZE_OPTIONS[1],
  );
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadDates() {
      try {
        const response = await fetch("/api/air-quality/dates");
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = (await response.json()) as { dates?: string[] };
        if (!isMounted) {
          return;
        }

        const dates = data.dates ?? [];
        setAvailableDates(dates);

        if (dates.length > 0) {
          setSelectedDate((current) => current || dates[dates.length - 1]);
        }
      } catch (fetchError) {
        console.error(fetchError);
        if (isMounted) {
          setError("Unable to load available dates right now.");
        }
      }
    }

    loadDates();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setHourlyData([]);
      setRows([]);
      setSelectedRow(null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    async function loadDataForDate(date: string) {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/air-quality/by-date?date=${encodeURIComponent(date)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = (await response.json()) as AirQualityApiResponse;
        if (!isMounted) {
          return;
        }

        setHourlyData(data.hourly);
        setRows(data.rows);
        setSelectedRow((current) => current ?? data.rows[0] ?? null);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(fetchError);
        if (isMounted) {
          setError("Unable to load air quality data for that date.");
          setHourlyData([]);
          setRows([]);
          setSelectedRow(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDataForDate(selectedDate);

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [selectedDate]);

  useEffect(() => {
    if (!modelOutputText.trim()) {
      setPredictionPercent(null);
      setModelOutputError(null);
      return;
    }

    try {
      const parsed = JSON.parse(modelOutputText) as {
        df_out?: Array<Record<string, unknown>>;
      };

      const firstRow = parsed.df_out?.[0] ?? null;
      const predictionValue =
        firstRow && typeof firstRow.Prediction === "number"
          ? firstRow.Prediction
          : typeof firstRow?.Prediction === "string"
            ? Number.parseFloat(firstRow.Prediction)
            : NaN;

      if (firstRow == null || Number.isNaN(predictionValue)) {
        setPredictionPercent(null);
        setModelOutputError(
          "Could not find a numeric Prediction value in df_out.",
        );
        return;
      }

      const normalized = Math.min(Math.max(predictionValue, 0), 1);
      setPredictionPercent(normalized);
      setModelOutputError(null);
    } catch (parseError) {
      console.error(parseError);
      setPredictionPercent(null);
      setModelOutputError("Invalid JSON. Please paste the model output JSON.");
    }
  }, [modelOutputText]);

  useEffect(() => {
    setCopyStatus("idle");
    setApiPrediction(null);
    setApiPredictionError(null);
  }, [selectedRow]);

  useEffect(() => {
    setCurrentPage(0);
  }, [selectedDate, pageSize]);

  useEffect(() => {
    const maxPage = Math.max(
      0,
      Math.ceil(rows.length / pageSize) - 1,
    );
    setCurrentPage((existing) => Math.min(existing, maxPage));
  }, [rows, pageSize]);

  const modelInputJson = useMemo(() => {
    if (!selectedRow) {
      return "";
    }
    return JSON.stringify(buildModelPayload(selectedRow), null, 2);
  }, [selectedRow]);

  const heatmapPoints = useMemo<HeatmapPoint[]>(() => {
    if (!rows || rows.length === 0) {
      return [];
    }

    const sensorTotals = new Map<
      string,
      {
        latitude: number;
        longitude: number;
        sensorName: string;
        total: number;
        fireActivations: number;
      }
    >();

    for (const row of rows) {
      const key = row.sensor_id;
      const existing =
        sensorTotals.get(key) ??
        {
          latitude: row.latitude,
          longitude: row.longitude,
          sensorName: row.sensor_name,
          total: 0,
          fireActivations: 0,
        };

      existing.total += 1;

      const isActive =
        typeof row.fire_event_active === "string" &&
        row.fire_event_active.trim().toLowerCase() === "yes";

      if (isActive) {
        existing.fireActivations += 1;
      }

      sensorTotals.set(key, existing);
    }

    return Array.from(sensorTotals.values()).map((entry) => ({
      latitude: entry.latitude,
      longitude: entry.longitude,
      sensorName: entry.sensorName,
      totalReadings: entry.total,
      fireActivations: entry.fireActivations,
      intensity:
        entry.total === 0 ? 0 : Math.min(entry.fireActivations / entry.total, 1),
    }));
  }, [rows]);

  const fireProbabilityEntries = useMemo(() => {
    if (!apiPrediction) {
      return [];
    }

    return Object.entries(apiPrediction.fire_probabilities).sort(
      (a, b) => b[1] - a[1],
    );
  }, [apiPrediction]);

  const alertProbabilityEntries = useMemo(() => {
    if (!apiPrediction) {
      return [];
    }

    return Object.entries(apiPrediction.alert_probabilities).sort(
      (a, b) => b[1] - a[1],
    );
  }, [apiPrediction]);

  const handleToggleMetric = (metric: HourlyMetricKey) => {
    setSelectedMetrics((current) => {
      if (current.includes(metric)) {
        return current.filter((key) => key !== metric);
      }
      return [...current, metric];
    });
  };

  const handleSelectRow = (row: AirQualityRecord) => {
    setSelectedRow(row);
  };

  const handleCopyInput = async () => {
    if (!selectedRow) {
      return;
    }

    try {
      await navigator.clipboard.writeText(modelInputJson);
      setCopyStatus("success");
    } catch (clipboardError) {
      console.error(clipboardError);
      setCopyStatus("error");
    }
  };

  const isMetricSelected = (metric: HourlyMetricKey) =>
    selectedMetrics.includes(metric);

  const requestBackendPrediction = useCallback(async () => {
    if (!selectedRow) {
      return;
    }

    const backendBase =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

    const payload = buildModelPayload(selectedRow);

    try {
      setApiPredictionLoading(true);
      setApiPredictionError(null);

      const response = await fetch(`${backendBase}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Backend responded with status ${response.status}: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { df_out?: BackendPredictionRow[] };
      const firstRow = data.df_out?.[0];

      if (!firstRow) {
        throw new Error("Backend response did not include any predictions.");
      }

      setApiPrediction(firstRow);
    } catch (err) {
      console.error(err);
      setApiPrediction(null);
      setApiPredictionError(
        err instanceof Error ? err.message : "Failed to query backend model.",
      );
    } finally {
      setApiPredictionLoading(false);
    }
  }, [selectedRow]);

  const totalPages = rows.length === 0 ? 1 : Math.ceil(rows.length / pageSize);

  const pagedRows = useMemo(() => {
    const startIndex = currentPage * pageSize;
    return rows.slice(startIndex, startIndex + pageSize);
  }, [rows, currentPage, pageSize]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
        <header>
          <h1 className="text-3xl font-semibold">
            Wildfire Air Quality Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Explore hourly air quality trends and build copy-ready inputs for
            the predictive wildfire risk model.
          </p>
        </header>

        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-300">
                Select date
              </label>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              >
                <option value="" disabled>
                  Choose a date
                </option>
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {HOURLY_METRIC_FIELDS.map((metric) => (
                <label
                  key={metric.key}
                  className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-slate-100 focus:ring-slate-500"
                    checked={isMetricSelected(metric.key)}
                    onChange={() => handleToggleMetric(metric.key)}
                  />
                  <span>{metric.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 h-80 w-full rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading hourly averages…
              </div>
            ) : hourlyData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No hourly data available for the selected date.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData}>
                  <CartesianGrid stroke="#1f2233" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "none" }}
                    labelStyle={{ color: "#f8fafc" }}
                  />
                  <Legend />
                  {selectedMetrics.map((metricKey) => (
                    <Line
                      key={metricKey}
                      type="monotone"
                      dataKey={metricKey}
                      stroke={METRIC_COLORS[metricKey]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {error ? (
            <p className="mt-3 text-sm text-rose-400">{error}</p>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
          <header className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Fire likelihood heatmap</h2>
              <p className="mt-1 text-sm text-slate-300">
                Visualizes sensors on campus. Color intensity reflects the share
                of readings flagged as active fire events for the selected date.
              </p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
              {heatmapPoints.length} sensors
            </span>
          </header>
          <div className="mt-4 h-96 w-full overflow-hidden rounded-lg border border-slate-800">
            {heatmapPoints.length > 0 ? (
              <FireHeatmap points={heatmapPoints} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Select a date with sensor readings to view the heatmap.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Sensor readings</h2>
              <p className="mt-1 text-sm text-slate-300">
                Tap a row to prepare the model input payload.
              </p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
              {rows.length} rows
            </span>
          </header>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span>Rows per page</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                value={pageSize}
                onChange={(event) =>
                  setPageSize(
                    Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number],
                  )
                }
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span>
                Page {Math.min(currentPage + 1, totalPages)} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))}
                  disabled={currentPage === 0}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(page + 1, totalPages - 1))
                  }
                  disabled={currentPage >= totalPages - 1}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-900">
                  <tr>
                    {TABLE_COLUMNS.map((column) => (
                      <th
                        key={column.key as string}
                        className="px-3 py-2 font-medium uppercase tracking-wide text-slate-400"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pagedRows.map((row) => {
                    const isSelected = selectedRow?.timestamp === row.timestamp &&
                      selectedRow?.sensor_id === row.sensor_id;
                    return (
                      <tr
                        key={`${row.timestamp}-${row.sensor_id}`}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-slate-800/80"
                            : "hover:bg-slate-900"
                        }`}
                        onClick={() => handleSelectRow(row)}
                      >
                        {TABLE_COLUMNS.map((column) => {
                          const rawValue =
                            row[column.key as keyof AirQualityRecord];
                          const cellValue =
                            column.isNumeric && typeof rawValue === "number"
                              ? formatNumber(rawValue)
                              : rawValue ?? "—";

                          return (
                            <td
                              key={`${row.timestamp}-${row.sensor_id}-${String(column.key)}`}
                              className={`px-3 py-2 text-slate-200 ${
                                column.isNumeric
                                  ? "text-right font-mono text-xs"
                                  : ""
                              }`}
                            >
                              {cellValue as string}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Model input</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Copy this JSON into the wildfire model interface.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                  onClick={handleCopyInput}
                  disabled={!selectedRow}
                >
                  {copyStatus === "success"
                    ? "Copied!"
                    : copyStatus === "error"
                      ? "Copy failed"
                      : "Copy JSON"}
                </button>
              </div>

              <textarea
                className="mt-4 h-60 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                readOnly
                value={
                  selectedRow
                    ? modelInputJson
                    : "Select a sensor reading to generate the model input payload."
                }
              />
            </div>

            <div className="order-first rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Local inference</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Query the FastAPI model (default: http://localhost:8000/predict) for this row.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={requestBackendPrediction}
                  disabled={!selectedRow || apiPredictionLoading}
                >
                  {apiPredictionLoading ? "Requesting…" : "Query model"}
                </button>
              </div>

              {apiPredictionError ? (
                <p className="mt-3 text-sm text-rose-400">{apiPredictionError}</p>
              ) : apiPrediction ? (
                <div className="mt-4 space-y-4 text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Fire activity</p>
                    <p className="mt-1 text-lg font-semibold capitalize">
                      {apiPrediction.fire_event_active}
                    </p>
                    <p className="font-mono text-xs text-amber-200/90">
                      Confidence {formatPercent(apiPrediction.fire_probability)}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {fireProbabilityEntries.map(([label, probability]) => (
                        <li key={`fire-${label}`} className="flex justify-between border-b border-slate-800/60 pb-1">
                          <span className="capitalize">{label}</span>
                          <span className="font-mono text-amber-200/90">{formatPercent(probability)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Alert level</p>
                    <p className="mt-1 text-lg font-semibold capitalize">
                      {apiPrediction.alert_level.replace("_", " ")}
                    </p>
                    <p className="font-mono text-xs text-sky-200/90">
                      Confidence {formatPercent(apiPrediction.alert_confidence)}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {alertProbabilityEntries.map(([label, probability]) => (
                        <li key={`alert-${label}`} className="flex justify-between border-b border-slate-800/60 pb-1">
                          <span className="capitalize">{label.replace("_", " ")}</span>
                          <span className="font-mono text-sky-200/90">{formatPercent(probability)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  Select a row and click “Query model” to see predictions from the local API.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
              <h2 className="text-xl font-semibold">Model output</h2>
              <p className="mt-1 text-sm text-slate-300">
                Paste the JSON response from the model to view the predicted
                fire confidence.
              </p>

              <textarea
                className="mt-4 h-48 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder='{\n  "df_out": [\n    {\n      "Prediction": 0.42,\n      ...\n    }\n  ]\n}'
                value={modelOutputText}
                onChange={(event) => setModelOutputText(event.target.value)}
              />

              {modelOutputError ? (
                <p className="mt-2 text-sm text-rose-400">{modelOutputError}</p>
              ) : predictionPercent != null ? (
                <div className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-5 text-slate-100 shadow-inner shadow-amber-500/20">
                  <p className="text-xs uppercase tracking-wide text-amber-200/80">
                    Fire confidence
                  </p>
                  <p className="mt-2 text-4xl font-bold text-amber-200">
                    {formatPercent(predictionPercent)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
