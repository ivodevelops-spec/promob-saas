// netlify/functions/health.ts — Estado del sistema (drivers y modo demo).
import { json, serverError } from "../../src/http";
import type { NetlifyHandler } from "../../src/netlify";
import { getRuntime } from "../../src/runtime";

const handler: NetlifyHandler = async () => {
  try {
    const { config } = await getRuntime();
    return json({
      ok: true,
      demo: config.demoMode,
      drivers: { data: config.dataDriver, pay: config.payDriver, mail: config.mailDriver },
      version: "0.1.0",
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Error inesperado.");
  }
};

export default handler;
