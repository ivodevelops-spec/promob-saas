/* ============================================================
   PROMOB — Panel de gestión: registro de secciones.
   Cada entrada define su ruta, navegación, título del encabezado
   y acciones de la vista. Los render son stubs (próxima entrega).
   ============================================================ */

import type { SectionDef } from "../router";
import { el, toast } from "../ui";
import { svgIcon } from "../icons";

import { renderDashboard } from "./dashboard";
import { renderClientes } from "./clientes";
import { renderSuscripciones } from "./suscripciones";
import { renderPagos } from "./pagos";
import { renderCodigos } from "./codigos";
import { renderReportes } from "./reportes";
import { renderConfiguracion } from "./configuracion";

/** Acción de encabezado "Exportar a Excel" (respetará los filtros activos). */
function exportAction(): HTMLElement[] {
  const button = el("button", {
    class: "btn btn--outline",
    type: "button",
    html: `${svgIcon("download", 18)}<span>Exportar a Excel</span>`,
  });
  button.addEventListener("click", () => {
    toast("La exportación estará disponible en la próxima entrega.", "info");
  });
  return [button];
}

/** Acción de encabezado "Cargar códigos" (pool de entrega automática). */
function uploadCodesAction(): HTMLElement[] {
  const button = el("button", {
    class: "btn btn--primary",
    type: "button",
    html: `${svgIcon("plus", 18)}<span>Cargar códigos</span>`,
  });
  button.addEventListener("click", () => {
    toast("La carga de códigos estará disponible en la próxima entrega.", "info");
  });
  return [button];
}

export const SECTIONS: SectionDef[] = [
  { id: "dashboard", label: "Dashboard", title: "Dashboard", icon: "dashboard", render: renderDashboard },
  { id: "clientes", label: "Clientes", title: "Clientes", icon: "clients", actions: exportAction, render: renderClientes },
  {
    id: "suscripciones",
    label: "Suscripciones",
    title: "Suscripciones",
    icon: "subscriptions",
    alertCount: 3,
    render: renderSuscripciones,
  },
  { id: "pagos", label: "Pagos", title: "Pagos", icon: "payments", render: renderPagos },
  {
    id: "codigos",
    label: "Códigos",
    title: "Códigos",
    icon: "codes",
    alertCount: 1,
    actions: uploadCodesAction,
    render: renderCodigos,
  },
  { id: "reportes", label: "Reportes", title: "Reportes", icon: "reports", actions: exportAction, render: renderReportes },
  { id: "configuracion", label: "Configuración", title: "Configuración", icon: "config", render: renderConfiguracion },
];
