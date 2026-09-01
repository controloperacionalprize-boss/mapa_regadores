import * as XLSX from "xlsx";
import { supabase } from "./supabase";
import type { Session, Dispositivo } from "./supabase";

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
  return dev?.nombre || usuario;
}

function resolveFundo(session: Session, deviceMap: Record<string, Dispositivo>) {
  if (session.fundo) return session.fundo;
  if (session.usuario) {
    const dev = deviceMap[session.usuario];
    if (dev?.fundos_asignados?.length) return dev.fundos_asignados.join(", ");
  }
  return "—";
}

function formatDateLocal(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatTimeLocal(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export async function generateExcelReport(sessions: Session[], deviceMap: Record<string, Dispositivo>) {
  const wb = XLSX.utils.book_new();

  // 1. Hoja: Recorridos
  const recorridosData: any[] = [];
  const sessionPoints: Record<string, any[]> = {};

  // Fetch points for all sessions
  const allSessionIds = sessions.map((s) => s.id);
  const batchSize = 20;
  for (let i = 0; i < allSessionIds.length; i += batchSize) {
    const batch = allSessionIds.slice(i, i + batchSize);
    const { data } = await supabase.rpc("get_multi_session_points", { p_sesion_ids: batch });
    if (data) {
      for (const p of data as any[]) {
        if (!sessionPoints[p.sesion_id]) sessionPoints[p.sesion_id] = [];
        sessionPoints[p.sesion_id].push(p);
      }
    }
  }

  // Fetch all paradas
  const { data: allParadas } = await supabase
    .from("paradas")
    .select("*")
    .in("sesion_id", allSessionIds)
    .order("inicio", { ascending: true });
  const paradasBySesion: Record<string, any[]> = {};
  for (const p of allParadas || []) {
    if (!paradasBySesion[p.sesion_id]) paradasBySesion[p.sesion_id] = [];
    paradasBySesion[p.sesion_id].push(p);
  }

  for (const s of sessions) {
    const pts = sessionPoints[s.id] || [];
    let distancia = 0;
    let velSum = 0;
    let velCount = 0;
    for (let i = 1; i < pts.length; i++) {
      distancia += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    }
    for (const p of pts) {
      if (p.velocidad > 0) { velSum += p.velocidad; velCount++; }
    }

    const durSec = s.terminado_en
      ? (new Date(s.terminado_en).getTime() - new Date(s.iniciado_en).getTime()) / 1000
      : 0;
    const durMin = Math.round(durSec / 60);
    const paradasCount = (paradasBySesion[s.id] || []).length;
    const avgSpeedKmh = velCount > 0 ? (velSum / velCount) * 3.6 : 0;

    recorridosData.push({
      Fecha: formatDateLocal(s.iniciado_en),
      Usuario: resolveNombre(s.usuario, deviceMap),
      Dispositivo: s.dispositivo || "—",
      Fundo: resolveFundo(s, deviceMap),
      "Hora Inicio": formatTimeLocal(s.iniciado_en),
      "Hora Fin": s.terminado_en ? formatTimeLocal(s.terminado_en) : "En curso",
      "Duración (min)": durMin || "—",
      "Distancia (km)": +(distancia / 1000).toFixed(2),
      "Vel. Promedio (km/h)": +avgSpeedKmh.toFixed(1),
      Paradas: paradasCount,
      Estado: s.terminado_en ? "Finalizado" : "En curso",
    });
  }

  const wsRecorridos = XLSX.utils.json_to_sheet(recorridosData);
  wsRecorridos["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRecorridos, "Recorridos");

  // 2. Hoja: Paradas
  const paradasData: any[] = [];
  for (const s of sessions) {
    const paradas = paradasBySesion[s.id] || [];
    for (const p of paradas) {
      const durParada = p.fin
        ? Math.round((new Date(p.fin).getTime() - new Date(p.inicio).getTime()) / 1000 / 60)
        : 0;
      paradasData.push({
        Fecha: formatDateLocal(s.iniciado_en),
        Usuario: resolveNombre(s.usuario, deviceMap),
        "Sesión": s.id.slice(0, 8),
        "Hora Inicio": formatTimeLocal(p.inicio),
        "Hora Fin": p.fin ? formatTimeLocal(p.fin) : "—",
        "Duración (min)": durParada || "—",
        Lat: p.lat,
        Lng: p.lng,
        Nota: p.nota || "",
      });
    }
  }

  const wsParadas = XLSX.utils.json_to_sheet(paradasData);
  wsParadas["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsParadas, "Paradas");

  // 3. Hoja: Resumen Diario
  const dailyMap: Record<string, {
    usuario: string; fundo: string; recorridos: number;
    minutos: number; km: number; paradas: number; velSum: number; velCount: number;
  }> = {};

  for (const s of sessions) {
    const fecha = formatDateLocal(s.iniciado_en);
    const usuario = resolveNombre(s.usuario, deviceMap);
    const key = `${fecha}|${usuario}`;
    if (!dailyMap[key]) {
      dailyMap[key] = {
        usuario, fundo: resolveFundo(s, deviceMap),
        recorridos: 0, minutos: 0, km: 0, paradas: 0, velSum: 0, velCount: 0,
      };
    }
    const d = dailyMap[key];
    d.recorridos++;

    const pts = sessionPoints[s.id] || [];
    let dist = 0;
    for (let i = 1; i < pts.length; i++) dist += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    d.km += dist / 1000;

    for (const p of pts) {
      if (p.velocidad > 0) { d.velSum += p.velocidad; d.velCount++; }
    }

    if (s.terminado_en) {
      d.minutos += (new Date(s.terminado_en).getTime() - new Date(s.iniciado_en).getTime()) / 1000 / 60;
    }
    d.paradas += (paradasBySesion[s.id] || []).length;
  }

  const resumenData = Object.entries(dailyMap).map(([key, d]) => ({
    Fecha: key.split("|")[0],
    Usuario: d.usuario,
    Fundo: d.fundo,
    "Total Recorridos": d.recorridos,
    "Total Horas": +(d.minutos / 60).toFixed(1),
    "Total Km": +d.km.toFixed(2),
    "Total Paradas": d.paradas,
    "Vel. Promedio (km/h)": d.velCount > 0 ? +((d.velSum / d.velCount) * 3.6).toFixed(1) : 0,
  }));

  const wsResumen = XLSX.utils.json_to_sheet(resumenData);
  wsResumen["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Diario");

  // Download
  const today = new Date();
  const fileName = `Reporte_Regadores_${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
