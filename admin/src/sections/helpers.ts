/* ============================================================
   PROMOB — Panel de gestión: ayudantes compartidos de secciones.
   Tipos de respuesta del panel (contrato-api.md §7), componentes
   reutilizables (tarjetas, modales, formularios, tablas con filas
   accionables) y utilidades (debounce, formatos, ciclo de carga).
   Nada usa estilos sueltos: todo referencia tokens.css.
   ============================================================ */

import type { Customer, Payment, Subscription } from "../../../src/db/types";
import { alert, el, emptyState, skeleton } from "../ui";
import type { CellValue, ColumnDef } from "../ui";
import { svgIcon } from "../icons";

/* ---------- Tipos de respuesta (contrato-api.md §7) ---------- */

/** KPIs del dashboard: `resource=dashboard` → `kpis`. */
export interface KpiSet {
  activeCustomers: number;
  activeSubscriptions: number;
  monthRevenueArs: number;
  availableCodes: number;
}

/** Aviso del día: `alerts[]` (kind ∈ past_due | suspended | low_stock). */
export interface DashboardAlert {
  kind: string;
  message: string;
  count: number;
}

/** Última suscripción del dashboard: `recentSubscriptions[]`. */
export interface RecentSubscription {
  id: string;
  customerEmail: string;
  productName: string;
  status: string;
  nextPaymentDate: string | null;
}

/** Punto de la serie mensual: `salesSeries[]`. */
export interface SalesPoint {
  month: string;
  totalArs: number;
}

/** Respuesta completa de `resource=dashboard` (objeto directo, sin paginar). */
export interface DashboardPayload {
  kpis: KpiSet;
  alerts: DashboardAlert[];
  recentSubscriptions: RecentSubscription[];
  salesSeries: SalesPoint[];
}

/** Item de `resource=customers`: Customer + contadores. */
export type CustomerRow = Customer & { subscriptionsCount: number; lastPaymentAt: string | null };

/** Item de `resource=subscriptions`: Subscription + vistas. */
export type SubscriptionRow = Subscription & { customerEmail: string; productName: string };

/** Item de `resource=payments`: Payment + vistas. */
export type PaymentRow = Payment & { customerEmail: string; productName: string };

/* ---------- Catálogos fijos del modo demo ---------- */

/**
 * Productos demo para el filtro de suscripciones.
 * Provisorio: la API del panel no expone catálogo de productos todavía
 * (contrato §2); estos ids coinciden con el seed demo (src/db/seed.ts).
 */
export const DEMO_PRODUCTS: readonly { id: string; name: string }[] = [
  { id: "demo-product-mensual", name: "Promob Plus Mensual" },
  { id: "demo-product-anual", name: "Promob Plus Anual" },
  { id: "demo-product-unico", name: "Promob Plus Único" },
];

/** Opciones del filtro de estado de suscripciones (valor vacío = todas). */
export const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "active", label: "Activa" },
  { value: "past_due", label: "En mora" },
  { value: "suspended", label: "Suspendida" },
  { value: "lapsed", label: "De baja" },
  { value: "canceled", label: "Cancelada" },
];

/** Opciones del filtro de país de clientes (valor vacío = todos). */
export const COUNTRY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "Todos los países" },
  { value: "AR", label: "Argentina" },
  { value: "UY", label: "Uruguay" },
  { value: "CL", label: "Chile" },
  { value: "PY", label: "Paraguay" },
];

/** Medios de pago manual aceptados por `mark-paid`. */
export const PAYMENT_METHODS: readonly { value: string; label: string }[] = [
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

const COUNTRY_LABELS: Record<string, string> = {
  AR: "Argentina",
  UY: "Uruguay",
  CL: "Chile",
  PY: "Paraguay",
};

/* ---------- Utilidades ---------- */

/** Nombre del país en español para el código ISO. */
export function countryLabel(code: string): string {
  return COUNTRY_LABELS[code] ?? code;
}

/** Etiqueta legible de un mes ISO `2026-09` → "sept 2026" (es-AR). */
export function monthLabel(isoMonth: string): string {
  const [year, month] = isoMonth.split("-");
  const index = Number(month) - 1;
  if (year === undefined || month === undefined || index < 0 || index > 11) return isoMonth;
  const short = new Date(Number(year), index, 1)
    .toLocaleDateString("es-AR", { month: "short" })
    .replace(".", "");
  return `${short} ${year}`;
}

/** Debounce simple para campos de búsqueda. */
export function debounce(fn: () => void, ms: number): () => void {
  let timer = 0;
  return () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(fn, ms);
  };
}

/** Mensaje en español listo para mostrar, para cualquier error capturado. */
export function actionErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado. Intente nuevamente.";
}

/* ---------- Composición de vistas ---------- */

type ChildLike = Node | string | number | null | undefined | false;

/** Columna vertical de bloques con separación estándar (`.content`). */
export function stack(...children: ChildLike[]): HTMLDivElement {
  return el("div", { class: "content" }, ...children);
}

const PANEL_STYLE =
  "background: var(--surface); border: 1.5px solid var(--border);" +
  " border-radius: var(--radius-lg); padding: var(--space-5);" +
  " display: flex; flex-direction: column; gap: var(--space-4);";

/** Tarjeta de contenido del panel (superficie, borde y relleno de tokens). */
export function panel(...children: ChildLike[]): HTMLDivElement {
  return el("div", { class: "panel", style: PANEL_STYLE }, ...children);
}

/** Encabezado de tarjeta: título h2 + metadato opcional a la derecha. */
export function panelHeader(title: string, meta?: string): HTMLElement {
  const head = el(
    "div",
    { style: "display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap;" },
    el("h2", {
      style: "font-size: var(--text-h3); font-weight: var(--weight-bold); line-height: var(--leading-h3); color: var(--ink-900);",
      text: title,
    }),
  );
  if (meta !== undefined) {
    head.append(el("span", { style: "font-size: var(--text-caption); color: var(--ink-400);", text: meta }));
  }
  return head;
}

/** Grilla de pares etiqueta/valor para modales de detalle. */
export function detailGrid(fields: readonly { label: string; value: string | HTMLElement }[]): HTMLElement {
  return el(
    "div",
    { style: "display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:var(--space-4);" },
    ...fields.map((field) =>
      el(
        "div",
        { style: "display:flex;flex-direction:column;gap:var(--space-1);" },
        el("span", {
          style: "font-size: var(--text-micro); font-weight: var(--weight-semibold); letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-400);",
          text: field.label,
        }),
        el("span", { style: "font-size: var(--text-body); color: var(--ink-900);" }, field.value),
      ),
    ),
  );
}

/* ---------- Tabla con filas accionables ---------- */

/** Como `ui.table`, pero admite clic/teclado sobre cada fila. */
export function dataTable(
  columns: ColumnDef[],
  rows: Record<string, CellValue>[],
  onRowClick?: (index: number) => void,
): HTMLElement {
  const headRow = el("tr");
  for (const column of columns) {
    headRow.append(el("th", { scope: "col", class: column.numeric === true ? "num" : "", text: column.label }));
  }

  const body = el("tbody");
  rows.forEach((row, index) => {
    const tr = el("tr");
    if (onRowClick !== undefined) {
      tr.style.cursor = "pointer";
      tr.setAttribute("tabindex", "0");
      const activate = (): void => onRowClick(index);
      tr.addEventListener("click", activate);
      tr.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    }
    for (const column of columns) {
      const value = row[column.key] ?? "";
      const cell = el("td", { class: column.numeric === true ? "num" : "" });
      if (value instanceof HTMLElement) cell.append(value);
      else cell.textContent = String(value);
      tr.append(cell);
    }
    body.append(tr);
  });

  return el("div", { class: "table-wrap" }, el("table", { class: "data-table" }, el("thead", {}, headRow), body));
}

/* ---------- Ciclo de carga con reintento ---------- */

/** Muestra esqueleto, carga y ante falla ofrece "Reintentar" (re-renderiza). */
export function runLoad(root: HTMLElement, load: () => Promise<HTMLElement>): void {
  root.replaceChildren(skeleton(6));
  load().then(
    (node) => root.replaceChildren(node),
    (error: unknown) => {
      root.replaceChildren(
        emptyState({
          title: "No pudimos cargar la vista",
          text: actionErrorMessage(error),
          actionLabel: "Reintentar",
          onAction: () => runLoad(root, load),
        }),
      );
    },
  );
}

/* ---------- Modal genérico ---------- */

export interface ModalHandle {
  close: () => void;
}

/** Abre un modal con título, cuerpo y pie opcional. Cierre: X, Escape o clic fuera. */
export function openModal(options: {
  title: string;
  body: HTMLElement;
  footer?: HTMLElement;
  wide?: boolean;
}): ModalHandle {
  const titleId = "modal-title";
  let closed = false;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const backdrop = el("div", { class: "modal-backdrop" });
  const closeButton = el("button", { class: "icon-btn", type: "button", "aria-label": "Cerrar", html: svgIcon("x", 18) });
  const panelEl = el(
    "div",
    {
      class: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      tabindex: "-1",
      style: options.wide === true ? "max-width: 720px;" : undefined,
    },
    el("div", { class: "modal-head" }, el("h2", { id: titleId, class: "modal-title", text: options.title }), closeButton),
    options.body,
  );
  if (options.footer !== undefined) panelEl.append(options.footer);
  backdrop.append(panelEl);

  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    backdrop.remove();
    previousFocus?.focus();
  };

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  }

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeydown);
  document.body.append(backdrop);
  panelEl.focus();

  return { close };
}

/* ---------- Confirmación destructiva con motivo ---------- */

/** Confirmación con motivo obligatorio; resuelve el motivo o `null` si se cancela. */
export function promptReason(options: {
  title: string;
  consequence: string;
  confirmLabel: string;
  reasonLabel?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const titleId = "prompt-reason-title";
    const reasonLabel = options.reasonLabel ?? "Motivo";
    let settled = false;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const backdrop = el("div", { class: "modal-backdrop" });
    const closeButton = el("button", { class: "icon-btn", type: "button", "aria-label": "Cerrar", html: svgIcon("x", 18) });
    const reasonInput = el("textarea", {
      class: "textarea",
      id: "prompt-reason-input",
      rows: "3",
      placeholder: "Describa el motivo de la acción",
    });
    const reasonError = el("p", { class: "field-error", role: "alert", hidden: "true", text: "Indique el motivo para continuar." });
    const reasonField = el(
      "div",
      { class: "field modal-field" },
      el("label", { class: "field-label", for: "prompt-reason-input", text: `${reasonLabel} (obligatorio)` }),
      reasonInput,
      reasonError,
    );
    const cancelButton = el("button", { class: "btn btn--ghost", type: "button", text: "Cancelar" });
    const confirmButton = el("button", { class: "btn btn--danger", type: "button", text: options.confirmLabel });
    const panelEl = el(
      "div",
      {
        class: "modal",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": titleId,
        tabindex: "-1",
      },
      el("div", { class: "modal-head" }, el("h2", { id: titleId, class: "modal-title", text: options.title }), closeButton),
      el("p", { class: "modal-consequence", text: options.consequence }),
      reasonField,
      el("div", { class: "modal-actions" }, cancelButton, confirmButton),
    );
    backdrop.append(panelEl);

    function finish(result: string | null): void {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKeydown);
      backdrop.remove();
      previousFocus?.focus();
      resolve(result);
    }

    function onKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        finish(null);
      }
    }

    closeButton.addEventListener("click", () => finish(null));
    cancelButton.addEventListener("click", () => finish(null));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(null);
    });
    confirmButton.addEventListener("click", () => {
      if (reasonInput.value.trim() === "") {
        reasonField.classList.add("field--error");
        reasonError.hidden = false;
        reasonInput.focus();
        return;
      }
      finish(reasonInput.value.trim());
    });

    document.addEventListener("keydown", onKeydown);
    document.body.append(backdrop);
    panelEl.focus();
  });
}

/* ---------- Formulario modal (acciones con datos) ---------- */

export interface FormFieldSpec {
  id: string;
  label: string;
  kind: "text" | "number" | "select" | "textarea";
  options?: readonly { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  min?: number;
}

/** Modal con campos; valida obligatorios y muestra errores de envío sin romper. */
export function formModal(options: {
  title: string;
  fields: readonly FormFieldSpec[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}): void {
  const fieldNodes = options.fields.map((spec) => {
    let control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (spec.kind === "select") {
      control = el(
        "select",
        { class: "select", id: spec.id },
        ...(spec.options ?? []).map((option) => el("option", { value: option.value, text: option.label })),
      );
    } else if (spec.kind === "textarea") {
      control = el("textarea", { class: "textarea", id: spec.id, rows: "3", placeholder: spec.placeholder ?? "" });
    } else {
      control = el("input", { class: "input", id: spec.id, type: spec.kind, placeholder: spec.placeholder ?? "" });
      if (spec.min !== undefined) control.setAttribute("min", String(spec.min));
    }
    const node = el("div", { class: "field" }, el("label", { class: "field-label", for: spec.id, text: spec.label }), control);
    if (spec.hint !== undefined) node.append(el("p", { class: "field-hint", text: spec.hint }));
    return { spec, node, control };
  });

  const errorBox = el("div");
  const submitButton = el("button", { class: "btn btn--primary", type: "button", text: options.submitLabel });
  const cancelButton = el("button", { class: "btn btn--ghost", type: "button", text: "Cancelar" });
  const body = el(
    "div",
    { style: "display:flex;flex-direction:column;gap:var(--space-4);" },
    ...fieldNodes.map((field) => field.node),
    errorBox,
  );
  const modal = openModal({
    title: options.title,
    body,
    footer: el("div", { class: "modal-actions" }, cancelButton, submitButton),
  });

  cancelButton.addEventListener("click", () => modal.close());
  submitButton.addEventListener("click", () => {
    const values: Record<string, string> = {};
    let valid = true;
    for (const field of fieldNodes) {
      const value = field.control.value;
      values[field.spec.id] = value;
      if (field.spec.required === true && value.trim() === "") {
        valid = false;
        field.node.classList.add("field--error");
      }
    }
    if (!valid) return;

    submitButton.disabled = true;
    errorBox.replaceChildren();
    options.onSubmit(values).then(
      () => modal.close(),
      (error: unknown) => {
        submitButton.disabled = false;
        errorBox.replaceChildren(alert({ title: actionErrorMessage(error), kind: "danger" }));
      },
    );
  });
}
