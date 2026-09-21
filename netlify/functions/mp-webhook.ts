// netlify/functions/mp-webhook.ts — Notificaciones de MercadoPago.
// - Verifica la firma `x-signature` (cuando MP_WEBHOOK_SECRET está configurado).
// - Deduplica por id de evento (idempotente: repetir no duplica efectos).
// - IMPORTANTE: `data.id` se lee del QUERY PARAM (así lo firma MercadoPago), no del body.
import { json, readJsonBody, serverError } from "../../src/http";
import { verifyWebhookSignature } from "../../src/mp";
import type { NetlifyHandler } from "../../src/netlify";
import { getRuntime } from "../../src/runtime";

const handler: NetlifyHandler = async (req) => {
  if (req.method !== "POST") {
    return json({ error: { code: "method_not_allowed", message: "Método no permitido." } }, 405);
  }
  try {
    const runtime = await getRuntime();
    const url = new URL(req.url);
    const dataId = url.searchParams.get("data.id");
    const requestId = req.headers.get("x-request-id");
    const xSignature = req.headers.get("x-signature");
    const secret = runtime.config.mpWebhookSecret;

    if (secret.length > 0) {
      const valid = verifyWebhookSignature({ xSignature, secret, dataId, requestId });
      if (!valid) {
        return json({ error: { code: "invalid_signature", message: "Firma inválida." } }, 401);
      }
    }

    const body = await readJsonBody<Record<string, unknown>>(req);
    const envelopeId = body?.["id"];
    const type = typeof body?.["type"] === "string" ? body["type"] : "unknown";
    const eventId =
      typeof envelopeId === "string" || typeof envelopeId === "number"
        ? String(envelopeId)
        : `${type}:${dataId ?? "sin-id"}`;

    const fresh = await runtime.repo.recordEventOnce({
      eventId,
      source: "mercadopago",
      type,
      payload: body ?? {},
      processedAt: runtime.repo.getNow(),
    });

    // Reflejo best-effort: la fuente de verdad es el recurso consultado en la API
    // de MercadoPago; en el demo solo se registra el evento (y se deduplica).
    if (dataId !== null) {
      const payment = await runtime.repo.getPaymentByMpId(dataId);
      if (payment !== null) {
        await runtime.repo.createEmailLog({
          template: "mp-webhook-traza",
          toEmail: runtime.config.ownerEmail,
          customerId: null,
          status: "sent",
          metadata: { paymentId: payment.id, eventId },
        });
      }
    }

    return json({ ok: true, duplicate: !fresh });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Error inesperado.");
  }
};

export default handler;
