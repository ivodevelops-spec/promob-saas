// netlify/functions/admin-api.ts — API del panel de gestión (lecturas + acciones).
// En modo demo la sesión es fija (sin login); en producción se cablea Supabase Auth.
import { handleAdminAction, handleAdminGet } from "../../src/admin";
import { badRequest, json, readJsonBody, serverError } from "../../src/http";
import type { NetlifyHandler } from "../../src/netlify";
import { getRuntime } from "../../src/runtime";

const handler: NetlifyHandler = async (req) => {
  try {
    const runtime = await getRuntime();
    if (!runtime.config.demoMode) {
      return json(
        {
          error: {
            code: "unauthorized",
            message: "La autenticación del panel no está configurada en esta entrega.",
          },
        },
        401,
      );
    }
    if (req.method === "GET") {
      return await handleAdminGet(runtime, new URL(req.url));
    }
    if (req.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(req);
      if (body === null) return badRequest("Body JSON inválido.");
      return await handleAdminAction(runtime, body);
    }
    return badRequest("Método no permitido.", "method_not_allowed");
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Error inesperado.");
  }
};

export default handler;
