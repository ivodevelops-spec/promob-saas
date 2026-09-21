import { emptyState } from "../ui";

/** Clientes: lista con búsqueda, filtros y detalle con actividad (próxima entrega). */
export function renderClientes(): HTMLElement {
  return emptyState({
    title: "Sección en preparación",
    text: "Disponible en la próxima entrega.",
  });
}
