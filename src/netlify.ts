// src/netlify.ts — Tipos mínimos para Netlify Functions v2 (sin dep @netlify/functions).

/** Contexto inyectado por Netlify a cada función (subconjunto usado). */
export interface NetlifyContext {
  readonly requestId: string;
  readonly ip?: string;
  readonly log: (...args: unknown[]) => void;
  readonly [key: string]: unknown;
}

/** Firma de un handler de Netlify Functions v2 (web standard Request/Response). */
export type NetlifyHandler = (
  req: Request,
  context: NetlifyContext,
) => Response | Promise<Response>;

/** Config de función v2 (p. ej. `schedule` para funciones programadas). */
export interface NetlifyFunctionConfig {
  readonly schedule?: string;
  readonly [key: string]: unknown;
}

/** Respuesta 501 estándar para funciones aún no implementadas. */
export function notImplemented(wave: "W1" | "W2" | "W3" | "W4"): Response {
  return new Response(
    JSON.stringify({ error: "not implemented", todo: wave }),
    { status: 501, headers: { "content-type": "application/json" } },
  );
}
