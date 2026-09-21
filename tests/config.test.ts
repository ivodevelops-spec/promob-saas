// tests/config.test.ts — parseo de entorno, defaults de demo y validación por driver.
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const supabaseEnv = {
  DATA_DRIVER: "supabase",
  SUPABASE_URL: "https://demo.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
  SUPABASE_ANON_KEY: "anon",
};

describe("loadConfig", () => {
  it("arranca en demo con un entorno vacío (cero variables, nada lanza)", () => {
    const cfg = loadConfig({});

    expect(cfg.dataDriver).toBe("memory");
    expect(cfg.payDriver).toBe("mock");
    expect(cfg.mailDriver).toBe("outbox");
    expect(cfg.demoMode).toBe(true);
    expect(cfg.outDir).toBe("out/");
    expect(cfg.siteUrl).toBe("http://localhost:4321");
    expect(cfg.mailFrom).toBe("Promob <noreply@localhost>");
    expect(cfg.ownerEmail).toBe("owner@example.com");
    // Todos los secretos quedan vacíos en demo.
    expect(cfg.supabaseUrl).toBe("");
    expect(cfg.supabaseServiceRoleKey).toBe("");
    expect(cfg.supabaseAnonKey).toBe("");
    expect(cfg.mpAccessToken).toBe("");
    expect(cfg.mpPublicKey).toBe("");
    expect(cfg.mpWebhookSecret).toBe("");
    expect(cfg.resendApiKey).toBe("");
    expect(cfg.cronSecret).toBe("");
  });

  it("parsea valores provistos (drivers, urls, secretos)", () => {
    const cfg = loadConfig({
      ...supabaseEnv,
      PAY_DRIVER: "real",
      MAIL_DRIVER: "resend",
      MP_ACCESS_TOKEN: "tok",
      MP_PUBLIC_KEY: "pub",
      MP_WEBHOOK_SECRET: "wh",
      RESEND_API_KEY: "re_key",
      SITE_URL: "https://promob.com.ar",
      MAIL_FROM: "Promob <hola@promob.com.ar>",
      OWNER_EMAIL: "owner@promob.com.ar",
      OUT_DIR: "dist/",
      CRON_SECRET: "cron",
    });

    expect(cfg.dataDriver).toBe("supabase");
    expect(cfg.payDriver).toBe("real");
    expect(cfg.mailDriver).toBe("resend");
    expect(cfg.siteUrl).toBe("https://promob.com.ar");
    expect(cfg.mailFrom).toBe("Promob <hola@promob.com.ar>");
    expect(cfg.ownerEmail).toBe("owner@promob.com.ar");
    expect(cfg.outDir).toBe("dist/");
    expect(cfg.supabaseUrl).toBe("https://demo.supabase.co");
    expect(cfg.mpAccessToken).toBe("tok");
    expect(cfg.resendApiKey).toBe("re_key");
  });

  it("lanza error con un valor inválido para DATA_DRIVER", () => {
    expect(() => loadConfig({ DATA_DRIVER: "mysql" })).toThrow(/inválido|invalid/i);
  });

  it("exige SUPABASE_URL cuando dataDriver es supabase; con las tres variables no lanza", () => {
    expect(() => loadConfig({ DATA_DRIVER: "supabase" })).toThrow(/SUPABASE_URL/);
    expect(() => loadConfig(supabaseEnv)).not.toThrow();
  });

  it("exige MP_ACCESS_TOKEN cuando payDriver es real", () => {
    expect(() => loadConfig({ PAY_DRIVER: "real" })).toThrow(/MP_ACCESS_TOKEN/);
  });

  it("exige RESEND_API_KEY cuando mailDriver es resend", () => {
    expect(() => loadConfig({ MAIL_DRIVER: "resend" })).toThrow(/RESEND_API_KEY/);
  });

  it("DEMO_MODE='false' desactiva el modo demo", () => {
    const cfg = loadConfig({ DEMO_MODE: "false" });

    expect(cfg.demoMode).toBe(false);
  });
});
