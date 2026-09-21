// src/codes.ts — Pool de códigos con hash (W2). Skeletons; lógica en W2.

export function hashCode(_plaintext: string): string {
  throw new Error("Pendiente W2: hash SHA-256 del código en reposo");
}

export function allocateCode(_orderId: string): Promise<string> {
  throw new Error("Pendiente W2: asignación atómica FOR UPDATE SKIP LOCKED");
}
