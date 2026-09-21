// src/mp.ts — Cliente MercadoPago (W1). Skeletons con firma tipada; lógica en W1.

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

export function createPreference(_input: CreatePreferenceInput): Promise<{ id: string }> {
  throw new Error("Pendiente W1: crear preference de pago único (Checkout Pro)");
}

export function createPreapproval(_input: CreatePreapprovalInput): Promise<{ id: string }> {
  throw new Error("Pendiente W1: crear preapproval de suscripción (Card Brick)");
}

export function parseWebhook(_payload: unknown, _signature: string): unknown {
  throw new Error("Pendiente W1: verificación de firma y parseo del webhook");
}
