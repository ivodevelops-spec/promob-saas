// src/config.ts — Configuración tipada desde variables de entorno, con defaults seguros.
// En modo demo el sistema arranca con CERO variables de entorno: nada lanza errores.

type Env = Record<string, string | undefined>;

/** Driver de persistencia de datos. */
export type DataDriver = "memory" | "supabase";
/** Driver de pagos. */
export type PayDriver = "mock" | "real";
/** Driver de correo. */
export type MailDriver = "outbox" | "resend";

/** Configuración completa de la app, resuelta desde el entorno. */
export interface AppConfig {
  readonly dataDriver: DataDriver;
  readonly payDriver: PayDriver;
  readonly mailDriver: MailDriver;
  readonly demoMode: boolean;
  readonly outDir: string;
  readonly siteUrl: string;
  readonly mailFrom: string;
  readonly ownerEmail: string;
  readonly supabaseUrl: string;
  readonly supabaseServiceRoleKey: string;
  readonly supabaseAnonKey: string;
  readonly mpAccessToken: string;
  readonly mpPublicKey: string;
  readonly mpWebhookSecret: string;
  readonly resendApiKey: string;
  readonly cronSecret: string;
}

const DATA_DRIVERS: readonly DataDriver[] = ["memory", "supabase"];
const PAY_DRIVERS: readonly PayDriver[] = ["mock", "real"];
const MAIL_DRIVERS: readonly MailDriver[] = ["outbox", "resend"];

/** Devuelve el valor si está definido y no vacío; si no, `""`. */
function optional(value: string | undefined): string {
  return value !== undefined && value.length > 0 ? value : "";
}

/** Devuelve el valor si está definido y no vacío; si no, el fallback. */
function withDefault(fallback: string, value: string | undefined): string {
  return value !== undefined && value.length > 0 ? value : fallback;
}

/** Valida que el valor pertenezca al conjunto permitido; si no, lanza error en español. */
function parseDriver<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined || value.length === 0) {
    return fallback;
  }
  if (!allowed.includes(value as T)) {
    throw new Error(
      `Valor inválido para ${name}: "${value}". Valores permitidos: ${allowed.join(", ")}.`,
    );
  }
  return value as T;
}

/** Parsea "true"/"false"; cualquier otro valor lanza error en español. */
function parseBool(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.length === 0) {
    return fallback;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Valor inválido para ${name}: "${value}". Valores permitidos: "true", "false".`);
}

/** Lanza si la variable requerida por el driver está vacía. */
function required(name: string, value: string): void {
  if (value.length === 0) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
}

/** Parsea el entorno en una config tipada. Puro y testeable. */
export function loadConfig(env: Env = process.env): AppConfig {
  const dataDriver = parseDriver("DATA_DRIVER", env["DATA_DRIVER"], DATA_DRIVERS, "memory");
  const payDriver = parseDriver("PAY_DRIVER", env["PAY_DRIVER"], PAY_DRIVERS, "mock");
  const mailDriver = parseDriver("MAIL_DRIVER", env["MAIL_DRIVER"], MAIL_DRIVERS, "outbox");
  const demoMode = parseBool("DEMO_MODE", env["DEMO_MODE"], true);

  const supabaseUrl = optional(env["SUPABASE_URL"]);
  const supabaseServiceRoleKey = optional(env["SUPABASE_SERVICE_ROLE_KEY"]);
  const supabaseAnonKey = optional(env["SUPABASE_ANON_KEY"]);
  const mpAccessToken = optional(env["MP_ACCESS_TOKEN"]);
  const mpPublicKey = optional(env["MP_PUBLIC_KEY"]);
  const mpWebhookSecret = optional(env["MP_WEBHOOK_SECRET"]);
  const resendApiKey = optional(env["RESEND_API_KEY"]);
  const cronSecret = optional(env["CRON_SECRET"]);

  // Validación por driver: los secretos solo se exigen cuando su driver los necesita.
  if (dataDriver === "supabase") {
    required("SUPABASE_URL", supabaseUrl);
    required("SUPABASE_SERVICE_ROLE_KEY", supabaseServiceRoleKey);
    required("SUPABASE_ANON_KEY", supabaseAnonKey);
  }
  if (payDriver === "real") {
    required("MP_ACCESS_TOKEN", mpAccessToken);
    required("MP_PUBLIC_KEY", mpPublicKey);
    required("MP_WEBHOOK_SECRET", mpWebhookSecret);
  }
  if (mailDriver === "resend") {
    required("RESEND_API_KEY", resendApiKey);
  }

  return {
    dataDriver,
    payDriver,
    mailDriver,
    demoMode,
    outDir: withDefault("out/", env["OUT_DIR"]),
    siteUrl: withDefault("http://localhost:4321", env["SITE_URL"]),
    mailFrom: withDefault("Promob <noreply@localhost>", env["MAIL_FROM"]),
    ownerEmail: withDefault("owner@example.com", env["OWNER_EMAIL"]),
    supabaseUrl,
    supabaseServiceRoleKey,
    supabaseAnonKey,
    mpAccessToken,
    mpPublicKey,
    mpWebhookSecret,
    resendApiKey,
    cronSecret,
  };
}

let cached: AppConfig | null = null;

/** Singleton diferido: solo lee el entorno la primera vez que se llama. */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}
