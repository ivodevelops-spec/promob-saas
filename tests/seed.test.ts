// tests/seed.test.ts — Verifica la forma y cobertura del seed demo (contrato-api.md §5).
import { describe, expect, it } from "vitest";
import { buildDemoSeed } from "../src/db/seed";

const NOW = "2026-10-01T12:00:00.000Z";

describe("buildDemoSeed", () => {
  const seed = buildDemoSeed(NOW);

  it("genera 3 productos demo con slugs únicos y ambos kinds", () => {
    expect(seed.products).toHaveLength(3);
    for (const product of seed.products) {
      expect(product.isDemo).toBe(true);
    }
    expect(new Set(seed.products.map((p) => p.slug)).size).toBe(3);
    const kinds = new Set(seed.products.map((p) => p.kind));
    expect(kinds).toContain("subscription");
    expect(kinds).toContain("one_time");
  });

  it("genera 6 clientes con suscripciones que cubren los 5 estados", () => {
    expect(seed.customers).toHaveLength(6);
    expect(seed.subscriptions).toHaveLength(6);
    // Cada suscripción pertenece a un cliente distinto (wiring correcto).
    expect(new Set(seed.subscriptions.map((s) => s.customerId)).size).toBe(6);
    const statuses = new Set(seed.subscriptions.map((s) => s.status));
    for (const status of ["active", "past_due", "suspended", "lapsed", "canceled"] as const) {
      expect(statuses).toContain(status);
    }
  });

  it("incluye al menos un pago aprobado y uno rechazado", () => {
    expect(seed.payments.some((p) => p.status === "approved")).toBe(true);
    expect(seed.payments.some((p) => p.status === "rejected")).toBe(true);
  });

  it("genera 40 códigos con plaintexts únicos en formato legible", () => {
    expect(seed.codes).toHaveLength(40);
    expect(new Set(seed.codes.map((c) => c.plaintext)).size).toBe(40);
    for (const code of seed.codes) {
      expect(code.plaintext).toMatch(/^PROMOB-\d{4}-\d{4}$/);
    }
  });

  it("config incluye dunning_policy y store_mode demo", () => {
    const byKey = new Map(seed.config.map((entry) => [entry.key, entry.value]));
    expect(byKey.get("dunning_policy")).toEqual({ graceDays: 14, lapseDays: 30 });
    expect(byKey.get("store_mode")).toBe("demo");
  });
});
