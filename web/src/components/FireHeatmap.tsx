'use client';

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Tooltip, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import "leaflet.heat";

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number; // 0..1
  sensorName: string;
  totalReadings: number;
  fireActivations: number;
}

interface HeatmapLayerProps {
  points: HeatmapPoint[];
}

function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();

  const heatPoints = useMemo(() => {
    if (!points || points.length === 0) {
      return [];
    }

    return points.map<[number, number, number]>((point) => [
      point.latitude,
      point.longitude,
      Math.max(0, Math.min(point.intensity, 1)),
    ]);
  }, [points]);

  useEffect(() => {
    if (!map || heatPoints.length === 0) {
      return;
    }

    const layer = L.heatLayer(heatPoints, {
      radius: 35,
      blur: 22,
      maxZoom: 13,
      minOpacity: 0.2,
      gradient: {
        0.0: "#0ea5e9",
        0.4: "#22c55e",
        0.7: "#f97316",
        1.0: "#ef4444",
      },
    });

    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, heatPoints]);

  return null;
}

interface FireHeatmapProps {
  points: HeatmapPoint[];
}

const DEFAULT_CENTER: LatLngTuple = [34.0689, -118.4452]; // UCLA campus

export function FireHeatmap({ points }: FireHeatmapProps) {
  const hasPoints = points.length > 0;

  const mapCenter: LatLngTuple = useMemo(() => {
    if (!hasPoints) {
      return DEFAULT_CENTER;
    }

    const latitude =
      points.reduce((total, point) => total + point.latitude, 0) / points.length;
    const longitude =
      points.reduce((total, point) => total + point.longitude, 0) / points.length;

    return [latitude, longitude];
  }, [hasPoints, points]);

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {hasPoints ? <HeatmapLayer points={points} /> : null}
      {points.map((point) => (
        <CircleMarker
          key={`${point.sensorName}-${point.latitude}-${point.longitude}`}
          center={[point.latitude, point.longitude]}
          radius={6}
          weight={1}
          pathOptions={{
            color: "#fbbf24",
            fillColor: "#f59e0b",
            fillOpacity: 0.7,
          }}
        >
          <Tooltip direction="top" offset={[0, -2]} opacity={0.9}>
            <div className="text-xs">
              <div className="font-semibold">{point.sensorName}</div>
              <div>Fire activations: {point.fireActivations}</div>
              <div>Total readings: {point.totalReadings}</div>
              <div>
                Likelihood:{" "}
                {(Math.max(0, Math.min(point.intensity, 1)) * 100).toFixed(1)}%
              </div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
