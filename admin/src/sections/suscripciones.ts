import { emptyState } from "../ui";

/** Suscripciones: lista con filtros por estado, producto y país (próxima entrega). */
export function renderSuscripciones(): HTMLElement {
  return emptyState({
    title: "Sección en preparación",
    text: "Disponible en la próxima entrega.",
  });
}
