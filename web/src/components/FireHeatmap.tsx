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

function HeatmapLegend() {
  const map = useMap();

  useEffect(() => {
    if (!map) {
      return;
    }

    const legendControl = L.control({ position: "bottomright" });

    legendControl.onAdd = () => {
      const container = L.DomUtil.create("div", "heatmap-legend");
      container.style.background = "rgba(15, 23, 42, 0.85)";
      container.style.borderRadius = "0.5rem";
      container.style.boxShadow = "0 14px 30px rgba(15, 23, 42, 0.35)";
      container.style.color = "#f8fafc";
      container.style.fontSize = "0.75rem";
      container.style.lineHeight = "1.15";
      container.style.minWidth = "160px";
      container.style.padding = "0.75rem 0.85rem";

      const title = L.DomUtil.create("div", "heatmap-legend-title", container);
      title.textContent = "Fire likelihood";
      title.style.fontWeight = "600";
      title.style.marginBottom = "0.45rem";

      const gradientRow = L.DomUtil.create("div", "heatmap-legend-row", container);
      gradientRow.style.display = "flex";
      gradientRow.style.alignItems = "center";
      gradientRow.style.gap = "0.4rem";

      const lowLabel = L.DomUtil.create("div", "heatmap-legend-low", gradientRow);
      lowLabel.textContent = "Low";
      lowLabel.style.fontSize = "0.7rem";
      lowLabel.style.fontWeight = "500";

      const gradientBar = L.DomUtil.create("div", "heatmap-legend-bar", gradientRow);
      gradientBar.style.flexGrow = "1";
      gradientBar.style.height = "10px";
      gradientBar.style.borderRadius = "9999px";
      gradientBar.style.background =
        "linear-gradient(90deg, #0ea5e9 0%, #22c55e 40%, #f97316 70%, #ef4444 100%)";

      const highLabel = L.DomUtil.create("div", "heatmap-legend-high", gradientRow);
      highLabel.textContent = "High";
      highLabel.style.fontSize = "0.7rem";
      highLabel.style.fontWeight = "500";

      const tickRow = L.DomUtil.create("div", "heatmap-legend-ticks", container);
      tickRow.style.display = "flex";
      tickRow.style.justifyContent = "space-between";
      tickRow.style.marginTop = "0.4rem";
      tickRow.style.fontSize = "0.65rem";
      tickRow.style.opacity = "0.8";

      ["0%", "25%", "50%", "75%", "100%"].forEach((labelText) => {
        const tick = L.DomUtil.create("span", "heatmap-legend-tick", tickRow);
        tick.textContent = labelText;
      });

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      return container;
    };

    legendControl.addTo(map);

    return () => {
      legendControl.remove();
    };
  }, [map]);

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
      {hasPoints ? (
        <>
          <HeatmapLayer points={points} />
          <HeatmapLegend />
        </>
      ) : null}
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
