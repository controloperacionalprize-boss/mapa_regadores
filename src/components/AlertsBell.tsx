import { useState, useEffect, useRef } from "react";
import { getAlertas, marcarAlertaLeida, marcarTodasLeidas, supabase } from "../services/supabase";
import type { Alerta, Dispositivo } from "../services/supabase";
import "./AlertsBell.css";

interface Props {
  deviceMap: Record<string, Dispositivo>;
}

export default function AlertsBell({ deviceMap }: Props) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const data = await getAlertas(30);
      setAlertas(data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("alertas-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alertas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = alertas.filter((a) => !a.leida).length;

  const resolveName = (androidId: string) => {
    const dev = deviceMap[androidId];
    return dev?.nombre || androidId.slice(0, 8);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return "hace un momento";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="alerts-bell" ref={ref}>
      <button className="alerts-bell-btn" onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="alerts-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="alerts-dropdown">
          <div className="alerts-dropdown-header">
            <span>Alertas</span>
            {unread > 0 && (
              <button className="alerts-mark-all" onClick={async () => { await marcarTodasLeidas(); load(); }}>
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="alerts-dropdown-list">
            {alertas.length === 0 ? (
              <div className="alerts-empty">Sin alertas</div>
            ) : (
              alertas.map((a) => (
                <div
                  key={a.id}
                  className={`alerts-item ${!a.leida ? "alerts-unread" : ""}`}
                  onClick={async () => { if (!a.leida) { await marcarAlertaLeida(a.id); load(); } }}
                >
                  <div className="alerts-item-icon">
                    {a.tipo === "gps_off" ? (
                      <span className="alerts-icon-off">!</span>
                    ) : (
                      <span className="alerts-icon-on">✓</span>
                    )}
                  </div>
                  <div className="alerts-item-content">
                    <div className="alerts-item-title">
                      {a.tipo === "gps_off" ? "GPS desactivado" : "GPS reactivado"}
                      <span className="alerts-item-user">{resolveName(a.android_id)}</span>
                    </div>
                    <div className="alerts-item-time">{formatTime(a.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
