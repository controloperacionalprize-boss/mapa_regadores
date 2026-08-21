import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://svlsyanlqkpemqvvifpr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2bHN5YW5scWtwZW1xdnZpZnByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MzM1NjAsImV4cCI6MjA5MzUwOTU2MH0.-hqqr08pVRK-sI4C3VtMiBPUz_2sTQjttBrZJY71fyw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
}

export interface UsuarioAutorizado {
  id: string;
  email: string;
  nombre: string | null;
  rol: string;
  activo: boolean;
  creado_en: string;
}

export async function checkUsuarioAutorizado(email: string): Promise<UsuarioAutorizado | null> {
  const { data } = await supabase
    .from("usuarios_autorizados")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .eq("activo", true)
    .maybeSingle();
  return data;
}

export async function getUsuariosAutorizados(): Promise<UsuarioAutorizado[]> {
  const { data, error } = await supabase
    .from("usuarios_autorizados")
    .select("*")
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addUsuarioAutorizado(email: string, nombre: string, rol: string) {
  const { error } = await supabase
    .from("usuarios_autorizados")
    .insert({ email: email.toLowerCase().trim(), nombre, rol });
  if (error) throw error;
}

export async function updateUsuarioAutorizado(id: string, updates: Partial<Pick<UsuarioAutorizado, "nombre" | "rol" | "activo">>) {
  const { error } = await supabase
    .from("usuarios_autorizados")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteUsuarioAutorizado(id: string) {
  const { error } = await supabase
    .from("usuarios_autorizados")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getActiveSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sesiones_gps")
    .select("*")
    .eq("app", "mapa_regadores")
    .is("terminado_en", null)
    .order("iniciado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sesiones_gps")
    .select("*")
    .eq("app", "mapa_regadores")
    .order("iniciado_en", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getSessionPoints(sessionId: string): Promise<GpsPoint[]> {
  const { data, error } = await supabase
    .from("punto_gps")
    .select("*")
    .eq("sesion_id", sessionId)
    .order("grabado_en", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getMultiSessionPoints(sessionIds: string[]): Promise<Record<string, GpsPoint[]>> {
  if (sessionIds.length === 0) return {};
  const { data, error } = await supabase
    .from("punto_gps")
    .select("*")
    .in("sesion_id", sessionIds)
    .order("grabado_en", { ascending: true });
  if (error) throw error;
  const grouped: Record<string, GpsPoint[]> = {};
  (data || []).forEach((p) => {
    if (!grouped[p.sesion_id]) grouped[p.sesion_id] = [];
    grouped[p.sesion_id].push(p);
  });
  return grouped;
}
