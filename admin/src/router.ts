/* ============================================================
   PROMOB — Panel de gestión: enrutador por hash.
   Rutas: #/dashboard (por omisión), #/clientes, #/suscripciones,
   #/pagos, #/codigos, #/reportes, #/configuracion.
   Re-renderiza el área de contenido y marca la sección activa
   de la navegación con aria-current="page".
   ============================================================ */

/** Definición de una sección del panel. */
export interface SectionDef {
  id: string;
  /** Etiqueta del elemento de navegación. */
  label: string;
  /** Título del encabezado de la vista (h1). */
  title: string;
  /** Nombre del ícono en línea (icons.ts). */
  icon: string;
  /** Contador de alertas junto a la sección (opcional). */
  alertCount?: number;
  /** Acciones del encabezado (opcional): Exportar, Cargar códigos… */
  actions?: () => HTMLElement[];
  /** Renderiza el contenido de la sección. */
  render: () => HTMLElement;
}

export interface RouterOptions {
  sections: SectionDef[];
  navEl: HTMLElement;
  viewEl: HTMLElement;
  titleEl: HTMLElement;
  actionsEl: HTMLElement;
}

export interface Router {
  start: () => void;
}

export function createRouter(options: RouterOptions): Router {
  const { sections, navEl, viewEl, titleEl, actionsEl } = options;
  const byId = new Map(sections.map((section) => [section.id, section]));

  function currentId(): string {
    const hash = window.location.hash.replace(/^#\/?/, "");
    return byId.has(hash) ? hash : "dashboard";
  }

  function markNav(activeId: string): void {
    for (const item of navEl.querySelectorAll<HTMLElement>("[data-section]")) {
      if (item.dataset.section === activeId) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    }
  }

  function render(): void {
    const section = byId.get(currentId());
    if (!section) return;
    titleEl.textContent = section.title;
    actionsEl.replaceChildren(...(section.actions ? section.actions() : []));
    viewEl.replaceChildren(section.render());
    markNav(section.id);
  }

  return {
    start(): void {
      window.addEventListener("hashchange", render);
      render();
    },
  };
}
