// Tipos del panel de regadores (respuesta de /api/panel).

export type Poligono = { c: [number, number][][]; m: string; t: string; l: string };

export type RecorridoMapa = {
  id: string;
  regador: string;
  fundo: string;
  modulo: string;
  turno: string;
  fecha: string | null;
  iniciadoEn: string | null;
  km: number;
  puntos: [number, number][];
};

export type Resumen = {
  sesiones: number;
  noProgramado: number;
  detectando: number;
  sinRecorrido: number;
  conRecorrido: number;
  abiertaSin: number;
  abiertaCon: number;
  cerradaSin: number;
  cerradaCon: number;
  sinModulo: number;
  km: number;
  paradas: number;
  fotos: number;
};

export type FundoStat = { fundo: string; conRecorrido: number; sinRecorrido: number };

export type Clase = "noProgramado" | "detectando" | "sinRecorrido" | "conRecorrido";

export type ParadaMapa = {
  lat: number;
  lng: number;
  min: number | null;
  fotos: string[];
  nota?: string;
};

export type Sesion = RecorridoMapa & {
  enCurso: boolean;
  clase: Clase;
  sinModulo: boolean;
  paradas: ParadaMapa[];
  fotos: number;
  fotosSueltas: string[];
};

export type Situacion = "todas" | "noProgramado" | "conRecorrido" | "sinRecorrido";

export type Filtro = {
  desde: string;
  hasta: string;
  fundo: string;
  regador: string;
  estado: "todas" | "curso" | "cerrada";
  situacion: Situacion;
};
