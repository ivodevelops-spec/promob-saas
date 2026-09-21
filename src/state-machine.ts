// src/state-machine.ts — Tipos y guards de la máquina de estados.
// La lógica de transición (side-effects + política de mora) se implementa en W1.

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

// --- Transiciones (W1) ---
// Orders: pending -> paid -> delivered; pending -> failed; paid -> refunded (libera código a voided).
export function transitionOrder(_from: OrderStatus, _to: OrderStatus): OrderStatus {
  throw new Error("Pendiente W1: transiciones de orders en la máquina de estados");
}

// Subscriptions: active -> past_due -> suspended -> lapsed; past_due -> active; owner -> canceled.
export function transitionSubscription(
  _from: SubscriptionStatus,
  _to: SubscriptionStatus,
): SubscriptionStatus {
  throw new Error("Pendiente W1: transiciones de subscriptions en la máquina de estados");
}
