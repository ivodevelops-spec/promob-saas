/* ============================================================
   PROMOB — Panel de gestión: ayudantes de DOM.
   Sin frameworks: creación de elementos, formato, badges,
   toasts, confirmaciones, tablas, esqueletos, estados vacíos
   y paginación. Todo con tokens del sistema de diseño.
   ============================================================ */

import { svgIcon } from "./icons";

/* ---------- Creación de elementos ---------- */

type Child = Node | string | number | null | undefined | false;

interface ElProps {
  [key: string]: unknown;
}

/** Crea un elemento con propiedades (class, attrs, eventos `on*`) e hijos. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") {
      node.className = String(value);
    } else if (key === "html") {
      node.innerHTML = String(value);
    } else if (key === "text") {
      node.textContent = String(value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Monta un nodo reemplazando el contenido del destino. */
export function mount(node: Node, target: HTMLElement): HTMLElement {
  target.replaceChildren(node);
  return target;
}

/* ---------- Formatos (convenciones §7) ---------- */

/** Formatea una fecha ISO (o Date) como DD/MM/AAAA. */
export function fmtDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Formatea un monto en pesos argentinos: "$ 1.234.567,89 ARS". */
export function fmtArs(amount: number): string {
  const formatted = amount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$ ${formatted} ARS`;
}

/* ---------- Badges de estado (plan §3) ---------- */

type BadgeKind = "success" | "warning" | "danger" | "info" | "neutral";

const BADGE_MAP: Record<string, { label: string; kind: BadgeKind }> = {
  active: { label: "Activa", kind: "success" },
  paid: { label: "Pagado", kind: "success" },
  approved: { label: "Aprobado", kind: "success" },
  available: { label: "Disponible", kind: "success" },
  delivered: { label: "Entregado", kind: "neutral" },
  past_due: { label: "En mora", kind: "warning" },
  low_stock: { label: "Stock bajo", kind: "warning" },
  suspended: { label: "Suspendida", kind: "danger" },
  rejected: { label: "Rechazado", kind: "danger" },
  failed: { label: "Fallido", kind: "danger" },
  pending: { label: "Pendiente", kind: "info" },
  reserved: { label: "Reservado", kind: "info" },
  canceled: { label: "Cancelada", kind: "neutral" },
  cancelled: { label: "Cancelada", kind: "neutral" },
  lapsed: { label: "De baja", kind: "neutral" },
  voided: { label: "Anulado", kind: "neutral" },
};

/** Convierte un estado crudo de la API en un badge con etiqueta en español. */
export function badge(status: string): HTMLElement {
  const entry = BADGE_MAP[status] ?? {
    label: status.replaceAll("_", " "),
    kind: "neutral" as BadgeKind,
  };
  return el("span", { class: `badge badge--${entry.kind}`, text: entry.label });
}

/* ---------- Toasts ---------- */

type ToastKind = "success" | "error" | "info";

let toastContainer: HTMLElement | null = null;

function getToastContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = el("div", { id: "toasts", role: "status", "aria-live": "polite" });
    document.body.append(toastContainer);
  }
  return toastContainer;
}

/** Muestra un aviso breve abajo a la derecha; desaparece a los 5 segundos. */
export function toast(message: string, kind: ToastKind = "info"): void {
  const container = getToastContainer();
  const iconName = kind === "success" ? "check-circle" : kind === "error" ? "alert-triangle" : "info";
  const closeButton = el("button", {
    class: "toast-close",
    type: "button",
    "aria-label": "Cerrar aviso",
    html: svgIcon("x", 14),
  });
  const item = el(
    "div",
    { class: `toast toast--${kind}` },
    el("span", { class: "toast-icon", html: svgIcon(iconName, 18) }),
    el("span", { class: "toast-text", text: message }),
    closeButton,
  );

  let timer = 0;
  const dismiss = (): void => {
    window.clearTimeout(timer);
    item.remove();
  };
  closeButton.addEventListener("click", dismiss);
  container.append(item);
  timer = window.setTimeout(dismiss, 5000);
}

/* ---------- Alertas / avisos ---------- */

export type AlertKind = "success" | "warning" | "danger" | "info";

export interface AlertOptions {
  title: string;
  text?: string;
  kind?: AlertKind;
  actionLabel?: string;
  onAction?: () => void;
}

/** Barra de aviso con ícono, título, texto y acción opcional. */
export function alert(options: AlertOptions): HTMLElement {
  const kind = options.kind ?? "info";
  const iconName = kind === "success" ? "check-circle" : kind === "info" ? "info" : "alert-triangle";

  const body = el("div", { class: "alert-body" }, el("p", { class: "alert-title", text: options.title }));
  if (options.text) body.append(el("p", { class: "alert-text", text: options.text }));

  const node = el(
    "div",
    { class: `alert alert--${kind}`, role: kind === "danger" ? "alert" : "status" },
    el("span", { class: "alert-icon", html: svgIcon(iconName, 20) }),
    body,
  );

  if (options.actionLabel) {
    const button = el("button", { class: "btn btn--sm btn--primary", type: "button", text: options.actionLabel });
    button.addEventListener("click", () => options.onAction?.());
    node.append(el("div", { class: "alert-actions" }, button));
  }
  return node;
}

/* ---------- Modal de confirmación de acción sensible (plan §3) ---------- */

export interface ConfirmOptions {
  /** Título con el verbo exacto: "¿Suspender la suscripción?" */
  title: string;
  /** Qué implica la acción, en una frase clara. */
  consequence: string;
  /** Etiqueta del botón de confirmación: "Suspender". */
  confirmLabel: string;
  /** Etiqueta del campo de motivo (por omisión "Motivo"). */
  reasonLabel?: string;
  /** Si es verdadero, el motivo es obligatorio. */
  requireReason?: boolean;
  /** Confirmación no destructiva (botón primario en vez de rojo). */
  danger?: boolean;
}

/**
 * Abre la confirmación y resuelve `true` al confirmar, `false` al cancelar.
 * Se cierra con X, Escape o clic fuera del panel.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const titleId = "confirm-title";
    const isDanger = options.danger !== false;
    const reasonLabel = options.reasonLabel ?? "Motivo";

    const backdrop = el("div", { class: "modal-backdrop" });
    const closeButton = el("button", {
      class: "icon-btn",
      type: "button",
      "aria-label": "Cerrar",
      html: svgIcon("x", 18),
    });
    const panel = el(
      "div",
      { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, tabindex: "-1" },
      el(
        "div",
        { class: "modal-head" },
        el("h2", { id: titleId, class: "modal-title", text: options.title }),
        closeButton,
      ),
      el("p", {
        class: isDanger ? "modal-consequence" : "modal-consequence modal-consequence--neutral",
        text: options.consequence,
      }),
    );

    let reasonInput: HTMLTextAreaElement | null = null;
    let reasonField: HTMLElement | null = null;
    let reasonError: HTMLElement | null = null;

    if (options.reasonLabel !== undefined || options.requireReason === true) {
      reasonInput = el("textarea", {
        class: "textarea",
        id: "confirm-reason",
        rows: "3",
        placeholder: "Describa el motivo de la acción",
      });
      reasonError = el("p", { class: "field-error", role: "alert", hidden: "true", text: "Indique el motivo para continuar." });
      reasonField = el(
        "div",
        { class: "field modal-field" },
        el("label", {
          class: "field-label",
          for: "confirm-reason",
          text: `${reasonLabel}${options.requireReason ? " (obligatorio)" : " (opcional)"}`,
        }),
        reasonInput,
        reasonError,
      );
      panel.append(reasonField);
    }

    const cancelButton = el("button", { class: "btn btn--ghost", type: "button", text: "Cancelar" });
    const confirmButton = el("button", {
      class: isDanger ? "btn btn--danger" : "btn btn--primary",
      type: "button",
      text: options.confirmLabel,
    });
    panel.append(el("div", { class: "modal-actions" }, cancelButton, confirmButton));
    backdrop.append(panel);

    let settled = false;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function finish(result: boolean): void {
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
        finish(false);
      }
    }

    closeButton.addEventListener("click", () => finish(false));
    cancelButton.addEventListener("click", () => finish(false));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(false);
    });
    confirmButton.addEventListener("click", () => {
      if (options.requireReason && reasonInput && reasonInput.value.trim() === "") {
        reasonField?.classList.add("field--error");
        if (reasonError) reasonError.hidden = false;
        reasonInput.focus();
        return;
      }
      finish(true);
    });

    document.addEventListener("keydown", onKeydown);
    document.body.append(backdrop);
    panel.focus();
  });
}

/* ---------- Tablas ---------- */

export interface ColumnDef {
  key: string;
  label: string;
  numeric?: boolean;
}

export type CellValue = string | number | HTMLElement;

/** Tabla estándar del panel: encabezados 11 px, filas 13 px, hover brand-50. */
export function table(columns: ColumnDef[], rows: Record<string, CellValue>[]): HTMLElement {
  const headRow = el("tr");
  for (const column of columns) {
    headRow.append(
      el("th", {
        scope: "col",
        class: column.numeric ? "num" : "",
        text: column.label,
      }),
    );
  }

  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    for (const column of columns) {
      const value = row[column.key] ?? "";
      const cell = el("td", { class: column.numeric ? "num" : "" });
      if (value instanceof HTMLElement) cell.append(value);
      else cell.textContent = String(value);
      tr.append(cell);
    }
    body.append(tr);
  }

  return el("div", { class: "table-wrap" }, el("table", { class: "data-table" }, el("thead", {}, headRow), body));
}

/* ---------- Paginación (plan §5.2) ---------- */

export interface PaginationOptions {
  page: number;
  pageSize: number;
  total: number;
  pageSizes?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** Controles de paginación: tamaño de página 25/50/100 y "Mostrando X de Y". */
export function pagination(options: PaginationOptions): HTMLElement {
  const { page, pageSize, total } = options;
  const sizes = options.pageSizes ?? [25, 50, 100];
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;

  const sizeSelect = el("select", { class: "select select--sm", "aria-label": "Filas por página" });
  for (const size of sizes) {
    const option = el("option", { value: String(size), text: String(size) });
    if (size === pageSize) option.selected = true;
    sizeSelect.append(option);
  }
  sizeSelect.addEventListener("change", () => options.onPageSizeChange(Number(sizeSelect.value)));

  const prevButton = el("button", {
    class: "page-btn",
    type: "button",
    "aria-label": "Página anterior",
    html: svgIcon("chevron-left", 16),
  });
  const nextButton = el("button", {
    class: "page-btn",
    type: "button",
    "aria-label": "Página siguiente",
    html: svgIcon("chevron-right", 16),
  });
  prevButton.disabled = page <= 1;
  nextButton.disabled = page >= pageCount;
  prevButton.addEventListener("click", () => options.onPageChange(page - 1));
  nextButton.addEventListener("click", () => options.onPageChange(page + 1));

  return el(
    "div",
    { class: "pagination" },
    el(
      "div",
      { class: "pagination-left" },
      el("label", { class: "pagination-label" }, "Filas por página", sizeSelect),
      el("span", { class: "pagination-info", text: `Mostrando ${from} de ${total}` }),
    ),
    el(
      "div",
      { class: "pagination-right" },
      prevButton,
      el("span", { class: "pagination-page", text: `Página ${page} de ${pageCount}` }),
      nextButton,
    ),
  );
}

/* ---------- Esqueleto de carga ---------- */

/** Bloques grises con pulso suave que respetan la grilla de la tabla. */
export function skeleton(rows = 5): HTMLElement {
  const node = el(
    "div",
    { class: "skeleton", role: "status" },
    el("span", { class: "sr-only", text: "Cargando datos" }),
  );
  for (let index = 0; index < rows; index += 1) {
    const widths = [55 - (index % 3) * 8, 22, 14, 8];
    const row = el("div", { class: "skeleton-row" });
    for (const width of widths) {
      row.append(el("span", { class: "skeleton-bar", style: `width: ${width}%` }));
    }
    node.append(row);
  }
  return node;
}

/* ---------- Estado vacío ---------- */

export interface EmptyStateOptions {
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Ícono en brand-100, título, explicación corta y una acción concreta. */
export function emptyState(options: EmptyStateOptions): HTMLElement {
  const node = el(
    "div",
    { class: "empty-state" },
    el("span", { class: "empty-state-icon", html: svgIcon("inbox", 40) }),
    el("h3", { class: "empty-state-title", text: options.title }),
  );
  if (options.text) node.append(el("p", { class: "empty-state-text", text: options.text }));
  if (options.actionLabel) {
    const button = el("button", { class: "btn btn--primary", type: "button", text: options.actionLabel });
    button.addEventListener("click", () => options.onAction?.());
    node.append(button);
  }
  return node;
}
