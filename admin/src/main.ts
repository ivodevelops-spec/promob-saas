/* ============================================================
   PROMOB — Panel de gestión: arranque del shell.
   Barra lateral (230 px, #2e3b44) + encabezado de vista (título,
   fecha de hoy, acciones, usuario "Camila · Dueño" en modo demo)
   + enrutador por hash. Si la API no responde, se muestra un
   aviso en el área de contenido sin romper la navegación.
   ============================================================ */

import { createRouter } from "./router";
import { SECTIONS } from "./sections";
import { apiGet } from "./api";
import { alert, el, fmtDate, mount, toast } from "./ui";
import { svgIcon } from "./icons";

const app = document.getElementById("app");
if (!app) {
  throw new Error("No se encontró el punto de montaje #app.");
}

/* ---- Barra lateral ---- */

const brand = el(
  "div",
  { class: "sidebar-brand" },
      el("span", {
        class: "sidebar-brand-name",
        style: "font-style: italic; letter-spacing: -0.5px;",
        text: "promob",
      }),
  el("span", { class: "sidebar-brand-sub", text: "· Gestión" }),
  el("span", { class: "sidebar-brand-mono", text: "PM", "aria-hidden": "true" }),
);

const nav = el("nav", { class: "sidebar-nav", "aria-label": "Navegación principal" });
for (const section of SECTIONS) {
  const accessibleName = section.alertCount
    ? `${section.label}, ${section.alertCount} alertas`
    : section.label;
  const item = el(
    "a",
    { class: "nav-item", href: `#/${section.id}`, "data-section": section.id, "aria-label": accessibleName },
    el("span", { class: "nav-icon", html: svgIcon(section.icon, 20) }),
    el("span", { class: "nav-label", text: section.label }),
  );
  if (section.alertCount) {
    item.append(
      el("span", {
        class: "nav-count",
        "aria-hidden": "true",
        text: String(section.alertCount),
      }),
    );
  }
  nav.append(item);
}

const sidebarFoot = el("div", { class: "sidebar-foot" }, el("span", { text: "Panel de gestión · v0.1.0" }));

const sidebar = el("aside", { class: "sidebar" }, brand, nav, sidebarFoot);

/* ---- Encabezado de vista ---- */

const titleEl = el("h1", { text: "" });
const actionsEl = el("div", { class: "topbar-actions" });

const userChip = el(
  "div",
  { class: "user-chip" },
  el("span", { class: "avatar", text: "C", "aria-hidden": "true" }),
  el("span", { class: "user-chip-name", text: "Camila" }),
  el("span", { class: "user-chip-role", text: "Dueño" }),
);

const topbar = el(
  "div",
  { class: "topbar" },
  titleEl,
  el("div", { class: "topbar-right" }, el("span", { class: "topbar-date", text: fmtDate(new Date()) }), actionsEl, userChip),
);

/* ---- Contenido ---- */

const viewEl = el("div", { id: "section-view" });
const content = el("div", { class: "content" }, viewEl);
const main = el("main", { class: "main", id: "contenido", tabindex: "-1" }, topbar, content);

/* ---- Montaje del shell ---- */

const skipLink = el("a", { class: "skip-link", href: "#contenido", text: "Saltar al contenido principal" });
mount(el("div", { class: "shell" }, sidebar, main), app);
app.prepend(skipLink);

createRouter({
  sections: SECTIONS,
  navEl: nav,
  viewEl,
  titleEl,
  actionsEl,
}).start();

/* ---- Estado del servidor de demo (contrato §1: DEMO_MODE) ---- */

let serverBanner: HTMLElement | null = null;

async function checkDemoServer(): Promise<boolean> {
  try {
    await apiGet("dashboard");
    return true;
  } catch {
    return false;
  }
}

function showServerBanner(): void {
  if (serverBanner) return;
  const banner = alert({
    title: "Servidor de demo no disponible",
    text: "No pudimos conectar con la API del panel. Verifique que el servidor de demo esté en línea. Puede seguir navegando mientras tanto.",
    kind: "danger",
  });
  const retryButton = el("button", { class: "btn btn--sm btn--primary", type: "button", text: "Reintentar" });
  retryButton.addEventListener("click", () => {
    void retryConnection(retryButton, banner);
  });
  banner.append(el("div", { class: "alert-actions" }, retryButton));
  content.prepend(banner);
  serverBanner = banner;
}

async function retryConnection(button: HTMLButtonElement, banner: HTMLElement): Promise<void> {
  button.disabled = true;
  const ok = await checkDemoServer();
  if (ok) {
    banner.remove();
    serverBanner = null;
    toast("Conexión con el servidor de demo restablecida.", "success");
  } else {
    button.disabled = false;
    toast("El servidor de demo sigue sin responder.", "error");
  }
}

void checkDemoServer().then((ok) => {
  if (!ok) showServerBanner();
});
