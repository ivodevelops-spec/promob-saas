// src/admin.ts — Lógica del panel de gestión (`/api/admin-api`):
// lecturas (dashboard, listas con filtros y paginación) y acciones del equipo.
// allow: SIZE_OK — superficie completa de la API interna del panel.
import { addDays, badRequest, json, notFound } from "./http";
import { alertOwner, resendCode } from "./flows";
import { transitionSubscription } from "./state-machine";
import type { Country, Payment, Subscription } from "./db/types";
import type { Runtime } from "./runtime";

// --- Consultas de listado -------------------------------------------------------

export interface PageQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly q: string | null;
  readonly status: string | null;
  readonly country: string | null;
  readonly productId: string | null;
  readonly customerId: string | null;
}

const PAGE_SIZES: readonly number[] = [25, 50, 100];
const COUNTRIES: readonly string[] = ["AR", "UY", "CL", "PY"];

function toCountry(value: string | null): Country | null {
  return value !== null && COUNTRIES.includes(value) ? (value as Country) : null;
}

export function parsePageQuery(url: URL): PageQuery {
  const params = url.searchParams;
  const parsedPage = Number.parseInt(params.get("page") ?? "1", 10);
  const parsedSize = Number.parseInt(params.get("pageSize") ?? "25", 10);
  return {
    page: Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage,
    pageSize: PAGE_SIZES.includes(parsedSize) ? parsedSize : 25,
    q: params.get("q"),
    status: params.get("status"),
    country: params.get("country"),
    productId: params.get("productId"),
    customerId: params.get("customerId"),
  };
}

interface Paginated<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

function paginate<T>(items: readonly T[], query: PageQuery): Paginated<T> {
  const start = (query.page - 1) * query.pageSize;
  return {
    items: items.slice(start, start + query.pageSize),
    total: items.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}

// --- Lecturas ---------------------------------------------------------------------

async function buildDashboard(runtime: Runtime): Promise<unknown> {
  const now = runtime.repo.getNow();
  const month = now.slice(0, 7);
  const [customers, subscriptions, payments, codes, products] = await Promise.all([
    runtime.repo.listCustomers(),
    runtime.repo.listSubscriptions(),
    runtime.repo.listPayments(),
    runtime.repo.listCodes(),
    runtime.repo.listProducts(),
  ]);

  const activeSubscriptions = subscriptions.filter((s) => s.status === "active").length;
  const monthRevenueArs = payments
    .filter((p) => p.status === "approved" && p.paidAt !== null && p.paidAt.startsWith(month))
    .reduce((sum, p) => sum + p.amountArs, 0);
  const nonVoided = codes.filter((c) => c.status !== "voided");
  const availableCodes = codes.filter((c) => c.status === "unissued").length;
  const pastDue = subscriptions.filter((s) => s.status === "past_due").length;
  const suspended = subscriptions.filter((s) => s.status === "suspended").length;
  const lowStock =
    nonVoided.length > 0 && (availableCodes / nonVoided.length) * 100 < 20;

  const alerts: { kind: string; message: string; count: number }[] = [];
  if (pastDue > 0) {
    alerts.push({ kind: "past_due", message: "Suscripciones con pago rechazado", count: pastDue });
  }
  if (suspended > 0) {
    alerts.push({ kind: "suspended", message: "Suscripciones suspendidas", count: suspended });
  }
  if (lowStock) {
    alerts.push({ kind: "low_stock", message: "Códigos con stock bajo", count: availableCodes });
  }

  const productName = (id: string): string =>
    products.find((p) => p.id === id)?.name ?? "—";
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const recent = [...subscriptions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const salesSeries: { month: string; totalArs: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(Date.parse(now));
    date.setUTCMonth(date.getUTCMonth() - i);
    const key = date.toISOString().slice(0, 7);
    salesSeries.push({
      month: key,
      totalArs: payments
        .filter((p) => p.status === "approved" && p.paidAt !== null && p.paidAt.startsWith(key))
        .reduce((sum, p) => sum + p.amountArs, 0),
    });
  }

  return {
    kpis: {
      activeCustomers: customers.length,
      activeSubscriptions,
      monthRevenueArs,
      availableCodes,
    },
    alerts,
    recentSubscriptions: recent.map((s) => ({
      id: s.id,
      customerEmail: customersById.get(s.customerId)?.email ?? "—",
      productName: productName(s.productId),
      status: s.status,
      nextPaymentDate: s.nextPaymentDate,
    })),
    salesSeries,
  };
}

async function listCustomersView(runtime: Runtime, query: PageQuery): Promise<unknown> {
  const country = toCountry(query.country);
  const filter = {
    ...(query.q !== null && query.q.length > 0 ? { q: query.q } : {}),
    ...(country !== null ? { country } : {}),
  };
  const [customers, subscriptions, payments, orders] = await Promise.all([
    runtime.repo.listCustomers(filter),
    runtime.repo.listSubscriptions(),
    runtime.repo.listPayments(),
    runtime.repo.listOrders(),
  ]);
  const subIdsByCustomer = new Map<string, Set<string>>();
  for (const sub of subscriptions) {
    const set = subIdsByCustomer.get(sub.customerId) ?? new Set<string>();
    set.add(sub.id);
    subIdsByCustomer.set(sub.customerId, set);
  }
  const orderIdsByCustomer = new Map<string, Set<string>>();
  for (const order of orders) {
    const set = orderIdsByCustomer.get(order.customerId) ?? new Set<string>();
    set.add(order.id);
    orderIdsByCustomer.set(order.customerId, set);
  }
  const items = customers.map((customer) => {
    const subIds = subIdsByCustomer.get(customer.id) ?? new Set<string>();
    const orderIds = orderIdsByCustomer.get(customer.id) ?? new Set<string>();
    const customerPayments = payments.filter(
      (p) =>
        (p.subscriptionId !== null && subIds.has(p.subscriptionId)) ||
        (p.orderId !== null && orderIds.has(p.orderId)),
    );
    const paidDates = customerPayments
      .filter((p) => p.status === "approved" && p.paidAt !== null)
      .map((p) => p.paidAt ?? "");
    const lastPaymentAt = paidDates.length > 0 ? paidDates.sort().at(-1) ?? null : null;
    return {
      ...customer,
      subscriptionsCount: subIds.size,
      lastPaymentAt,
    };
  });
  return paginate(items, query);
}

async function listSubscriptionsView(runtime: Runtime, query: PageQuery): Promise<unknown> {
  const subscriptions = await runtime.repo.listSubscriptions();
  const customers = await runtime.repo.listCustomers();
  const products = await runtime.repo.listProducts();
  const customersById = new Map(customers.map((c) => [c.id, c]));
  let list = subscriptions;
  if (query.status !== null) {
    list = list.filter((s) => s.status === query.status);
  }
  if (query.productId !== null) {
    list = list.filter((s) => s.productId === query.productId);
  }
  if (query.customerId !== null) {
    list = list.filter((s) => s.customerId === query.customerId);
  }
  let items = list.map((s) => ({
    ...s,
    customerEmail: customersById.get(s.customerId)?.email ?? "—",
    productName: products.find((p) => p.id === s.productId)?.name ?? "—",
  }));
  if (query.q !== null && query.q.length > 0) {
    const q = query.q.trim().toLowerCase();
    items = items.filter(
      (item) =>
        item.customerEmail.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q),
    );
  }
  return paginate(items, query);
}

async function listPaymentsView(runtime: Runtime, query: PageQuery): Promise<unknown> {
  const [payments, subscriptions, orders, customers, products] = await Promise.all([
    runtime.repo.listPayments(),
    runtime.repo.listSubscriptions(),
    runtime.repo.listOrders(),
    runtime.repo.listCustomers(),
    runtime.repo.listProducts(),
  ]);
  const subsById = new Map(subscriptions.map((s) => [s.id, s]));
  const ordersById = new Map(orders.map((o) => [o.id, o]));
  const customersById = new Map(customers.map((c) => [c.id, c]));
  let list = payments;
  if (query.status !== null) list = list.filter((p) => p.status === query.status);
  if (query.customerId !== null) {
    list = list.filter((p) => {
      const customerId =
        p.subscriptionId !== null
          ? subsById.get(p.subscriptionId)?.customerId
          : p.orderId !== null
            ? ordersById.get(p.orderId)?.customerId
            : undefined;
      return customerId === query.customerId;
    });
  }
  const emailFor = (payment: Payment): string => {
    const customerId =
      payment.subscriptionId !== null
        ? subsById.get(payment.subscriptionId)?.customerId
        : payment.orderId !== null
          ? ordersById.get(payment.orderId)?.customerId
          : undefined;
    return customerId !== undefined ? (customersById.get(customerId)?.email ?? "—") : "—";
  };
  const productNameFor = (payment: Payment): string => {
    const productId =
      payment.subscriptionId !== null
        ? subsById.get(payment.subscriptionId)?.productId
        : payment.orderId !== null
          ? ordersById.get(payment.orderId)?.productId
          : undefined;
    return productId !== undefined
      ? (products.find((p) => p.id === productId)?.name ?? "—")
      : "—";
  };
  const items = list.map((p) => ({
    ...p,
    customerEmail: emailFor(p),
    productName: productNameFor(p),
  }));
  return paginate(items, query);
}

async function listOrdersView(runtime: Runtime, query: PageQuery): Promise<unknown> {
  const orders = await runtime.repo.listOrders();
  const customers = await runtime.repo.listCustomers();
  const products = await runtime.repo.listProducts();
  const customersById = new Map(customers.map((c) => [c.id, c]));
  let list = orders;
  if (query.status !== null) list = list.filter((o) => o.status === query.status);
  const items = list.map((o) => ({
    ...o,
    customerEmail: customersById.get(o.customerId)?.email ?? "—",
    productName: products.find((p) => p.id === o.productId)?.name ?? "—",
  }));
  return paginate(items, query);
}

async function listCodesView(runtime: Runtime, query: PageQuery): Promise<unknown> {
  const codes = await runtime.repo.listCodes();
  let list = codes;
  if (query.status !== null) list = list.filter((c) => c.status === query.status);
  const stats = {
    available: codes.filter((c) => c.status === "unissued").length,
    reserved: codes.filter((c) => c.status === "reserved").length,
    issued: codes.filter((c) => c.status === "issued").length,
    voided: codes.filter((c) => c.status === "voided").length,
    lowStock: false,
  };
  const nonVoided = codes.filter((c) => c.status !== "voided").length;
  stats.lowStock = nonVoided > 0 && (stats.available / nonVoided) * 100 < 20;
  // Nunca se expone el hash completo: solo un prefijo informativo.
  const items = list.map((c) => ({
    id: c.id,
    status: c.status,
    batch: c.batch,
    createdAt: c.createdAt,
    issuedAt: c.issuedAt,
    reservedUntil: c.reservedUntil,
    codeHashMasked: `${c.codeHash.slice(0, 8)}…`,
  }));
  return { ...paginate(items, query), stats };
}

async function buildReports(runtime: Runtime, query: PageQuery): Promise<unknown> {
  const [payments, subscriptions] = await Promise.all([
    runtime.repo.listPayments(),
    runtime.repo.listSubscriptions(),
  ]);
  const now = runtime.repo.getNow();
  const salesSeries: { month: string; totalArs: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(Date.parse(now));
    date.setUTCMonth(date.getUTCMonth() - i);
    const key = date.toISOString().slice(0, 7);
    salesSeries.push({
      month: key,
      totalArs: payments
        .filter((p) => p.status === "approved" && p.paidAt !== null && p.paidAt.startsWith(key))
        .reduce((sum, p) => sum + p.amountArs, 0),
    });
  }
  const approved = payments.filter((p) => p.status === "approved");
  return {
    ...paginate(salesSeries, { ...query, pageSize: 25 }),
    salesSeries,
    totals: {
      yearArs: salesSeries.reduce((sum, point) => sum + point.totalArs, 0),
      count: approved.length,
      activeSubscriptions: subscriptions.filter((s) => s.status === "active").length,
    },
  };
}

async function listEmailsView(runtime: Runtime, query: PageQuery): Promise<unknown> {
  const [logs, customers] = await Promise.all([
    runtime.repo.listEmailLogs(),
    runtime.repo.listCustomers(),
  ]);
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const items = logs
    .map((log) => ({
      ...log,
      metadata: { ...log.metadata, dedupeKey: undefined },
      customerEmail:
        log.customerId !== null ? (customersById.get(log.customerId)?.email ?? "—") : "—",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(items, query);
}

export async function handleAdminGet(runtime: Runtime, url: URL): Promise<Response> {
  const resource = url.searchParams.get("resource") ?? "dashboard";
  const query = parsePageQuery(url);
  switch (resource) {
    case "dashboard":
      return json(await buildDashboard(runtime));
    case "customers":
      return json(await listCustomersView(runtime, query));
    case "subscriptions":
      return json(await listSubscriptionsView(runtime, query));
    case "payments":
      return json(await listPaymentsView(runtime, query));
    case "orders":
      return json(await listOrdersView(runtime, query));
    case "codes":
      return json(await listCodesView(runtime, query));
    case "reports":
      return json(await buildReports(runtime, query));
    case "emails":
      return json(await listEmailsView(runtime, query));
    case "config":
      return json(await paginate(await runtime.repo.listConfig(), query));
    default:
      return json({ error: { code: "unknown_resource", message: `Recurso desconocido: ${resource}.` } }, 400);
  }
}

// --- Acciones ------------------------------------------------------------------------

interface ActionPayload {
  readonly subscriptionId?: unknown;
  readonly orderId?: unknown;
  readonly customerId?: unknown;
  readonly amountArs?: unknown;
  readonly method?: unknown;
  readonly note?: unknown;
  readonly days?: unknown;
  readonly reason?: unknown;
  readonly codes?: unknown;
  readonly batch?: unknown;
  readonly key?: unknown;
  readonly value?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function subscriptionEmail(runtime: Runtime, subscription: Subscription): Promise<string | null> {
  const customer = await runtime.repo.getCustomerById(subscription.customerId);
  return customer?.email ?? null;
}

export async function handleAdminAction(
  runtime: Runtime,
  body: Record<string, unknown>,
): Promise<Response> {
  const action = asString(body["action"]);
  const payload = (typeof body["payload"] === "object" && body["payload"] !== null
    ? body["payload"]
    : {}) as ActionPayload;

  if (action === null) return badRequest("Falta la acción.");

  switch (action) {
    case "resend-code": {
      let customerId = asString(payload.customerId);
      if (customerId === null) {
        const subscriptionId = asString(payload.subscriptionId);
        const orderId = asString(payload.orderId);
        if (subscriptionId !== null) {
          const subscription = await runtime.repo.getSubscriptionById(subscriptionId);
          customerId = subscription?.customerId ?? null;
        } else if (orderId !== null) {
          const order = await runtime.repo.getOrderById(orderId);
          customerId = order?.customerId ?? null;
        }
      }
      if (customerId === null) return badRequest("Falta indicar el cliente.");
      const sent = await resendCode(runtime, customerId);
      if (!sent) {
        return json(
          { error: { code: "no_stock", message: "No hay códigos disponibles para reenviar." } },
          409,
        );
      }
      return json({ ok: true, codeEmailSent: true });
    }

    case "mark-paid": {
      const subscriptionId = asString(payload.subscriptionId);
      const amountArs = typeof payload.amountArs === "number" ? payload.amountArs : null;
      if (subscriptionId === null || amountArs === null) {
        return badRequest("Faltan la suscripción o el monto.");
      }
      const subscription = await runtime.repo.getSubscriptionById(subscriptionId);
      if (subscription === null) return notFound("Suscripción no encontrada.");
      const now = runtime.repo.getNow();
      await runtime.repo.createPayment({
        subscriptionId: subscription.id,
        mpPaymentId: `manual_${Date.now().toString(36)}`,
        amountArs,
        status: "approved",
        paidAt: now,
      });
      await runtime.repo.updateSubscription(subscription.id, {
        status: "active",
        nextPaymentDate: addDays(now, 30),
      });
      return json({ ok: true });
    }

    case "extend": {
      const subscriptionId = asString(payload.subscriptionId);
      const days = typeof payload.days === "number" && payload.days > 0 ? payload.days : null;
      if (subscriptionId === null || days === null) return badRequest("Faltan la suscripción o los días.");
      const subscription = await runtime.repo.getSubscriptionById(subscriptionId);
      if (subscription === null) return notFound("Suscripción no encontrada.");
      const now = runtime.repo.getNow();
      const base =
        subscription.nextPaymentDate !== null &&
        Date.parse(subscription.nextPaymentDate) > Date.parse(now)
          ? subscription.nextPaymentDate
          : now;
      await runtime.repo.updateSubscription(subscription.id, {
        nextPaymentDate: addDays(base, days),
      });
      return json({ ok: true, nextPaymentDate: addDays(base, days) });
    }

    case "suspend": {
      const subscriptionId = asString(payload.subscriptionId);
      const reason = asString(payload.reason) ?? "sin motivo indicado";
      if (subscriptionId === null) return badRequest("Falta la suscripción.");
      const subscription = await runtime.repo.getSubscriptionById(subscriptionId);
      if (subscription === null) return notFound("Suscripción no encontrada.");
      transitionSubscription(subscription.status, "suspended"); // lanza si no aplica
      await runtime.repo.updateSubscription(subscription.id, { status: "suspended" });
      const email = await subscriptionEmail(runtime, subscription);
      if (email !== null) {
        await runtime.mailer.sendTemplate(
          "suspension",
          email,
          { nombre: email, producto: "", fecha: runtime.repo.getNow().slice(0, 10) },
          { customerId: subscription.customerId },
        );
      }
      await alertOwner(
        runtime,
        `Suspensión manual de la suscripción ${subscription.id}. Motivo: ${reason}.`,
      );
      return json({ ok: true });
    }

    case "reactivate": {
      const subscriptionId = asString(payload.subscriptionId);
      if (subscriptionId === null) return badRequest("Falta la suscripción.");
      const subscription = await runtime.repo.getSubscriptionById(subscriptionId);
      if (subscription === null) return notFound("Suscripción no encontrada.");
      transitionSubscription(subscription.status, "active"); // lanza si no aplica
      await runtime.repo.updateSubscription(subscription.id, {
        status: "active",
        nextPaymentDate:
          subscription.nextPaymentDate ?? addDays(runtime.repo.getNow(), 30),
      });
      return json({ ok: true });
    }

    case "cancel": {
      const subscriptionId = asString(payload.subscriptionId);
      const reason = asString(payload.reason) ?? "sin motivo indicado";
      if (subscriptionId === null) return badRequest("Falta la suscripción.");
      const subscription = await runtime.repo.getSubscriptionById(subscriptionId);
      if (subscription === null) return notFound("Suscripción no encontrada.");
      transitionSubscription(subscription.status, "canceled"); // lanza si no aplica
      await runtime.repo.updateSubscription(subscription.id, { status: "canceled" });
      await alertOwner(
        runtime,
        `Baja manual de la suscripción ${subscription.id}. Motivo: ${reason}.`,
      );
      return json({ ok: true });
    }

    case "upload-codes": {
      const codes = payload.codes;
      if (!Array.isArray(codes) || codes.some((code) => typeof code !== "string")) {
        return badRequest("Se espera una lista de códigos (strings).");
      }
      const batch = asString(payload.batch) ?? `carga-${runtime.repo.getNow().slice(0, 10)}`;
      const inserted = await runtime.repo.addCodes(
        (codes as string[]).map((plaintext) => ({ plaintext, batch })),
      );
      return json({ ok: true, inserted });
    }

    case "update-config": {
      const key = asString(payload.key);
      if (key === null) return badRequest("Falta la clave de configuración.");
      await runtime.repo.setConfigValue(key, payload.value);
      return json({ ok: true });
    }

    default:
      return badRequest(`Acción desconocida: ${action}.`);
  }
}
