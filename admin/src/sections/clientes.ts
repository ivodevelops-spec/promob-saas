/* ============================================================
   PROMOB — Panel de gestión: Clientes.
   Lista con búsqueda (debounce), filtro por país y paginación
   25/50/100 ("Mostrando X de Y"). Clic en fila → modal de
   detalle con suscripciones y pagos del cliente + acción
   "Reenviar código" (solo si hay una suscripción activa).
   ============================================================ */

import { apiGet, apiPost } from "../api";
import { alert, badge, el, emptyState, fmtArs, fmtDate, pagination, skeleton, toast } from "../ui";
import type { EmptyStateOptions } from "../ui";
import { svgIcon } from "../icons";
import {
  actionErrorMessage,
  COUNTRY_OPTIONS,
  countryLabel,
  dataTable,
  debounce,
  detailGrid,
  openModal,
  panel,
  panelHeader,
  runLoad,
  stack,
  type CustomerRow,
  type PaymentRow,
  type SubscriptionRow,
} from "./helpers";

/** Vista de clientes: barra de filtros fija + cuerpo recargable. */
export function renderClientes(): HTMLElement {
  const root = el("div", { class: "content" });
  const state = { q: "", country: "", page: 1, pageSize: 25 };
  const body = el("div", { class: "content" });

  const reloadBody = (): void => {
    runLoad(body, loadPage);
  };

  const searchInput = el("input", {
    class: "input",
    id: "clientes-buscar",
    type: "search",
    placeholder: "Email o nombre…",
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

  const countrySelect = el(
    "select",
    { class: "select", id: "clientes-pais" },
    ...COUNTRY_OPTIONS.map((option) => el("option", { value: option.value, text: option.label })),
  );
  countrySelect.style.maxWidth = "220px";
  countrySelect.addEventListener("change", () => {
    state.country = countrySelect.value;
    state.page = 1;
    reloadBody();
  });

  function clearFilters(): void {
    searchInput.value = "";
    countrySelect.value = "";
    state.q = "";
    state.country = "";
    state.page = 1;
    reloadBody();
  }

  async function loadPage(): Promise<HTMLElement> {
    const page = await apiGet<CustomerRow>("customers", {
      q: state.q,
      country: state.country,
      page: state.page,
      pageSize: state.pageSize,
    });

    if (page.items.length === 0) {
      const hasFilters = state.q !== "" || state.country !== "";
      const options: EmptyStateOptions = hasFilters
        ? {
            title: "Sin resultados",
            text: "Ningún cliente coincide con los filtros aplicados.",
            actionLabel: "Limpiar filtros",
            onAction: clearFilters,
          }
        : {
            title: "Todavía no hay clientes",
            text: "Cuando se registre el primer cliente, aparecerá en esta lista.",
          };
      return emptyState(options);
    }

    return stack(
      dataTable(
        [
          { key: "cliente", label: "Cliente" },
          { key: "pais", label: "País" },
          { key: "subs", label: "Suscripciones", numeric: true },
          { key: "ultimoPago", label: "Último pago" },
          { key: "acciones", label: "Acciones" },
        ],
        page.items.map(customerRowView),
        (index) => {
          const row = page.items[index];
          if (row !== undefined) void openCustomerDetail(row);
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
      el("div", { class: "field" }, el("label", { class: "field-label", for: "clientes-buscar", text: "Buscar" }), searchInput),
      el("div", { class: "field" }, el("label", { class: "field-label", for: "clientes-pais", text: "País" }), countrySelect),
    ),
    body,
  );
  reloadBody();
  return root;
}

/** Fila de la tabla: cliente con email + nombre, país, contadores y acción. */
function customerRowView(row: CustomerRow): Record<string, string | number | HTMLElement> {
  const openButton = el("button", { class: "btn btn--sm btn--outline", type: "button", text: "Ver detalle" });
  openButton.addEventListener("click", (event) => {
    event.stopPropagation();
    void openCustomerDetail(row);
  });
  return {
    cliente: el(
      "div",
      { style: "display:flex;flex-direction:column;gap:var(--space-1);" },
      el("span", { style: "font-size:var(--text-caption);font-weight:var(--weight-semibold);color:var(--ink-900);", text: row.email }),
      el("span", { style: "font-size:var(--text-micro);color:var(--ink-500);", text: row.fullName ?? "Sin nombre" }),
    ),
    pais: countryLabel(row.country),
    subs: row.subscriptionsCount,
    ultimoPago: row.lastPaymentAt !== null ? fmtDate(row.lastPaymentAt) : "Sin pagos",
    acciones: openButton,
  };
}

/** Modal de detalle: datos + suscripciones + pagos + reenvío de código. */
async function openCustomerDetail(row: CustomerRow): Promise<void> {
  const body = el("div", { class: "content" });
  openModal({ title: "Detalle del cliente", body, wide: true });
  body.append(skeleton(3));

  try {
    const [subs, pays] = await Promise.all([
      apiGet<SubscriptionRow>("subscriptions", { customerId: row.id, pageSize: 100 }),
      apiGet<PaymentRow>("payments", { customerId: row.id, pageSize: 100 }),
    ]);

    body.replaceChildren(
      detailGrid([
        { label: "Nombre", value: row.fullName ?? "—" },
        { label: "Email", value: row.email },
        { label: "Teléfono", value: row.phone ?? "—" },
        { label: "País", value: countryLabel(row.country) },
        { label: "Alta", value: fmtDate(row.createdAt) },
        { label: "Último pago", value: row.lastPaymentAt !== null ? fmtDate(row.lastPaymentAt) : "Sin pagos" },
      ]),
      panel(
        panelHeader("Suscripciones"),
        subs.items.length === 0
          ? el("p", { style: "font-size:var(--text-body);color:var(--ink-500);", text: "Este cliente no tiene suscripciones." })
          : dataTable(
              [
                { key: "producto", label: "Producto" },
                { key: "estado", label: "Estado" },
                { key: "proximo", label: "Próximo cobro" },
                { key: "creada", label: "Creada" },
              ],
              subs.items.map((sub) => ({
                producto: sub.productName,
                estado: badge(sub.status),
                proximo: sub.nextPaymentDate !== null ? fmtDate(sub.nextPaymentDate) : "—",
                creada: fmtDate(sub.createdAt),
              })),
            ),
      ),
      panel(
        panelHeader("Pagos"),
        pays.items.length === 0
          ? el("p", { style: "font-size:var(--text-body);color:var(--ink-500);", text: "Este cliente todavía no registra pagos." })
          : dataTable(
              [
                { key: "fecha", label: "Fecha" },
                { key: "monto", label: "Monto", numeric: true },
                { key: "estado", label: "Estado" },
              ],
              pays.items.map((pay) => ({
                fecha: pay.paidAt !== null ? fmtDate(pay.paidAt) : "—",
                monto: fmtArs(pay.amountArs),
                estado: badge(pay.status),
              })),
            ),
      ),
    );

    const activeSub = subs.items.find((sub) => sub.status === "active");
    if (activeSub !== undefined) {
      body.append(resendCodePanel(row, activeSub));
    }
  } catch (error) {
    body.replaceChildren(alert({ title: "No pudimos cargar el detalle", text: actionErrorMessage(error), kind: "danger" }));
  }
}

/** Panel "Entrega de código" con la acción de reenvío y su estado de error. */
function resendCodePanel(customer: CustomerRow, subscription: SubscriptionRow): HTMLElement {
  const errorBox = el("div");
  const button = el("button", {
    class: "btn btn--primary",
    type: "button",
    html: `${svgIcon("refresh-cw", 16)}<span>Reenviar código</span>`,
  });
  button.addEventListener("click", () => {
    button.disabled = true;
    errorBox.replaceChildren();
    void (async () => {
      try {
        await apiPost("resend-code", { subscriptionId: subscription.id });
        toast(`Código reenviado a ${customer.email}.`, "success");
      } catch (error) {
        errorBox.replaceChildren(alert({ title: actionErrorMessage(error), kind: "danger" }));
      } finally {
        button.disabled = false;
      }
    })();
  });
  return panel(
    panelHeader("Entrega de código"),
    el("p", { style: "font-size:var(--text-body);color:var(--ink-700);", text: "Vuelva a enviar el código de acceso por email a este cliente." }),
    button,
    errorBox,
  );
}
