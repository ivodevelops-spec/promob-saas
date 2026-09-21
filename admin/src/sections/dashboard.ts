/* ============================================================
   PROMOB — Panel de gestión: Dashboard.
   KPIs (fmtArs), avisos del día (badge por kind + count),
   últimas suscripciones y ventas de 6 meses como gráfico CSS
   de barras (valores accesibles como texto). Si la API falla,
   estado vacío con "Reintentar" que re-renderiza la vista.
   ============================================================ */

import { apiGet } from "../api";
import { alert, badge, el, fmtArs, fmtDate, table } from "../ui";
import {
  monthLabel,
  panel,
  panelHeader,
  runLoad,
  stack,
  type DashboardAlert,
  type DashboardPayload,
  type RecentSubscription,
  type SalesPoint,
} from "./helpers";

/** Altura de la pista del gráfico de barras (constante de layout, en px). */
const CHART_TRACK_HEIGHT_PX = 180;

/** Vista del dashboard: carga la API y re-renderiza ante fallas. */
export function renderDashboard(): HTMLElement {
  const root = el("div", { class: "content" });
  runLoad(root, loadDashboard);
  return root;
}

/** Carga `resource=dashboard` y arma la composición completa. */
async function loadDashboard(): Promise<HTMLElement> {
  const data = (await apiGet("dashboard")) as unknown as DashboardPayload;
  return stack(
    kpiGrid(data),
    el(
      "div",
      { style: "display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:var(--space-4);" },
      alertsPanel(data.alerts),
      salesPanel(data.salesSeries),
    ),
    recentPanel(data.recentSubscriptions),
  );
}

/* ---------- KPIs ---------- */

function kpiGrid(data: DashboardPayload): HTMLElement {
  const items = [
    { label: "Clientes activos", value: String(data.kpis.activeCustomers), hint: "Registrados en el panel" },
    { label: "Suscripciones activas", value: String(data.kpis.activeSubscriptions), hint: "Con cobro al día" },
    { label: "Ingresos del mes", value: fmtArs(data.kpis.monthRevenueArs), hint: "Pagos aprobados este mes" },
    { label: "Códigos disponibles", value: String(data.kpis.availableCodes), hint: "Pool listo para entregar" },
  ];
  return el(
    "div",
    { class: "kpi-grid" },
    ...items.map((item) =>
      el(
        "div",
        { class: "kpi" },
        el("p", { class: "kpi-label", text: item.label }),
        el("p", { class: "kpi-value", text: item.value }),
        el("p", { class: "kpi-hint", text: item.hint }),
      ),
    ),
  );
}

/* ---------- Avisos del día ---------- */

function alertsPanel(alerts: DashboardAlert[]): HTMLElement {
  const body = el("div", { style: "display:flex;flex-direction:column;gap:var(--space-3);" });
  if (alerts.length === 0) {
    body.append(alert({ title: "Todo al día", text: "No hay avisos pendientes para hoy.", kind: "success" }));
  } else {
    for (const item of alerts) {
      body.append(
        el(
          "div",
          { style: "display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);border:1px solid var(--border);border-radius:var(--radius-md);" },
          badge(item.kind),
          el("span", { style: "flex:1;font-size:var(--text-body);color:var(--ink-700);", text: item.message }),
          el("span", { class: "badge badge--neutral", text: String(item.count) }),
        ),
      );
    }
  }
  return panel(panelHeader("Avisos del día"), body);
}

/* ---------- Ventas últimos 6 meses (gráfico CSS de barras) ---------- */

function salesPanel(points: SalesPoint[]): HTMLElement {
  return panel(panelHeader("Ventas últimos 6 meses", "Pagos aprobados por mes"), salesChart(points));
}

function salesChart(points: SalesPoint[]): HTMLElement {
  const totals = points.map((point) => point.totalArs);
  const max = Math.max(...totals, 1);

  const columns = points.map((point) => {
    const heightPct = point.totalArs <= 0 ? 0 : Math.max((point.totalArs / max) * 100, 6);
    const background =
      point.totalArs <= 0
        ? "var(--border-subtle)"
        : point.totalArs === max
          ? "var(--accent-500)"
          : "var(--brand-700)";
    const bar = el("div", {
      role: "img",
      "aria-label": `${monthLabel(point.month)}: ${fmtArs(point.totalArs)}`,
      style:
        `width:100%;height:${heightPct}%;min-height:${point.totalArs <= 0 ? "4px" : "0"};` +
        `background:${background};border-radius:var(--radius-sm) var(--radius-sm) 0 0;`,
    });
    return el(
      "div",
      { style: "flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:var(--space-2);" },
      el("div", { style: `height:${CHART_TRACK_HEIGHT_PX}px;width:100%;max-width:56px;display:flex;align-items:flex-end;` }, bar),
      el("span", { style: "width:100%;text-align:center;font-size:var(--text-micro);color:var(--ink-400);overflow-wrap:anywhere;", text: monthLabel(point.month) }),
      el("span", {
        style: "width:100%;text-align:center;font-size:var(--text-micro);color:var(--ink-700);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;",
        text: fmtArs(point.totalArs),
      }),
    );
  });

  return el("div", { style: "display:flex;align-items:flex-end;gap:var(--space-3);" }, ...columns);
}

/* ---------- Últimas suscripciones ---------- */

function recentPanel(items: RecentSubscription[]): HTMLElement {
  const body: HTMLElement =
    items.length === 0
      ? el("p", { style: "font-size:var(--text-body);color:var(--ink-500);", text: "Todavía no hay suscripciones registradas." })
      : table(
          [
            { key: "cliente", label: "Cliente" },
            { key: "producto", label: "Producto" },
            { key: "estado", label: "Estado" },
            { key: "proximo", label: "Próximo cobro" },
          ],
          items.map((item) => ({
            cliente: item.customerEmail,
            producto: item.productName,
            estado: badge(item.status),
            proximo: item.nextPaymentDate !== null ? fmtDate(item.nextPaymentDate) : "—",
          })),
        );
  return panel(panelHeader("Últimas suscripciones", "Las 6 más recientes"), body);
}
