import { emptyState } from "../ui";

/** Códigos: estado del pool y carga de lotes (próxima entrega). */
export function renderCodigos(): HTMLElement {
  return emptyState({
    title: "Sección en preparación",
    text: "Disponible en la próxima entrega.",
  });
}
