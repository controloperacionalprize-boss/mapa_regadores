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
