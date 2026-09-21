import { emptyState } from "../ui";

/** Configuración: política de mora, avisos, equipo y roles. Solo rol dueño (próxima entrega). */
export function renderConfiguracion(): HTMLElement {
  return emptyState({
    title: "Sección en preparación",
    text: "Disponible en la próxima entrega.",
  });
}
