// tests/config.test.ts — parseo de entorno y defaults de src/config.ts.
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const fullEnv = {
  SUPABASE_URL: "https://demo.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
  SUPABASE_ANON_KEY: "anon",
  MP_ACCESS_TOKEN: "tok",
  MP_PUBLIC_KEY: "pub",
  MP_WEBHOOK_SECRET: "secret",
  RESEND_API_KEY: "re_key",
  OWNER_EMAIL: "owner@example.com",
  CRON_SECRET: "cron",
};

describe("loadConfig", () => {
  it("parsea un entorno completo y aplica defaults cuando un campo opcional falta", () => {
    const cfg = loadConfig(fullEnv);

    expect(cfg.supabaseUrl).toBe("https://demo.supabase.co");
    expect(cfg.ownerEmail).toBe("owner@example.com");
    // MAIL_FROM y SITE_URL tienen defaults.
    expect(cfg.mailFrom).toBe("Promob <noreply@localhost>");
    expect(cfg.siteUrl).toBe("http://localhost:4321");
  });

  it("respeta valores provistos para campos con default", () => {
    const cfg = loadConfig({
      ...fullEnv,
      MAIL_FROM: "Promob <hola@promob.com.ar>",
      SITE_URL: "https://promob.com.ar",
    });

    expect(cfg.mailFrom).toBe("Promob <hola@promob.com.ar>");
    expect(cfg.siteUrl).toBe("https://promob.com.ar");
  });

  it("lanza error cuando falta una variable requerida", () => {
    const { OWNER_EMAIL: _omit, ...missingOwner } = fullEnv;

    expect(() => loadConfig(missingOwner)).toThrow(/OWNER_EMAIL/);
  });
});
