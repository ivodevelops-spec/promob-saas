// src/config.ts — Configuración tipada desde variables de entorno, con defaults seguros.

type Env = Record<string, string | undefined>;

export interface AppConfig {
  readonly supabaseUrl: string;
  readonly supabaseServiceRoleKey: string;
  readonly supabaseAnonKey: string;
  readonly mpAccessToken: string;
  readonly mpPublicKey: string;
  readonly mpWebhookSecret: string;
  readonly resendApiKey: string;
  readonly mailFrom: string;
  readonly ownerEmail: string;
  readonly siteUrl: string;
  readonly cronSecret: string;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

function withDefault(fallback: string, value: string | undefined): string {
  return value && value.length > 0 ? value : fallback;
}

/** Parsea el entorno en una config tipada. Puro y testeable. */
export function loadConfig(env: Env = process.env): AppConfig {
  return {
    supabaseUrl: required("SUPABASE_URL", env["SUPABASE_URL"]),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", env["SUPABASE_SERVICE_ROLE_KEY"]),
    supabaseAnonKey: required("SUPABASE_ANON_KEY", env["SUPABASE_ANON_KEY"]),
    mpAccessToken: required("MP_ACCESS_TOKEN", env["MP_ACCESS_TOKEN"]),
    mpPublicKey: required("MP_PUBLIC_KEY", env["MP_PUBLIC_KEY"]),
    mpWebhookSecret: required("MP_WEBHOOK_SECRET", env["MP_WEBHOOK_SECRET"]),
    resendApiKey: required("RESEND_API_KEY", env["RESEND_API_KEY"]),
    mailFrom: withDefault("Promob <noreply@localhost>", env["MAIL_FROM"]),
    ownerEmail: required("OWNER_EMAIL", env["OWNER_EMAIL"]),
    siteUrl: withDefault("http://localhost:4321", env["SITE_URL"]),
    cronSecret: required("CRON_SECRET", env["CRON_SECRET"]),
  };
}

let cached: AppConfig | null = null;

/** Singleton diferido: solo lee el entorno la primera vez que se llama. */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}
