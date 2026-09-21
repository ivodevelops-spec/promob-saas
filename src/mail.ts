// src/mail.ts — Envío de correos transaccionales con drivers intercambiables.
//
// - `outbox` (modo demo): renderiza el HTML y lo escribe en `out/outbox/*.html`.
//   Registra cada envío en `email_logs`. No necesita ninguna cuenta externa.
// - `resend` (producción): POST a la API de Resend. Nunca lanza: los fallos se
//   registran en `email_logs` con estado `failed` y se devuelven como `{ ok: false }`.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getTemplate, type EmailTemplateName } from "./emails";
import type { Repository } from "./db/types";
import type { MailDriver } from "./config";

/** Resultado de un envío de correo. */
export interface SendResult {
  readonly ok: boolean;
  readonly file?: string;
  readonly error?: string;
}

/** Contrato del mailer (mismo para outbox y Resend). */
export interface Mailer {
  sendTemplate(
    name: EmailTemplateName,
    to: string,
    vars: Record<string, string>,
    options?: { readonly customerId?: string | null; readonly dedupeKey?: string },
  ): Promise<SendResult>;
}

export interface MailerOptions {
  readonly driver: MailDriver;
  readonly repo: Repository;
  readonly outDir: string;
  readonly from: string;
  readonly resendApiKey?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Crea el mailer según el driver configurado. */
export function createMailer(options: MailerOptions): Mailer {
  const { driver, repo, outDir, from, resendApiKey } = options;

  async function record(
    name: EmailTemplateName,
    to: string,
    subject: string | null,
    customerId: string | null,
    status: "sent" | "failed",
    error: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await repo.createEmailLog({
      template: name,
      toEmail: to,
      subject,
      customerId,
      status,
      error,
      metadata,
    });
  }

  async function sendTemplate(
    name: EmailTemplateName,
    to: string,
    vars: Record<string, string>,
    sendOptions?: { readonly customerId?: string | null; readonly dedupeKey?: string },
  ): Promise<SendResult> {
    const template = getTemplate(name);
    const subject = template.subject(vars);
    const html = template.html(vars);
    const customerId = sendOptions?.customerId ?? null;
    const dedupeKey = sendOptions?.dedupeKey ?? null;

    if (driver === "outbox") {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const suffix = randomUUID().slice(0, 6);
      const outboxDir = path.join(outDir, "outbox");
      await mkdir(outboxDir, { recursive: true });
      const file = path.join(outboxDir, `${stamp}-${suffix}-${name}.html`);
      await writeFile(file, html, "utf8");
      await record(name, to, subject, customerId, "sent", null, { driver: "outbox", file, dedupeKey });
      return { ok: true, file };
    }

    // Driver `resend` (producción).
    if (resendApiKey === undefined || resendApiKey.length === 0) {
      const error = "Falta RESEND_API_KEY para el driver resend.";
      await record(name, to, subject, customerId, "failed", error, { driver: "resend", dedupeKey });
      return { ok: false, error };
    }

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!response.ok) {
        const error = `Resend respondió ${String(response.status)}.`;
        await record(name, to, subject, customerId, "failed", error, { driver: "resend", dedupeKey });
        return { ok: false, error };
      }
      await record(name, to, subject, customerId, "sent", null, { driver: "resend", dedupeKey });
      return { ok: true };
    } catch (thrown) {
      const error = thrown instanceof Error ? thrown.message : "Error desconocido de red.";
      await record(name, to, subject, customerId, "failed", error, { driver: "resend", dedupeKey });
      return { ok: false, error };
    }
  }

  return { sendTemplate };
}
