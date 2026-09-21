import { emptyState } from "../ui";

/** Pagos: lista con filtros por estado y fecha, detalle con comprobante (próxima entrega). */
export function renderPagos(): HTMLElement {
  return emptyState({
    title: "Sección en preparación",
    text: "Disponible en la próxima entrega.",
  });
}
