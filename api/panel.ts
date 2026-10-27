import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  options: "-c timezone=America/Lima -c statement_timeout=50000",
});

// Sesiones de un rango de fechas listas para el panel: trazo aligerado, km, paradas y fotos.
// Lee la vista public.vw_regadores (la misma que usa el panel de escritorio).
const VISTA = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(process.env.DB_VISTA || "")
  ? (process.env.DB_VISTA as string)
  : "public.vw_regadores";
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

type Punto = [number, number];

function puntosDe(recorrido: any): Punto[] {
  if (!Array.isArray(recorrido)) return [];
  const salida: Punto[] = [];
  for (const p of recorrido) {
    if (!p || typeof p !== "object" || p.lat == null || p.lng == null) continue;
    salida.push([Number(p.lat), Number(p.lng)]);
  }
  return salida;
}

function km(puntos: Punto[]) {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) {
    const [lat1, lng1] = puntos[i - 1];
    const [lat2, lng2] = puntos[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const dist = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
    if (dist <= 1.5) total += dist; // saltos de GPS mayores a 1.5 km no cuentan
  }
  return Math.round(total * 100) / 100;
}

// Douglas-Peucker sobre coordenadas proyectadas a metros (válido para áreas pequeñas).
function simplificar(puntos: Punto[], tolM: number) {
  if (puntos.length < 3) return puntos;
  const k = Math.cos((puntos[0][0] * Math.PI) / 180);
  const xy = puntos.map(([lat, lng]) => [lng * k * 111320, lat * 111320]);
  const conservar = new Array(xy.length).fill(false);
  conservar[0] = conservar[xy.length - 1] = true;
  const pila: [number, number][] = [[0, xy.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop()!;
    const [x1, y1] = xy[a];
    const [x2, y2] = xy[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const largo = Math.hypot(dx, dy);
    let lejos = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = xy[i];
      const d = largo === 0 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * (x - x1) - dx * (y - y1)) / largo;
      if (d > lejos) { lejos = d; idx = i; }
    }
    if (idx !== -1 && lejos > tolM) {
      conservar[idx] = true;
      pila.push([a, idx], [idx, b]);
    }
  }
  return puntos.filter((_, i) => conservar[i]);
}

function aligerar(puntos: Punto[], tope = 300) {
  let tol = 1.5;
  let muestra = simplificar(puntos, tol);
  while (muestra.length > tope) {
    tol *= 1.6;
    muestra = simplificar(puntos, tol);
  }
  return muestra.map(([lat, lng]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
}

const esUrl = (u: any): u is string => typeof u === "string" && u.startsWith("http");

function paradasMapa(valor: any) {
  const puntos: any[] = [];
  const urls: string[] = [];
  if (!Array.isArray(valor)) return { puntos, urls };
  for (const item of valor) {
    if (!item || typeof item !== "object") continue;
    const fotos = (Array.isArray(item.fotos) ? item.fotos : []).filter(esUrl) as string[];
    urls.push(...fotos);
    if (item.lat == null || item.lng == null) continue;
    const punto: any = {
      lat: Math.round(Number(item.lat) * 1e5) / 1e5,
      lng: Math.round(Number(item.lng) * 1e5) / 1e5,
      min: typeof item.duracion_min === "number" ? Math.round(item.duracion_min * 10) / 10 : null,
      fotos: fotos.slice(0, 4),
    };
    const nota = String(item.nota || "").trim();
    if (nota) punto.nota = nota.slice(0, 80);
    puntos.push(punto);
  }
  return { puntos, urls };
}

function clase(fundo: string, conRecorrido: boolean) {
  const nombre = (fundo || "").trim().toUpperCase();
  if (nombre === "NO PROGRAMADO") return "noProgramado";
  if (nombre === "DETECTANDO") return "detectando";
  return conRecorrido ? "conRecorrido" : "sinRecorrido";
}

// Hora de Perú (UTC-5, sin horario de verano) para que el panel no muestre UTC.
const iso = (v: any) =>
  v instanceof Date ? new Date(v.getTime() - 5 * 3600000).toISOString().slice(0, 19) + "-05:00" : v == null ? null : String(v);

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { desde, hasta } = req.query;
  if (!FECHA.test(desde || "") || !FECHA.test(hasta || "")) {
    return res.status(400).json({ error: "desde y hasta deben ser AAAA-MM-DD" });
  }
  if (desde > hasta) return res.status(400).json({ error: "La fecha inicial es posterior a la final" });

  try {
    const { rows } = await pool.query(
      `SELECT sesion_id, fecha::text AS fecha, regador, fundo, modulo, turno, iniciado_en, en_curso, paradas, fotos,
              CASE WHEN jsonb_typeof(recorrido) = 'array' AND jsonb_array_length(recorrido) > 0 THEN recorrido END AS recorrido
       FROM ${VISTA}
       WHERE fecha >= $1 AND fecha <= $2`,
      [desde, hasta]
    );

    const sesiones = rows.map((row: any) => {
      const puntos = puntosDe(row.recorrido);
      const con = puntos.length > 0;
      const cl = clase(row.fundo, con);
      const modulo = (row.modulo || "").trim().toUpperCase();
      const { puntos: paradas, urls } = paradasMapa(row.paradas);
      const enPunto = new Set(paradas.flatMap((p) => p.fotos));
      const sueltas = urls.filter((u) => !enPunto.has(u));
      for (const u of Array.isArray(row.fotos) ? row.fotos : []) {
        if (esUrl(u) && !enPunto.has(u) && !sueltas.includes(u) && sueltas.length < 6) sueltas.push(u);
      }
      return {
        id: String(row.sesion_id),
        regador: row.regador || "—",
        fundo: (row.fundo || "—").trim(),
        modulo: row.modulo || "—",
        turno: row.turno || "—",
        fecha: row.fecha,
        iniciadoEn: iso(row.iniciado_en),
        enCurso: Boolean(row.en_curso),
        clase: cl,
        sinModulo: (cl === "sinRecorrido" || cl === "conRecorrido") && modulo === "NO PROGRAMADO",
        km: con ? km(puntos) : 0,
        puntos: con ? aligerar(puntos) : [],
        paradas,
        fotos: enPunto.size + sueltas.length,
        fotosSueltas: sueltas.slice(0, 6),
      };
    });
    return res.json({ sesiones });
  } catch (e: any) {
    return res.status(503).json({ error: String(e?.message || e).split("\n")[0] });
  }
}
