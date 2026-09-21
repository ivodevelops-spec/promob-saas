// src/runtime.ts — Composición de la "runtime" del sistema: configuración + drivers
// (repositorio, mailer, simulador de pagos). Un solo repositorio por proceso.
//
// El modo demo (default) usa memoria + mock + outbox: cero cuentas externas.
import path from "node:path";
import { getConfig, type AppConfig } from "./config";
import { createMemoryRepository, type MemoryRepository } from "./db/memory";
import { createMailer, type Mailer } from "./mail";
import { createMockPay, type MockPayInput, type MockPayResult } from "./mp";

/** Runtime compartida por funciones y servidor de demo. */
export interface Runtime {
  readonly config: AppConfig;
  readonly repo: MemoryRepository;
  readonly mailer: Mailer;
  readonly mockPay: (input: MockPayInput) => MockPayResult;
}

let cached: Promise<Runtime> | null = null;

/** Devuelve (y cachea) la runtime del proceso. */
export function getRuntime(): Promise<Runtime> {
  cached ??= buildRuntime();
  return cached;
}

/** Reinicia la runtime (el simulador del demo lo usa para re-sembrar). */
export function resetRuntime(): void {
  cached = null;
}

async function buildRuntime(): Promise<Runtime> {
  const config = getConfig();
  if (config.dataDriver !== "memory") {
    throw new Error(
      "El driver de datos `supabase` todavía no está cableado en la runtime (pendiente).",
    );
  }
  const repo = await createMemoryRepository({
    filePath: path.join(config.outDir, "demo-db.json"),
  });
  const mailer = createMailer({
    driver: config.mailDriver,
    repo,
    outDir: config.outDir,
    from: config.mailFrom,
    resendApiKey: config.resendApiKey,
  });
  const mockPay = createMockPay();
  return { config, repo, mailer, mockPay };
}
