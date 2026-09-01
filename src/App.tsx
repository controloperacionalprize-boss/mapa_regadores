import { useEffect, useState, useRef, useCallback } from "react";
import { getSessions, getSessionPoints, getMultiSessionPoints, supabase, checkUsuarioAutorizado, getDispositivoByAndroidId, getDispositivos, getParadas, getParadaFotos, deleteSession } from "./services/supabase";
import type { Session, GpsPoint, UsuarioAutorizado, Dispositivo } from "./services/supabase";
import type { ParadaConFotos } from "./components/MapView";
import { loadKmzPolygons } from "./services/kmzLoader";
import type { PolygonData } from "./services/kmzLoader";
import MapView from "./components/MapView";
import type { TrackData } from "./components/MapView";
import Sidebar from "./components/Sidebar";
import LoginPage from "./components/LoginPage";
import UsersAdmin from "./components/UsersAdmin";
import DevicesAdmin from "./components/DevicesAdmin";
import ReportesView from "./components/ReportesView";
import "./App.css";

type NavView = "mapa" | "reportes" | "usuarios" | "dispositivos";

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
  const [usuario, setUsuario] = useState<UsuarioAutorizado | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleLogin = (u: UsuarioAutorizado) => {
    setUsuario(u);
    localStorage.setItem("usuario_email", u.email);
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem("usuario_email");
    if (savedEmail) {
      setAuthLoading(true);
      checkUsuarioAutorizado(savedEmail).then((u) => {
        if (u) setUsuario(u);
        else localStorage.removeItem("usuario_email");
        setAuthLoading(false);
      });
    }
  }, []);

  if (authLoading) return <div className="loading" style={{ height: "100vh" }}>Cargando...</div>;
  if (!usuario) return <LoginPage onLogin={handleLogin} />;

  return <Dashboard usuario={usuario} onLogout={async () => {
    setUsuario(null);
    localStorage.removeItem("usuario_email");
  }} />;
}

function Dashboard({ usuario, onLogout }: { usuario: UsuarioAutorizado; onLogout: () => void }) {
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
  const [showUsersAdmin, setShowUsersAdmin] = useState(false);
  const [showDevicesAdmin, setShowDevicesAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeView, setActiveView] = useState<NavView>("mapa");
  const [highlightFundos, setHighlightFundos] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deviceMap, setDeviceMap] = useState<Record<string, Dispositivo>>({});
  const [paradas, setParadas] = useState<ParadaConFotos[]>([]);
  const liveRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([getSessions(), loadKmzPolygons()])
      .then(([s, p]) => { setSessions(s); setPolygons(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
    getDispositivos()
      .then((devs) => {
        const map: Record<string, Dispositivo> = {};
        devs.forEach((d) => { map[d.android_id] = d; });
        setDeviceMap(map);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setIsAdmin(usuario.rol === "admin");
  }, [usuario.rol]);

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

    if (s.usuario) {
      try {
        const dev = await getDispositivoByAndroidId(s.usuario);
        setHighlightFundos(dev?.fundos_asignados || []);
      } catch { setHighlightFundos([]); }
    } else {
      setHighlightFundos([]);
    }

    try {
      const ps = await getParadas(s.id);
      const withFotos = await Promise.all(
        ps.map(async (p) => ({ ...p, fotos: await getParadaFotos(p.id) }))
      );
      setParadas(withFotos);
    } catch { setParadas([]); }
  }, []);

  const goBack = useCallback(() => {
    setSelected(null);
    selectedIdRef.current = null;
    setPoints([]);
    setDistance(0);
    setCursorIndex(0);
    setLiveMode(false);
    liveRef.current = false;
    setHighlightFundos([]);
    setParadas([]);
  }, []);

  const fundoCounts: Record<string, number> = {};
  polygons.forEach((p) => { fundoCounts[p.fundo] = (fundoCounts[p.fundo] || 0) + 1; });

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <button className="topbar-hamburger" onClick={() => setSidebarOpen((v) => !v)}><span /><span /><span /></button>
          <div className="logo">📍</div>
          <div>
            <h1>Mapa Regadores</h1>
            <span className="topbar-sub">Monitoreo de recorridos GPS</span>
          </div>
        </div>
        <div className="topbar-right">
          {liveMode && <span className="live-badge">EN VIVO</span>}
          <span className="user-badge">{usuario.email}</span>
          <button className="logout-btn" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <div className="app-body">
        <nav className="side-nav">
          <button className={`side-nav-btn ${activeView === "mapa" ? "side-nav-active" : ""}`} onClick={() => setActiveView("mapa")} title="Mapa">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16"/><path d="M16 6v16"/></svg>
            <span>Mapa</span>
          </button>
          <button className={`side-nav-btn ${activeView === "reportes" ? "side-nav-active" : ""}`} onClick={() => setActiveView("reportes")} title="Reportes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span>Reportes</span>
          </button>
          {isAdmin && <button className={`side-nav-btn ${activeView === "usuarios" ? "side-nav-active" : ""}`} onClick={() => setActiveView("usuarios")} title="Usuarios">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Usuarios</span>
          </button>}
          {isAdmin && <button className={`side-nav-btn ${activeView === "dispositivos" ? "side-nav-active" : ""}`} onClick={() => setActiveView("dispositivos")} title="Dispositivos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            <span>Dispositivos</span>
          </button>}
        </nav>

        <div className="app-content">
      {activeView === "mapa" && (
        <div className="main">
          <div className={`sidebar-wrapper ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
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
            highlightFundos={highlightFundos}
            deviceMap={deviceMap}
            paradas={paradas}
            isAdmin={isAdmin}
            onDeleteSession={async (id) => {
              try {
                await deleteSession(id);
                setSessions((prev) => prev.filter((s) => s.id !== id));
                setSelected(null);
                setPoints([]);
              } catch (e: any) {
                alert("Error al eliminar: " + (e?.message || e));
              }
            }}
          />
          </div>
          <div className="map-area">
            {loading ? (
              <div className="loading">Cargando datos...</div>
            ) : (
              <MapView polygons={polygons} points={points} cursorIndex={cursorIndex} liveMode={liveMode} multiTracks={multiTracks} highlightFundos={highlightFundos} paradas={paradas} />
            )}
          </div>
        </div>
      )}

      {activeView === "reportes" && (
        <div className="main" style={{ overflow: "auto", flex: 1 }}>
          <ReportesView sessions={sessions} deviceMap={deviceMap} />
        </div>
      )}

      {activeView === "usuarios" && (
        <div className="main" style={{ overflow: "auto", flex: 1 }}>
          <UsersAdmin onClose={() => setActiveView("mapa")} />
        </div>
      )}

      {activeView === "dispositivos" && (
        <div className="main" style={{ overflow: "auto", flex: 1 }}>
          <DevicesAdmin onClose={() => setActiveView("mapa")} />
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
