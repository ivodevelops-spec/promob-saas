/* ============================================================
   PROMOB — Panel de gestión: Suscripciones.
   Lista con búsqueda (debounce), filtros por estado y producto,
   paginación 25/50/100 y modal de detalle con acciones:
   reenviar código, marcar pagado, extender, suspender,
   reactivar y cancelar (suspender/cancelar exigen motivo).
   Éxito → toast + refresco; error → alerta danger sin romper.
   ============================================================ */

import { apiGet, apiPost } from "../api";
import { alert, badge, el, emptyState, fmtDate, pagination, toast } from "../ui";
import type { EmptyStateOptions } from "../ui";
import {
  actionErrorMessage,
  dataTable,
  debounce,
  DEMO_PRODUCTS,
  detailGrid,
  formModal,
  openModal,
  panel,
  panelHeader,
  PAYMENT_METHODS,
  promptReason,
  runLoad,
  stack,
  STATUS_OPTIONS,
  type SubscriptionRow,
} from "./helpers";

/** Vista de suscripciones: barra de filtros fija + cuerpo recargable. */
export function renderSuscripciones(): HTMLElement {
  const root = el("div", { class: "content" });
  const state = { q: "", status: "", productId: "", page: 1, pageSize: 25 };
  const body = el("div", { class: "content" });

  const reloadBody = (): void => {
    runLoad(body, loadPage);
  };

  const searchInput = el("input", {
    class: "input",
    id: "subs-buscar",
    type: "search",
    placeholder: "Email o producto…",
  });
  searchInput.style.maxWidth = "300px";
  searchInput.addEventListener(
    "input",
    debounce(() => {
      state.q = searchInput.value.trim();
      state.page = 1;
      reloadBody();
    }, 300),
  );

  const statusSelect = el(
    "select",
    { class: "select", id: "subs-estado" },
    ...STATUS_OPTIONS.map((option) => el("option", { value: option.value, text: option.label })),
  );
  statusSelect.style.maxWidth = "220px";
  statusSelect.addEventListener("change", () => {
    state.status = statusSelect.value;
    state.page = 1;
    reloadBody();
  });

  const productSelect = el(
    "select",
    { class: "select", id: "subs-producto" },
    el("option", { value: "", text: "Todos los productos" }),
    ...DEMO_PRODUCTS.map((product) => el("option", { value: product.id, text: product.name })),
  );
  productSelect.style.maxWidth = "240px";
  productSelect.addEventListener("change", () => {
    state.productId = productSelect.value;
    state.page = 1;
    reloadBody();
  });

  function clearFilters(): void {
    searchInput.value = "";
    statusSelect.value = "";
    productSelect.value = "";
    state.q = "";
    state.status = "";
    state.productId = "";
    state.page = 1;
    reloadBody();
  }

  async function loadPage(): Promise<HTMLElement> {
    const page = await apiGet<SubscriptionRow>("subscriptions", {
      q: state.q,
      status: state.status,
      productId: state.productId,
      page: state.page,
      pageSize: state.pageSize,
    });

    if (page.items.length === 0) {
      const hasFilters = state.q !== "" || state.status !== "" || state.productId !== "";
      const options: EmptyStateOptions = hasFilters
        ? {
            title: "Sin resultados",
            text: "Ninguna suscripción coincide con los filtros aplicados.",
            actionLabel: "Limpiar filtros",
            onAction: clearFilters,
          }
        : {
            title: "Todavía no hay suscripciones",
            text: "Cuando se registre la primera suscripción, aparecerá en esta lista.",
          };
      return emptyState(options);
    }

    return stack(
      dataTable(
        [
          { key: "cliente", label: "Cliente" },
          { key: "producto", label: "Producto" },
          { key: "estado", label: "Estado" },
          { key: "proximo", label: "Próximo cobro" },
          { key: "creada", label: "Creada" },
          { key: "acciones", label: "Acciones" },
        ],
        page.items.map((row) => subscriptionRowView(row, reloadBody)),
        (index) => {
          const row = page.items[index];
          if (row !== undefined) void openSubscriptionDetail(row, reloadBody);
        },
      ),
      pagination({
        page: state.page,
        pageSize: state.pageSize,
        total: page.total,
        onPageChange: (next) => {
          state.page = next;
          reloadBody();
        },
        onPageSizeChange: (size) => {
          state.pageSize = size;
          state.page = 1;
          reloadBody();
        },
      }),
    );
  }

  root.append(
    el(
      "div",
      { style: "display:flex;align-items:flex-end;flex-wrap:wrap;gap:var(--space-4);" },
      el("div", { class: "field" }, el("label", { class: "field-label", for: "subs-buscar", text: "Buscar" }), searchInput),
      el("div", { class: "field" }, el("label", { class: "field-label", for: "subs-estado", text: "Estado" }), statusSelect),
      el("div", { class: "field" }, el("label", { class: "field-label", for: "subs-producto", text: "Producto" }), productSelect),
    ),
    body,
  );
  reloadBody();
  return root;
}

/** Fila de la tabla: cliente, producto, estado, fechas y acción. */
function subscriptionRowView(
  row: SubscriptionRow,
  reload: () => void,
): Record<string, string | number | HTMLElement> {
  const openButton = el("button", { class: "btn btn--sm btn--outline", type: "button", text: "Ver detalle" });
  openButton.addEventListener("click", (event) => {
    event.stopPropagation();
    void openSubscriptionDetail(row, reload);
  });
  return {
    cliente: row.customerEmail,
    producto: row.productName,
    estado: badge(row.status),
    proximo: row.nextPaymentDate !== null ? fmtDate(row.nextPaymentDate) : "—",
    creada: fmtDate(row.createdAt),
    acciones: openButton,
  };
}

/** Modal de detalle con grilla de datos y acciones según el estado. */
async function openSubscriptionDetail(row: SubscriptionRow, reload: () => void): Promise<void> {
  const errorBox = el("div");
  let closeModal: (() => void) | null = null;
  const onChanged = (): void => {
    closeModal?.();
    reload();
  };

  const body = el(
    "div",
    { class: "content" },
    detailGrid([
      { label: "Cliente", value: row.customerEmail },
      { label: "Producto", value: row.productName },
      { label: "Estado", value: badge(row.status) },
      { label: "Próximo cobro", value: row.nextPaymentDate !== null ? fmtDate(row.nextPaymentDate) : "—" },
      { label: "Creada", value: fmtDate(row.createdAt) },
      { label: "Actualizada", value: fmtDate(row.updatedAt) },
    ]),
    panel(panelHeader("Acciones"), actionsPanel(row, errorBox, onChanged), errorBox),
  );
  const modal = openModal({ title: "Detalle de la suscripción", body, wide: true });
  closeModal = () => modal.close();
}

/** Botones de acción del detalle, visibles según el estado de la suscripción. */
function actionsPanel(row: SubscriptionRow, errorBox: HTMLElement, onChanged: () => void): HTMLElement {
  const buttons: HTMLElement[] = [];
  const status = row.status;

  /** Acción directa contra la API, con estado ocupado y error inline. */
  const direct = (label: string, variant: string, run: () => Promise<void>): void => {
    const button = el("button", { class: `btn btn--sm ${variant}`, type: "button", text: label });
    button.addEventListener("click", () => {
      button.disabled = true;
      errorBox.replaceChildren();
      run().then(
        () => {
          button.disabled = false;
        },
        (error: unknown) => {
          errorBox.replaceChildren(alert({ title: actionErrorMessage(error), kind: "danger" }));
          button.disabled = false;
        },
      );
    });
    buttons.push(button);
  };

  /** Botón que abre un formulario modal (marcar pagado, extender). */
  const form = (label: string, variant: string, open: () => void): void => {
    const button = el("button", { class: `btn btn--sm ${variant}`, type: "button", text: label });
    button.addEventListener("click", open);
    buttons.push(button);
  };

  /** Botón que exige confirmación destructiva con motivo. */
  const destructive = (
    options: { title: string; consequence: string; confirmLabel: string; reasonLabel?: string },
    action: "suspend" | "cancel",
    successMessage: string,
  ): void => {
    const button = el("button", { class: `btn btn--sm ${action === "cancel" ? "btn--danger" : "btn--outline"}`, type: "button", text: options.confirmLabel });
    button.addEventListener("click", () => {
      void promptReason(options).then((reason) => {
        if (reason === null) return;
        errorBox.replaceChildren();
        void apiPost(action, { subscriptionId: row.id, reason })
          .then(() => {
            toast(successMessage, "success");
            onChanged();
          })
          .catch((error: unknown) => {
            errorBox.replaceChildren(alert({ title: actionErrorMessage(error), kind: "danger" }));
          });
      });
    });
    buttons.push(button);
  };

  const resend = async (): Promise<void> => {
    await apiPost("resend-code", { subscriptionId: row.id });
    toast(`Código reenviado a ${row.customerEmail}.`, "success");
  };

  const markPaid = (): void => {
    formModal({
      title: "Registrar pago manual",
      fields: [
        { id: "amount", label: "Monto en ARS", kind: "number", required: true, min: 1, placeholder: "4900" },
        { id: "method", label: "Medio de pago", kind: "select", options: PAYMENT_METHODS },
        { id: "note", label: "Nota (opcional)", kind: "textarea", placeholder: "Pago recibido por transferencia…" },
      ],
      submitLabel: "Registrar pago",
      onSubmit: async (values) => {
        const amount = Number(values["amount"] ?? "");
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("Indique un monto válido, mayor que cero.");
        }
        await apiPost("mark-paid", {
          subscriptionId: row.id,
          amountArs: amount,
          method: values["method"] ?? "",
          note: values["note"] ?? "",
        });
        toast("Pago registrado. La suscripción quedó activa.", "success");
        onChanged();
      },
    });
  };

  const extend = (): void => {
    formModal({
      title: "Extender la suscripción",
      fields: [
        { id: "days", label: "Días a sumar", kind: "number", required: true, min: 1, placeholder: "30" },
        { id: "reason", label: "Motivo (opcional)", kind: "textarea", placeholder: "Extensión por cortesía…" },
      ],
      submitLabel: "Extender",
      onSubmit: async (values) => {
        const days = Number(values["days"] ?? "");
        if (!Number.isInteger(days) || days <= 0) {
          throw new Error("Indique una cantidad de días válida.");
        }
        await apiPost("extend", {
          subscriptionId: row.id,
          days,
          reason: values["reason"] ?? "",
        });
        toast("Suscripción extendida.", "success");
        onChanged();
      },
    });
  };

  const reactivate = async (): Promise<void> => {
    await apiPost("reactivate", { subscriptionId: row.id });
    toast("Suscripción reactivada.", "success");
    onChanged();
  };

  const canResend = status === "active" || status === "past_due" || status === "suspended";
  const canPay = status === "past_due" || status === "suspended" || status === "lapsed";
  const canExtend = status === "active" || status === "past_due" || status === "suspended";
  const canSuspend = status === "active" || status === "past_due";
  const canReactivate = status === "suspended";

  if (canResend) direct("Reenviar código", "btn--outline", resend);
  if (canPay) form("Marcar pagado", "btn--primary", markPaid);
  if (canExtend) form("Extender", "btn--outline", extend);
  if (canSuspend) {
    destructive(
      {
        title: "¿Suspender la suscripción?",
        consequence: "El cliente pierde el acceso al servicio y recibe un aviso por email. Podrá reactivarla cuando regularice el pago.",
        confirmLabel: "Suspender",
      },
      "suspend",
      "Suscripción suspendida.",
    );
  }
  if (canReactivate) direct("Reactivar", "btn--primary", reactivate);
  if (status !== "canceled") {
    destructive(
      {
        title: "¿Cancelar la suscripción?",
        consequence: "La baja es definitiva y no se puede reactivar. El cliente deja de tener acceso al servicio.",
        confirmLabel: "Cancelar suscripción",
        reasonLabel: "Motivo de la baja",
      },
      "cancel",
      "Suscripción cancelada.",
    );
  }

  const node = el("div", { style: "display:flex;flex-wrap:wrap;gap:var(--space-2);" }, ...buttons);
  if (buttons.length === 0) {
    node.append(el("p", { style: "font-size:var(--text-caption);color:var(--ink-500);", text: "Esta suscripción está cancelada y no admite acciones." }));
  }
  return node;
}
