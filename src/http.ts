// src/http.ts — Helpers HTTP para las funciones (respuestas JSON y lectura de body).

/** Respuesta JSON con content-type correcto. */
export function json(data: unknown, init?: number | ResponseInit): Response {
  const responseInit: ResponseInit = typeof init === "number" ? { status: init } : (init ?? {});
  return new Response(JSON.stringify(data), {
    ...responseInit,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(responseInit.headers ?? {}),
    },
  });
}

/** Error 400 con el shape `{ error: { code, message } }` del contrato. */
export function badRequest(message: string, code = "bad_request"): Response {
  return json({ error: { code, message } }, 400);
}

/** Error 404 con el shape del contrato. */
export function notFound(message: string, code = "not_found"): Response {
  return json({ error: { code, message } }, 404);
}

/** Error 500 con el shape del contrato. */
export function serverError(message: string, code = "server_error"): Response {
  return json({ error: { code, message } }, 500);
}

/** Lee y parsea el body JSON; devuelve `null` si no es JSON válido. */
export async function readJsonBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Fecha solo-día (YYYY-MM-DD) desplazada `days` días desde un ISO dado. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

/** ¿El string parece un email? Validación mínima de servidor. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
