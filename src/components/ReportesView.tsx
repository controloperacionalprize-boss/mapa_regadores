import { useState, useEffect } from "react";
import type { Session, Dispositivo, GpsPoint } from "../services/supabase";
import { supabase } from "../services/supabase";
import { generateExcelReport } from "../services/excelReport";
import "./ReportesView.css";

interface Props {
  sessions: Session[];
  deviceMap: Record<string, Dispositivo>;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveNombre(usuario: string | null, deviceMap: Record<string, Dispositivo>) {
  if (!usuario) return "—";
  const dev = deviceMap[usuario];
  return dev?.nombre || usuario.slice(0, 8);
}

function resolveFundo(s: Session, deviceMap: Record<string, Dispositivo>) {
  if (s.fundo) return s.fundo;
  if (s.usuario) {
    const dev = deviceMap[s.usuario];
    if (dev?.fundos_asignados?.length) return dev.fundos_asignados.join(", ");
  }
  return "—";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function durationStr(start: string, end: string | null) {
  if (!end) return "En curso";
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

type Tab = "recorridos" | "resumen" | "paradas";

interface RowData {
  session: Session;
  distKm: number;
  avgSpeed: number;
  paradaCount: number;
}

export default function ReportesView({ sessions, deviceMap }: Props) {
  const [tab, setTab] = useState<Tab>("recorridos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const usuarios = [...new Set(sessions.map((s) => s.usuario).filter(Boolean))] as string[];

  const filtered = sessions.filter((s) => {
    if (userFilter && s.usuario !== userFilter) return false;
    if (dateFrom) {
      const d = new Date(s.iniciado_en);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (ds < dateFrom) return false;
    }
    if (dateTo) {
      const d = new Date(s.iniciado_en);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (ds > dateTo) return false;
    }
    return true;
  });

  useEffect(() => {
    if (filtered.length === 0) { setRows([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const ids = filtered.map((s) => s.id);
      const pointsMap: Record<string, GpsPoint[]> = {};
      const batchSize = 20;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data } = await supabase.rpc("get_multi_session_points", { p_sesion_ids: batch });
        if (data) for (const p of data as GpsPoint[]) {
          if (!pointsMap[p.sesion_id]) pointsMap[p.sesion_id] = [];
          pointsMap[p.sesion_id].push(p);
        }
      }
      const { data: allParadas } = await supabase
        .from("paradas").select("sesion_id").in("sesion_id", ids);
      const paradaCounts: Record<string, number> = {};
      for (const p of allParadas || []) paradaCounts[p.sesion_id] = (paradaCounts[p.sesion_id] || 0) + 1;

      if (cancelled) return;
      const result: RowData[] = filtered.map((s) => {
        const pts = pointsMap[s.id] || [];
        let dist = 0;
        let velSum = 0, velCount = 0;
        for (let i = 1; i < pts.length; i++) dist += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
        for (const p of pts) if (p.velocidad > 0) { velSum += p.velocidad; velCount++; }
        return {
          session: s,
          distKm: dist / 1000,
          avgSpeed: velCount > 0 ? (velSum / velCount) * 3.6 : 0,
          paradaCount: paradaCounts[s.id] || 0,
        };
      });
      setRows(result);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [filtered.map((s) => s.id).join(",")]);

  // Resumen diario
  const dailyMap: Record<string, { usuario: string; fundo: string; recorridos: number; minutos: number; km: number; paradas: number; vel: number; velN: number }> = {};
  for (const r of rows) {
    const fecha = formatDate(r.session.iniciado_en);
    const usr = resolveNombre(r.session.usuario, deviceMap);
    const key = `${fecha}|${usr}`;
    if (!dailyMap[key]) dailyMap[key] = { usuario: usr, fundo: resolveFundo(r.session, deviceMap), recorridos: 0, minutos: 0, km: 0, paradas: 0, vel: 0, velN: 0 };
    const d = dailyMap[key];
    d.recorridos++;
    d.km += r.distKm;
    d.paradas += r.paradaCount;
    if (r.avgSpeed > 0) { d.vel += r.avgSpeed; d.velN++; }
    if (r.session.terminado_en) d.minutos += (new Date(r.session.terminado_en).getTime() - new Date(r.session.iniciado_en).getTime()) / 60000;
  }

  const totalDist = rows.reduce((a, r) => a + r.distKm, 0);
  const totalParadas = rows.reduce((a, r) => a + r.paradaCount, 0);
  const totalHours = rows.reduce((a, r) => {
    if (r.session.terminado_en) return a + (new Date(r.session.terminado_en).getTime() - new Date(r.session.iniciado_en).getTime()) / 3600000;
    return a;
  }, 0);

  return (
    <div className="reportes-view">
      <div className="reportes-header">
        <h2>Reportes</h2>
        <button
          className="export-btn"
          disabled={exporting || rows.length === 0}
          onClick={async () => {
            setExporting(true);
            try { await generateExcelReport(filtered, deviceMap); } catch (e: any) { alert(e?.message || e); }
            setExporting(false);
          }}
        >{exporting ? "Generando..." : "Descargar Excel"}</button>
      </div>

      {/* Filtros */}
      <div className="reportes-filters">
        <div className="filter-group">
          <label>Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Usuario</label>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">Todos</option>
            {usuarios.map((u) => <option key={u} value={u}>{resolveNombre(u, deviceMap)}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="reportes-kpis">
        <div className="kpi">
          <span className="kpi-value">{filtered.length}</span>
          <span className="kpi-label">Recorridos</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{totalDist.toFixed(1)} km</span>
          <span className="kpi-label">Distancia total</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{totalHours.toFixed(1)} h</span>
          <span className="kpi-label">Horas total</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{totalParadas}</span>
          <span className="kpi-label">Paradas</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="reportes-tabs">
        <button className={tab === "recorridos" ? "active" : ""} onClick={() => setTab("recorridos")}>Recorridos</button>
        <button className={tab === "resumen" ? "active" : ""} onClick={() => setTab("resumen")}>Resumen Diario</button>
        <button className={tab === "paradas" ? "active" : ""} onClick={() => setTab("paradas")}>Paradas</button>
      </div>

      {/* Table */}
      <div className="reportes-table-wrap">
        {loading ? <div className="reportes-loading">Cargando datos...</div> : (
          <>
            {tab === "recorridos" && (
              <table className="reportes-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Fundo</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Duración</th>
                    <th>Distancia</th>
                    <th>Vel. Prom.</th>
                    <th>Paradas</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.session.id}>
                      <td>{formatDate(r.session.iniciado_en)}</td>
                      <td>{resolveNombre(r.session.usuario, deviceMap)}</td>
                      <td>{resolveFundo(r.session, deviceMap)}</td>
                      <td>{formatTime(r.session.iniciado_en)}</td>
                      <td>{r.session.terminado_en ? formatTime(r.session.terminado_en) : "—"}</td>
                      <td>{durationStr(r.session.iniciado_en, r.session.terminado_en)}</td>
                      <td>{r.distKm.toFixed(2)} km</td>
                      <td>{r.avgSpeed > 0 ? r.avgSpeed.toFixed(1) + " km/h" : "—"}</td>
                      <td>{r.paradaCount}</td>
                      <td><span className={`estado-tag ${r.session.terminado_en ? "finalizado" : "en-curso"}`}>{r.session.terminado_en ? "Finalizado" : "En curso"}</span></td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={10} className="empty-row">Sin datos</td></tr>}
                </tbody>
              </table>
            )}

            {tab === "resumen" && (
              <table className="reportes-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Fundo</th>
                    <th>Recorridos</th>
                    <th>Horas</th>
                    <th>Km</th>
                    <th>Paradas</th>
                    <th>Vel. Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dailyMap).map(([key, d]) => (
                    <tr key={key}>
                      <td>{key.split("|")[0]}</td>
                      <td>{d.usuario}</td>
                      <td>{d.fundo}</td>
                      <td>{d.recorridos}</td>
                      <td>{(d.minutos / 60).toFixed(1)}</td>
                      <td>{d.km.toFixed(2)}</td>
                      <td>{d.paradas}</td>
                      <td>{d.velN > 0 ? (d.vel / d.velN).toFixed(1) + " km/h" : "—"}</td>
                    </tr>
                  ))}
                  {Object.keys(dailyMap).length === 0 && <tr><td colSpan={8} className="empty-row">Sin datos</td></tr>}
                </tbody>
              </table>
            )}

            {tab === "paradas" && (
              <table className="reportes-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Sesión</th>
                    <th>Paradas</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((r) => r.paradaCount > 0).map((r) => (
                    <tr key={r.session.id}>
                      <td>{formatDate(r.session.iniciado_en)}</td>
                      <td>{resolveNombre(r.session.usuario, deviceMap)}</td>
                      <td className="mono">{r.session.id.slice(0, 8)}</td>
                      <td>{r.paradaCount}</td>
                    </tr>
                  ))}
                  {rows.filter((r) => r.paradaCount > 0).length === 0 && <tr><td colSpan={4} className="empty-row">Sin paradas</td></tr>}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
