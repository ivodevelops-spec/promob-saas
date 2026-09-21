// src/flows.ts — Flujos de negocio compartidos por las funciones Netlify,
// el servidor de demo y el simulador. Todo el dinero y la entrega de accesos
// pasan por acá: un solo lugar, testeable y sin duplicar reglas.
import { allocateCode } from "./codes";
import { addDays } from "./http";
import type { Runtime } from "./runtime";
import type { Country, Customer, Product } from "./db/types";

const COUNTRIES: readonly string[] = ["AR", "UY", "CL", "PY"];

function toCountry(value: string): Country {
  return COUNTRIES.includes(value) ? (value as Country) : "AR";
}

export interface CheckoutInput {
  readonly productSlug: string;
  readonly customer: {
    readonly fullName: string;
    readonly email: string;
    readonly country: string;
  };
  readonly cardLast4: string | null;
}

export interface CheckoutResult {
  readonly orderId: string;
  readonly status: "paid" | "rejected" | "pending";
  readonly codeEmailSent: boolean;
}

export interface SubscribeResult {
  readonly subscriptionId: string | null;
  readonly status: "active" | "rejected" | "pending";
  readonly nextPaymentDate: string | null;
  readonly codeEmailSent: boolean;
}

/** Envía una alerta interna al dueño (si hay email configurado). */
export async function alertOwner(runtime: Runtime, detalle: string): Promise<void> {
  if (runtime.config.ownerEmail.length === 0) return;
  await runtime.mailer.sendTemplate("owner-alert", runtime.config.ownerEmail, {
    nombre: "Equipo",
    detalle,
    fecha: runtime.repo.getNow().slice(0, 10),
  });
}

/** Alta o reutilización de cliente por email (el email identifica al cliente). */
export async function upsertCustomer(
  runtime: Runtime,
  input: CheckoutInput["customer"],
): Promise<Customer> {
  const existing = await runtime.repo.getCustomerByEmail(input.email);
  if (existing !== null) return existing;
  return runtime.repo.createCustomer({
    email: input.email,
    fullName: input.fullName,
    country: toCountry(input.country),
  });
}

/**
 * Entrega el código de acceso al cliente tras un pago aprobado:
 * asigna del pool (sin sobreventa) y envía welcome-code + comprobante.
 * Si no hay stock: NO se entrega y se alerta al dueño.
 */
async function deliverCode(
  runtime: Runtime,
  customer: Customer,
  product: Product,
  reference: string,
  amountArs: number,
): Promise<boolean> {
  const code = await allocateCode(runtime.repo);
  if (code === null) {
    await alertOwner(
      runtime,
      `Pago aprobado SIN código disponible (pool vacío). Cliente: ${customer.email}. Referencia: ${reference}.`,
    );
    return false;
  }
  const vars: Record<string, string> = {
    nombre: customer.fullName ?? customer.email,
    producto: product.name,
    code: code.plaintext,
    monto: `$ ${amountArs.toLocaleString("es-AR")}`,
    fecha: runtime.repo.getNow().slice(0, 10),
    medio: "MercadoPago (modo demo)",
  };
  await runtime.mailer.sendTemplate("welcome-code", customer.email, vars, {
    customerId: customer.id,
  });
  await runtime.mailer.sendTemplate("receipt", customer.email, vars, {
    customerId: customer.id,
  });
  return true;
}

/** Flujo completo de compra única. `null` si el producto no existe o no aplica. */
export async function processCheckout(
  runtime: Runtime,
  input: CheckoutInput,
): Promise<CheckoutResult | null> {
  const product = await runtime.repo.getProductBySlug(input.productSlug);
  if (product === null || !product.active || product.kind !== "one_time") return null;

  const customer = await upsertCustomer(runtime, input.customer);
  const pay = runtime.mockPay({
    last4: input.cardLast4 ?? "4242",
    amountArs: product.priceArs,
  });
  const order = await runtime.repo.createOrder({
    customerId: customer.id,
    productId: product.id,
    amountArs: product.priceArs,
    status: "pending",
    mpPaymentId: pay.mpPaymentId,
  });

  if (pay.status === "approved") {
    await runtime.repo.updateOrder(order.id, { status: "paid" });
    await runtime.repo.createPayment({
      orderId: order.id,
      mpPaymentId: pay.mpPaymentId,
      amountArs: product.priceArs,
      status: "approved",
      paidAt: runtime.repo.getNow(),
    });
    const delivered = await deliverCode(
      runtime,
      customer,
      product,
      `pedido ${order.id}`,
      product.priceArs,
    );
    return { orderId: order.id, status: "paid", codeEmailSent: delivered };
  }

  if (pay.status === "rejected") {
    await runtime.repo.updateOrder(order.id, { status: "failed" });
    await runtime.repo.createPayment({
      orderId: order.id,
      mpPaymentId: pay.mpPaymentId,
      amountArs: product.priceArs,
      status: "rejected",
      paidAt: null,
    });
    return { orderId: order.id, status: "rejected", codeEmailSent: false };
  }

  return { orderId: order.id, status: "pending", codeEmailSent: false };
}

/** Flujo completo de suscripción mensual/anual. `null` si el producto no existe. */
export async function processSubscribe(
  runtime: Runtime,
  input: CheckoutInput,
): Promise<SubscribeResult | null> {
  const product = await runtime.repo.getProductBySlug(input.productSlug);
  if (product === null || !product.active) return null;

  const customer = await upsertCustomer(runtime, input.customer);
  const pay = runtime.mockPay({
    last4: input.cardLast4 ?? "4242",
    amountArs: product.priceArs,
  });

  if (pay.status === "approved") {
    const now = runtime.repo.getNow();
    const subscription = await runtime.repo.createSubscription({
      customerId: customer.id,
      productId: product.id,
      mpPreapprovalId: pay.mpPaymentId,
      status: "active",
      nextPaymentDate: addDays(now, 30),
    });
    await runtime.repo.createPayment({
      subscriptionId: subscription.id,
      mpPaymentId: pay.mpPaymentId,
      amountArs: product.priceArs,
      status: "approved",
      paidAt: now,
    });
    const delivered = await deliverCode(
      runtime,
      customer,
      product,
      `suscripción ${subscription.id}`,
      product.priceArs,
    );
    return {
      subscriptionId: subscription.id,
      status: "active",
      nextPaymentDate: subscription.nextPaymentDate,
      codeEmailSent: delivered,
    };
  }

  if (pay.status === "rejected") {
    return { subscriptionId: null, status: "rejected", nextPaymentDate: null, codeEmailSent: false };
  }
  return { subscriptionId: null, status: "pending", nextPaymentDate: null, codeEmailSent: false };
}

/** Simula un cobro rechazado (simulador del demo): pago rechazado + `past_due`. */
export async function failSubscriptionCharge(
  runtime: Runtime,
  subscriptionId: string,
): Promise<boolean> {
  const subscription = await runtime.repo.getSubscriptionById(subscriptionId);
  if (subscription === null) return false;
  const product = await runtime.repo.getProductById(subscription.productId);
  await runtime.repo.createPayment({
    subscriptionId: subscription.id,
    mpPaymentId: `mock_fail_${Date.now().toString(36)}`,
    amountArs: product?.priceArs ?? 0,
    status: "rejected",
    paidAt: null,
  });
  if (subscription.status === "active") {
    await runtime.repo.updateSubscription(subscription.id, { status: "past_due" });
  }
  return true;
}

/** Reenvío de código (acción del panel): asigna un código nuevo y lo envía. */
export async function resendCode(
  runtime: Runtime,
  customerId: string,
): Promise<boolean> {
  const customer = await runtime.repo.getCustomerById(customerId);
  if (customer === null) return false;
  const code = await allocateCode(runtime.repo);
  if (code === null) {
    await alertOwner(runtime, `Reenvío de código sin stock (pool vacío). Cliente: ${customer.email}.`);
    return false;
  }
  await runtime.mailer.sendTemplate(
    "welcome-code",
    customer.email,
    {
      nombre: customer.fullName ?? customer.email,
      producto: "PROMOB",
      code: code.plaintext,
      monto: "",
      fecha: runtime.repo.getNow().slice(0, 10),
      medio: "",
    },
    { customerId: customer.id },
  );
  return true;
}
