// src/db/types.ts — Tipos de dominio y contrato del repositorio.
// Espejo exacto del esquema SQL (supabase/migrations/0001_init.sql):
// columnas nullable como `X | null`, fechas como string ISO, dinero como number (ARS).
// IMPORTANTE: este módulo NO importa @supabase/supabase-js — el driver de memoria
// (modo demo) debe poder cargarlo sin tocar la dependencia de Supabase.
import type {
  CodePoolStatus,
  OrderStatus,
  PaymentStatus,
  SubscriptionStatus,
} from "../state-machine";

// allow: SIZE_OK — declaraciones de tipos (espejo del esquema SQL)

// --- Uniones de dominio ---------------------------------------------------

/** País del cliente (CHECK `customers_country_check`). */
export type Country = "AR" | "UY" | "CL" | "PY";

/** Tipo de producto (CHECK `products_kind_check`). */
export type ProductKind = "subscription" | "one_time";

/** Estado de un envío de email (CHECK `email_logs_status_check`). */
export type EmailLogStatus = "sent" | "failed" | "queued";

// --- Entidades (espejo de las tablas) --------------------------------------

/** Tabla `customers` — datos de contacto de quien compra/suscribe. */
export interface Customer {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly phone: string | null;
  readonly country: Country;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Tabla `products` — catálogo (suscripción o compra única). */
export interface Product {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly kind: ProductKind;
  readonly priceArs: number;
  readonly currency: string;
  readonly isDemo: boolean;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Tabla `orders` — compras únicas. */
export interface Order {
  readonly id: string;
  readonly customerId: string;
  readonly productId: string;
  readonly amountArs: number;
  readonly status: OrderStatus;
  readonly mpPaymentId: string | null;
  readonly deliveredAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Tabla `subscriptions` — suscripciones (Preapproval de MercadoPago). */
export interface Subscription {
  readonly id: string;
  readonly customerId: string;
  readonly productId: string;
  readonly mpPreapprovalId: string | null;
  readonly status: SubscriptionStatus;
  readonly nextPaymentDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Tabla `payments` — pagos (compra única o cuota de suscripción). */
export interface Payment {
  readonly id: string;
  readonly orderId: string | null;
  readonly subscriptionId: string | null;
  readonly mpPaymentId: string;
  readonly amountArs: number;
  readonly status: PaymentStatus;
  readonly paidAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Tabla `code_pool` — códigos de acceso (solo hash SHA-256 en reposo). */
export interface CodePoolItem {
  readonly id: string;
  readonly codeHash: string;
  readonly batch: string | null;
  readonly status: CodePoolStatus;
  readonly reservedUntil: string | null;
  readonly issuedAt: string | null;
  readonly orderId: string | null;
  readonly subscriptionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Tabla `email_logs` — registro de envíos (Resend / outbox). */
export interface EmailLog {
  readonly id: string;
  readonly customerId: string | null;
  readonly template: string;
  readonly toEmail: string;
  readonly subject: string | null;
  readonly status: EmailLogStatus;
  readonly error: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

/** Tabla `events` — eventos recibidos (dedupe por `event_id`). */
export interface EventRecord {
  readonly id: string;
  readonly eventId: string;
  readonly source: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly processedAt: string | null;
  readonly createdAt: string;
}

/** Tabla `config` — clave/valor (`dunning_policy`, `fx_rates`, `store_mode`, …). */
export interface ConfigEntry {
  readonly key: string;
  readonly value: unknown;
  readonly updatedAt: string;
}

// --- Entradas de creación (New*) -------------------------------------------
// `id` es opcional (la DB genera UUID por defecto); los campos con default de
// esquema también son opcionales. Los campos nullable del esquema aceptan null.

/** Alta de cliente. */
export interface NewCustomer {
  readonly id?: string;
  readonly email: string;
  readonly fullName?: string | null;
  readonly phone?: string | null;
  readonly country?: Country;
  readonly metadata?: Record<string, unknown>;
}

/** Alta de producto. */
export interface NewProduct {
  readonly id?: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string | null;
  readonly kind?: ProductKind;
  readonly priceArs?: number;
  readonly currency?: string;
  readonly isDemo?: boolean;
  readonly active?: boolean;
}

/** Alta de orden de compra. */
export interface NewOrder {
  readonly id?: string;
  readonly customerId: string;
  readonly productId: string;
  readonly amountArs: number;
  readonly status?: OrderStatus;
  readonly mpPaymentId?: string | null;
  readonly deliveredAt?: string | null;
}

/** Alta de suscripción. */
export interface NewSubscription {
  readonly id?: string;
  readonly customerId: string;
  readonly productId: string;
  readonly mpPreapprovalId?: string | null;
  readonly status?: SubscriptionStatus;
  readonly nextPaymentDate?: string | null;
}

/** Alta de pago (exactamente una de orderId / subscriptionId). */
export interface NewPayment {
  readonly id?: string;
  readonly orderId?: string | null;
  readonly subscriptionId?: string | null;
  readonly mpPaymentId: string;
  readonly amountArs: number;
  readonly status?: PaymentStatus;
  readonly paidAt?: string | null;
}

/** Alta de registro de email. */
export interface NewEmailLog {
  readonly id?: string;
  readonly customerId?: string | null;
  readonly template: string;
  readonly toEmail: string;
  readonly subject?: string | null;
  readonly status?: EmailLogStatus;
  readonly error?: string | null;
  readonly metadata?: Record<string, unknown>;
}

/** Alta de evento (el repositorio deduplica por `eventId`). */
export interface NewEvent {
  readonly id?: string;
  readonly eventId: string;
  readonly source: string;
  readonly type: string;
  readonly payload?: Record<string, unknown>;
  readonly processedAt?: string | null;
}

// --- Códigos de acceso ------------------------------------------------------

/** Código en texto plano para cargar al pool (se persiste solo su hash). */
export interface NewCodeInput {
  readonly plaintext: string;
  readonly batch?: string;
}

/** Código ya asignado a una compra/suscripción (plaintext solo en memoria). */
export interface AllocatedCode {
  readonly id: string;
  readonly plaintext: string;
}

// --- Filtros de listado -----------------------------------------------------

export interface CustomerFilter {
  readonly q?: string;
  readonly country?: Country;
}

export interface OrderFilter {
  readonly status?: OrderStatus;
  readonly customerId?: string;
}

export interface SubscriptionFilter {
  readonly status?: SubscriptionStatus;
  readonly customerId?: string;
}

export interface PaymentFilter {
  readonly status?: PaymentStatus;
  readonly customerId?: string;
  readonly subscriptionId?: string;
  readonly orderId?: string;
}

export interface CodeFilter {
  readonly status?: CodePoolStatus;
  readonly batch?: string;
}

export interface EmailLogFilter {
  readonly customerId?: string;
  readonly template?: string;
}

// --- Patches de actualización ------------------------------------------------

/** Campos actualizables de una orden. */
export type OrderPatch = Partial<Pick<Order, "status" | "mpPaymentId" | "deliveredAt">>;

/** Campos actualizables de una suscripción. */
export type SubscriptionPatch = Partial<
  Pick<Subscription, "status" | "mpPreapprovalId" | "nextPaymentDate">
>;

/** Campos actualizables de un pago. */
export type PaymentPatch = Partial<Pick<Payment, "status" | "paidAt">>;

/** Campos actualizables de un cliente. */
export type CustomerPatch = Partial<
  Pick<Customer, "fullName" | "phone" | "country" | "metadata">
>;

/** Campos actualizables de un producto. */
export type ProductPatch = Partial<
  Pick<Product, "name" | "description" | "kind" | "priceArs" | "currency" | "isDemo" | "active">
>;

/** Campos actualizables de un código del pool. */
export type CodePoolPatch = Partial<
  Pick<CodePoolItem, "status" | "reservedUntil" | "issuedAt" | "orderId" | "subscriptionId">
>;

// --- Contrato del repositorio -------------------------------------------------
// Interfaz única para los dos drivers: `memory` (modo demo) y `supabase` (real).

export interface Repository {
  // customers
  createCustomer(input: NewCustomer): Promise<Customer>;
  getCustomerById(id: string): Promise<Customer | null>;
  getCustomerByEmail(email: string): Promise<Customer | null>;
  listCustomers(filter?: CustomerFilter): Promise<Customer[]>;
  updateCustomer(id: string, patch: CustomerPatch): Promise<Customer | null>;

  // products
  createProduct(input: NewProduct): Promise<Product>;
  getProductById(id: string): Promise<Product | null>;
  getProductBySlug(slug: string): Promise<Product | null>;
  listProducts(): Promise<Product[]>;
  updateProduct(id: string, patch: ProductPatch): Promise<Product | null>;

  // orders
  createOrder(input: NewOrder): Promise<Order>;
  getOrderById(id: string): Promise<Order | null>;
  listOrders(filter?: OrderFilter): Promise<Order[]>;
  updateOrder(id: string, patch: OrderPatch): Promise<Order | null>;

  // subscriptions
  createSubscription(input: NewSubscription): Promise<Subscription>;
  getSubscriptionById(id: string): Promise<Subscription | null>;
  listSubscriptions(filter?: SubscriptionFilter): Promise<Subscription[]>;
  updateSubscription(id: string, patch: SubscriptionPatch): Promise<Subscription | null>;

  // payments
  createPayment(input: NewPayment): Promise<Payment>;
  getPaymentById(id: string): Promise<Payment | null>;
  getPaymentByMpId(mpPaymentId: string): Promise<Payment | null>;
  listPayments(filter?: PaymentFilter): Promise<Payment[]>;
  updatePayment(id: string, patch: PaymentPatch): Promise<Payment | null>;

  // code_pool
  /** Inserta códigos nuevos (dedupe por hash) y devuelve la cantidad insertada. */
  addCodes(codes: readonly NewCodeInput[]): Promise<number>;
  listCodes(filter?: CodeFilter): Promise<CodePoolItem[]>;
  /** Reserva y emite el próximo código `unissued`; `null` si no hay stock. */
  allocateNextCode(): Promise<AllocatedCode | null>;
  /** Anula un código emitido y lo devuelve al pool; `false` si no existe/no aplica. */
  voidCode(id: string): Promise<boolean>;

  // email_logs
  createEmailLog(input: NewEmailLog): Promise<EmailLog>;
  listEmailLogs(filter?: EmailLogFilter): Promise<EmailLog[]>;

  // events
  /** Registra el evento si su `eventId` es nuevo; `false` si ya estaba (duplicado). */
  recordEventOnce(event: NewEvent): Promise<boolean>;
  listEvents(): Promise<EventRecord[]>;

  // config
  getConfigValue(key: string): Promise<unknown>;
  setConfigValue(key: string, value: unknown): Promise<void>;
  listConfig(): Promise<ConfigEntry[]>;
}
