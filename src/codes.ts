// src/codes.ts — Pool de códigos de acceso: hash en reposo (SHA-256),
// asignación sin sobreventa y detección de stock bajo.
//
// Regla de oro: el texto plano de un código NUNCA se persiste; solo se entrega
// una vez (al email) y el repositorio lo mantiene en memoria durante la sesión.
import { createHash } from "node:crypto";
import type { AllocatedCode, Repository } from "./db/types";

/** Umbral por defecto de stock bajo: menos del 20 % del pool disponible. */
export const LOW_STOCK_THRESHOLD_PCT = 20;

/** Hash SHA-256 (hex) de un código en texto plano. */
export function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** Resultado del cálculo de stock del pool. */
export interface LowStockResult {
  readonly low: boolean;
  readonly remaining: number;
  readonly total: number;
  readonly remainingPct: number;
}

/**
 * Asigna el próximo código disponible del pool.
 * Devuelve `{ id, plaintext }` (el texto plano se entrega una sola vez) o `null`
 * si no hay stock: nunca se sobrevende una licencia.
 */
export async function allocateCode(repo: Repository): Promise<AllocatedCode | null> {
  return repo.allocateNextCode();
}

/** Anula un código (por ejemplo, tras un reintegro). */
export async function voidCode(repo: Repository, id: string): Promise<boolean> {
  return repo.voidCode(id);
}

/**
 * Calcula el estado de stock del pool.
 * `remaining` = códigos sin emitir; `total` = códigos no anulados.
 * Un pool vacío (`total === 0`) no se considera stock bajo.
 */
export async function lowStock(
  repo: Repository,
  thresholdPct: number = LOW_STOCK_THRESHOLD_PCT,
): Promise<LowStockResult> {
  const codes = await repo.listCodes();
  const remaining = codes.filter((code) => code.status === "unissued").length;
  const total = codes.filter((code) => code.status !== "voided").length;
  const remainingPct = total === 0 ? 100 : (remaining / total) * 100;
  return {
    low: total > 0 && remainingPct < thresholdPct,
    remaining,
    total,
    remainingPct,
  };
}
