// tests/memory-repo.test.ts — Evidencia del repositorio en memoria (modo demo):
// seed, persistencia, asignación sin duplicados y reloj inyectable.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { allocateCode, lowStock } from "../src/codes";
import { createMemoryRepository } from "../src/db/memory";

const tempDirs: string[] = [];

async function tempDbPath(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "promob-db-"));
  tempDirs.push(dir);
  return path.join(dir, "demo-db.json");
}

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("repositorio en memoria (driver demo)", () => {
  it("siembra en la primera ejecución y persiste el archivo", async () => {
    const filePath = await tempDbPath();
    const repo = await createMemoryRepository({ filePath });

    expect(await repo.listProducts()).toHaveLength(3);
    expect(await repo.listCustomers()).toHaveLength(6);
    expect(await repo.listCodes()).toHaveLength(40);

    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { data: { codes: { codeHash: string }[] } };
    // Se persisten SOLO hashes: ningún código en texto plano en el archivo.
    expect(parsed.data.codes[0]?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(raw).not.toContain("PROMOB-");
  });

  it("sobrevive a un reinicio (persistencia) y sigue entregando códigos", async () => {
    const filePath = await tempDbPath();
    const first = await createMemoryRepository({ filePath });
    await first.allocateNextCode();

    const second = await createMemoryRepository({ filePath });
    expect(await second.listCustomers()).toHaveLength(6);
    const allocated = await second.allocateNextCode();
    expect(allocated).not.toBeNull();
    expect(allocated?.plaintext).toMatch(/^PROMOB-/);
  });

  it("asigna códigos únicos bajo llamadas concurrentes y nunca devuelve un hash", async () => {
    const filePath = await tempDbPath();
    const repo = await createMemoryRepository({ filePath });

    const results = await Promise.all(
      Array.from({ length: 12 }, () => allocateCode(repo)),
    );
    const codes = results.filter((r): r is NonNullable<typeof r> => r !== null);
    expect(codes).toHaveLength(12);
    const ids = new Set(codes.map((c) => c.id));
    const plaintexts = new Set(codes.map((c) => c.plaintext));
    expect(ids.size).toBe(12);
    expect(plaintexts.size).toBe(12);
    for (const code of codes) {
      expect(code.plaintext).toMatch(/^PROMOB-/);
      expect(code.plaintext).not.toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("no sobrevende: pool agotado devuelve null y activa el stock bajo", async () => {
    const filePath = await tempDbPath();
    const repo = await createMemoryRepository({ filePath });

    const stockBefore = await lowStock(repo);
    expect(stockBefore.remaining).toBe(40);
    expect(stockBefore.low).toBe(false);

    for (let i = 0; i < 40; i++) {
      expect(await allocateCode(repo)).not.toBeNull();
    }
    expect(await allocateCode(repo)).toBeNull();

    const stockAfter = await lowStock(repo);
    expect(stockAfter.remaining).toBe(0);
    expect(stockAfter.low).toBe(true);
  });

  it("deduplica eventos por eventId (idempotencia de webhooks)", async () => {
    const filePath = await tempDbPath();
    const repo = await createMemoryRepository({ filePath });

    const first = await repo.recordEventOnce({
      eventId: "evt-1",
      source: "mp",
      type: "payment",
      payload: { status: "approved" },
    });
    const second = await repo.recordEventOnce({
      eventId: "evt-1",
      source: "mp",
      type: "payment",
      payload: { status: "approved" },
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await repo.listEvents()).toHaveLength(1);
  });

  it("persiste configuración y reloj del simulador", async () => {
    const filePath = await tempDbPath();
    const repo = await createMemoryRepository({ filePath });

    await repo.setConfigValue("dunning_policy", { graceDays: 10, lapseDays: 45 });
    const before = repo.getNow();
    await repo.advanceDays(3);
    const after = repo.getNow();

    const deltaMs = Date.parse(after) - Date.parse(before);
    // El offset avanza 3 días exactos; la diferencia incluye los ms reales
    // transcurridos entre ambas lecturas (por eso la tolerancia).
    expect(deltaMs).toBeGreaterThanOrEqual(3 * 86_400_000);
    expect(deltaMs).toBeLessThan(3 * 86_400_000 + 5_000);

    const reloaded = await createMemoryRepository({ filePath });
    expect(await reloaded.getConfigValue("dunning_policy")).toEqual({
      graceDays: 10,
      lapseDays: 45,
    });
    const reloadedNow = reloaded.getNow();
    expect(Date.parse(reloadedNow) - Date.parse(before)).toBeGreaterThanOrEqual(3 * 86_400_000);
  });
});
