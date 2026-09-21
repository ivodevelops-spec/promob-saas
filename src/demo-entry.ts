// src/demo-entry.ts — Punto de entrada que el servidor de demo compila con esbuild.
// Reúne las funciones Netlify y los helpers del simulador en UN solo bundle para
// que todo comparta la misma instancia de runtime (un solo repositorio en memoria).
import adminApi from "../netlify/functions/admin-api";
import checkout from "../netlify/functions/checkout";
import contact from "../netlify/functions/contact";
import cronBackup from "../netlify/functions/cron-backup";
import cronDunning from "../netlify/functions/cron-dunning";
import health from "../netlify/functions/health";
import mail from "../netlify/functions/mail";
import mpWebhook from "../netlify/functions/mp-webhook";
import subscribe from "../netlify/functions/subscribe";
import type { NetlifyHandler } from "./netlify";
import { getRuntime, resetRuntime } from "./runtime";
import { runDunning } from "./dunning";
import { failSubscriptionCharge } from "./flows";

/** Mapa de funciones disponibles para el servidor de demo (nombre → handler). */
export const functions: Record<string, NetlifyHandler> = {
  "admin-api": adminApi,
  checkout,
  contact,
  "cron-backup": cronBackup,
  "cron-dunning": cronDunning,
  health,
  mail,
  "mp-webhook": mpWebhook,
  subscribe,
};

export { getRuntime, resetRuntime, runDunning, failSubscriptionCharge };
