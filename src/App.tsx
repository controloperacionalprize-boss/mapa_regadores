import { useEffect, useState, useRef, useCallback } from "react";
import { getSessions, getSessionPoints, getMultiSessionPoints, supabase } from "./services/supabase";
import type { Session, GpsPoint } from "./services/supabase";
import { loadKmzPolygons } from "./services/kmzLoader";
import type { PolygonData } from "./services/kmzLoader";
import MapView from "./components/MapView";
import type { TrackData } from "./components/MapView";
import Sidebar from "./components/Sidebar";
import "./App.css";

const TRACK_COLORS = [
  "#00e5ff", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff",
  "#ff922b", "#cc5de8", "#20c997", "#ff6b81", "#748ffc",
  "#f06595", "#51cf66", "#fcc419", "#339af0", "#e64980",
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDistance(pts: GpsPoint[]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  return d;
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [polygons, setPolygons] = useState<PolygonData[]>([]);
  const [distance, setDistance] = useState(0);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [, setSocketStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [filter, setFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [multiTracks, setMultiTracks] = useState<TrackData[]>([]);
  const liveRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([getSessions(), loadKmzPolygons()])
      .then(([s, p]) => { setSessions(s); setPolygons(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Poll sessions every 3s to detect new/ended sessions
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fresh = await getSessions();
        setSessions(fresh);

        // If watching a live session, check if it ended
        if (liveRef.current && selectedIdRef.current) {
          const current = fresh.find((s) => s.id === selectedIdRef.current);
          if (current?.terminado_en) {
            setLiveMode(false);
            liveRef.current = false;
            setSelected(current);
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Poll GPS points every 3s when in live mode
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(async () => {
      if (!selectedIdRef.current) return;
      try {
        const pts = await getSessionPoints(selectedIdRef.current);
        if (pts.length > points.length) {
          setPoints(pts);
          setDistance(calcDistance(pts));
          setCursorIndex(pts.length - 1);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [liveMode, points.length]);

  // Realtime WebSocket (works if Realtime is enabled in Supabase)
  useEffect(() => {
    const channel = supabase
      .channel("realtime-all")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "punto_gps" },
        (payload) => {
          const newPt = payload.new as GpsPoint;
          if (!liveRef.current || newPt.sesion_id !== selectedIdRef.current) return;
          setPoints((prev) => {
            if (prev.some((p) => p.id === newPt.id)) return prev;
            const updated = [...prev, newPt];
            setDistance(calcDistance(updated));
            setCursorIndex(updated.length - 1);
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sesiones_gps" },
        (payload) => {
          const s = payload.new as Session;
          if (s.app !== "mapa_regadores") return;
          setSessions((prev) => prev.some((x) => x.id === s.id) ? prev : [s, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sesiones_gps" },
        (payload) => {
          const s = payload.new as Session;
          if (s.app !== "mapa_regadores") return;
          setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x)));
          if (s.id === selectedIdRef.current && s.terminado_en) {
            setLiveMode(false);
            liveRef.current = false;
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setSocketStatus("connected");
        else if (status === "CLOSED" || status === "CHANNEL_ERROR") setSocketStatus("disconnected");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!dateFilter || selected) { setMultiTracks([]); return; }
    const sessionsForDate = sessions.filter((s) => {
      const d = new Date(s.iniciado_en);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return dateStr === dateFilter;
    });
    if (sessionsForDate.length === 0) { setMultiTracks([]); return; }
    const ids = sessionsForDate.map((s) => s.id);
    getMultiSessionPoints(ids).then((grouped) => {
      const tracks: TrackData[] = sessionsForDate.map((s, i) => ({
        sessionId: s.id,
        points: grouped[s.id] || [],
        color: TRACK_COLORS[i % TRACK_COLORS.length],
        label: `${s.fundo} — ${s.usuario || "Sin usuario"}`,
      })).filter((t) => t.points.length > 0);
      setMultiTracks(tracks);
    }).catch(console.error);
  }, [dateFilter, sessions, selected]);

  const selectSession = useCallback(async (s: Session) => {
    setSelected(s);
    selectedIdRef.current = s.id;
    const isActive = !s.terminado_en;
    setLiveMode(isActive);
    liveRef.current = isActive;
    const pts = await getSessionPoints(s.id);
    setCursorIndex(pts.length - 1);
    setPoints(pts);
    setDistance(calcDistance(pts));
  }, []);

  const goBack = useCallback(() => {
    setSelected(null);
    selectedIdRef.current = null;
    setPoints([]);
    setDistance(0);
    setCursorIndex(0);
    setLiveMode(false);
    liveRef.current = false;
  }, []);

  const fundoCounts: Record<string, number> = {};
  polygons.forEach((p) => { fundoCounts[p.fundo] = (fundoCounts[p.fundo] || 0) + 1; });

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <button className="topbar-hamburger"><span /><span /><span /></button>
          <div className="logo">📍</div>
          <div>
            <h1>Mapa Regadores</h1>
            <span className="topbar-sub">Monitoreo de recorridos GPS</span>
          </div>
        </div>
        <div className="topbar-right">
          {liveMode && <span className="live-badge">EN VIVO</span>}
        </div>
      </header>
      <div className="main">
        <Sidebar
          sessions={sessions}
          selectedSession={selected}
          points={points}
          distance={distance}
          onSelectSession={selectSession}
          onBack={goBack}
          fundoCounts={fundoCounts}
          cursorIndex={cursorIndex}
          onCursorChange={setCursorIndex}
          liveMode={liveMode}
          filter={filter}
          onFilterChange={setFilter}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          multiTracks={multiTracks}
        />
        <div className="map-area">
          {loading ? (
            <div className="loading">Cargando datos...</div>
          ) : (
            <MapView polygons={polygons} points={points} cursorIndex={cursorIndex} liveMode={liveMode} multiTracks={multiTracks} />
          )}
        </div>
      </div>
    </div>
  );
}
