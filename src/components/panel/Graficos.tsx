import { useState } from "react";
import type { FundoStat, Resumen } from "./tipos";
import type { RegadorStat } from "./filtrar";

type Props = {
  resumen: Resumen;
  porFundo: FundoStat[];
  porRegador: RegadorStat[];
  fundoActivo: string;
  regadorActivo: string;
  onFundo: (fundo: string) => void;
  onRegador: (regador: string) => void;
};

function porcentaje(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

function colorFundo(valor: number) {
  if (valor >= 75) return "#22c55e";
  if (valor >= 50) return "#3b82f6";
  if (valor >= 35) return "#e8b931";
  return "#ef4444";
}

function iniciales(id: string) {
  const limpio = id.replace(/[^a-z0-9]/gi, "");
  return (limpio.slice(0, 2) || "—").toUpperCase();
}

const COLORES = ["#16a34a", "#ef6b4a", "#e8b931", "#94a3b8", "#3b82f6"];

export default function Graficos({ resumen, porFundo, porRegador, fundoActivo, regadorActivo, onFundo, onRegador }: Props) {
  const [fundosAbiertos, setFundosAbiertos] = useState(false);
  const [regadoresAbiertos, setRegadoresAbiertos] = useState(false);
  const conTrazo = porFundo.reduce((suma, fila) => suma + fila.conRecorrido, 0);
  const sinTrazo = porFundo.reduce((suma, fila) => suma + fila.sinRecorrido, 0);
  const total = conTrazo + sinTrazo || 1;
  const anillo = [
    { nombre: "Con recorrido", n: conTrazo, color: COLORES[0] },
    { nombre: "Sin recorrido", n: sinTrazo, color: COLORES[1] },
  ];
  const extras = [
    { nombre: "No programado", n: resumen.noProgramado, color: COLORES[2] },
    { nombre: "Sin módulo", n: resumen.sinModulo, color: COLORES[3] },
  ];
  let cursor = 0;
  const arcos = anillo.map((parte) => {
    const arco = { ...parte, inicio: cursor };
    cursor += (parte.n / total) * 100;
    return arco;
  });
  const gradiente = arcos.map((arco) => `${arco.color} ${arco.inicio}% ${arco.inicio + (arco.n / total) * 100}%`).join(", ");
  const fundos = [...porFundo]
    .sort((a, b) => b.conRecorrido + b.sinRecorrido - (a.conRecorrido + a.sinRecorrido))
    .slice(0, fundosAbiertos ? porFundo.length : 6);
  const regadores = porRegador.slice(0, regadoresAbiertos ? porRegador.length : 5);

  return (
    <section className="graficos">
      <article className="tarjeta">
        <header className="tarjeta-cabeza">
          <h2>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 19V5M4 19h16" /><path d="M8 16v-5M12 16V8M16 16v-3" /></svg>
            Cobertura por fundo
          </h2>
          {porFundo.length > 6 && (
            <button type="button" onClick={() => setFundosAbiertos((v) => !v)}>
              {fundosAbiertos ? "Ver menos" : "Ver todos"}
            </button>
          )}
        </header>
        <ul className="barras">
          {fundos.map((fila) => {
            const sesiones = fila.conRecorrido + fila.sinRecorrido;
            const cobertura = porcentaje(fila.conRecorrido, sesiones);
            return (
              <li key={fila.fundo}>
                <button
                  type="button"
                  className={fundoActivo === fila.fundo ? "activa" : ""}
                  onClick={() => onFundo(fundoActivo === fila.fundo ? "" : fila.fundo)}
                >
                  <span>{fila.fundo}</span>
                  <i>
                    <b style={{ width: `${cobertura}%`, background: colorFundo(cobertura) }} />
                  </i>
                  <em>{cobertura}%</em>
                </button>
              </li>
            );
          })}
        </ul>
      </article>

      <article className="tarjeta">
        <header className="tarjeta-cabeza">
          <h2>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3 3-5 6-5s5.4 2 6 5" /><circle cx="17" cy="9" r="2.2" /></svg>
            Rendimiento por regador
          </h2>
          {porRegador.length > 5 && (
            <button type="button" onClick={() => setRegadoresAbiertos((v) => !v)}>
              {regadoresAbiertos ? "Ver menos" : "Ver todos"}
            </button>
          )}
        </header>
        <div className="columnas"><span>Regador</span><span>Kilómetros</span></div>
        <ol className="ranking">
          {regadores.map((fila, indice) => (
            <li key={fila.regador}>
              <button
                type="button"
                className={regadorActivo === fila.regador ? "activa" : ""}
                onClick={() => onRegador(regadorActivo === fila.regador ? "" : fila.regador)}
              >
                <b>{indice + 1}</b>
                <span className="avatar" style={{ background: COLORES[indice % COLORES.length] }}>
                  {iniciales(fila.regador)}
                </span>
                <strong>{fila.regador}</strong>
                <em>{fila.km.toFixed(1)}</em>
              </button>
            </li>
          ))}
        </ol>
      </article>

      <article className="tarjeta">
        <header className="tarjeta-cabeza">
          <h2>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 19V5M4 19h16" /><path d="m7 14 4-4 3 3 5-6" /></svg>
            Sesiones por estado
          </h2>
        </header>
        <div className="dona-bloque">
          <div className="dona grande" style={{ background: `conic-gradient(${gradiente})` }}>
            <span>
              <strong>{resumen.sesiones}</strong>
              Sesiones
            </span>
          </div>
          <ul>
            {[...anillo, ...extras].map((parte) => (
              <li key={parte.nombre}>
                <i style={{ background: parte.color }} />
                {parte.nombre}
                <b>{parte.n}</b>
                <em>{porcentaje(parte.n, resumen.sesiones)}%</em>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </section>
  );
}
