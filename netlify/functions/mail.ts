// netlify/functions/mail.ts — Envío puntual de una plantilla (uso interno/demo).
// Protegido con `x-cron-secret` cuando CRON_SECRET está configurado.
import type { EmailTemplateName } from "../../src/emails";
import { badRequest, json, readJsonBody, serverError } from "../../src/http";
import type { NetlifyHandler } from "../../src/netlify";
import { getRuntime } from "../../src/runtime";

interface MailBody {
  template?: unknown;
  to?: unknown;
  vars?: unknown;
  customerId?: unknown;
}

const handler: NetlifyHandler = async (req) => {
  if (req.method !== "POST") return badRequest("Método no permitido.", "method_not_allowed");
  const body = await readJsonBody<MailBody>(req);
  const template = typeof body?.template === "string" ? body.template : null;
  const to = typeof body?.to === "string" ? body.to : null;
  if (template === null || to === null) return badRequest("Faltan `template` o `to`.");
  try {
    const runtime = await getRuntime();
    const secret = runtime.config.cronSecret;
    if (secret.length > 0 && req.headers.get("x-cron-secret") !== secret) {
      return json({ error: { code: "unauthorized", message: "Credencial inválida." } }, 401);
    }
    const vars = (
      typeof body?.vars === "object" && body.vars !== null ? body.vars : {}
    ) as Record<string, string>;
    const result = await runtime.mailer.sendTemplate(template as EmailTemplateName, to, vars, {
      customerId: typeof body?.customerId === "string" ? body.customerId : null,
    });
    if (!result.ok) return json({ ok: false, error: result.error ?? "No se pudo enviar." }, 502);
    return json({ ok: true, file: result.file ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return serverError(message);
  }
};

export default handler;
