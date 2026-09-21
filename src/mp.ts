// Integración de Mercado Pago para la demo.
//
// NOTA IMPORTANTE: en las peticiones reales de webhook, `data.id` viene como
// query param de la URL, NO dentro del body JSON. Por eso `verifyWebhookSignature`
// recibe `dataId` como parámetro explícito y no lo lee del payload.

import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Verificación de firma de webhooks (header `x-signature`)
// ---------------------------------------------------------------------------

export interface VerifySignatureInput {
  readonly xSignature: string | null;
  readonly secret: string;
  readonly dataId: string | null;
  readonly requestId: string | null;
}

interface SignatureParts {
  readonly ts: string | null;
  readonly v1: string | null;
}

// Parsea el header `x-signature` con formato "ts=1700000000,v1=<hex>".
// Solo se aceptan las claves `ts` y `v1`; el resto se ignora.
function parseXSignature(xSignature: string | null): SignatureParts {
  if (xSignature === null) {
    return { ts: null, v1: null };
  }
  let ts: string | null = null;
  let v1: string | null = null;
  for (const pair of xSignature.split(",")) {
    const eq = pair.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (key === "ts") {
      ts = value;
    } else if (key === "v1") {
      v1 = value;
    }
  }
  return { ts, v1 };
}

// Construye el manifiesto firmado por Mercado Pago: une SOLO los segmentos
// presentes con ";" en el orden id, request-id, ts, y termina con ";".
// Ejemplo: "id:12345;request-id:req-1;ts:1700000000;".
function buildManifest(dataId: string | null, requestId: string | null, ts: string): string {
  const segments: string[] = [];
  if (dataId !== null) {
    segments.push(`id:${dataId}`);
  }
  if (requestId !== null) {
    segments.push(`request-id:${requestId}`);
  }
  segments.push(`ts:${ts}`);
  return `${segments.join(";")};`;
}

export function verifyWebhookSignature(input: VerifySignatureInput): boolean {
  const { ts, v1 } = parseXSignature(input.xSignature);
  if (ts === null || ts === "" || v1 === null || v1 === "") {
    return false;
  }

  // Mercado Pago normaliza a minúsculas los ids alfanuméricos.
  let dataId = input.dataId;
  if (dataId !== null && /^[A-Za-z0-9]+$/.test(dataId)) {
    dataId = dataId.toLowerCase();
  }

  const manifest = buildManifest(dataId, input.requestId, ts);
  const expectedHex = createHmac("sha256", input.secret).update(manifest).digest("hex");

  try {
    const expected = Buffer.from(expectedHex, "utf8");
    const received = Buffer.from(v1, "utf8");
    if (expected.length !== received.length) {
      return false;
    }
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cliente HTTP real de Mercado Pago (no se ejercita en la demo)
// ---------------------------------------------------------------------------

export interface CreatePreferenceInput {
  readonly productId: string;
  readonly customerEmail: string;
  readonly amountArs: number;
}

export interface CreatePreapprovalInput {
  readonly productId: string;
  readonly customerEmail: string;
  readonly cardTokenId: string;
  readonly amountArs: number;
}

export interface MpPreference {
  readonly id: string;
  readonly status: string;
  readonly initPoint: string;
}

export interface MpPreapproval {
  readonly id: string;
  readonly status: string;
}

export interface MpPayment {
  readonly id: string;
  readonly status: string;
}

export interface MpClient {
  createPreference(input: CreatePreferenceInput): Promise<MpPreference>;
  createPreapproval(input: CreatePreapprovalInput): Promise<MpPreapproval>;
  getPayment(id: string): Promise<MpPayment>;
}

const MP_BASE_URL = "https://api.mercadopago.com";

export function createMpClient(opts: { accessToken: string }): MpClient {
  const headers = {
    Authorization: `Bearer ${opts.accessToken}`,
    "Content-Type": "application/json",
  };

  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${MP_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Mercado Pago respondió con estado ${response.status}`);
    }
    const data = (await response.json()) as T;
    return data;
  }

  async function get<T>(path: string): Promise<T> {
    const response = await fetch(`${MP_BASE_URL}${path}`, { headers });
    if (!response.ok) {
      throw new Error(`Mercado Pago respondió con estado ${response.status}`);
    }
    const data = (await response.json()) as T;
    return data;
  }

  return {
    // POST /checkout/preferences — crea una preferencia de pago (Checkout Pro).
    createPreference(input: CreatePreferenceInput): Promise<MpPreference> {
      return post<MpPreference>("/checkout/preferences", {
        external_reference: input.productId,
        payer: { email: input.customerEmail },
        items: [
          {
            id: input.productId,
            title: "Producto de la demo",
            quantity: 1,
            unit_price: input.amountArs,
          },
        ],
      });
    },

    // POST /preapproval — crea una suscripción (Card Brick).
    createPreapproval(input: CreatePreapprovalInput): Promise<MpPreapproval> {
      return post<MpPreapproval>("/preapproval", {
        external_reference: input.productId,
        payer_email: input.customerEmail,
        card_token_id: input.cardTokenId,
        auto_recurring: {
          currency_id: "ARS",
          transaction_amount: input.amountArs,
          frequency: 1,
          frequency_type: "months",
        },
      });
    },

    // GET /v1/payments/{id} — consulta el estado de un pago.
    getPayment(id: string): Promise<MpPayment> {
      return get<MpPayment>(`/v1/payments/${id}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Simulador de pagos (demo)
// ---------------------------------------------------------------------------

export type MockPaymentStatus = "approved" | "rejected" | "pending";

export interface MockPayInput {
  readonly last4: string;
  readonly amountArs: number;
}

export interface MockPayResult {
  readonly status: MockPaymentStatus;
  readonly mpPaymentId: string;
  readonly detail: string;
}

export function createMockPay(
  options?: { scenarioOverride?: (input: MockPayInput) => MockPaymentStatus | null },
): (input: MockPayInput) => MockPayResult {
  return (input: MockPayInput): MockPayResult => {
    const overridden = options?.scenarioOverride?.(input) ?? null;
    let status: MockPaymentStatus;
    let detail: string;

    if (overridden !== null) {
      // El escenario forzado gana siempre que devuelva un valor.
      status = overridden;
      detail = `Escenario forzado por scenarioOverride (${status}).`;
    } else if (input.last4.endsWith("0002")) {
      // Tarjeta terminada en 0002: rechazada (simulado).
      status = "rejected";
      detail = "Pago rechazado (simulado).";
    } else if (input.last4.endsWith("0009")) {
      // Tarjeta terminada en 0009: pendiente (simulado).
      status = "pending";
      detail = "Pago pendiente (simulado).";
    } else {
      status = "approved";
      detail = "Pago aprobado (simulado).";
    }

    const mpPaymentId = `mock_${input.last4}_${Date.now().toString(36)}`;
    return { status, mpPaymentId, detail };
  };
}
