// src/mail.ts — Cliente Resend (W2). Skeleton; lógica en W2.

export interface MailInput {
  readonly to: string;
  readonly subject: string;
  readonly template: string;
  readonly data: Record<string, unknown>;
}

export function sendMail(_input: MailInput): Promise<void> {
  throw new Error("Pendiente W2: envío de emails con Resend (10 templates)");
}
