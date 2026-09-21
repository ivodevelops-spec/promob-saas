// src/state-machine.ts — Tipos, guards, transiciones y política de mora (dunning)
// de la máquina de estados de promob-saas.
// Fechas y montos viajan como cadenas ISO; los comentarios van en español.
import type { EmailTemplateName } from "./emails";

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "delivered",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "suspended",
  "lapsed",
  "canceled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "approved", "rejected", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CODE_POOL_STATUSES = ["unissued", "reserved", "issued", "voided"] as const;
export type CodePoolStatus = (typeof CODE_POOL_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function isCodePoolStatus(value: string): value is CodePoolStatus {
  return (CODE_POOL_STATUSES as readonly string[]).includes(value);
}

// --- Política de mora (dunning) ---

/**
 * Política de mora de una suscripción.
 * `graceDays`: días de gracia posteriores al vencimiento antes de suspender el servicio.
 * `lapseDays`: días posteriores al vencimiento tras los cuales la suscripción caduca (lapse).
 */
export interface DunningPolicy {
  readonly graceDays: number;
  readonly lapseDays: number;
}

/** Efectos colaterales que produce una transición de estado. */
export type SideEffect =
  | { readonly type: "void-code" }
  | { readonly type: "deliver-code" }
  | { readonly type: "send-email"; readonly template: EmailTemplateName };

/** Resultado de una transición: el nuevo estado y los efectos colaterales que dispara. */
export interface TransitionResult<S extends string> {
  readonly status: S;
  readonly effects: readonly SideEffect[];
}

// --- Transiciones de órdenes de compra ---
// pending -> paid (envía comprobante "receipt"); pending -> failed;
// paid -> delivered (entrega el código); paid -> refunded (devuelve el código al pool).
export function transitionOrder(from: OrderStatus, to: OrderStatus): TransitionResult<OrderStatus> {
  switch (`${from}->${to}`) {
    case "pending->paid":
      return { status: to, effects: [{ type: "send-email", template: "receipt" }] };
    case "pending->failed":
      return { status: to, effects: [] };
    case "paid->delivered":
      return { status: to, effects: [{ type: "deliver-code" }] };
    case "paid->refunded":
      return { status: to, effects: [{ type: "void-code" }] };
    default:
      throw new Error(
        `Transición de orden inválida: no se puede pasar de "${from}" a "${to}".`,
      );
  }
}

// --- Transiciones de suscripciones ---
// active -> past_due (venció el pago); active -> suspended (suspensión manual,
// avisa al cliente y al owner); active -> canceled (cancela el owner).
// past_due -> active (pagó la deuda); past_due -> suspended; past_due -> canceled.
// suspended -> active (reanuda tras pagar); suspended -> lapsed (se cumplió lapseDays,
// envía "lapse"); suspended -> canceled; lapsed -> canceled (baja definitiva).
export function transitionSubscription(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): TransitionResult<SubscriptionStatus> {
  const suspensionEffects: readonly SideEffect[] = [
    { type: "send-email", template: "suspension" },
    { type: "send-email", template: "owner-alert" },
  ];
  switch (`${from}->${to}`) {
    case "active->past_due":
      return { status: to, effects: [] };
    case "active->suspended":
      return { status: to, effects: suspensionEffects };
    case "active->canceled":
      return { status: to, effects: [] };
    case "past_due->active":
      return { status: to, effects: [] };
    case "past_due->suspended":
      return { status: to, effects: suspensionEffects };
    case "past_due->canceled":
      return { status: to, effects: [] };
    case "suspended->active":
      return { status: to, effects: [] };
    case "suspended->lapsed":
      return { status: to, effects: [{ type: "send-email", template: "lapse" }] };
    case "suspended->canceled":
      return { status: to, effects: [] };
    case "lapsed->canceled":
      return { status: to, effects: [] };
    default:
      throw new Error(
        `Transición de suscripción inválida: no se puede pasar de "${from}" a "${to}".`,
      );
  }
}

// --- Cronograma de mora (dunning) ---

/**
 * Acción programada de la política de mora.
 * `dueAt` es una fecha ISO; `offsetDays` es el desfase en días respecto del
 * vencimiento D (negativo = antes, positivo = después).
 */
export type DunningAction =
  | {
      kind: "reminder";
      template: "reminder-7" | "reminder-3";
      dueAt: string;
      offsetDays: number;
    }
  | {
      kind: "warning";
      template: "dunning-1" | "dunning-4" | "dunning-8";
      dueAt: string;
      offsetDays: number;
    }
  | {
      kind: "suspend";
      template: "suspension";
      dueAt: string;
      offsetDays: number;
      alertOwner: true;
    }
  | { kind: "lapse"; template: "lapse"; dueAt: string; offsetDays: number };

const DAY_MS = 86_400_000;

/**
 * Devuelve la próxima acción de mora programada estrictamente después de `now`,
 * o `null` si no queda ninguna.
 *
 * Semántica (D = `nextPaymentDate`, fecha ISO del próximo vencimiento):
 * - Sin `nextPaymentDate`, o con estado `canceled`/`lapsed`, no hay acciones: `null`.
 * - Recordatorios (estados `active`, `past_due` y `suspended`):
 *   "reminder-7" a D−7d y "reminder-3" a D−3d.
 * - Gestión de mora (estados `past_due` y `suspended`):
 *   "dunning-1" a D+1d, "dunning-4" a D+4d, "dunning-8" a D+8d,
 *   suspensión ("suspension", con alerta al owner) a D+graceDays
 *   y caducidad ("lapse") a D+lapseDays.
 * - Se arma el cronograma completo, se descartan las acciones con `dueAt <= now`
 *   (solo quedan las estrictamente futuras) y se devuelve la más temprana.
 */
export function dunningSchedule(
  policy: DunningPolicy,
  subscription: { status: SubscriptionStatus; nextPaymentDate: string | null },
): DunningAction[] {
  const { status, nextPaymentDate } = subscription;
  if (nextPaymentDate === null || status === "canceled" || status === "lapsed") {
    return [];
  }

  const dueMs = Date.parse(nextPaymentDate);
  const dueAt = (offsetDays: number): string =>
    new Date(dueMs + offsetDays * DAY_MS).toISOString();

  const schedule: DunningAction[] = [];
  if (status === "active" || status === "past_due" || status === "suspended") {
    schedule.push({ kind: "reminder", template: "reminder-7", dueAt: dueAt(-7), offsetDays: -7 });
    schedule.push({ kind: "reminder", template: "reminder-3", dueAt: dueAt(-3), offsetDays: -3 });
  }
  if (status === "past_due" || status === "suspended") {
    schedule.push({ kind: "warning", template: "dunning-1", dueAt: dueAt(1), offsetDays: 1 });
    schedule.push({ kind: "warning", template: "dunning-4", dueAt: dueAt(4), offsetDays: 4 });
    schedule.push({ kind: "warning", template: "dunning-8", dueAt: dueAt(8), offsetDays: 8 });
    schedule.push({
      kind: "suspend",
      template: "suspension",
      dueAt: dueAt(policy.graceDays),
      offsetDays: policy.graceDays,
      alertOwner: true,
    });
    schedule.push({
      kind: "lapse",
      template: "lapse",
      dueAt: dueAt(policy.lapseDays),
      offsetDays: policy.lapseDays,
    });
  }

  return schedule.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export function nextDunningAction(
  policy: DunningPolicy,
  subscription: { status: SubscriptionStatus; nextPaymentDate: string | null },
  now: Date | string,
): DunningAction | null {
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  const upcoming = dunningSchedule(policy, subscription).filter(
    (action) => Date.parse(action.dueAt) > nowMs,
  );
  return upcoming[0] ?? null;
}
