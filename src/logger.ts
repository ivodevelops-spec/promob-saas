// src/logger.ts — Logger por niveles sin dependencias, con timestamp ISO y scope.

/** Interfaz mínima de logger: info / warn / error. */
export interface Logger {
  info(...a: unknown[]): void;
  warn(...a: unknown[]): void;
  error(...a: unknown[]): void;
}

/** Convierte un argumento arbitrario a texto legible para la línea de log. */
function formatArg(a: unknown): string {
  if (typeof a === "string") {
    return a;
  }
  if (a instanceof Error) {
    return a.stack ?? a.message;
  }
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

/** Escribe una línea con formato `[<ISO>] [<scope>] [level] message`. */
function write(
  scope: string,
  level: "info" | "warn" | "error",
  args: unknown[],
): void {
  const timestamp = new Date().toISOString();
  const message = args.map(formatArg).join(" ");
  const line = `[${timestamp}] [${scope}] [${level}] ${message}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/** Crea un logger con un scope fijo (ej. el nombre del módulo). */
export function createLogger(scope: string): Logger {
  return {
    info: (...a: unknown[]) => write(scope, "info", a),
    warn: (...a: unknown[]) => write(scope, "warn", a),
    error: (...a: unknown[]) => write(scope, "error", a),
  };
}

/** Logger global de la app. */
export const logger = createLogger("app");
