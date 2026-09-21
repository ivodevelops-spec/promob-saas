// netlify/functions/cron-dunning.ts — Cron diario de mora (función programada).
// El cron es el ÚNICO que envía emails de dunning; los webhooks no envían nada.
import { runDunning } from "../../src/dunning";
import { json, serverError } from "../../src/http";
import type { NetlifyFunctionConfig, NetlifyHandler } from "../../src/netlify";
import { getRuntime } from "../../src/runtime";

export const config: NetlifyFunctionConfig = { schedule: "@daily" };

const handler: NetlifyHandler = async () => {
  try {
    const runtime = await getRuntime();
    const result = await runDunning(runtime);
    return json({ ok: true, ...result });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Error inesperado.");
  }
};

export default handler;
