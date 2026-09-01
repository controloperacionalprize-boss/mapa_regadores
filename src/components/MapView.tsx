import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { PolygonData } from "../services/kmzLoader";
import type { GpsPoint, Parada, ParadaFoto } from "../services/supabase";
import "leaflet/dist/leaflet.css";

export interface TrackData {
  sessionId: string;
  points: GpsPoint[];
  color: string;
  label: string;
}

export interface ParadaConFotos extends Parada {
  fotos: ParadaFoto[];
}

interface Props {
  polygons: PolygonData[];
  points: GpsPoint[];
  cursorIndex: number;
  liveMode: boolean;
  multiTracks?: TrackData[];
  highlightFundos?: string[];
  paradas?: ParadaConFotos[];
}

function paradaIcon(num: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#ff9800;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
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

function splitAtJumps(coords: [number, number][]): [number, number][][] {
  return coords.length < 2 ? [] : [coords];
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
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

export default function MapView({ polygons, points, cursorIndex: rawIdx, liveMode, multiTracks, highlightFundos = [], paradas = [] }: Props) {
  const isMulti = multiTracks && multiTracks.length > 0 && points.length === 0;

  const cursorIndex = Math.min(rawIdx, Math.max(0, points.length - 1));
  const walkedCoords = points.slice(0, cursorIndex + 1).map((p) => [p.lat, p.lng] as [number, number]);
  const remainingCoords = points.slice(cursorIndex).map((p) => [p.lat, p.lng] as [number, number]);
  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : multiTracks && multiTracks.length > 0 && multiTracks[0].points.length > 0
      ? [multiTracks[0].points[0].lat, multiTracks[0].points[0].lng]
      : [-7.65, -79.35];
  const cursorPt = points.length > 0 ? points[cursorIndex] : undefined;

  return (
    <MapContainer center={center} zoom={17} style={{ width: "100%", height: "100%" }} zoomControl={false}>
      <InvalidateOnResize />
      <TileLayer
        url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
        attribution="Google"
        maxZoom={21}
      />

      {polygons.map((p, i) => {
        const isHighlighted = highlightFundos.length > 0 && p.modulo && highlightFundos.includes(p.modulo);
        return (
          <Polygon
            key={i}
            positions={p.coords}
            pathOptions={{
              color: isHighlighted ? "#ffd700" : p.color,
              weight: isHighlighted ? 3 : 1.5,
              fillOpacity: isHighlighted ? 0.4 : 0.15,
              fillColor: isHighlighted ? "#ffd700" : p.color,
            }}
          />
        );
      })}

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

      {!isMulti && remainingCoords.length > 1 && (
        <>
          <Polyline positions={remainingCoords} pathOptions={{ color: "#00e5ff", weight: 10, opacity: 0.15 }} />
          <Polyline positions={remainingCoords} pathOptions={{ color: "#00e5ff", weight: 3, opacity: 0.2, dashArray: "6 4" }} />
        </>
      )}

      {!isMulti && walkedCoords.length > 1 && (
        <>
          <Polyline positions={walkedCoords} pathOptions={{ color: "#00e5ff", weight: 10, opacity: 0.15 }} />
          <Polyline positions={walkedCoords} pathOptions={{ color: "#00e5ff", weight: 4, opacity: 0.9 }} />
        </>
      )}

      {!isMulti && points.length > 0 && (
        <CircleMarker center={[points[0].lat, points[0].lng]} radius={7} pathOptions={{ color: "#fff", fillColor: "#22c55e", fillOpacity: 1, weight: 3 }} />
      )}
      {!isMulti && points.length > 1 && cursorIndex === points.length - 1 && (
        <CircleMarker center={[points[points.length - 1].lat, points[points.length - 1].lng]} radius={7} pathOptions={{ color: "#fff", fillColor: "#ef4444", fillOpacity: 1, weight: 3 }} />
      )}

      {!isMulti && cursorPt && (
        <CircleMarker center={[cursorPt.lat, cursorPt.lng]} radius={9} pathOptions={{ color: "#fff", fillColor: "#00e5ff", fillOpacity: 1, weight: 3 }} />
      )}

      {!isMulti && paradas.map((p, i) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={paradaIcon(i + 1)}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong>Parada {i + 1}</strong>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                {new Date(p.inicio).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                {p.fin && ` — ${new Date(p.fin).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`}
              </div>
              {p.nota && <div style={{ fontSize: 12, marginTop: 4 }}>{p.nota}</div>}
              {p.fotos.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {p.fotos.map((f) => (
                    <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                      <img src={f.url} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4 }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {isMulti ? <FitMultiBounds tracks={multiTracks!} /> : <FitBounds points={points} />}
      {!isMulti && points.length > 0 && <LiveFollow points={points} index={cursorIndex} liveMode={liveMode} />}
    </MapContainer>
  );
}
