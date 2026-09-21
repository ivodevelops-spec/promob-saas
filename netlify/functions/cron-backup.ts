// netlify/functions/cron-backup.ts — Respaldo diario del archivo de datos del demo.
// (En producción este respaldo lo cubre Supabase Pro; acá queda el hook local.)
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { json, serverError } from "../../src/http";
import type { NetlifyFunctionConfig, NetlifyHandler } from "../../src/netlify";
import { getRuntime } from "../../src/runtime";

export const config: NetlifyFunctionConfig = { schedule: "@daily" };

const handler: NetlifyHandler = async () => {
  try {
    const runtime = await getRuntime();
    const source = path.join(runtime.config.outDir, "demo-db.json");
    const backupsDir = path.join(runtime.config.outDir, "backups");
    await mkdir(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const target = path.join(backupsDir, `demo-db-${stamp}.json`);
    try {
      await copyFile(source, target);
      return json({ ok: true, file: target });
    } catch {
      return json({ ok: false, message: "No hay archivo de datos para respaldar." });
    }
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Error inesperado.");
  }
};

export default handler;
