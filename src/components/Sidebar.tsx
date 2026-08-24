import type { Session, GpsPoint } from "../services/supabase";
import type { TrackData } from "./MapView";
import TrackTimeline from "./TrackTimeline";
import "./Sidebar.css";

interface Props {
  sessions: Session[];
  selectedSession: Session | null;
  points: GpsPoint[];
  distance: number;
  onSelectSession: (s: Session) => void;
  onBack: () => void;
  fundoCounts: Record<string, number>;
  cursorIndex: number;
  onCursorChange: (i: number) => void;
  liveMode: boolean;
  filter: string;
  onFilterChange: (f: string) => void;
  dateFilter: string;
  onDateFilterChange: (d: string) => void;
  multiTracks: TrackData[];
}

const FUNDO_COLORS: Record<string, string> = {
  "Arena Azul": "#4A90E2",
  "Quri Allpa": "#22c55e",
  "Kawsay Allpa": "#a855f7",
  "Ayllu Allpa": "#ef4444",
};

function getFundoColor(name: string): string {
  const key = Object.keys(FUNDO_COLORS).find((k) => name.toUpperCase().includes(k.toUpperCase()));
  return key ? FUNDO_COLORS[key] : "#94a3b8";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function durationMin(start: string, end: string | null) {
  if (!end) return "0 min";
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return mins + " min";
}

function formatDist(m: number) {
  return m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m";
}

export default function Sidebar({ sessions, selectedSession, points, distance, onSelectSession, onBack, fundoCounts, cursorIndex, onCursorChange, liveMode, filter, onFilterChange, dateFilter, onDateFilterChange, multiTracks }: Props) {
  const filtered = sessions.filter((s) => {
    if (filter && !s.fundo.toUpperCase().includes(filter.toUpperCase())) return false;
    if (dateFilter) {
      const d = new Date(s.iniciado_en);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dateStr !== dateFilter) return false;
    }
    return true;
  });
  const fundoNames = [...new Set(sessions.map((s) => s.fundo))];

  const avgSpeed = points.length > 1
    ? (distance / ((new Date(points[points.length - 1].grabado_en).getTime() - new Date(points[0].grabado_en).getTime()) / 1000)) * 3.6
    : 0;

  const totalLotes = Object.values(fundoCounts).reduce((a, b) => a + b, 0);

  return (
    <aside className="sidebar">
      {selectedSession ? (
        <>
          <button className="back-sidebar-btn" onClick={onBack}>← Todos los recorridos</button>
          <div className="card">
            <div className="card-header">
              <h3>Detalle del recorrido</h3>
              <span className={liveMode ? "badge badge-live" : "badge"}>
                {liveMode ? "En vivo" : "Completada"}
              </span>
            </div>
            <div className="card-body">
              <div className="info-row">
                <span className="label">Fundo</span>
                <span className="value fundo-tag">{selectedSession.fundo}</span>
              </div>
              <div className="info-row">
                <span className="label">Fecha</span>
                <span className="value">{formatDate(selectedSession.iniciado_en)}</span>
              </div>
              <div className="info-row">
                <span className="label">Hora</span>
                <span className="value">{formatTime(selectedSession.iniciado_en)} – {selectedSession.terminado_en ? formatTime(selectedSession.terminado_en) : "..."}</span>
              </div>
              <div className="info-row">
                <span className="label">Usuario</span>
                <span className="value">{selectedSession.usuario || "—"}</span>
              </div>
              <div className="info-row">
                <span className="label">Dispositivo</span>
                <span className="value">{selectedSession.dispositivo || "—"}</span>
              </div>
              <div className="info-row">
                <span className="label">ID</span>
                <span className="value mono">{selectedSession.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Timeline</h3></div>
            <div className="card-body">
              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-dot" style={{ background: "#22c55e" }} />
                  <div>
                    <div className="timeline-time">{formatTime(selectedSession.iniciado_en)}</div>
                    <div className="timeline-text">Inicio de recorrido</div>
                  </div>
                </div>
                {points.length > 2 && (
                  <div className="timeline-item">
                    <div className="timeline-dot" style={{ background: "#4A90E2" }} />
                    <div>
                      <div className="timeline-time">{formatTime(points[Math.floor(points.length / 2)].grabado_en)}</div>
                      <div className="timeline-text">Punto medio — {Math.floor(points.length / 2)} pts</div>
                    </div>
                  </div>
                )}
                {selectedSession.terminado_en && (
                  <div className="timeline-item">
                    <div className="timeline-dot" style={{ background: "#ef4444" }} />
                    <div>
                      <div className="timeline-time">{formatTime(selectedSession.terminado_en)}</div>
                      <div className="timeline-text">Fin de recorrido</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {points.some((p) => p.offline) && (
            <div className="card">
              <div className="card-header"><h3>Conectividad</h3></div>
              <div className="card-body">
                <div className="offline-legend">
                  <div className="offline-legend-item">
                    <span className="offline-legend-line" style={{ background: "#00e5ff" }} />
                    <span>Con internet</span>
                  </div>
                  <div className="offline-legend-item">
                    <span className="offline-legend-line offline-legend-dashed" style={{ background: "#ff9800" }} />
                    <span>Sin internet (offline)</span>
                  </div>
                </div>
                <div className="offline-stats">
                  <span>{points.filter((p) => p.offline).length} puntos offline</span>
                  <span> / {points.length} total</span>
                </div>
              </div>
            </div>
          )}

          <TrackTimeline points={points} totalDistance={distance} currentIndex={cursorIndex} onIndexChange={onCursorChange} />
        </>
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              <h3>Recorridos</h3>
              <span className="count-badge">{filtered.length}</span>
            </div>
            <div className="card-body">
              <select className="filter-sidebar" value={filter} onChange={(e) => onFilterChange(e.target.value)}>
                <option value="">Todos los fundos</option>
                {fundoNames.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input
                type="date"
                className="filter-sidebar"
                value={dateFilter}
                onChange={(e) => onDateFilterChange(e.target.value)}
              />
              <div className="session-list">
                {filtered.map((s) => (
                  <button key={s.id} className={`session-btn ${!s.terminado_en ? "session-btn-live" : ""}`} onClick={() => onSelectSession(s)}>
                    <div className="session-btn-left">
                      <div className="session-btn-fundo">
                        {!s.terminado_en && <span className="session-live-dot" />}
                        <span className="fundo-color-dot" style={{ background: getFundoColor(s.fundo) }} />
                        {s.fundo}
                      </div>
                      <div className="session-btn-date">{formatDate(s.iniciado_en)}</div>
                      {s.usuario && <div className="session-btn-user">{s.usuario}</div>}
                    </div>
                    <div className="session-btn-duration">
                      {!s.terminado_en ? "En vivo" : durationMin(s.iniciado_en, s.terminado_en)}
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && <p className="empty">No hay recorridos</p>}
              </div>
            </div>
          </div>

          {multiTracks.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Recorridos en mapa</h3>
                <span className="count-badge">{multiTracks.length}</span>
              </div>
              <div className="card-body">
                <div className="track-legend">
                  {multiTracks.map((t) => (
                    <div className="track-legend-item" key={t.sessionId}>
                      <span className="track-legend-color" style={{ background: t.color }} />
                      <div className="track-legend-text">
                        <div className="track-legend-label">{t.label}</div>
                        <div className="track-legend-pts">{t.points.length} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><h3>Resumen</h3></div>
            <div className="card-body">
              <div className="stats-grid">
                <div className="stat-item">
                  <svg className="stat-svg accent-stroke" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>
                  <div className="stat-value accent">{formatDist(distance || 0)}</div>
                  <div className="stat-label">Distancia total</div>
                </div>
                <div className="stat-item">
                  <svg className="stat-svg green-stroke" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <div className="stat-value green">
                    {sessions.length > 0 && sessions[0].terminado_en
                      ? durationMin(sessions[0].iniciado_en, sessions[0].terminado_en)
                      : "—"}
                  </div>
                  <div className="stat-label">Duración total</div>
                </div>
                <div className="stat-item">
                  <svg className="stat-svg blue-stroke" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                  <div className="stat-value blue">{points.length || "—"}</div>
                  <div className="stat-label">Puntos GPS</div>
                </div>
                <div className="stat-item">
                  <svg className="stat-svg orange-stroke" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4.24 2.54"/><path d="M16.24 7.76l1.42-1.42M19.07 11.5H21M16.24 16.24l1.42 1.42"/></svg>
                  <div className="stat-value orange">{avgSpeed > 0 ? avgSpeed.toFixed(1) + " km/h" : "—"}</div>
                  <div className="stat-label">Velocidad prom.</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Fundos</h3>
          <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 500 }}>Total: {totalLotes} lotes</span>
        </div>
        <div className="card-body">
          <div className="fundo-list">
            {Object.entries(FUNDO_COLORS).map(([name, color]) => (
              <div className="fundo-item" key={name}>
                <div className="fundo-dot" style={{ background: color }} />
                <span>{name}</span>
                <span className="fundo-count">{fundoCounts[name.toUpperCase()] || fundoCounts[name] || 0} lotes</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
