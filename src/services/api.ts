const BASE = "/api";

async function request(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204 || options?.method === "HEAD") return null;
  return res.json();
}

export interface Session {
  id: string;
  fundo: string;
  modulo_origen: string | null;
  turno_origen: string | null;
  modulo_destino: string | null;
  turno_destino: string | null;
  iniciado_en: string;
  terminado_en: string | null;
  dispositivo: string | null;
  app: string | null;
  usuario: string | null;
}

export interface GpsPoint {
  id: number;
  sesion_id: string;
  lat: number;
  lng: number;
  velocidad: number;
  precision_metros: number;
  fundo: string;
  grabado_en: string;
  offline: boolean | null;
}

export interface UsuarioAutorizado {
  id: string;
  email: string;
  nombre: string | null;
  rol: string;
  activo: boolean;
  creado_en: string;
}

export interface Dispositivo {
  id: string;
  android_id: string;
  modelo: string | null;
  nombre: string | null;
  fundos_asignados: string[];
  activo: boolean;
  registrado_en: string;
  ultimo_acceso: string;
}

export interface Parada {
  id: string;
  sesion_id: string;
  lat: number;
  lng: number;
  inicio: string;
  fin: string | null;
  nota: string | null;
}

export interface ParadaFoto {
  id: string;
  parada_id: string;
  url: string;
  grabado_en: string;
}

export interface Alerta {
  id: string;
  android_id: string;
  tipo: string;
  mensaje: string | null;
  created_at: string;
  leida: boolean;
}

export async function checkUsuarioAutorizado(email: string): Promise<UsuarioAutorizado | null> {
  return request(`usuarios?email=${encodeURIComponent(email)}`);
}

export async function getUsuariosAutorizados(): Promise<UsuarioAutorizado[]> {
  return request("usuarios");
}

export async function addUsuarioAutorizado(email: string, nombre: string, rol: string) {
  return request("usuarios", { method: "POST", body: JSON.stringify({ email, nombre, rol }) });
}

export async function updateUsuarioAutorizado(id: string, updates: Partial<Pick<UsuarioAutorizado, "nombre" | "rol" | "activo">>) {
  return request("usuarios", { method: "PATCH", body: JSON.stringify({ id, ...updates }) });
}

export async function deleteUsuarioAutorizado(id: string) {
  return request(`usuarios?id=${id}`, { method: "DELETE" });
}

export async function getSessions(): Promise<Session[]> {
  return request("sessions");
}

export async function getActiveSessions(): Promise<Session[]> {
  return request("sessions?active=true");
}

export async function deleteSession(sessionId: string): Promise<void> {
  return request(`sessions?id=${sessionId}`, { method: "DELETE" });
}

export async function getSessionPoints(sessionId: string): Promise<GpsPoint[]> {
  return request(`points?sesion_id=${sessionId}`);
}

export async function getMultiSessionPoints(sessionIds: string[]): Promise<Record<string, GpsPoint[]>> {
  if (sessionIds.length === 0) return {};
  const grouped: Record<string, GpsPoint[]> = {};
  const batchSize = 10;
  for (let i = 0; i < sessionIds.length; i += batchSize) {
    const batch = sessionIds.slice(i, i + batchSize);
    const points: GpsPoint[] = await request(`points?sesion_ids=${batch.join(",")}`);
    for (const p of points) {
      if (!grouped[p.sesion_id]) grouped[p.sesion_id] = [];
      grouped[p.sesion_id].push(p);
    }
  }
  return grouped;
}

export async function getDispositivos(): Promise<Dispositivo[]> {
  return request("dispositivos");
}

export async function updateDispositivo(id: string, updates: Partial<Pick<Dispositivo, "nombre" | "fundos_asignados" | "activo">>) {
  return request("dispositivos", { method: "PATCH", body: JSON.stringify({ id, ...updates }) });
}

export async function deleteDispositivo(id: string) {
  return request(`dispositivos?id=${id}`, { method: "DELETE" });
}

export async function getDispositivoByAndroidId(androidId: string): Promise<Dispositivo | null> {
  return request(`dispositivos?android_id=${encodeURIComponent(androidId)}`);
}

export async function getParadas(sesionId: string): Promise<Parada[]> {
  return request(`paradas?sesion_id=${sesionId}`);
}

export async function getParadaFotos(paradaId: string): Promise<ParadaFoto[]> {
  return request(`parada-fotos?parada_id=${paradaId}`);
}

export async function getAlertas(limit = 50): Promise<Alerta[]> {
  return request(`alertas?limit=${limit}`);
}

export async function marcarAlertaLeida(id: string) {
  return request("alertas", { method: "PATCH", body: JSON.stringify({ id }) });
}

export async function marcarTodasLeidas() {
  return request("alertas", { method: "PATCH", body: JSON.stringify({ all: true }) });
}

export async function signOut() {
  localStorage.removeItem("usuario_email");
}
