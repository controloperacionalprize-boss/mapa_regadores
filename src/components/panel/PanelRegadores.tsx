import { useCallback, useEffect, useMemo, useState } from "react";
import type { PolygonData } from "../../services/kmzLoader";
import { cargarPanel } from "../../services/panelApi";
import { unicos, vistaDe, pasa } from "./filtrar";
import Graficos from "./Graficos";
import Mapa, { type ParadaVisible } from "./Mapa";
import type { Filtro, Poligono, Sesion } from "./tipos";
import "./panel.css";

function hoyLima() {
  return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
}

const estadoInicial: Filtro = {
  desde: sumarDias(hoyLima(), -6),
  hasta: hoyLima(),
  fundo: "",
  regador: "",
  estado: "todas",
  situacion: "todas",
};

function sumarDias(iso: string, dias: number) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function diasRango(desde: string, hasta: string) {
  const ms = Date.parse(hasta) - Date.parse(desde);
  return Math.round(ms / 86400000) + 1;
}

function lunesDe(iso: string) {
  const dia = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return sumarDias(iso, -dia);
}

function numeroSemana(lunes: string) {
  const jueves = new Date(`${sumarDias(lunes, 3)}T00:00:00Z`);
  const inicio = Date.UTC(jueves.getUTCFullYear(), 0, 1);
  return Math.floor((jueves.getTime() - inicio) / 604800000) + 1;
}

function corto(iso: string) {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function porcentaje(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

function fechaVisible(iso: string) {
  if (!iso) return "dd/mm/aaaa";
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

function cambio(actual: number, anterior: number) {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

function conPuntos(filas: { conRecorrido: number }[]) {
  return filas.reduce((suma, fila) => suma + fila.conRecorrido, 0);
}

export default function PanelRegadores({ polygons }: { polygons: PolygonData[] }) {
  const [filtro, setFiltro] = useState<Filtro>(estadoInicial);
  const poligonos = useMemo<Poligono[]>(
    () => polygons.map((p) => ({ c: [p.coords], m: [p.fundo, p.modulo].filter(Boolean).join(" · "), t: "", l: "" })),
    [polygons],
  );
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [activo, setActivo] = useState<string | null>(null);
  const [parada, setParada] = useState<string | null>(null);
  const [amplia, setAmplia] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [intento, setIntento] = useState(0);
  const elegir = useCallback((id: string) => {
    setActivo(id);
    setParada(null);
  }, []);
  const elegirParada = useCallback((sesionId: string, key: string) => {
    setActivo(sesionId);
    setParada((actual) => (actual === key ? null : key));
  }, []);
  const limpiarSeleccion = useCallback(() => {
    setActivo(null);
    setParada(null);
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") limpiarSeleccion();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [limpiarSeleccion]);

  useEffect(() => {
    if (!filtro.desde || !filtro.hasta) return;
    const control = new AbortController();
    const dias = diasRango(filtro.desde, filtro.hasta);
    const desdeCarga = sumarDias(filtro.desde, -dias);
    setCargando(true);
    setError("");
    // Primero el rango pedido (así el panel responde antes); el período anterior, solo para las tendencias, llega después.
    cargarPanel(filtro.desde, filtro.hasta, control.signal)
      .then((lista) => {
        if (control.signal.aborted) return;
        setSesiones(lista);
        setActivo((actual) => (lista.some((r) => r.id === actual && r.puntos.length > 1) ? actual : null));
        setCargando(false);
        return cargarPanel(desdeCarga, sumarDias(filtro.desde, -1), control.signal).then((previas) => {
          if (!control.signal.aborted) setSesiones([...previas, ...lista]);
        });
      })
      .catch((err: Error) => {
        if (!control.signal.aborted) {
          setError(err.message);
          setCargando(false);
        }
      });
    return () => control.abort();
  }, [filtro.desde, filtro.hasta, intento]);

  const actuales = useMemo(
    () => sesiones.filter((s) => s.fecha && s.fecha >= filtro.desde && s.fecha <= filtro.hasta),
    [sesiones, filtro.desde, filtro.hasta],
  );
  const previas = useMemo(
    () => sesiones.filter((s) => s.fecha && filtro.desde && s.fecha < filtro.desde),
    [sesiones, filtro.desde],
  );
  const fundos = useMemo(() => unicos(actuales, filtro, "fundo"), [actuales, filtro]);
  const regadores = useMemo(() => unicos(actuales, filtro, "regador"), [actuales, filtro]);
  const vista = useMemo(() => vistaDe(actuales, filtro), [actuales, filtro]);
  const anterior = useMemo(() => vistaDe(previas, filtro), [previas, filtro]);
  const conTrazo = conPuntos(vista.porFundo);
  const conTrazoAntes = conPuntos(anterior.porFundo);
  const cobertura = porcentaje(conTrazo, vista.resumen.sesiones);
  const coberturaAntes = porcentaje(conTrazoAntes, anterior.resumen.sesiones);
  const cortes = useMemo(() => actuales.filter((sesion) => pasa(sesion, filtro)), [actuales, filtro]);
  const paradasMapa = useMemo(() => {
    const lista: ParadaVisible[] = [];
    for (const sesion of cortes) {
      sesion.paradas?.forEach((punto, indice) => {
        lista.push({
          ...punto,
          key: `${sesion.id}-${indice}`,
          sesionId: sesion.id,
          regador: sesion.regador,
          fundo: sesion.fundo,
        });
      });
    }
    return lista;
  }, [cortes]);

  useEffect(() => {
    if (parada && !paradasMapa.some((punto) => punto.key === parada)) setParada(null);
  }, [paradasMapa, parada]);
  const fotosTira = useMemo(() => {
    const de = (sesion: (typeof cortes)[number], solo?: string) => {
      const tomadas = sesion.paradas?.flatMap((punto, indice) => {
        const key = `${sesion.id}-${indice}`;
        if (solo && key !== solo) return [];
        return punto.fotos.map((url) => url);
      }) ?? [];
      return [...tomadas, ...(solo ? [] : sesion.fotosSueltas ?? [])];
    };
    const origen = parada
      ? cortes.filter((sesion) => sesion.id === activo)
      : activo
        ? cortes.filter((sesion) => sesion.id === activo)
        : cortes;
    const urls: string[] = [];
    for (const sesion of origen) {
      for (const url of de(sesion, parada ?? undefined)) {
        if (!urls.includes(url)) urls.push(url);
        if (!parada && !activo && urls.length >= 8) return urls;
      }
    }
    return urls;
  }, [cortes, activo, parada]);

  useEffect(() => {
    setFiltro((actual) => {
      const fundo = actual.fundo && !unicos(actuales, actual, "fundo").includes(actual.fundo) ? "" : actual.fundo;
      const regador =
        actual.regador && !unicos(actuales, actual, "regador").includes(actual.regador) ? "" : actual.regador;
      if (fundo === actual.fundo && regador === actual.regador) return actual;
      return { ...actual, fundo, regador };
    });
  }, [actuales, filtro.situacion, filtro.estado, filtro.fundo, filtro.regador]);

  const semanas = useMemo(() => {
    const tope = hoyLima();
    const lista: { lunes: string; hasta: string; texto: string }[] = [];
    let lunes = lunesDe(tope);
    for (let n = 0; n < 26; n += 1, lunes = sumarDias(lunes, -7)) {
      const domingo = sumarDias(lunes, 6);
      const hasta = domingo > tope ? tope : domingo;
      lista.push({ lunes, hasta, texto: `Sem ${numeroSemana(lunes)} · ${corto(lunes)} – ${corto(hasta)}` });
    }
    return lista;
  }, []);
  const semanaActual = semanas.find((w) => w.lunes === filtro.desde && w.hasta === filtro.hasta)?.lunes ?? "";
  const elegirSemana = (lunes: string) => {
    const semana = semanas.find((w) => w.lunes === lunes);
    if (semana) setFiltro((prev) => ({ ...prev, desde: semana.lunes, hasta: semana.hasta }));
  };

  const poner = (parcial: Partial<Filtro>) => setFiltro((prev) => ({ ...prev, ...parcial }));
  const r = vista.resumen;
  const a = anterior.resumen;

  return (
    <div className="pagina panel-regadores">
      <header className="barra">
        <div className="controles">
          <div className="fechas">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            <label className="fecha-campo">
              <span>{fechaVisible(filtro.desde)}</span>
              <input type="date" onClick={(e) => e.currentTarget.showPicker?.()} value={filtro.desde} max={filtro.hasta || hoyLima()} onChange={(e) => poner({ desde: e.target.value })} />
            </label>
            <span className="sep">–</span>
            <label className="fecha-campo">
              <span>{fechaVisible(filtro.hasta)}</span>
              <input type="date" onClick={(e) => e.currentTarget.showPicker?.()} value={filtro.hasta} min={filtro.desde || undefined} max={hoyLima()} onChange={(e) => poner({ hasta: e.target.value })} />
            </label>
          </div>
          <label>
            Semana
            <select value={semanaActual} onChange={(e) => elegirSemana(e.target.value)}>
              <option value="" disabled>
                Personalizado
              </option>
              {semanas.map((w) => (
                <option key={w.lunes} value={w.lunes}>
                  {w.texto}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fundo
            <select value={filtro.fundo} onChange={(e) => poner({ fundo: e.target.value })}>
              <option value="">Todos</option>
              {fundos.map((fundo) => (
                <option key={fundo}>{fundo}</option>
              ))}
            </select>
          </label>
          <label>
            Regador
            <select value={filtro.regador} onChange={(e) => poner({ regador: e.target.value })}>
              <option value="">Todos</option>
              {regadores.map((regador) => (
                <option key={regador}>{regador}</option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select value={filtro.estado} onChange={(e) => poner({ estado: e.target.value as Filtro["estado"] })}>
              <option value="todas">Todas</option>
              <option value="curso">En curso</option>
              <option value="cerrada">Cerradas</option>
            </select>
          </label>
        </div>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
          <button type="button" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </p>
      )}

      <section className="kpis">
        <article className="pr-kpi kpi-cobertura">
          <div className="anillo" style={{ background: `conic-gradient(#22c55e ${cobertura}%, #e7f6ee 0)` }}>
            <span>{cobertura}%</span>
          </div>
          <div>
            <p>Cobertura</p>
            <Tendencia valor={cambio(cobertura, coberturaAntes)} />
          </div>
        </article>
        <Kpi icono="cal" tono="azul" valor={String(r.sesiones)} nombre="Sesiones" delta={cambio(r.sesiones, a.sesiones)} />
        <Kpi icono="ok" tono="verde" valor={String(conTrazo)} nombre="Con recorrido" delta={cambio(conTrazo, conTrazoAntes)} />
        <Kpi icono="alerta" tono="rojo" valor={String(r.sesiones - conTrazo)} nombre="Sin recorrido" delta={cambio(r.sesiones - conTrazo, a.sesiones - conTrazoAntes)} inverso />
        <Kpi icono="pin" tono="azul" valor={`${r.km.toFixed(1)} km`} nombre="Kilómetros" delta={cambio(r.km, a.km)} />
      </section>

      <section className={`escenario ${cargando ? "atenuado" : ""}`}>
        <div className="mapa-caja">
          <div className="pestanas" role="group" aria-label="Situación">
            {(
              [
                ["todas", "Todos"],
                ["conRecorrido", "Con recorrido"],
                ["sinRecorrido", "Sin recorrido"],
                ["noProgramado", "No programados"],
              ] as const
            ).map(([id, texto]) => (
              <button key={id} type="button" className={filtro.situacion === id ? "activa" : ""} onClick={() => poner({ situacion: id })}>
                {texto}
              </button>
            ))}
          </div>
          <Mapa
            poligonos={poligonos}
            recorridos={vista.recorridos}
            paradas={paradasMapa}
            activo={activo}
            paradaActiva={parada}
            onElegir={elegir}
            onParada={elegirParada}
            onLimpiar={limpiarSeleccion}
          />
          <aside className="leyenda-mapa">
            <strong>Estado de recorrido</strong>
            <span><i className="c-ok" /> Con recorrido</span>
            <span><i className="c-no" /> Sin recorrido</span>
            <span><i className="c-prog" /> No programado</span>
            <span><i className="c-mod" /> Sin módulo</span>
            <span><i className="c-parada" /> Parada</span>
          </aside>
          {fotosTira.length > 0 && (
            <div className="tira-fotos">
              <div>
                <strong>{parada ? "Fotos de la parada" : activo ? "Fotos del recorrido" : "Fotos del corte"}</strong>
                <span>{fotosTira.length}</span>
              </div>
              <div className="miniaturas">
                {fotosTira.map((url) => (
                  <button key={url} type="button" onClick={() => setAmplia(url)}>
                    <img src={url} alt="Foto de la parada" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="corte">
          <h2>Análisis del corte</h2>
          <div className="corte-cuerpo">
            <div className="anillo grande" style={{ background: `conic-gradient(#22c55e ${cobertura}%, #e8eef5 0)` }}>
              <span>
                <strong>{cobertura}%</strong>
                Con trazo
              </span>
            </div>
            <ul className="corte-cifras">
              <li>
                <span className="mini cal" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                </span>
                <div><b>{r.sesiones}</b>Sesiones</div>
              </li>
              <li>
                <span className="mini pin" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
                </span>
                <div><b>{r.km.toFixed(1)} km</b>Kilómetros</div>
              </li>
              <li>
                <span className="mini gente" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3 3-5 6-5s5.4 2 6 5" /><circle cx="17" cy="9" r="2.2" /><path d="M16 14c2.2.3 3.8 1.6 4.5 4" /></svg>
                </span>
                <div><b>{vista.porRegador.length}</b>Regadores</div>
              </li>
            </ul>
          </div>
          <div className="corte-extra">
            <div>
              <b>{r.paradas}</b>
              <span>Paradas</span>
            </div>
            <div>
              <b>{r.fotos}</b>
              <span>Fotos</span>
            </div>
          </div>
          <h3>Alertas</h3>
          <ul className="alertas">
            <li>
              <button type="button" onClick={() => poner({ situacion: "sinRecorrido" })}>
                <span className="bola rojo" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 2 20h20L12 3z" /><path d="M12 9v5M12 17h.01" /></svg>
                </span>
                <b>{r.sesiones - conTrazo}</b>
                <span>Sesiones sin recorrido</span>
                <svg className="mas" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
              </button>
            </li>
            <li>
              <button type="button" onClick={() => poner({ situacion: "noProgramado" })}>
                <span className="bola ambar" aria-hidden="true" />
                <b>{r.noProgramado}</b>
                <span>Sesiones no programadas</span>
                <svg className="mas" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
              </button>
            </li>
            <li>
              <button type="button" onClick={() => poner({ situacion: "todas" })}>
                <span className="bola verde" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12.5 10 17 19 7" /></svg>
                </span>
                <b>{r.sinModulo}</b>
                <span>Sesiones sin módulo</span>
                <svg className="mas" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
              </button>
            </li>
          </ul>
        </aside>
      </section>
      <Graficos
        resumen={r}
        porFundo={vista.porFundo}
        porRegador={vista.porRegador}
        fundoActivo={filtro.fundo}
        regadorActivo={filtro.regador}
        onFundo={(fundo) => poner({ fundo })}
        onRegador={(regador) => poner({ regador })}
      />
      {amplia && (
        <button type="button" className="luz" onClick={() => setAmplia(null)} aria-label="Cerrar foto">
          <img src={amplia} alt="Foto ampliada" />
        </button>
      )}
    </div>
  );
}

function Tendencia({ valor, inverso = false }: { valor: number | null; inverso?: boolean }) {
  if (valor === null) return <p className="tendencia">Sin período anterior</p>;
  if (valor === 0) return <p className="tendencia">Igual que el período anterior</p>;
  const sube = valor > 0;
  const baja = valor < 0;
  const bien = inverso ? baja : sube || valor === 0;
  const flecha = sube ? "▲" : baja ? "▼" : "·";
  return (
    <p className={bien ? "tendencia bien" : "tendencia mal"}>
      {flecha} {Math.abs(valor)}% vs. período anterior
    </p>
  );
}

function Kpi({
  icono,
  tono,
  valor,
  nombre,
  delta,
  inverso = false,
}: {
  icono: "cal" | "ok" | "alerta" | "pin";
  tono: "azul" | "verde" | "rojo";
  valor: string;
  nombre: string;
  delta: number | null;
  inverso?: boolean;
}) {
  return (
    <article className={`pr-kpi ${tono === "rojo" ? "kpi-alerta" : ""}`}>
      <span className={`icono ${tono}`} aria-hidden="true">
        {icono === "cal" && (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        )}
        {icono === "ok" && (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5 11 15.5 16 9" />
          </svg>
        )}
        {icono === "alerta" && (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3 2 20h20L12 3z" />
            <path d="M12 9v5M12 17h.01" />
          </svg>
        )}
        {icono === "pin" && (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.2" />
          </svg>
        )}
      </span>
      <div>
        <strong>{valor}</strong>
        <p>{nombre}</p>
        <Tendencia valor={delta} inverso={inverso} />
      </div>
    </article>
  );
}
