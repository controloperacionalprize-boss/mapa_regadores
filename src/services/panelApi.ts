import type { Sesion } from "../components/panel/tipos";

// La consulta a la vista es pesada para la base: se piden bloques de pocos días, de uno en uno,
// y cada día cerrado se guarda en memoria. Mover el rango solo trae los días que faltan.
const VIGENCIA_HOY = 60_000;
const DIAS_POR_PEDIDO = 7;
const dias = new Map<string, { sesiones: Sesion[]; en: number }>();

function sumarDias(iso: string, n: number) {
  const f = new Date(`${iso}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
}

async function pedir(desde: string, hasta: string, senal: AbortSignal): Promise<Sesion[]> {
  const res = await fetch(`/api/panel?desde=${desde}&hasta=${hasta}`, { signal: senal });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(cuerpo?.error || "No se pudo leer el panel de regadores");
  }
  return ((await res.json()) as { sesiones: Sesion[] }).sesiones;
}

export async function cargarPanel(desde: string, hasta: string, senal: AbortSignal): Promise<Sesion[]> {
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const rango: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) rango.push(d);

  const vigente = (d: string) => {
    const c = dias.get(d);
    return !!c && (d < hoy || Date.now() - c.en < VIGENCIA_HOY);
  };
  const faltan = rango.filter((d) => d <= hoy && !vigente(d));
  for (let i = 0; i < faltan.length; i += DIAS_POR_PEDIDO) {
    const bloque = faltan.slice(i, i + DIAS_POR_PEDIDO);
    const lista = await pedir(bloque[0], bloque[bloque.length - 1], senal);
    for (const d of bloque) dias.set(d, { sesiones: lista.filter((s) => s.fecha === d), en: Date.now() });
  }
  return rango.flatMap((d) => dias.get(d)?.sesiones ?? []);
}
