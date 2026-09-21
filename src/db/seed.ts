// src/db/seed.ts — Datos demo (seed) del modo demostración.
// Función PURA: no hace I/O ni usa `new Date()` sin argumentos — todas las
// fechas se derivan del parámetro `now` (reloj inyectable del driver demo).
// Datos profesionales y deterministas: mismos inputs → misma salida.
import type {
  NewCodeInput,
  NewCustomer,
  NewOrder,
  NewPayment,
  NewProduct,
  NewSubscription,
} from "./types";

// --- Contrato del seed -------------------------------------------------------

/** Estructura completa del seed demo (contempla contrato-api.md §5). */
export interface DemoSeed {
  readonly customers: NewCustomer[];
  readonly products: NewProduct[];
  readonly orders: NewOrder[];
  readonly subscriptions: NewSubscription[];
  readonly payments: NewPayment[];
  readonly codes: NewCodeInput[];
  readonly config: { key: string; value: unknown }[];
}

// --- Utilidades de fechas (deterministas, derivadas de `now`) -----------------

const DAY_MS = 86_400_000;

/** Fecha ISO completa desplazada `offsetDays` días respecto de `now`. */
function dateAt(now: string, offsetDays: number): string {
  return new Date(Date.parse(now) + offsetDays * DAY_MS).toISOString();
}

/** Fecha solo-día (`YYYY-MM-DD`) desplazada `offsetDays` días respecto de `now`. */
function dateOnlyAt(now: string, offsetDays: number): string {
  return dateAt(now, offsetDays).slice(0, 10);
}

/** Genera `count` códigos legibles `PROMOB-XXXX-XXXX`, deterministas. */
function buildCodes(count: number, batch: string): NewCodeInput[] {
  const pad4 = (n: number): string => String(n).padStart(4, "0");
  const codes: NewCodeInput[] = [];
  for (let i = 1; i <= count; i++) {
    codes.push({ plaintext: `PROMOB-${pad4(i)}-${pad4(10_000 - i)}`, batch });
  }
  return codes;
}

// --- Seed ---------------------------------------------------------------------

/**
 * Construye el seed demo completo para una fecha `now` dada (ISO).
 * Ver contrato-api.md §5: 3 productos demo, 6 clientes cubriendo todos los
 * estados de suscripción, pagos aprobados/rechazados, ~40 códigos y config
 * (dunning_policy, fx_rates, store_mode).
 */
export function buildDemoSeed(now: string): DemoSeed {
  // Productos demo (montos de ejemplo editables; los reales los define el cliente).
  const products: NewProduct[] = [
    {
      id: "demo-product-mensual",
      slug: "promob-plus-mensual",
      name: "Promob Plus Mensual",
      description: "Suscripción mensual a Promob Plus (demo, monto de ejemplo).",
      kind: "subscription",
      priceArs: 4900,
      currency: "ARS",
      isDemo: true,
      active: true,
    },
    {
      id: "demo-product-anual",
      slug: "promob-plus-anual",
      name: "Promob Plus Anual",
      description: "Suscripción anual a Promob Plus — 12 meses al precio de 10 (demo).",
      kind: "subscription",
      priceArs: 46900,
      currency: "ARS",
      isDemo: true,
      active: true,
    },
    {
      id: "demo-product-unico",
      slug: "promob-plus-unico",
      name: "Promob Plus Único",
      description: "Licencia de pago único de Promob Plus (demo, monto de ejemplo).",
      kind: "one_time",
      priceArs: 14900,
      currency: "ARS",
      isDemo: true,
      active: true,
    },
  ];

  // Clientes demo (nombres ficticios; uno por cada estado de suscripción + un activo más).
  const customers: NewCustomer[] = [
    {
      id: "demo-customer-01",
      email: "ana.perez@demo.com",
      fullName: "Ana Pérez",
      phone: "+54 9 11 5555-0101",
      country: "AR",
      metadata: {},
    },
    {
      id: "demo-customer-02",
      email: "bruno.gomez@demo.com",
      fullName: "Bruno Gómez",
      phone: "+54 9 11 5555-0102",
      country: "AR",
      metadata: {},
    },
    {
      id: "demo-customer-03",
      email: "carla.dominguez@demo.com",
      fullName: "Carla Domínguez",
      phone: "+598 99 555 103",
      country: "UY",
      metadata: {},
    },
    {
      id: "demo-customer-04",
      email: "diego.fernandez@demo.com",
      fullName: "Diego Fernández",
      phone: "+54 9 11 5555-0104",
      country: "AR",
      metadata: {},
    },
    {
      id: "demo-customer-05",
      email: "elena.ruiz@demo.com",
      fullName: "Elena Ruiz",
      phone: "+56 9 5555 0105",
      country: "CL",
      metadata: {},
    },
    {
      id: "demo-customer-06",
      email: "federico.silva@demo.com",
      fullName: "Federico Silva",
      phone: "+595 981 555 106",
      country: "PY",
      metadata: {},
    },
  ];

  // Suscripciones: cubren los 5 estados (active ×2, past_due, suspended, lapsed, canceled).
  const subscriptions: NewSubscription[] = [
    {
      id: "demo-sub-01",
      customerId: "demo-customer-01",
      productId: "demo-product-mensual",
      mpPreapprovalId: "demo-preapproval-01",
      status: "active",
      nextPaymentDate: dateOnlyAt(now, 12),
    },
    {
      id: "demo-sub-02",
      customerId: "demo-customer-02",
      productId: "demo-product-mensual",
      mpPreapprovalId: "demo-preapproval-02",
      status: "active",
      nextPaymentDate: dateOnlyAt(now, 20),
    },
    {
      id: "demo-sub-03",
      customerId: "demo-customer-03",
      productId: "demo-product-mensual",
      mpPreapprovalId: "demo-preapproval-03",
      status: "past_due",
      nextPaymentDate: dateOnlyAt(now, -3),
    },
    {
      id: "demo-sub-04",
      customerId: "demo-customer-04",
      productId: "demo-product-mensual",
      mpPreapprovalId: "demo-preapproval-04",
      status: "suspended",
      nextPaymentDate: dateOnlyAt(now, -18),
    },
    {
      id: "demo-sub-05",
      customerId: "demo-customer-05",
      productId: "demo-product-mensual",
      mpPreapprovalId: "demo-preapproval-05",
      status: "lapsed",
      nextPaymentDate: dateOnlyAt(now, -45),
    },
    {
      id: "demo-sub-06",
      customerId: "demo-customer-06",
      productId: "demo-product-mensual",
      mpPreapprovalId: "demo-preapproval-06",
      status: "canceled",
      nextPaymentDate: null,
    },
  ];

  // Órdenes de compra única: una entregada y una fallida.
  const orders: NewOrder[] = [
    {
      id: "demo-order-01",
      customerId: "demo-customer-02",
      productId: "demo-product-unico",
      amountArs: 14900,
      status: "delivered",
      mpPaymentId: "demo-order-mp-01",
      deliveredAt: dateAt(now, 0),
    },
    {
      id: "demo-order-02",
      customerId: "demo-customer-04",
      productId: "demo-product-unico",
      amountArs: 14900,
      status: "failed",
      mpPaymentId: "demo-order-mp-02",
    },
  ];

  // Pagos: cuotas aprobadas/rechazadas + pagos de órdenes (aprobado y rechazado).
  const payments: NewPayment[] = [
    {
      id: "demo-pay-01",
      subscriptionId: "demo-sub-01",
      mpPaymentId: "demo-mp-pay-01",
      amountArs: 4900,
      status: "approved",
      paidAt: dateAt(now, -5),
    },
    {
      id: "demo-pay-02",
      subscriptionId: "demo-sub-02",
      mpPaymentId: "demo-mp-pay-02",
      amountArs: 4900,
      status: "approved",
      paidAt: dateAt(now, -2),
    },
    {
      id: "demo-pay-03",
      subscriptionId: "demo-sub-03",
      mpPaymentId: "demo-mp-pay-03",
      amountArs: 4900,
      status: "rejected",
      paidAt: null,
    },
    {
      id: "demo-pay-04",
      subscriptionId: "demo-sub-03",
      mpPaymentId: "demo-mp-pay-04",
      amountArs: 4900,
      status: "approved",
      paidAt: dateAt(now, -35),
    },
    {
      id: "demo-pay-05",
      subscriptionId: "demo-sub-04",
      mpPaymentId: "demo-mp-pay-05",
      amountArs: 4900,
      status: "rejected",
      paidAt: null,
    },
    {
      id: "demo-pay-06",
      subscriptionId: "demo-sub-06",
      mpPaymentId: "demo-mp-pay-06",
      amountArs: 4900,
      status: "approved",
      paidAt: dateAt(now, -60),
    },
    {
      id: "demo-pay-07",
      orderId: "demo-order-01",
      mpPaymentId: "demo-mp-pay-07",
      amountArs: 14900,
      status: "approved",
      paidAt: dateAt(now, 0),
    },
    {
      id: "demo-pay-08",
      orderId: "demo-order-02",
      mpPaymentId: "demo-mp-pay-08",
      amountArs: 14900,
      status: "rejected",
      paidAt: null,
    },
  ];

  // Pool de códigos: ~40 códigos sin emitir (stock ok para mostrar alertas de stock bajo).
  const codes: NewCodeInput[] = buildCodes(40, "demo-inicial");

  // Config: política de mora, tasas de cambio demo y modo demo.
  const config: DemoSeed["config"] = [
    { key: "dunning_policy", value: { graceDays: 14, lapseDays: 30 } },
    { key: "fx_rates", value: { AR: 1, UY: 0.22, CL: 0.0011, PY: 0.00014 } },
    { key: "store_mode", value: "demo" },
  ];

  return { customers, products, orders, subscriptions, payments, codes, config };
}
