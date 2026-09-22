// admin/src/sections/emails.ts — Bandeja de salida del demo: cada email generado,
// listo para abrir y mostrar al cliente (se sirve desde /api/demo/outbox/<archivo>).
import { apiGet } from "../api";
import { badge, el, emptyState, fmtDate, toast, type CellValue, type ColumnDef } from "../ui";
import { dataTable, panel, panelHeader, runLoad, stack } from "./helpers";

interface EmailRow {
  id: string;
  template: string;
  toEmail: string;
  subject: string | null;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

const COLUMNS: ColumnDef[] = [
  { key: "fecha", label: "Fecha" },
  { key: "plantilla", label: "Plantilla" },
  { key: "destinatario", label: "Destinatario" },
  { key: "asunto", label: "Asunto" },
  { key: "estado", label: "Estado" },
];

/** Nombre de archivo del email (lo agrega el driver outbox en los metadatos). */
function fileNameOf(row: EmailRow): string | null {
  const file = row.metadata?.["file"];
  if (typeof file !== "string") return null;
  const base = file.replaceAll("\\", "/").split("/").pop();
  return base !== undefined && base.endsWith(".html") ? base : null;
}

/** Descarga la vista actual como CSV (con BOM para acentos). */
function exportCsv(rows: readonly EmailRow[]): void {
  const head = ["Fecha", "Plantilla", "Destinatario", "Asunto", "Estado"];
  const lines = rows.map((row) => [
    row.createdAt,
    row.template,
    row.toEmail,
    row.subject ?? "",
    row.status,
  ]);
  const csv = [head, ...lines]
    .map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "emails-promob.csv";
  link.click();
  URL.revokeObjectURL(url);
  toast("Se exportó emails-promob.csv.", "success");
}

/** Emails: la bandeja de salida para recorrer la demo de comunicación. */
export function renderEmails(): HTMLElement {
  const root = stack();

  runLoad(root, async () => {
    const page = await apiGet<EmailRow>("emails", { pageSize: 100 });
    const items = page.items;

    const exportButton = el("button", {
      class: "btn btn--outline btn--sm",
      type: "button",
      text: "Exportar CSV",
    });
    exportButton.addEventListener("click", () => exportCsv(items));

    const body: CellValue =
      items.length === 0
        ? emptyState({
            title: "Todavía no se enviaron emails",
            text: "Haga una compra o corra el simulador para generar envíos.",
          })
        : dataTable(
            COLUMNS,
            items.map((row) => ({
              fecha: fmtDate(row.createdAt),
              plantilla: row.template,
              destinatario: row.toEmail,
              asunto: row.subject ?? "—",
              estado: badge(row.status),
            })),
            (index) => {
              const row = items[index];
              if (row === undefined) return;
              const file = fileNameOf(row);
              if (file === null) {
                toast("Este email no tiene archivo asociado en este entorno.", "info");
                return;
              }
              window.open(`/api/demo/outbox/${encodeURIComponent(file)}`, "_blank", "noopener");
            },
          );

    return panel(panelHeader("Bandeja de salida", `${page.total} emails`), exportButton, body);
  });

  return root;
}
