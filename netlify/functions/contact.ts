// netlify/functions/contact.ts — Formulario de contacto: valida y notifica al dueño.
import { alertOwner } from "../../src/flows";
import { badRequest, isEmail, json, readJsonBody, serverError } from "../../src/http";
import type { NetlifyHandler } from "../../src/netlify";
import { getRuntime } from "../../src/runtime";

interface ContactBody {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  country?: unknown;
  message?: unknown;
}

const handler: NetlifyHandler = async (req) => {
  if (req.method !== "POST") return badRequest("Método no permitido.", "method_not_allowed");
  const body = await readJsonBody<ContactBody>(req);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  if (name.length === 0 || !isEmail(email) || message.length < 5) {
    return badRequest("Revise los campos: nombre, email y mensaje son obligatorios.");
  }
  try {
    const runtime = await getRuntime();
    const companyText = company.length > 0 ? ` (${company})` : "";
    await alertOwner(
      runtime,
      `Nuevo mensaje de contacto de ${name}${companyText} <${email}>: ${message}`,
    );
    return json({ ok: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Error inesperado.");
  }
};

export default handler;
