// netlify/functions/subscribe.ts — Suscripción mensual/anual (flujo demo).
import { processSubscribe } from "../../src/flows";
import { badRequest, isEmail, json, notFound, readJsonBody, serverError } from "../../src/http";
import type { NetlifyHandler } from "../../src/netlify";
import { getRuntime } from "../../src/runtime";

interface SubscribeBody {
  productSlug?: unknown;
  customer?: { fullName?: unknown; email?: unknown; country?: unknown };
  card?: { last4?: unknown };
}

const handler: NetlifyHandler = async (req) => {
  if (req.method !== "POST") return badRequest("Método no permitido.", "method_not_allowed");
  const body = await readJsonBody<SubscribeBody>(req);
  const productSlug = body?.productSlug;
  const email = body?.customer?.email;
  if (typeof productSlug !== "string" || typeof email !== "string" || !isEmail(email)) {
    return badRequest("Datos incompletos: producto y email son obligatorios.");
  }
  try {
    const runtime = await getRuntime();
    const result = await processSubscribe(runtime, {
      productSlug,
      customer: {
        fullName:
          typeof body?.customer?.fullName === "string" ? body.customer.fullName : email,
        email,
        country: typeof body?.customer?.country === "string" ? body.customer.country : "AR",
      },
      cardLast4: typeof body?.card?.last4 === "string" ? body.card.last4 : null,
    });
    if (result === null) return notFound("Producto no encontrado o no disponible.");
    return json(result);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Error inesperado.");
  }
};

export default handler;
