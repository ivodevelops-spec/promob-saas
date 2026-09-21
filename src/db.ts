// src/db.ts — Fábrica de cliente Supabase (service role). Real.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "./config";

let client: SupabaseClient | null = null;

/**
 * Devuelve un cliente Supabase autenticado con la service-role key.
 * La service-role saltea RLS (acceso full) — usarlo SOLO del lado servidor.
 */
export function getDb(): SupabaseClient {
  if (client) {
    return client;
  }
  const cfg = getConfig();
  client = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
