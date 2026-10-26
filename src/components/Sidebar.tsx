import { useState } from "react";
import type { Session, GpsPoint, Dispositivo } from "../services/api";
import type { ParadaConFotos } from "./MapView";
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
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (d: string) => void;
  onDateToChange: (d: string) => void;
  userFilter: string;
  onUserFilterChange: (u: string) => void;
  multiTracks: TrackData[];
  highlightFundos?: string[];
  deviceMap?: Record<string, Dispositivo>;
  paradas?: ParadaConFotos[];
  isAdmin?: boolean;
  onDeleteSession?: (id: string) => void;
}

const FUNDO_COLORS: Record<string, string> = {
  "Arena Azul": "#4A90E2",
  "Quri Allpa": "#22c55e",
  "Kawsay Allpa": "#a855f7",
  "Ayllu Allpa": "#ef4444",
};

const MODULO_A_FUNDO: Record<string, string> = {};
[1, 2, 3, 4].forEach((n) => { MODULO_A_FUNDO[`AQ1-${n}`] = "ARENA AZUL"; });
[1, 2, 3, 4, 5].forEach((n) => { MODULO_A_FUNDO[`AQ2-${n}`] = "QURI ALLPA"; });
[6, 7, 8, 9, 10, 11, 16, 17, 18].forEach((n) => { MODULO_A_FUNDO[`AQ2-${n}`] = "KAWSAY ALLPA"; });
[12, 13, 14, 15].forEach((n) => { MODULO_A_FUNDO[`AQ2-${n}`] = "AYLLU ALLPA"; });

function getFundoColor(name: string): string {
  const key = Object.keys(FUNDO_COLORS).find((k) => name.toUpperCase().includes(k.toUpperCase()));
  return key ? FUNDO_COLORS[key] : "#94a3b8";
}

function resolveFundo(s: { fundo: string; usuario: string | null }, devMap: Record<string, import("../services/api").Dispositivo>): string {
  if (s.fundo) return s.fundo;
  if (!s.usuario || !devMap[s.usuario]) return "";
  const mods = devMap[s.usuario].fundos_asignados || [];
  if (mods.length === 0) return "";
  const fundo = MODULO_A_FUNDO[mods[0]];
  return fundo || "";
}

function resolveDeviceName(usuario: string | null, devMap: Record<string, import("../services/api").Dispositivo>): string | null {
  if (!usuario || !devMap[usuario]) return usuario;
  return devMap[usuario].nombre || usuario;
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

function getWeekRange(): [string, string] {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [fmt(mon), fmt(sun)];
}

function toDateStr(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_COLORS = [
  "#00e5ff", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff",
  "#ff922b", "#cc5de8", "#20c997", "#ff6b81", "#748ffc",
];

function UserSessionGroup({ userName, sessions, deviceMap, onSelectSession }: {
  userName: string;
  sessions: Session[];
  deviceMap: Record<string, Dispositivo>;
  onSelectSession: (s: Session) => void;
}) {
  const [open, setOpen] = useState(true);
  const sorted = [...sessions].sort((a, b) => new Date(a.iniciado_en).getTime() - new Date(b.iniciado_en).getTime());
  const uniqueDays = [...new Set(sorted.map((s) => toDateStr(s.iniciado_en)))];
  const dayColorMap: Record<string, string> = {};
  uniqueDays.forEach((d, i) => { dayColorMap[d] = DAY_COLORS[i % DAY_COLORS.length]; });

  return (
    <div className="user-group">
      <button className="user-group-header" onClick={() => setOpen(!open)}>
        <span className="user-group-name">{userName}</span>
        <span className="user-group-count">{sessions.length} recorridos</span>
        <span className="toggle-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && sorted.map((s) => {
        const dayStr = toDateStr(s.iniciado_en);
        const dayColor = dayColorMap[dayStr];
        const d = new Date(s.iniciado_en);
        const dayLabel = d.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });
        const fundo = resolveFundo(s, deviceMap);
        return (
          <button key={s.id} className={`session-btn ${!s.terminado_en ? "session-btn-live" : ""}`} onClick={() => onSelectSession(s)}>
            <div className="session-btn-left">
              <div className="session-btn-fundo">
                {!s.terminado_en && <span className="session-live-dot" />}
                <span className="fundo-color-dot" style={{ background: dayColor }} />
                {dayLabel}
              </div>
              <div className="session-btn-date">{fundo || "Sin fundo"}</div>
            </div>
            <div className="session-btn-duration">
              {!s.terminado_en ? "En vivo" : durationMin(s.iniciado_en, s.terminado_en)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function Sidebar({ sessions, selectedSession, points, distance, onSelectSession, onBack, fundoCounts, cursorIndex, onCursorChange, liveMode, filter, onFilterChange, dateFrom, dateTo, onDateFromChange, onDateToChange, userFilter, onUserFilterChange, multiTracks, highlightFundos = [], deviceMap = {}, paradas = [], isAdmin = false, onDeleteSession }: Props) {
  const filtered = sessions.filter((s) => {
    const fundo = resolveFundo(s, deviceMap);
    if (filter && !fundo.toUpperCase().includes(filter.toUpperCase())) return false;
    const ds = toDateStr(s.iniciado_en);
    if (dateFrom && ds < dateFrom) return false;
    if (dateTo && ds > dateTo) return false;
    return true;
  });
  const fundoNames = [...new Set(sessions.map((s) => resolveFundo(s, deviceMap)))].filter(Boolean);

  const avgSpeed = points.length > 1
    ? (distance / ((new Date(points[points.length - 1].grabado_en).getTime() - new Date(points[0].grabado_en).getTime()) / 1000)) * 3.6
    : 0;

  const totalLotes = Object.values(fundoCounts).reduce((a, b) => a + b, 0);
  const [showRecorridos, setShowRecorridos] = useState(true);
  const [showResumen, setShowResumen] = useState(true);
  const [showFundos, setShowFundos] = useState(true);
  const [showDetalle, setShowDetalle] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showTrackTimeline, setShowTrackTimeline] = useState(true);
  const [showParadas, setShowParadas] = useState(true);

  const allUserNames = [...new Set(filtered.map((s) => resolveDeviceName(s.usuario, deviceMap) || s.usuario || "Sin usuario"))].sort();
  const displayFiltered = userFilter ? filtered.filter((s) => {
    const name = resolveDeviceName(s.usuario, deviceMap) || s.usuario || "Sin usuario";
    return name === userFilter;
  }) : filtered;

  return (
    <aside className="sidebar">
      {selectedSession ? (
        <>
          <button className="back-sidebar-btn" onClick={onBack}>← Todos los recorridos</button>
          <div className="card">
            <div className="card-header card-header-toggle" onClick={() => setShowDetalle(!showDetalle)}>
              <h3>Detalle del recorrido</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={liveMode ? "badge badge-live" : "badge"}>
                  {liveMode ? "En vivo" : "Completada"}
                </span>
                <span className="toggle-arrow">{showDetalle ? "▲" : "▼"}</span>
              </div>
            </div>
            {showDetalle && <div className="card-body">
              <div className="info-row">
                <span className="label">Fundo</span>
                <span className="value fundo-tag">{resolveFundo(selectedSession, deviceMap) || "—"}</span>
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
                <span className="value">{resolveDeviceName(selectedSession.usuario, deviceMap) || "—"}</span>
              </div>
              <div className="info-row">
                <span className="label">Dispositivo</span>
                <span className="value">{selectedSession.dispositivo || "—"}</span>
              </div>
              <div className="info-row">
                <span className="label">ID</span>
                <span className="value mono">{selectedSession.id.slice(0, 8)}</span>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid var(--border, #333)", margin: "10px 0" }} />
              <div className="stats-grid" style={{ marginTop: 4 }}>
                <div className="stat-item">
                  <div className="stat-value accent">{formatDist(distance || 0)}</div>
                  <div className="stat-label">Distancia</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value green">{durationMin(selectedSession.iniciado_en, selectedSession.terminado_en)}</div>
                  <div className="stat-label">Duración</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value orange">{avgSpeed > 0 ? avgSpeed.toFixed(1) + " km/h" : "—"}</div>
                  <div className="stat-label">Vel. prom.</div>
                </div>
              </div>
              {isAdmin && onDeleteSession && (
                <button
                  className="delete-session-btn"
                  onClick={() => {
                    if (window.confirm("¿Seguro que deseas eliminar este recorrido? Se borrarán todos los puntos, paradas y fotos asociados.")) {
                      onDeleteSession(selectedSession.id);
                    }
                  }}
                >
                  Eliminar recorrido
                </button>
              )}
            </div>}
          </div>

          <div className="card">
            <div className="card-header card-header-toggle" onClick={() => setShowTimeline(!showTimeline)}>
              <h3>Timeline</h3>
              <span className="toggle-arrow">{showTimeline ? "▲" : "▼"}</span>
            </div>
            {showTimeline && <div className="card-body">
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
            </div>}
          </div>

          {paradas.length > 0 && (
            <div className="card">
              <div className="card-header card-header-toggle" onClick={() => setShowParadas(!showParadas)}>
                <h3>Paradas</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="count-badge">{paradas.length}</span>
                  <span className="toggle-arrow">{showParadas ? "▲" : "▼"}</span>
                </div>
              </div>
              {showParadas && <div className="card-body">
                <div className="paradas-list">
                  {paradas.map((p, i) => {
                    const dur = p.fin
                      ? Math.round((new Date(p.fin).getTime() - new Date(p.inicio).getTime()) / 60000)
                      : null;
                    return (
                      <div className="parada-item" key={p.id}>
                        <div className="parada-num">{i + 1}</div>
                        <div className="parada-info">
                          <div className="parada-title">
                            Parada {i + 1}
                            {dur !== null && <span className="parada-dur">{dur} min</span>}
                          </div>
                          <div className="parada-time">
                            {new Date(p.inicio).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                            {p.fin && ` — ${new Date(p.fin).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`}
                          </div>
                          {p.nota && <div className="parada-nota">{p.nota}</div>}
                          {p.fotos.length > 0 && (
                            <div className="parada-fotos">
                              {p.fotos.map((f) => (
                                <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                                  <img src={f.url} alt="" className="parada-foto" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>}
            </div>
          )}

          {highlightFundos.length > 0 && (
            <div className="card">
              <div className="card-header"><h3>Zona asignada</h3></div>
              <div className="card-body">
                <div className="offline-legend">
                  <div className="offline-legend-item">
                    <span className="offline-legend-line" style={{ background: "#22c55e" }} />
                    <span>Dentro del módulo</span>
                  </div>
                  <div className="offline-legend-item">
                    <span className="offline-legend-line" style={{ background: "#ef4444" }} />
                    <span>Fuera del módulo</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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

          <div className="card">
            <div className="card-header card-header-toggle" onClick={() => setShowTrackTimeline(!showTrackTimeline)}>
              <h3>Línea de tiempo</h3>
              <span className="toggle-arrow">{showTrackTimeline ? "▲" : "▼"}</span>
            </div>
            {showTrackTimeline && <div className="card-body">
              <TrackTimeline points={points} totalDistance={distance} currentIndex={cursorIndex} onIndexChange={onCursorChange} />
            </div>}
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <div className="card-header card-header-toggle" onClick={() => setShowRecorridos(!showRecorridos)}>
              <h3>Recorridos</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="count-badge">{displayFiltered.length}</span>
                <span className="toggle-arrow">{showRecorridos ? "▲" : "▼"}</span>
              </div>
            </div>
            {showRecorridos && <div className="card-body">
              <select className="filter-sidebar" value={filter} onChange={(e) => onFilterChange(e.target.value)}>
                <option value="">Todos los fundos</option>
                {fundoNames.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <div className="date-range-row">
                <input type="date" className="filter-sidebar" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} placeholder="Desde" />
                <input type="date" className="filter-sidebar" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} placeholder="Hasta" />
              </div>
              <div className="date-range-row">
                <button className="week-btn" onClick={() => { const [f, t] = getWeekRange(); onDateFromChange(f); onDateToChange(t); }}>Esta semana</button>
                {(dateFrom || dateTo) && <button className="week-btn week-btn-clear" onClick={() => { onDateFromChange(""); onDateToChange(""); }}>Limpiar</button>}
              </div>
              <select className="filter-sidebar" value={userFilter} onChange={(e) => onUserFilterChange(e.target.value)}>
                <option value="">Todos los usuarios</option>
                {allUserNames.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <div className="session-list">
                {(() => {
                  const grouped: Record<string, Session[]> = {};
                  displayFiltered.forEach((s) => {
                    const name = resolveDeviceName(s.usuario, deviceMap) || s.usuario || "Sin usuario";
                    if (!grouped[name]) grouped[name] = [];
                    grouped[name].push(s);
                  });
                  const userNames = Object.keys(grouped).sort();
                  if (userNames.length === 0) return <p className="empty">No hay recorridos</p>;
                  const isRangeMode = !!(dateFrom && dateTo && dateFrom !== dateTo);
                  if (!isRangeMode) {
                    return displayFiltered.map((s) => {
                      const fundo = resolveFundo(s, deviceMap);
                      const devName = resolveDeviceName(s.usuario, deviceMap);
                      return (
                        <button key={s.id} className={`session-btn ${!s.terminado_en ? "session-btn-live" : ""}`} onClick={() => onSelectSession(s)}>
                          <div className="session-btn-left">
                            <div className="session-btn-fundo">
                              {!s.terminado_en && <span className="session-live-dot" />}
                              <span className="fundo-color-dot" style={{ background: getFundoColor(fundo) }} />
                              {fundo || "Sin fundo"}
                            </div>
                            <div className="session-btn-date">{formatDate(s.iniciado_en)}</div>
                            {devName && <div className="session-btn-user">{devName}</div>}
                          </div>
                          <div className="session-btn-duration">
                            {!s.terminado_en ? "En vivo" : durationMin(s.iniciado_en, s.terminado_en)}
                          </div>
                        </button>
                      );
                    });
                  }
                  return userNames.map((userName) => (
                    <UserSessionGroup key={userName} userName={userName} sessions={grouped[userName]} deviceMap={deviceMap} onSelectSession={onSelectSession} />
                  ));
                })()}
              </div>
            </div>}
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
            <div className="card-header card-header-toggle" onClick={() => setShowResumen(!showResumen)}>
              <h3>Resumen</h3>
              <span className="toggle-arrow">{showResumen ? "▲" : "▼"}</span>
            </div>
            {showResumen && <div className="card-body">
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
            </div>}
          </div>
        </>
      )}

      <div className="card">
        <div className="card-header card-header-toggle" onClick={() => setShowFundos(!showFundos)}>
          <h3>Fundos</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 500 }}>Total: {totalLotes} lotes</span>
            <span className="toggle-arrow">{showFundos ? "▲" : "▼"}</span>
          </div>
        </div>
        {showFundos && <div className="card-body">
          <div className="fundo-list">
            {Object.entries(FUNDO_COLORS).map(([name, color]) => (
              <div className="fundo-item" key={name}>
                <div className="fundo-dot" style={{ background: color }} />
                <span>{name}</span>
                <span className="fundo-count">{fundoCounts[name.toUpperCase()] || fundoCounts[name] || 0} lotes</span>
              </div>
            ))}
          </div>
        </div>}
      </div>
    </aside>
  );
}
