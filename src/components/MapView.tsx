import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import type { PolygonData } from "../services/kmzLoader";
import type { GpsPoint } from "../services/supabase";
import "leaflet/dist/leaflet.css";

export interface TrackData {
  sessionId: string;
  points: GpsPoint[];
  color: string;
  label: string;
}

interface Props {
  polygons: PolygonData[];
  points: GpsPoint[];
  cursorIndex: number;
  liveMode: boolean;
  multiTracks?: TrackData[];
}

function FitBounds({ points }: { points: GpsPoint[] }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (points.length < 2 || didFit.current) return;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40] }
    );
    didFit.current = true;
  }, [points, map]);

  useEffect(() => { didFit.current = false; }, []);
  return null;
}

function LiveFollow({ points, index, liveMode }: { points: GpsPoint[]; index: number; liveMode: boolean }) {
  const map = useMap();
  const [following, setFollowing] = useState(true);
  const userDragged = useRef(false);

  // Detect user manually moving/zooming the map
  useMapEvents({
    dragstart: () => { if (liveMode) { userDragged.current = true; setFollowing(false); } },
    zoomstart: () => { if (liveMode) { userDragged.current = true; setFollowing(false); } },
  });

  // Reset follow when entering live mode
  useEffect(() => {
    if (liveMode) { setFollowing(true); userDragged.current = false; }
  }, [liveMode]);

  // Pan to current point only if following
  useEffect(() => {
    if (!following && liveMode) return;
    const p = points[index];
    if (!p) return;
    if (liveMode) {
      // In live mode: pan without changing zoom
      map.panTo([p.lat, p.lng], { animate: true, duration: 0.4 });
    } else {
      // In replay mode (slider): always pan
      map.panTo([p.lat, p.lng], { animate: true, duration: 0.3 });
    }
  }, [index, points, map, following, liveMode]);

  // Show "re-center" button when not following in live mode
  if (liveMode && !following) {
    return (
      <div
        style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 8, padding: "8px 16px", cursor: "pointer",
          color: "#4A90E2", fontSize: 13, fontWeight: 600,
          boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        }}
        onClick={() => { setFollowing(true); userDragged.current = false; }}
      >
        Volver a seguir
      </div>
    );
  }
  return null;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function splitAtJumps(coords: [number, number][], maxGapM = 200): [number, number][][] {
  if (coords.length < 2) return coords.length ? [coords] : [];
  const segments: [number, number][][] = [];
  let seg: [number, number][] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const dist = haversine(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    if (dist > maxGapM) {
      if (seg.length > 1) segments.push(seg);
      seg = [coords[i]];
    } else {
      seg.push(coords[i]);
    }
  }
  if (seg.length > 1) segments.push(seg);
  return segments;
}

interface OfflineSegment {
  coords: [number, number][];
  offline: boolean;
}

function splitByOffline(points: GpsPoint[]): OfflineSegment[] {
  if (points.length === 0) return [];
  const segments: OfflineSegment[] = [];
  let current: OfflineSegment = { coords: [[points[0].lat, points[0].lng]], offline: !!points[0].offline };
  for (let i = 1; i < points.length; i++) {
    const isOff = !!points[i].offline;
    const dist = haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    if (dist > 200) {
      if (current.coords.length > 1) segments.push(current);
      current = { coords: [[points[i].lat, points[i].lng]], offline: isOff };
    } else if (isOff !== current.offline) {
      current.coords.push([points[i].lat, points[i].lng]);
      segments.push(current);
      current = { coords: [[points[i].lat, points[i].lng]], offline: isOff };
    } else {
      current.coords.push([points[i].lat, points[i].lng]);
    }
  }
  if (current.coords.length > 1) segments.push(current);
  return segments;
}

function FitMultiBounds({ tracks }: { tracks: TrackData[] }) {
  const map = useMap();
  const didFit = useRef(false);
  const trackKey = tracks.map((t) => t.sessionId).join(",");
  useEffect(() => { didFit.current = false; }, [trackKey]);
  useEffect(() => {
    if (didFit.current) return;
    const allPts = tracks.flatMap((t) => t.points);
    if (allPts.length < 2) return;
    const lats = allPts.map((p) => p.lat);
    const lngs = allPts.map((p) => p.lng);
    map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], { padding: [40, 40] });
    didFit.current = true;
  }, [tracks, map]);
  return null;
}

export default function MapView({ polygons, points, cursorIndex: rawIdx, liveMode, multiTracks }: Props) {
  const isMulti = multiTracks && multiTracks.length > 0 && points.length === 0;

  const cursorIndex = Math.min(rawIdx, Math.max(0, points.length - 1));
  const trackCoords = points.map((p) => [p.lat, p.lng] as [number, number]);
  const walkedCoords = trackCoords.slice(0, cursorIndex + 1);
  const remainingCoords = trackCoords.slice(cursorIndex);
  const walkedSegments = splitAtJumps(walkedCoords);
  const remainingSegments = splitAtJumps(remainingCoords);
  const walkedPoints = points.slice(0, cursorIndex + 1);
  const offlineSegments = splitByOffline(walkedPoints);
  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : multiTracks && multiTracks.length > 0 && multiTracks[0].points.length > 0
      ? [multiTracks[0].points[0].lat, multiTracks[0].points[0].lng]
      : [-7.65, -79.35];
  const cursorPt = points.length > 0 ? points[cursorIndex] : undefined;

  return (
    <MapContainer center={center} zoom={17} style={{ width: "100%", height: "100%" }} zoomControl={false}>
      <TileLayer
        url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
        attribution="Google"
        maxZoom={21}
      />

      {polygons.map((p, i) => (
        <Polygon
          key={i}
          positions={p.coords}
          pathOptions={{ color: p.color, weight: 1.5, fillOpacity: 0.15, fillColor: p.color }}
        />
      ))}

      {isMulti && multiTracks!.map((track) => {
        const coords = track.points.map((p) => [p.lat, p.lng] as [number, number]);
        const segs = splitAtJumps(coords);
        return (
          <React.Fragment key={track.sessionId}>
            {segs.map((seg, i) => (
              <React.Fragment key={`mt-${track.sessionId}-${i}`}>
                <Polyline positions={seg} pathOptions={{ color: track.color, weight: 10, opacity: 0.15 }} />
                <Polyline positions={seg} pathOptions={{ color: track.color, weight: 4, opacity: 0.9 }} />
              </React.Fragment>
            ))}
            {track.points.length > 0 && (
              <CircleMarker center={[track.points[0].lat, track.points[0].lng]} radius={6} pathOptions={{ color: "#fff", fillColor: track.color, fillOpacity: 1, weight: 2 }} />
            )}
          </React.Fragment>
        );
      })}

      {!isMulti && remainingSegments.map((seg, i) => (
        <Polyline key={`rem${i}`} positions={seg} pathOptions={{ color: "#00e5ff", weight: 3, opacity: 0.2, dashArray: "6 4" }} />
      ))}

      {!isMulti && offlineSegments.map((seg, i) => (
        <React.Fragment key={`walk${i}`}>
          <Polyline positions={seg.coords} pathOptions={{ color: seg.offline ? "#ff9800" : "#00e5ff", weight: 12, opacity: 0.15 }} />
          <Polyline positions={seg.coords} pathOptions={{ color: seg.offline ? "#ff9800" : "#00e5ff", weight: 4, opacity: 0.9, dashArray: seg.offline ? "8 6" : undefined }} />
        </React.Fragment>
      ))}

      {!isMulti && points.length > 0 && (
        <CircleMarker center={[points[0].lat, points[0].lng]} radius={7} pathOptions={{ color: "#fff", fillColor: "#22c55e", fillOpacity: 1, weight: 3 }} />
      )}
      {!isMulti && points.length > 1 && cursorIndex === points.length - 1 && (
        <CircleMarker center={[points[points.length - 1].lat, points[points.length - 1].lng]} radius={7} pathOptions={{ color: "#fff", fillColor: "#ef4444", fillOpacity: 1, weight: 3 }} />
      )}

      {!isMulti && cursorPt && (
        <CircleMarker center={[cursorPt.lat, cursorPt.lng]} radius={9} pathOptions={{ color: "#fff", fillColor: "#00e5ff", fillOpacity: 1, weight: 3 }} />
      )}

      {isMulti ? <FitMultiBounds tracks={multiTracks!} /> : <FitBounds points={points} />}
      {!isMulti && points.length > 0 && <LiveFollow points={points} index={cursorIndex} liveMode={liveMode} />}
    </MapContainer>
  );
}
