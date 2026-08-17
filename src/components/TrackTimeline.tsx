import { useRef, useCallback } from "react";
import type { GpsPoint } from "../services/supabase";
import "./TrackTimeline.css";

interface Props {
  points: GpsPoint[];
  totalDistance: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function speedColor(kmh: number) {
  if (kmh < 1) return "#ef4444";
  if (kmh < 3) return "#f97316";
  if (kmh < 5) return "#22c55e";
  return "#3b82f6";
}

function speedLabel(kmh: number) {
  if (kmh < 1) return "Detenido";
  if (kmh < 3) return "Lento";
  if (kmh < 5) return "Normal";
  return "Rapido";
}

export default function TrackTimeline({ points, totalDistance: _totalDistance, currentIndex, onIndexChange }: Props) {
  if (points.length < 2) return null;

  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const t0 = new Date(points[0].grabado_en).getTime();
  const tEnd = new Date(points[points.length - 1].grabado_en).getTime();
  const totalSec = (tEnd - t0) / 1000;

  const segments: { pct: number; speed: number; cumDist: number; time: string; elapsed: number }[] = [];
  let cumDist = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = (new Date(points[i].grabado_en).getTime() - t0) / 1000;
    const segDist = haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    cumDist += segDist;
    const segTime = (new Date(points[i].grabado_en).getTime() - new Date(points[i - 1].grabado_en).getTime()) / 1000;
    const speed = segTime > 0 ? (segDist / segTime) * 3.6 : 0;
    segments.push({ pct: (dt / totalSec) * 100, speed, cumDist, time: fmt(points[i].grabado_en), elapsed: dt });
  }

  const curPct = currentIndex <= 0 ? 0 : currentIndex >= points.length - 1 ? 100 : segments[Math.min(currentIndex - 1, segments.length - 1)]?.pct ?? 0;
  const curSeg = currentIndex > 0 ? segments[Math.min(currentIndex - 1, segments.length - 1)] : null;
  const curElapsed = curSeg ? curSeg.elapsed : 0;
  const curDist = curSeg ? curSeg.cumDist : 0;
  const pt = points[currentIndex];
  const curSpeed = pt?.velocidad ? pt.velocidad * 3.6 : (curSeg?.speed ?? 0);

  const indexFromX = useCallback((clientX: number) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(pct * (points.length - 1));
  }, [points.length]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onIndexChange(indexFromX(e.clientX));
  }, [indexFromX, onIndexChange]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    onIndexChange(indexFromX(e.clientX));
  }, [indexFromX, onIndexChange]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  return (
    <div className="track-tl">
      <div className="track-tl-header">
        <h3>Linea de Tiempo</h3>
        <span className="track-tl-duration">{Math.round(totalSec / 60)} min {Math.round(totalSec % 60)}s</span>
      </div>

      <div className="track-tl-scrubber">
        <div className="track-tl-current">
          <span className="track-tl-cur-time">{pt ? fmt(pt.grabado_en) : "--"}</span>
          <span className="track-tl-cur-stats">
            {Math.round(curDist)}m — {curSpeed.toFixed(1)} km/h
            <span className="track-tl-cur-tag" style={{ color: speedColor(curSpeed) }}>{speedLabel(curSpeed)}</span>
          </span>
        </div>
        <div className="track-tl-cur-elapsed">+{Math.floor(curElapsed / 60)}:{Math.round(curElapsed % 60).toString().padStart(2, "0")}</div>
      </div>

      <div className="track-tl-bar-wrap">
        <div
          className="track-tl-bar"
          ref={barRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {segments.map((s, i) => {
            const prevPct = i === 0 ? 0 : segments[i - 1].pct;
            const width = s.pct - prevPct;
            const active = i < currentIndex;
            return (
              <div
                key={i}
                className="track-tl-seg"
                style={{
                  width: `${Math.max(width, 0.5)}%`,
                  background: speedColor(s.speed),
                  opacity: active ? 1 : 0.25,
                }}
              />
            );
          })}
          <div className="track-tl-thumb" style={{ left: `${curPct}%` }} />
        </div>
        <div className="track-tl-labels">
          <span>{fmt(points[0].grabado_en)}</span>
          <span>{fmt(points[points.length - 1].grabado_en)}</span>
        </div>
      </div>

      <div className="track-tl-legend">
        {[["Detenido", "#ef4444"], ["Lento", "#f97316"], ["Normal", "#22c55e"], ["Rapido", "#3b82f6"]].map(([l, c]) => (
          <div key={l} className="track-tl-legend-item">
            <div className="track-tl-legend-dot" style={{ background: c as string }} />
            <span>{l}</span>
          </div>
        ))}
      </div>

      <div className="track-tl-slider-row">
        <input
          type="range"
          min={0}
          max={points.length - 1}
          value={currentIndex}
          onChange={(e) => onIndexChange(Number(e.target.value))}
          className="track-tl-range"
        />
        <span className="track-tl-counter">{currentIndex + 1} / {points.length}</span>
      </div>
    </div>
  );
}
