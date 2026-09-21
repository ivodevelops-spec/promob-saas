// src/dunning.ts — Motor de mora (dunning): aplica la agenda del state-machine
// y envía los emails correspondientes de forma idempotente.
//
// IMPORTANTE: este es el ÚNICO lugar que envía emails de mora. Los webhooks de
// MercadoPago solo registran el rechazo y pasan la suscripción a `past_due`.
// La idempotencia se apoya en `email_logs.metadata.dedupeKey` (una clave por
// suscripción + plantilla + vencimiento): correr el cron dos veces no duplica nada.
import type { Runtime } from "./runtime";
import {
  dunningSchedule,
  transitionSubscription,
  type DunningPolicy,
  type SubscriptionStatus,
} from "./state-machine";
import type { Subscription } from "./db/types";
import type { EmailTemplateName } from "./emails";

const DEFAULT_POLICY: DunningPolicy = { graceDays: 14, lapseDays: 30 };

/** Resultado de una corrida de mora (para reportes del cron y del simulador). */
export interface DunningRunResult {
  readonly processed: number;
  readonly sent: number;
  readonly items: { readonly subscriptionId: string; readonly template: EmailTemplateName }[];
}

/** Política de mora configurada en el panel (con default y validación). */
async function getPolicy(runtime: Runtime): Promise<DunningPolicy> {
  const stored = await runtime.repo.getConfigValue("dunning_policy");
  if (stored !== null && typeof stored === "object") {
    const candidate = stored as { graceDays?: unknown; lapseDays?: unknown };
    if (
      typeof candidate.graceDays === "number" &&
      typeof candidate.lapseDays === "number" &&
      candidate.graceDays > 0 &&
      candidate.lapseDays > candidate.graceDays
    ) {
      return { graceDays: candidate.graceDays, lapseDays: candidate.lapseDays };
    }
  }
  return DEFAULT_POLICY;
}

/** ¿Ya se envió un email con esta clave de dedupe? */
async function wasSent(runtime: Runtime, dedupeKey: string): Promise<boolean> {
  const logs = await runtime.repo.listEmailLogs();
  return logs.some((log) => log.metadata["dedupeKey"] === dedupeKey);
}

/** Aplica la transición de estado si es válida; devuelve el estado resultante. */
async function applyStatus(
  runtime: Runtime,
  subscriptionId: string,
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): Promise<SubscriptionStatus> {
  try {
    transitionSubscription(from, to);
  } catch {
    return from; // transición inválida (p. ej., ya suspendida): no se aplica
  }
  await runtime.repo.updateSubscription(subscriptionId, { status: to });
  return to;
}

/**
 * Corre la agenda de mora contra el reloj del demo:
 * envía cada hito vencido que no se haya enviado y aplica suspensiones/bajas.
 */
export async function runDunning(runtime: Runtime): Promise<DunningRunResult> {
  const policy = await getPolicy(runtime);
  const now = runtime.repo.getNow();
  const nowMs = Date.parse(now);
  const today = now.slice(0, 10);
  const subscriptions = await runtime.repo.listSubscriptions();
  const items: { subscriptionId: string; template: EmailTemplateName }[] = [];
  let sent = 0;
  let processed = 0;

  for (const subscription of subscriptions) {
    if (subscription.status === "canceled" || subscription.status === "lapsed") continue;
    processed += 1;

    const customer = await runtime.repo.getCustomerById(subscription.customerId);
    const email = customer?.email ?? null;
    const product = await runtime.repo.getProductById(subscription.productId);
    const productName = product?.name ?? "su producto";
    let currentStatus: SubscriptionStatus = subscription.status;

    for (const step of dunningSchedule(policy, subscription)) {
      if (Date.parse(step.dueAt) > nowMs) continue; // todavía no vence
      const dedupeKey = `${subscription.id}:${step.template}:${step.dueAt}`;
      if (await wasSent(runtime, dedupeKey)) continue;
      if (email === null) continue;

      const vars: Record<string, string> = {
        nombre: customer?.fullName ?? email,
        producto: productName,
        fecha: step.dueAt.slice(0, 10),
        detalle: `La suscripción ${subscription.id} alcanzó el hito «${step.template}» (${today}).`,
      };

      const result = await runtime.mailer.sendTemplate(step.template, email, vars, {
        customerId: subscription.customerId,
        dedupeKey,
      });
      items.push({ subscriptionId: subscription.id, template: step.template });
      if (result.ok) sent += 1;

      if (step.kind === "suspend") {
        currentStatus = await applyStatus(runtime, subscription.id, currentStatus, "suspended");
        const alertKey = `${dedupeKey}:owner`;
        if (
          !(await wasSent(runtime, alertKey)) &&
          runtime.config.ownerEmail.length > 0
        ) {
          await runtime.mailer.sendTemplate("owner-alert", runtime.config.ownerEmail, vars, {
            dedupeKey: alertKey,
          });
        }
      }
      if (step.kind === "lapse") {
        currentStatus = await applyStatus(runtime, subscription.id, currentStatus, "lapsed");
      }
    }
  }

  return { processed, sent, items };
}

/** Suscripción con su acceso vigente (helper para las funciones). */
export type { Subscription };
