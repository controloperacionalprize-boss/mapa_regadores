import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { ParadaMapa, Poligono, RecorridoMapa } from "./tipos";

function colorTrazo(rec: { clase?: string; sinModulo?: boolean }) {
  if (rec.sinModulo) return "#94a3b8";
  if (rec.clase === "noProgramado") return "#f5b942";
  if (rec.clase === "detectando") return "#3b82f6";
  return "#22c55e";
}

function esc(valor: string) {
  return valor.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Trazo = RecorridoMapa & { clase?: string; sinModulo?: boolean };

export type ParadaVisible = ParadaMapa & {
  key: string;
  sesionId: string;
  regador: string;
  fundo: string;
};

type Props = {
  poligonos: Poligono[];
  recorridos: Trazo[];
  paradas: ParadaVisible[];
  activo: string | null;
  paradaActiva: string | null;
  onElegir: (id: string) => void;
  onParada: (sesionId: string, key: string) => void;
  onLimpiar: () => void;
};

export default function Mapa({ poligonos, recorridos, paradas, activo, paradaActiva, onElegir, onParada, onLimpiar }: Props) {
  const div = useRef<HTMLDivElement>(null);
  const limpiar = useRef(onLimpiar);
  limpiar.current = onLimpiar;
  const elegir = useRef(onElegir);
  elegir.current = onElegir;
  const elegirParada = useRef(onParada);
  elegirParada.current = onParada;
  const trazos = useRef(new Map<string, { borde: L.Polyline; linea: L.Polyline }>());
  const puntos = useRef(new Map<string, { marca: L.CircleMarker; sesionId: string }>());
  const mapa = useRef<L.Map | null>(null);
  const base = useRef<L.LayerGroup | null>(null);
  const lineas = useRef<L.LayerGroup | null>(null);
  const marcas = useRef<L.LayerGroup | null>(null);
  const territorioListo = useRef(false);
  const firma = useRef("");

  useEffect(() => {
    if (!div.current || mapa.current) return;
    const m = L.map(div.current, { preferCanvas: true, zoomControl: true }).setView([-7.65, -79.38], 13);
    base.current = L.layerGroup().addTo(m);
    lineas.current = L.layerGroup().addTo(m);
    marcas.current = L.layerGroup().addTo(m);
    L.control.scale({ imperial: false, position: "bottomleft", maxWidth: 80 }).addTo(m);
    m.on("click", () => limpiar.current());
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    m.eachLayer((capa) => {
      if (capa instanceof L.TileLayer) m.removeLayer(capa);
    });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Esri World Imagery",
      crossOrigin: "anonymous",
      maxZoom: 19,
      minZoom: 10,
    }).addTo(m);
  }, []);

  useEffect(() => {
    const m = mapa.current;
    const capa = base.current;
    if (!m || !capa || poligonos.length === 0 || territorioListo.current) return;
    const limites: L.LatLngExpression[] = [];
    for (const poly of poligonos) {
      const titulo = [poly.m, poly.t && `Turno ${poly.t}`, poly.l && `Lote ${poly.l}`].filter(Boolean).join(" · ");
      for (const anillo of poly.c) {
        L.polygon(anillo, {
          color: "#ffffff",
          weight: 1,
          fillColor: "#ffffff",
          fillOpacity: 0.06,
        })
          .bindTooltip(esc(titulo), { sticky: true })
          .addTo(capa);
        limites.push(anillo[0]);
      }
    }
    if (limites.length) m.fitBounds(L.latLngBounds(limites), { padding: [16, 16] });
    territorioListo.current = true;
  }, [poligonos]);

  useEffect(() => {
    const m = mapa.current;
    const capa = lineas.current;
    if (!m || !capa) return;
    capa.clearLayers();
    trazos.current.clear();
    const limites: L.LatLngExpression[] = [];
    for (const rec of recorridos) {
      if (rec.puntos.length < 2) continue;
      const corto = rec.regador.slice(0, 8);
      const hora = rec.iniciadoEn ? rec.iniciadoEn.slice(11, 16) : "—";
      const borde = L.polyline(rec.puntos, {
        color: "#ffffff",
        interactive: false,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(capa);
      const linea = L.polyline(rec.puntos, {
        color: colorTrazo(rec),
        lineCap: "round",
        lineJoin: "round",
        bubblingMouseEvents: false,
      });
      linea.bindPopup(
        `<div class="popup-reg"><div class="popup-titulo"><b>Regador: ${esc(corto)}</b><span>›</span></div><span>Fundo: ${esc(rec.fundo)}</span><span>Módulo: ${esc(rec.modulo || "—")}</span><span>Km: ${rec.km.toFixed(1)} km</span><span>Inicio: ${esc(hora)}</span></div>`,
        { className: "popup-reg-caja", closeButton: false, offset: [80, 0] },
      );
      linea.on("click", () => elegir.current(rec.id));
      linea.addTo(capa);
      trazos.current.set(rec.id, { borde, linea });
      limites.push(rec.puntos[0], rec.puntos[rec.puntos.length - 1]);
    }
    const marca = recorridos.map((rec) => rec.id).join("|");
    if (limites.length && marca !== firma.current) {
      firma.current = marca;
      m.fitBounds(L.latLngBounds(limites), { padding: [24, 24], maxZoom: 16 });
    }
  }, [recorridos]);

  // Elegir un recorrido solo cambia el estilo: reconstruir las capas cerraría el popup abierto.
  useEffect(() => {
    for (const [id, { borde, linea }] of trazos.current) {
      const elegido = id === activo;
      const apagado = Boolean(activo) && !elegido;
      borde.setStyle({ weight: elegido ? 9 : 7, opacity: apagado ? 0.25 : 0.9 });
      linea.setStyle({ weight: elegido ? 5 : 3.5, opacity: apagado ? 0.35 : 1 });
      if (elegido) linea.bringToFront();
    }
  }, [recorridos, activo]);

  useEffect(() => {
    const capa = marcas.current;
    if (!capa) return;
    capa.clearLayers();
    puntos.current.clear();
    for (const parada of paradas) {
      const marca = L.circleMarker([parada.lat, parada.lng], {
        color: "#ffffff",
        weight: 2,
        fillColor: "#f97316",
        bubblingMouseEvents: false,
      });
      const fotos = parada.fotos.length;
      const tiempo = parada.min == null ? "—" : parada.min < 1 ? `${Math.round(parada.min * 60)} s` : `${Math.round(parada.min)} min`;
      marca.bindPopup(
        `<div class="popup-reg"><div class="popup-titulo"><b>Parada</b></div><span>Regador: ${esc(parada.regador.slice(0, 8))}</span><span>Fundo: ${esc(parada.fundo)}</span><span>Duración: ${esc(tiempo)}</span><span>${fotos} ${fotos === 1 ? "foto" : "fotos"}</span>${parada.nota ? `<span>${esc(parada.nota)}</span>` : ""}</div>`,
        { className: "popup-reg-caja", closeButton: false },
      );
      marca.on("click", () => elegirParada.current(parada.sesionId, parada.key));
      marca.addTo(capa);
      puntos.current.set(parada.key, { marca, sesionId: parada.sesionId });
    }
  }, [paradas]);

  useEffect(() => {
    for (const [key, { marca, sesionId }] of puntos.current) {
      const apagada = Boolean(activo) && sesionId !== activo;
      marca.setStyle({ fillOpacity: apagada ? 0.25 : 0.95, opacity: apagada ? 0.35 : 1 });
      marca.setRadius(key === paradaActiva ? 8 : 6);
    }
  }, [paradas, activo, paradaActiva]);

  return <div ref={div} className="mapa" />;
}
