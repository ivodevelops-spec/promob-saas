// tests/schema.test.ts — sanity del esquema SQL (tablas, RLS, seed).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const initSql = readFileSync(path.join(root, "supabase", "migrations", "0001_init.sql"), "utf8");
const seedSql = readFileSync(path.join(root, "supabase", "migrations", "0002_seed.sql"), "utf8");

const REQUIRED_TABLES = [
  "customers",
  "products",
  "orders",
  "subscriptions",
  "payments",
  "code_pool",
  "email_logs",
  "events",
  "config",
  "profiles",
] as const;

describe("schema 0001_init.sql", () => {
  it("declara las 10 tablas del dominio", () => {
    for (const table of REQUIRED_TABLES) {
      expect(initSql).toMatch(new RegExp(`create table if not exists public\\.${table}\\b`));
    }
  });

  it("habilita RLS en todas las tablas", () => {
    for (const table of REQUIRED_TABLES) {
      expect(initSql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
    }
  });

  it("define constraints de estado clave", () => {
    expect(initSql).toContain("pending', 'paid', 'failed', 'refunded', 'delivered'");
    expect(initSql).toContain("active', 'past_due', 'suspended', 'lapsed', 'canceled'");
    expect(initSql).toContain("unissued', 'reserved', 'issued', 'voided'");
  });
});

describe("schema 0002_seed.sql", () => {
  it("siembra config de dunning y store_mode demo", () => {
    expect(seedSql).toContain("dunning_policy");
    expect(seedSql).toContain('"graceDays": 14, "lapseDays": 30');
    expect(seedSql).toContain("store_mode");
    expect(seedSql).toContain('"demo"');
  });

  it("marca los productos demo como provisorios", () => {
    expect(seedSql).toContain("is_demo, active) values");
    expect(seedSql).toContain("reemplazar por SKU real");
  });
});
