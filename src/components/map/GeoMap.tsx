import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HotspotPoint } from "../../lib/dashboard";
import { Icon } from "../Icon";

type GeoMapProps = {
  points: HotspotPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number | string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  emptyLabel?: string;
  overlayTop?: number;
  showSelectedOverlay?: boolean;
  showSelectedTooltip?: boolean;
};

const DEFAULT_BOUNDS = L.latLngBounds(
  [12.85, 77.48],
  [13.08, 77.72],
);
const WORLD_BOUNDS = L.latLngBounds(
  [-85, -180],
  [85, 180],
);
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export function GeoMap(props: GeoMapProps) {
  const overlayTop = props.overlayTop ?? 20;
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const lastBoundsKeyRef = useRef("");
  const [selectedId, setSelectedId] = useState<string | null>(props.selectedId ?? props.points[0]?.id ?? null);

  useEffect(() => {
    setSelectedId(props.selectedId ?? props.points[0]?.id ?? null);
  }, [props.points, props.selectedId]);

  const selectedPoint =
    props.points.find((point) => point.id === selectedId) ?? props.points[0] ?? null;

  useEffect(() => {
    if (!mapHostRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapHostRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      worldCopyJump: false,
      maxBounds: WORLD_BOUNDS,
      maxBoundsViscosity: 0.2,
      minZoom: 2,
      maxZoom: 19,
      preferCanvas: true,
    });

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      minZoom: 2,
      subdomains: ["a", "b", "c"],
      noWrap: true,
    }).addTo(map);

    const markers = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersRef.current = markers;

    const syncDataset = () => {
      if (!mapHostRef.current) {
        return;
      }
      mapHostRef.current.dataset.zoom = String(map.getZoom());
      const center = map.getCenter();
      mapHostRef.current.dataset.center = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
    };
    map.on("zoomend moveend load", syncDataset);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize(false);
    });
    resizeObserver.observe(mapHostRef.current);

    return () => {
      resizeObserver.disconnect();
      map.off("zoomend moveend load", syncDataset);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) {
      return;
    }

    markers.clearLayers();

    const bounds = boundsForPoints(props.points);
    const boundsKey = serializeBounds(bounds);
    const paddedBounds = bounds.pad(props.compact ? 0.4 : 0.55);

    window.requestAnimationFrame(() => {
      map.invalidateSize(false);

      if (lastBoundsKeyRef.current !== boundsKey) {
        map.fitBounds(bounds, {
          padding: props.compact ? [20, 20] : [34, 34],
          maxZoom: props.compact ? 15 : 16,
          animate: false,
        });
        lastBoundsKeyRef.current = boundsKey;
      }

      if (selectedPoint) {
        const selectedLatLng = L.latLng(selectedPoint.latitude, selectedPoint.longitude);
        const currentBounds = map.getBounds();
        if (!currentBounds.pad(-0.18).contains(selectedLatLng)) {
          map.panTo(selectedLatLng, { animate: false });
        }
      }
    });

    props.points.forEach((point) => {
      const tone = toneFor(point.severity);
      const isSelected = point.id === selectedPoint?.id;
      const radius = markerRadius(point.weight, isSelected);

      const marker = isSelected
        ? L.marker([point.latitude, point.longitude], {
            icon: buildPulseMarkerIcon(radius),
            keyboard: false,
          })
        : L.circleMarker([point.latitude, point.longitude], {
            radius,
            color: tone.stroke,
            weight: 1.6,
            fillColor: tone.fill,
            fillOpacity: 0.88,
          });

      marker.on("click", () => {
        setSelectedId(point.id);
        props.onSelect?.(point.id);
      });

      marker.bindTooltip(buildTooltip(point), {
        permanent: isSelected && props.showSelectedTooltip !== false,
        direction: "top",
        offset: [0, isSelected ? -18 : -10],
        className: isSelected ? "lg-map-tooltip lg-map-tooltip-active" : "lg-map-tooltip",
        opacity: 1,
      });

      marker.addTo(markers);
      if (isSelected && "bringToFront" in marker && typeof marker.bringToFront === "function") {
        marker.bringToFront();
      }
    });
  }, [props.compact, props.onSelect, props.points, props.showSelectedTooltip, selectedPoint]);

  const containerHeight = useMemo(() => props.height ?? 420, [props.height]);

  function zoomIn() {
    mapRef.current?.zoomIn();
  }

  function zoomOut() {
    mapRef.current?.zoomOut();
  }

  function resetView() {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    map.fitBounds(boundsForPoints(props.points), {
      padding: props.compact ? [18, 18] : [30, 30],
      maxZoom: props.compact ? 15 : 16,
      animate: false,
    });
  }

  return (
    <div
      className="lg-map-shell"
      style={{
        height: containerHeight,
      }}
    >
      <div className="lg-map-viewport">
        <div ref={mapHostRef} className="lg-map-canvas" />
      </div>

      {props.title ? (
        <div
          className="lg-map-overlay lg-map-heading"
          style={{ maxWidth: props.compact ? 220 : 320, top: overlayTop }}
        >
          <div style={{ fontSize: props.compact ? 12 : 13, fontWeight: 700, lineHeight: 1.2 }}>{props.title}</div>
          {props.subtitle ? (
            <div className="lg-subtitle" style={{ fontSize: 10, lineHeight: "15px" }}>
              {props.subtitle}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="lg-map-overlay lg-map-toolbar" style={{ top: overlayTop }}>
        <MapControlButton label="Zoom in" onClick={zoomIn} icon="add_circle" />
        <MapControlButton label="Zoom out" onClick={zoomOut} icon="remove_circle" />
        <MapControlButton label="Reset view" onClick={resetView} icon="my_location" />
      </div>

      {!props.points.length ? (
        <div className="lg-map-empty">
          <div>
            <div className="lg-kicker">No mapped records</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>
              {props.emptyLabel ?? "No hotspot coordinates match the current filter set."}
            </div>
          </div>
        </div>
      ) : null}

      {selectedPoint && props.showSelectedOverlay !== false ? (
        <div
          className="lg-map-overlay lg-map-selected"
          style={{
            left: props.compact ? "auto" : 14,
            right: props.compact ? 14 : "auto",
            maxWidth: props.compact ? 240 : 320,
          }}
        >
          <div className="lg-kicker" style={{ fontSize: 9, lineHeight: "12px" }}>Selected marker</div>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{selectedPoint.label}</div>
          {selectedPoint.meta ? (
            <div className="lg-subtitle" style={{ fontSize: 10, lineHeight: "15px" }}>
              {selectedPoint.meta}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="lg-map-overlay lg-map-attribution">
        © OSM
      </div>
    </div>
  );
}

function MapControlButton(props: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      aria-label={props.label}
      style={{
        width: 34,
        height: 34,
        border: "1px solid var(--lg-outline-variant)",
        background: "var(--lg-surface-container)",
        display: "grid",
        placeItems: "center",
        color: "var(--lg-text)",
        cursor: "pointer",
      }}
    >
      <Icon name={props.icon} size={16} color="var(--lg-text)" />
    </button>
  );
}

function boundsForPoints(points: HotspotPoint[]) {
  if (!points.length) {
    return DEFAULT_BOUNDS;
  }

  if (points.length === 1) {
    const point = points[0];
    return L.latLngBounds(
      [point.latitude - 0.014, point.longitude - 0.02],
      [point.latitude + 0.014, point.longitude + 0.02],
    );
  }

  return L.latLngBounds(points.map((point) => [point.latitude, point.longitude] as [number, number])).pad(0.16);
}

function serializeBounds(bounds: L.LatLngBounds) {
  return [
    bounds.getSouth().toFixed(4),
    bounds.getWest().toFixed(4),
    bounds.getNorth().toFixed(4),
    bounds.getEast().toFixed(4),
  ].join(":");
}

function buildTooltip(point: HotspotPoint) {
  return `
    <div class="lg-map-tooltip-body">
      <div class="lg-map-tooltip-title">${escapeHtml(point.label)}</div>
      ${point.meta ? `<div class="lg-map-tooltip-meta">${escapeHtml(point.meta)}</div>` : ""}
    </div>
  `;
}

function markerRadius(weight: number, isSelected: boolean) {
  const clamped = Math.max(5, Math.min(15, 5 + weight / 16));
  return isSelected ? clamped + 2 : clamped;
}

function buildPulseMarkerIcon(radius: number) {
  const size = Math.max(22, Math.round(radius * 2 + 10));
  const dotSize = Math.max(10, Math.round(radius * 1.18));

  return L.divIcon({
    className: "lg-map-pulse-icon",
    html: `
      <span
        class="lg-map-pulse-marker"
        style="width:${size}px;height:${size}px;--lg-pulse-dot:${dotSize}px;"
      ></span>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  });
}

function toneFor(severity: HotspotPoint["severity"]) {
  if (severity === "critical") {
    return { fill: "#ff8d80", stroke: "#ffb4aa" };
  }
  if (severity === "high") {
    return { fill: "#ffcf70", stroke: "#ffd79b" };
  }
  if (severity === "info") {
    return { fill: "#7bc4ff", stroke: "#b8c3ff" };
  }
  return { fill: "#b8c3ff", stroke: "#d5dbff" };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
