import { useRef, useCallback, useEffect, useState } from "react";
import type { GpsPoint } from "../services/supabase";
import "./TrackTimeline.css";

interface Props {
  points: GpsPoint[];
  totalDistance: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function TrackTimeline({ points, totalDistance: _totalDistance, currentIndex, onIndexChange }: Props) {
  if (points.length < 2) return null;

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playRef = useRef(false);
  const speedRef = useRef(1);
  const indexRef = useRef(currentIndex);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);

  useEffect(() => {
    if (!playing) { playRef.current = false; return; }
    playRef.current = true;

    let raf: number;
    let last = performance.now();

    const tick = (now: number) => {
      if (!playRef.current) return;
      const dt = now - last;
      const interval = 100 / speedRef.current;
      if (dt >= interval) {
        last = now;
        const next = indexRef.current + 1;
        if (next >= points.length) {
          setPlaying(false);
          return;
        }
        onIndexChange(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { playRef.current = false; cancelAnimationFrame(raf); };
  }, [playing, points.length, onIndexChange]);

  const t0 = new Date(points[0].grabado_en).getTime();
  const tEnd = new Date(points[points.length - 1].grabado_en).getTime();
  const totalSec = (tEnd - t0) / 1000;
  const curTime = new Date(points[currentIndex].grabado_en).getTime();
  const curElapsed = (curTime - t0) / 1000;
  const progress = points.length > 1 ? (currentIndex / (points.length - 1)) * 100 : 0;

  const togglePlay = useCallback(() => {
    if (currentIndex >= points.length - 1) {
      onIndexChange(0);
    }
    setPlaying((p) => !p);
  }, [currentIndex, points.length, onIndexChange]);

  const cycleSpeed = useCallback(() => {
    setSpeed((s) => {
      if (s === 1) return 2;
      if (s === 2) return 4;
      if (s === 4) return 8;
      return 1;
    });
  }, []);

  return (
    <div className="track-tl">
      <div className="track-tl-header">
        <h3>Linea de Tiempo</h3>
        <span className="track-tl-duration">{Math.floor(totalSec / 60)} min {Math.round(totalSec % 60)}s</span>
      </div>

      <div className="track-tl-scrubber">
        <div className="track-tl-current">
          <span className="track-tl-cur-time">{fmt(points[currentIndex].grabado_en)}</span>
          <span className="track-tl-cur-stats">
            +{Math.floor(curElapsed / 60)}:{Math.round(curElapsed % 60).toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="track-tl-bar-wrap">
        <div className="track-tl-progress-bar">
          <div className="track-tl-progress-fill" style={{ width: `${progress}%` }} />
          <div className="track-tl-thumb" style={{ left: `${progress}%` }} />
        </div>
        <div className="track-tl-labels">
          <span>{fmt(points[0].grabado_en)}</span>
          <span>{fmt(points[points.length - 1].grabado_en)}</span>
        </div>
      </div>

      <div className="track-tl-controls">
        <button className="track-tl-play-btn" onClick={togglePlay}>
          {playing ? "⏸" : "▶"}
        </button>
        <button className="track-tl-speed-btn" onClick={cycleSpeed}>
          x{speed}
        </button>
        <input
          type="range"
          min={0}
          max={points.length - 1}
          value={currentIndex}
          onChange={(e) => { setPlaying(false); onIndexChange(Number(e.target.value)); }}
          className="track-tl-range"
        />
        <span className="track-tl-counter">{currentIndex + 1} / {points.length}</span>
      </div>
    </div>
  );
}
