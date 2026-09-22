/* ============================================================
   PROMOB — Panel de gestión: registro de secciones.
   Cada entrada define su ruta, ícono, título y render.
   Las acciones de cada vista viven dentro de la propia sección.
   ============================================================ */

import type { SectionDef } from "../router";

import { renderDashboard } from "./dashboard";
import { renderClientes } from "./clientes";
import { renderSuscripciones } from "./suscripciones";
import { renderPagos } from "./pagos";
import { renderEmails } from "./emails";
import { renderCodigos } from "./codigos";
import { renderReportes } from "./reportes";
import { renderConfiguracion } from "./configuracion";

export const SECTIONS: SectionDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    title: "Dashboard",
    icon: "dashboard",
    render: renderDashboard,
  },
  {
    id: "clientes",
    label: "Clientes",
    title: "Clientes",
    icon: "clients",
    render: renderClientes,
  },
  {
    id: "suscripciones",
    label: "Suscripciones",
    title: "Suscripciones",
    icon: "subscriptions",
    render: renderSuscripciones,
  },
  { id: "pagos", label: "Pagos", title: "Pagos", icon: "payments", render: renderPagos },
  {
    id: "emails",
    label: "Emails",
    title: "Bandeja de salida",
    icon: "bell",
    render: renderEmails,
  },
  { id: "codigos", label: "Códigos", title: "Códigos", icon: "codes", render: renderCodigos },
  {
    id: "reportes",
    label: "Reportes",
    title: "Reportes",
    icon: "reports",
    render: renderReportes,
  },
  {
    id: "configuracion",
    label: "Configuración",
    title: "Configuración",
    icon: "config",
    render: renderConfiguracion,
  },
];
