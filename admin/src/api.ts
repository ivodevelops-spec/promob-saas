/* ============================================================
   PROMOB — Panel de gestión: cliente tipado de la API.
   Contrato: docs/contrato-api.md §2 y §4.
   Una falla lanza ApiError con mensaje en español; la interfaz
   muestra un aviso con reintento, nunca rompe la navegación.
   ============================================================ */

/** Respuesta paginada estándar del contrato §2. */
export interface ApiPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Respuesta de una acción del panel: `{ ok, result }`. */
export interface ApiActionResult<T = unknown> {
  ok: boolean;
  result: T;
}

/** Acciones soportadas por POST /api/admin-api (contrato §2). */
export type AdminAction =
  | "resend-code"
  | "mark-paid"
  | "extend"
  | "suspend"
  | "reactivate"
  | "cancel"
  | "upload-codes"
  | "update-config";

/** Parámetros de query aceptados por GET /api/admin-api. */
export interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

interface ApiErrorBody {
  code?: string;
  message?: string;
}

/** Error tipado de la API, con mensaje listo para mostrar en español. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "La solicitud no es válida. Revise los datos e intente nuevamente.",
  401: "Su sesión expiró. Vuelva a ingresar al panel.",
  403: "No tiene permisos para realizar esta acción.",
  404: "No encontramos lo que buscaba.",
  500: "El servidor tuvo un problema. Intente nuevamente en unos minutos.",
};

const NETWORK_MESSAGE =
  "No pudimos conectar con el servidor de demo. Verifique que esté en línea e intente nuevamente.";

function messageFor(status: number, serverMessage?: string): string {
  if (serverMessage && serverMessage.trim() !== "") return serverMessage;
  return STATUS_MESSAGES[status] ?? "Ocurrió un error inesperado. Intente nuevamente.";
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiError(0, "network", NETWORK_MESSAGE);
  }

  if (!response.ok) {
    let code = "http";
    let serverMessage: string | undefined;
    try {
      const body = (await response.json()) as { error?: ApiErrorBody };
      code = body.error?.code ?? "http";
      serverMessage = body.error?.message;
    } catch {
      // Cuerpo no JSON: se usa el mensaje genérico según el estado.
    }
    throw new ApiError(response.status, code, messageFor(response.status, serverMessage));
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, "invalid-json", "La respuesta del servidor no es válida.");
  }
}

/** Lectura del panel: GET /api/admin-api?resource=… (contrato §2). */
export function apiGet<T>(resource: string, params?: QueryParams): Promise<ApiPage<T>> {
  const url = new URL("/api/admin-api", window.location.origin);
  url.searchParams.set("resource", resource);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return request<ApiPage<T>>(url);
}

/** Acción del panel: POST /api/admin-api (contrato §2). */
export function apiPost<T = unknown>(action: AdminAction, payload?: unknown): Promise<ApiActionResult<T>> {
  return request<ApiActionResult<T>>("/api/admin-api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload: payload ?? {} }),
  });
}
