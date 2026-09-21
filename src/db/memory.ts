// src/db/memory.ts — Driver de memoria del repositorio (modo demo, sin cuentas externas).
//
// Garantías de diseño (ver docs/modo-demo.md):
// - Persistencia JSON en `filePath` con write-temp + rename (atómico) dentro de una
//   cola serializada: nunca se escriben dos flushes a la vez.
// - UN mutex (cadena de promesas) serializa TODAS las operaciones: en un proceso
//   los `await` intercalan, así que el lock es obligatorio para no pisar estado.
// - Los códigos se persisten SOLO como hash SHA-256; el texto plano vive en un Map
//   en memoria y jamás se escribe en disco. Si el proceso se reinicia, los códigos
//   NO emitidos reciben un texto nuevo (refresh) para que el demo siga funcionando.
// - Reloj inyectable: `getNow()` / `advanceDays(d)` mueven el offset del simulador
//   y el offset se persiste junto a los datos.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hashCode } from "../codes";
import { buildDemoSeed, type DemoSeed } from "./seed";
import type {
  AllocatedCode,
  CodeFilter,
  CodePoolItem,
  ConfigEntry,
  Customer,
  CustomerFilter,
  CustomerPatch,
  EmailLog,
  EmailLogFilter,
  EventRecord,
  NewCodeInput,
  NewCustomer,
  NewEmailLog,
  NewEvent,
  NewOrder,
  NewPayment,
  NewProduct,
  NewSubscription,
  Order,
  OrderFilter,
  OrderPatch,
  Payment,
  PaymentFilter,
  PaymentPatch,
  Product,
  ProductPatch,
  Repository,
  Subscription,
  SubscriptionFilter,
  SubscriptionPatch,
} from "./types";

const DAY_MS = 86_400_000;

// --- Estado interno -----------------------------------------------------------

/** Estado completo del demo (arrays mutables; ítems readonly por contrato). */
interface MemoryState {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  subscriptions: Subscription[];
  payments: Payment[];
  codes: CodePoolItem[];
  emailLogs: EmailLog[];
  events: EventRecord[];
  config: ConfigEntry[];
}

/** Forma del archivo persistido (versión + offset del reloj demo + datos). */
interface PersistedState {
  readonly version: 1;
  readonly nowOffsetMs: number;
  readonly data: MemoryState;
}

/** Extras del driver de memoria que usa el simulador del demo (no están en `Repository`). */
export interface MemoryRepositoryExtras {
  /** Fecha/hora "actual" del demo (hora real + offset del simulador). */
  getNow(): string;
  /** Avanza (o retrocede, con negativos) el reloj del demo N días y persiste. */
  advanceDays(days: number): Promise<void>;
}

export type MemoryRepository = Repository & MemoryRepositoryExtras;

export interface MemoryRepositoryOptions {
  readonly filePath: string;
  /** Seed explícito (tests). Por defecto: `buildDemoSeed` con la hora real. */
  readonly seed?: DemoSeed;
}

// --- Utilidades ---------------------------------------------------------------

/** Aplica un patch sin sobrescribir con `undefined` (semántica PATCH). */
function applyDefinedPatch<T extends object>(target: T, patch: Partial<NoInfer<T>>): T {
  const result = { ...target } as Record<string, unknown>;
  for (const key of Object.keys(patch) as Array<keyof T>) {
    const value = patch[key];
    if (value !== undefined) {
      result[key as string] = value;
    }
  }
  return result as T;
}

/** Valida de forma mínima el archivo persistido (evita crashear con basura). */
function isPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const data = candidate["data"];
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  const collections = [
    "customers",
    "products",
    "orders",
    "subscriptions",
    "payments",
    "codes",
    "emailLogs",
    "events",
    "config",
  ];
  return (
    typeof candidate["nowOffsetMs"] === "number" &&
    collections.every((key) => Array.isArray(record[key]))
  );
}

// --- Fábrica -------------------------------------------------------------------

/**
 * Crea el repositorio en memoria con persistencia en `filePath`.
 * - Archivo inexistente → seed + persistencia.
 * - Archivo corrupto → backup `.bak` + reseed (nunca lanza por datos).
 */
export async function createMemoryRepository(
  options: MemoryRepositoryOptions,
): Promise<MemoryRepository> {
  const { filePath } = options;
  await mkdir(path.dirname(filePath), { recursive: true });

  /** Texto plano de códigos: hash → plaintext (SOLO memoria; nunca se persiste). */
  const plaintexts = new Map<string, string>();
  let nowOffsetMs = 0;
  let state: MemoryState;

  // --- Carga o seed -----------------------------------------------------------

  const loaded = await tryLoad();
  if (loaded !== null) {
    state = loaded.data;
    nowOffsetMs = loaded.nowOffsetMs;
    refreshUnissuedPlaintexts(state, plaintexts);
    demoteStaleReservations();
  } else {
    const seed = options.seed ?? buildDemoSeed(new Date().toISOString());
    state = buildStateFromSeed(seed, plaintexts, new Date().toISOString());
    await persist();
  }

  // --- Mutex --------------------------------------------------------------------

  let queue: Promise<unknown> = Promise.resolve();

  function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = queue.then(() => fn());
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  // --- Persistencia ---------------------------------------------------------------

  async function persist(): Promise<void> {
    const payload: PersistedState = { version: 1, nowOffsetMs, data: state };
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf8");
    await rename(tmpPath, filePath);
  }

  async function tryLoad(): Promise<PersistedState | null> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch {
      return null; // primera ejecución
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isPersistedState(parsed)) return parsed;
    } catch {
      // cae al backup de abajo
    }
    // Archivo corrupto: se aparta y se vuelve a sembrar (el demo nunca crashea).
    try {
      await rename(filePath, `${filePath}.bak`);
    } catch {
      // sin backup posible; se continúa con el reseed
    }
    return null;
  }

  function nowIso(): string {
    return new Date(Date.now() + nowOffsetMs).toISOString();
  }

  // --- Códigos (helpers) -----------------------------------------------------------

  /** Regenera el texto plano de los códigos NO emitidos (proceso reiniciado). */
  function refreshUnissuedPlaintexts(target: MemoryState, map: Map<string, string>): void {
    const runId = randomUUID().slice(0, 4).toUpperCase();
    let index = 0;
    target.codes = target.codes.map((code) => {
      if (code.status === "issued" || code.status === "voided") return code;
      index += 1;
      const plaintext = `PROMOB-${runId}-${String(index).padStart(4, "0")}`;
      const hash = hashCode(plaintext);
      map.set(hash, plaintext);
      return { ...code, codeHash: hash };
    });
  }

  /** Reservas vencidas vuelven a `unissued`. */
  function demoteStaleReservations(): void {
    const nowMs = Date.parse(nowIso());
    state.codes = state.codes.map((code) => {
      if (
        code.status === "reserved" &&
        code.reservedUntil !== null &&
        Date.parse(code.reservedUntil) < nowMs
      ) {
        return { ...code, status: "unissued", reservedUntil: null, updatedAt: nowIso() };
      }
      return code;
    });
  }

  // --- API ---------------------------------------------------------------------------

  const repository: MemoryRepository = {
    // Extras del demo
    getNow: (): string => nowIso(),
    advanceDays: (days: number): Promise<void> =>
      withLock(async () => {
        nowOffsetMs += days * DAY_MS;
        demoteStaleReservations();
        await persist();
      }),

    // customers
    createCustomer: (input: NewCustomer): Promise<Customer> =>
      withLock(async () => {
        const now = nowIso();
        const customer: Customer = {
          id: input.id ?? randomUUID(),
          email: input.email,
          fullName: input.fullName ?? null,
          phone: input.phone ?? null,
          country: input.country ?? "AR",
          metadata: input.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        };
        state.customers.push(customer);
        await persist();
        return customer;
      }),

    getCustomerById: (id: string): Promise<Customer | null> =>
      withLock(() => state.customers.find((c) => c.id === id) ?? null),

    getCustomerByEmail: (email: string): Promise<Customer | null> =>
      withLock(
        () =>
          state.customers.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null,
      ),

    listCustomers: (filter?: CustomerFilter): Promise<Customer[]> =>
      withLock(() => {
        let list = state.customers;
        const country = filter?.country;
        if (country !== undefined) list = list.filter((c) => c.country === country);
        const q = filter?.q?.trim().toLowerCase();
        if (q !== undefined && q.length > 0) {
          list = list.filter(
            (c) =>
              c.email.toLowerCase().includes(q) ||
              (c.fullName ?? "").toLowerCase().includes(q),
          );
        }
        return [...list];
      }),

    updateCustomer: (id: string, patch: CustomerPatch): Promise<Customer | null> =>
      withLock(async () => {
        const index = state.customers.findIndex((c) => c.id === id);
        if (index < 0) return null;
        const current = state.customers[index];
        if (current === undefined) return null;
        const updated = applyDefinedPatch(current, patch);
        state.customers[index] = { ...updated, updatedAt: nowIso() };
        await persist();
        return state.customers[index] ?? null;
      }),

    // products
    createProduct: (input: NewProduct): Promise<Product> =>
      withLock(async () => {
        const now = nowIso();
        const product: Product = {
          id: input.id ?? randomUUID(),
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          kind: input.kind ?? "subscription",
          priceArs: input.priceArs ?? 0,
          currency: input.currency ?? "ARS",
          isDemo: input.isDemo ?? false,
          active: input.active ?? true,
          createdAt: now,
          updatedAt: now,
        };
        state.products.push(product);
        await persist();
        return product;
      }),

    getProductById: (id: string): Promise<Product | null> =>
      withLock(() => state.products.find((p) => p.id === id) ?? null),

    getProductBySlug: (slug: string): Promise<Product | null> =>
      withLock(() => state.products.find((p) => p.slug === slug) ?? null),

    listProducts: (): Promise<Product[]> => withLock(() => [...state.products]),

    updateProduct: (id: string, patch: ProductPatch): Promise<Product | null> =>
      withLock(async () => {
        const index = state.products.findIndex((p) => p.id === id);
        if (index < 0) return null;
        const current = state.products[index];
        if (current === undefined) return null;
        state.products[index] = { ...applyDefinedPatch(current, patch), updatedAt: nowIso() };
        await persist();
        return state.products[index] ?? null;
      }),

    // orders
    createOrder: (input: NewOrder): Promise<Order> =>
      withLock(async () => {
        const now = nowIso();
        const order: Order = {
          id: input.id ?? randomUUID(),
          customerId: input.customerId,
          productId: input.productId,
          amountArs: input.amountArs,
          status: input.status ?? "pending",
          mpPaymentId: input.mpPaymentId ?? null,
          deliveredAt: input.deliveredAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        state.orders.push(order);
        await persist();
        return order;
      }),

    getOrderById: (id: string): Promise<Order | null> =>
      withLock(() => state.orders.find((o) => o.id === id) ?? null),

    listOrders: (filter?: OrderFilter): Promise<Order[]> =>
      withLock(() => {
        let list = state.orders;
        if (filter?.status !== undefined) list = list.filter((o) => o.status === filter.status);
        if (filter?.customerId !== undefined)
          list = list.filter((o) => o.customerId === filter.customerId);
        return [...list];
      }),

    updateOrder: (id: string, patch: OrderPatch): Promise<Order | null> =>
      withLock(async () => {
        const index = state.orders.findIndex((o) => o.id === id);
        if (index < 0) return null;
        const current = state.orders[index];
        if (current === undefined) return null;
        state.orders[index] = { ...applyDefinedPatch(current, patch), updatedAt: nowIso() };
        await persist();
        return state.orders[index] ?? null;
      }),

    // subscriptions
    createSubscription: (input: NewSubscription): Promise<Subscription> =>
      withLock(async () => {
        const now = nowIso();
        const subscription: Subscription = {
          id: input.id ?? randomUUID(),
          customerId: input.customerId,
          productId: input.productId,
          mpPreapprovalId: input.mpPreapprovalId ?? null,
          status: input.status ?? "active",
          nextPaymentDate: input.nextPaymentDate ?? null,
          createdAt: now,
          updatedAt: now,
        };
        state.subscriptions.push(subscription);
        await persist();
        return subscription;
      }),

    getSubscriptionById: (id: string): Promise<Subscription | null> =>
      withLock(() => state.subscriptions.find((s) => s.id === id) ?? null),

    listSubscriptions: (filter?: SubscriptionFilter): Promise<Subscription[]> =>
      withLock(() => {
        let list = state.subscriptions;
        if (filter?.status !== undefined)
          list = list.filter((s) => s.status === filter.status);
        if (filter?.customerId !== undefined)
          list = list.filter((s) => s.customerId === filter.customerId);
        return [...list];
      }),

    updateSubscription: (
      id: string,
      patch: SubscriptionPatch,
    ): Promise<Subscription | null> =>
      withLock(async () => {
        const index = state.subscriptions.findIndex((s) => s.id === id);
        if (index < 0) return null;
        const current = state.subscriptions[index];
        if (current === undefined) return null;
        state.subscriptions[index] = { ...applyDefinedPatch(current, patch), updatedAt: nowIso() };
        await persist();
        return state.subscriptions[index] ?? null;
      }),

    // payments
    createPayment: (input: NewPayment): Promise<Payment> =>
      withLock(async () => {
        const now = nowIso();
        const payment: Payment = {
          id: input.id ?? randomUUID(),
          orderId: input.orderId ?? null,
          subscriptionId: input.subscriptionId ?? null,
          mpPaymentId: input.mpPaymentId,
          amountArs: input.amountArs,
          status: input.status ?? "pending",
          paidAt: input.paidAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        state.payments.push(payment);
        await persist();
        return payment;
      }),

    getPaymentById: (id: string): Promise<Payment | null> =>
      withLock(() => state.payments.find((p) => p.id === id) ?? null),

    getPaymentByMpId: (mpPaymentId: string): Promise<Payment | null> =>
      withLock(() => state.payments.find((p) => p.mpPaymentId === mpPaymentId) ?? null),

    listPayments: (filter?: PaymentFilter): Promise<Payment[]> =>
      withLock(() => {
        let list = state.payments;
        if (filter?.status !== undefined) list = list.filter((p) => p.status === filter.status);
        if (filter?.customerId !== undefined) {
          const customerId = filter.customerId;
          const subIds = new Set(
            state.subscriptions
              .filter((s) => s.customerId === customerId)
              .map((s) => s.id),
          );
          const orderIds = new Set(
            state.orders.filter((o) => o.customerId === customerId).map((o) => o.id),
          );
          list = list.filter(
            (p) =>
              (p.subscriptionId !== null && subIds.has(p.subscriptionId)) ||
              (p.orderId !== null && orderIds.has(p.orderId)),
          );
        }
        if (filter?.subscriptionId !== undefined)
          list = list.filter((p) => p.subscriptionId === filter.subscriptionId);
        if (filter?.orderId !== undefined)
          list = list.filter((p) => p.orderId === filter.orderId);
        return [...list];
      }),

    updatePayment: (id: string, patch: PaymentPatch): Promise<Payment | null> =>
      withLock(async () => {
        const index = state.payments.findIndex((p) => p.id === id);
        if (index < 0) return null;
        const current = state.payments[index];
        if (current === undefined) return null;
        state.payments[index] = { ...applyDefinedPatch(current, patch), updatedAt: nowIso() };
        await persist();
        return state.payments[index] ?? null;
      }),

    // code_pool
    addCodes: (codes: readonly NewCodeInput[]): Promise<number> =>
      withLock(async () => {
        const now = nowIso();
        const existing = new Set(state.codes.map((code) => code.codeHash));
        let inserted = 0;
        for (const input of codes) {
          const hash = hashCode(input.plaintext);
          if (existing.has(hash)) continue;
          existing.add(hash);
          plaintexts.set(hash, input.plaintext);
          state.codes.push({
            id: randomUUID(),
            codeHash: hash,
            batch: input.batch ?? null,
            status: "unissued",
            reservedUntil: null,
            issuedAt: null,
            orderId: null,
            subscriptionId: null,
            createdAt: now,
            updatedAt: now,
          });
          inserted += 1;
        }
        if (inserted > 0) await persist();
        return inserted;
      }),

    listCodes: (filter?: CodeFilter): Promise<CodePoolItem[]> =>
      withLock(() => {
        let list = state.codes;
        if (filter?.status !== undefined) list = list.filter((c) => c.status === filter.status);
        if (filter?.batch !== undefined) list = list.filter((c) => c.batch === filter.batch);
        return [...list];
      }),

    allocateNextCode: (): Promise<AllocatedCode | null> =>
      withLock(async () => {
        const index = state.codes.findIndex((code) => code.status === "unissued");
        if (index < 0) return null;
        const code = state.codes[index];
        if (code === undefined) return null;
        const plaintext = plaintexts.get(code.codeHash);
        if (plaintext === undefined) return null; // sin texto plano no se puede entregar
        state.codes[index] = {
          ...code,
          status: "issued",
          issuedAt: nowIso(),
          updatedAt: nowIso(),
        };
        await persist();
        return { id: code.id, plaintext };
      }),

    voidCode: (id: string): Promise<boolean> =>
      withLock(async () => {
        const index = state.codes.findIndex((code) => code.id === id);
        if (index < 0) return false;
        const code = state.codes[index];
        if (code === undefined) return false;
        state.codes[index] = { ...code, status: "voided", updatedAt: nowIso() };
        await persist();
        return true;
      }),

    // email_logs
    createEmailLog: (input: NewEmailLog): Promise<EmailLog> =>
      withLock(async () => {
        const log: EmailLog = {
          id: input.id ?? randomUUID(),
          customerId: input.customerId ?? null,
          template: input.template,
          toEmail: input.toEmail,
          subject: input.subject ?? null,
          status: input.status ?? "sent",
          error: input.error ?? null,
          metadata: input.metadata ?? {},
          createdAt: nowIso(),
        };
        state.emailLogs.push(log);
        await persist();
        return log;
      }),

    listEmailLogs: (filter?: EmailLogFilter): Promise<EmailLog[]> =>
      withLock(() => {
        let list = state.emailLogs;
        if (filter?.customerId !== undefined)
          list = list.filter((log) => log.customerId === filter.customerId);
        if (filter?.template !== undefined)
          list = list.filter((log) => log.template === filter.template);
        return [...list];
      }),

    // events
    recordEventOnce: (event: NewEvent): Promise<boolean> =>
      withLock(async () => {
        const exists = state.events.some((e) => e.eventId === event.eventId);
        if (exists) return false;
        state.events.push({
          id: event.id ?? randomUUID(),
          eventId: event.eventId,
          source: event.source,
          type: event.type,
          payload: event.payload ?? {},
          processedAt: event.processedAt ?? null,
          createdAt: nowIso(),
        });
        await persist();
        return true;
      }),

    listEvents: (): Promise<EventRecord[]> => withLock(() => [...state.events]),

    // config
    getConfigValue: (key: string): Promise<unknown> =>
      withLock(() => state.config.find((entry) => entry.key === key)?.value ?? null),

    setConfigValue: (key: string, value: unknown): Promise<void> =>
      withLock(async () => {
        const index = state.config.findIndex((entry) => entry.key === key);
        const entry: ConfigEntry = { key, value, updatedAt: nowIso() };
        if (index < 0) {
          state.config.push(entry);
        } else {
          state.config[index] = entry;
        }
        await persist();
      }),

    listConfig: (): Promise<ConfigEntry[]> => withLock(() => [...state.config]),
  };

  return repository;

  // --- Estado inicial desde el seed ------------------------------------------------

  function buildStateFromSeed(
    seed: DemoSeed,
    map: Map<string, string>,
    now: string,
  ): MemoryState {
    const customers: Customer[] = seed.customers.map((c) => ({
      id: c.id ?? randomUUID(),
      email: c.email,
      fullName: c.fullName ?? null,
      phone: c.phone ?? null,
      country: c.country ?? "AR",
      metadata: c.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    }));

    const products: Product[] = seed.products.map((p) => ({
      id: p.id ?? randomUUID(),
      slug: p.slug,
      name: p.name,
      description: p.description ?? null,
      kind: p.kind ?? "subscription",
      priceArs: p.priceArs ?? 0,
      currency: p.currency ?? "ARS",
      isDemo: p.isDemo ?? false,
      active: p.active ?? true,
      createdAt: now,
      updatedAt: now,
    }));

    const orders: Order[] = seed.orders.map((o) => ({
      id: o.id ?? randomUUID(),
      customerId: o.customerId,
      productId: o.productId,
      amountArs: o.amountArs,
      status: o.status ?? "pending",
      mpPaymentId: o.mpPaymentId ?? null,
      deliveredAt: o.deliveredAt ?? null,
      createdAt: now,
      updatedAt: now,
    }));

    const subscriptions: Subscription[] = seed.subscriptions.map((s) => ({
      id: s.id ?? randomUUID(),
      customerId: s.customerId,
      productId: s.productId,
      mpPreapprovalId: s.mpPreapprovalId ?? null,
      status: s.status ?? "active",
      nextPaymentDate: s.nextPaymentDate ?? null,
      createdAt: now,
      updatedAt: now,
    }));

    const payments: Payment[] = seed.payments.map((p) => ({
      id: p.id ?? randomUUID(),
      orderId: p.orderId ?? null,
      subscriptionId: p.subscriptionId ?? null,
      mpPaymentId: p.mpPaymentId,
      amountArs: p.amountArs,
      status: p.status ?? "pending",
      paidAt: p.paidAt ?? null,
      createdAt: now,
      updatedAt: now,
    }));

    const codes: CodePoolItem[] = [];
    const seen = new Set<string>();
    for (const input of seed.codes) {
      const hash = hashCode(input.plaintext);
      if (seen.has(hash)) continue;
      seen.add(hash);
      map.set(hash, input.plaintext);
      codes.push({
        id: randomUUID(),
        codeHash: hash,
        batch: input.batch ?? null,
        status: "unissued",
        reservedUntil: null,
        issuedAt: null,
        orderId: null,
        subscriptionId: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    const config: ConfigEntry[] = seed.config.map((entry) => ({
      key: entry.key,
      value: entry.value,
      updatedAt: now,
    }));

    return {
      customers,
      products,
      orders,
      subscriptions,
      payments,
      codes,
      emailLogs: [],
      events: [],
      config,
    };
  }
}
