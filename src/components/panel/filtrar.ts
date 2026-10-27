import type { Filtro, FundoStat, Resumen, Sesion } from "./tipos";

export function pasa(sesion: Sesion, filtro: Filtro, salvo?: "fundo" | "regador") {
  if (filtro.situacion === "noProgramado" && sesion.clase !== "noProgramado") return false;
  if (filtro.situacion === "conRecorrido" && sesion.puntos.length === 0) return false;
  if (filtro.situacion === "sinRecorrido" && sesion.puntos.length > 0) return false;
  if (filtro.estado === "curso" && !sesion.enCurso) return false;
  if (filtro.estado === "cerrada" && sesion.enCurso) return false;
  if (salvo !== "fundo" && filtro.fundo && sesion.fundo !== filtro.fundo) return false;
  if (salvo !== "regador" && filtro.regador && sesion.regador !== filtro.regador) return false;
  return true;
}

export function unicos(sesiones: Sesion[], filtro: Filtro, campo: "fundo" | "regador") {
  const valores = new Set<string>();
  for (const sesion of sesiones) {
    if (pasa(sesion, filtro, campo)) valores.add(sesion[campo]);
  }
  return [...valores].sort((a, b) => a.localeCompare(b, "es"));
}

export function vistaDe(sesiones: Sesion[], filtro: Filtro) {
  const visibles = sesiones.filter((sesion) => pasa(sesion, filtro));
  const resumen: Resumen = {
    sesiones: 0,
    noProgramado: 0,
    detectando: 0,
    sinRecorrido: 0,
    conRecorrido: 0,
    abiertaSin: 0,
    abiertaCon: 0,
    cerradaSin: 0,
    cerradaCon: 0,
    sinModulo: 0,
    km: 0,
    paradas: 0,
    fotos: 0,
  };
  const porFundo = new Map<string, FundoStat>();
  for (const sesion of visibles) {
    resumen.sesiones += 1;
    resumen[sesion.clase] += 1;
    const con = sesion.puntos.length > 0;
    if (sesion.enCurso && con) resumen.abiertaCon += 1;
    else if (sesion.enCurso) resumen.abiertaSin += 1;
    else if (con) resumen.cerradaCon += 1;
    else resumen.cerradaSin += 1;
    if (sesion.sinModulo) resumen.sinModulo += 1;
    resumen.paradas += sesion.paradas?.length ?? 0;
    resumen.fotos += sesion.fotos ?? 0;
    resumen.km = Math.round((resumen.km + sesion.km) * 100) / 100;
    const slot = porFundo.get(sesion.fundo) ?? { fundo: sesion.fundo, conRecorrido: 0, sinRecorrido: 0 };
    if (con) slot.conRecorrido += 1;
    else slot.sinRecorrido += 1;
    porFundo.set(sesion.fundo, slot);
  }
  return {
    resumen,
    porFundo: [...porFundo.values()].sort(
      (a, b) => b.conRecorrido + b.sinRecorrido - (a.conRecorrido + a.sinRecorrido),
    ),
    porRegador: regadoresDe(visibles),
    recorridos: visibles.filter((sesion) => sesion.puntos.length > 1),
  };
}

export type RegadorStat = { regador: string; sesiones: number; conRecorrido: number; km: number };

function regadoresDe(sesiones: Sesion[]): RegadorStat[] {
  const mapa = new Map<string, RegadorStat>();
  for (const sesion of sesiones) {
    const slot = mapa.get(sesion.regador) ?? { regador: sesion.regador, sesiones: 0, conRecorrido: 0, km: 0 };
    slot.sesiones += 1;
    if (sesion.puntos.length > 0) slot.conRecorrido += 1;
    slot.km = Math.round((slot.km + sesion.km) * 100) / 100;
    mapa.set(sesion.regador, slot);
  }
  return [...mapa.values()].sort((a, b) => b.km - a.km || b.sesiones - a.sesiones);
}

export function conteoSituacion(sesiones: Sesion[], filtro: Filtro) {
  const abierto = { ...filtro, situacion: "todas" as const };
  const conteo = { todas: 0, noProgramado: 0, conRecorrido: 0, sinRecorrido: 0 };
  for (const sesion of sesiones) {
    if (!pasa(sesion, abierto)) continue;
    conteo.todas += 1;
    if (sesion.clase === "noProgramado") conteo.noProgramado += 1;
    if (sesion.puntos.length > 0) conteo.conRecorrido += 1;
    else conteo.sinRecorrido += 1;
  }
  return conteo;
}
