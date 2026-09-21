// src/emails/index.ts — Plantillas de correo transaccional de promob-saas.
// Registro central de plantillas + helper de placeholders {{nombre}}.
// Copy en español (es-AR), con trato de "usted".

export type EmailTemplateName =
  | "welcome-code"
  | "receipt"
  | "reminder-7"
  | "reminder-3"
  | "dunning-1"
  | "dunning-4"
  | "dunning-8"
  | "suspension"
  | "lapse"
  | "owner-alert";

/** Plantilla de email transaccional: asunto y cuerpo HTML, ambos con variables. */
export interface EmailTemplate {
  subject(vars: Record<string, string>): string;
  html(vars: Record<string, string>): string;
}

const registry = new Map<string, EmailTemplate>();

export function registerTemplate(name: EmailTemplateName, template: EmailTemplate): void {
  registry.set(name, template);
}

export function getTemplate(name: string): EmailTemplate {
  const template = registry.get(name);
  if (template === undefined) {
    const disponibles = [...registry.keys()].join(", ");
    throw new Error(
      `La plantilla de email "${name}" no existe. Plantillas disponibles: ${
        disponibles === "" ? "(ninguna)" : disponibles
      }.`,
    );
  }
  return template;
}

/**
 * Reemplaza los placeholders `{{nombre}}` por el valor correspondiente de `vars`.
 * Los placeholders sin valor en `vars` se conservan tal cual.
 */
export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? (vars[key] ?? match) : match,
  );
}

const FOOTER = `<div style="margin-top:24px;padding:16px 24px;border-top:1px solid #e5e7eb;font-size:14px;color:#6b7280;">
  ¿Necesita ayuda? Escríbanos por WhatsApp:
  <a href="https://wa.me/5491150993627" style="color:#6b7280;">+54 9 11 5099-3627</a><br/>
  <a href="https://promob.ar/terminos" style="color:#6b7280;">Términos y condiciones</a>
  &middot; <a href="https://promob.ar/privacidad" style="color:#6b7280;">Política de privacidad</a>
</div>`;

/** Envuelve el contenido en el layout común: barra PROMOB, título y pie legal. */
function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} &mdash; PROMOB</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <div style="background:#123b25;color:#ffffff;padding:16px 24px;font-size:18px;font-weight:bold;letter-spacing:2px;">PROMOB</div>
    <div style="padding:24px;font-size:16px;line-height:1.55;color:#1f2933;">
      <h3 style="margin:0 0 16px;font-size:20px;color:#123b25;">${title}</h3>
      ${body}
    </div>
    ${FOOTER}
  </div>
</body>
</html>`;
}

/** Botón de llamada a la acción con los colores de la marca. */
function cta(href: string, label: string): string {
  return `<div style="margin:24px 0;text-align:center;">
  <a href="${href}" style="display:inline-block;background:#1b5e3b;color:#ffffff;text-decoration:none;height:44px;line-height:44px;padding:0 28px;border-radius:8px;font-size:16px;font-weight:bold;">${label}</a>
</div>`;
}

// --- welcome-code: entrega del código de activación al comprar una licencia ---
const welcomeCodeTemplate: EmailTemplate = {
  subject: () => "Bienvenido a PROMOB — su código de activación",
  html: (vars) =>
    render(
      layout(
        "Su licencia de PROMOB ya está disponible",
        `<p>Estimado {{nombre}}:</p>
<p>Gracias por su compra. Su licencia de PROMOB ya está disponible. Este es su código de activación:</p>
<div style="margin:16px 0;padding:16px;background:#eef6f1;border:1px solid #1b5e3b;border-radius:8px;text-align:center;">
  <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:bold;letter-spacing:2px;color:#123b25;">{{code}}</div>
</div>
<p>Para activar su licencia, siga estos pasos:</p>
<ol style="margin:0;padding-left:20px;">
  <li>Descargue e instale la última versión de PROMOB desde el sitio oficial.</li>
  <li>Abra la aplicación y seleccione &laquo;Activar licencia&raquo;.</li>
  <li>Ingrese su código y confirme. &iexcl;Listo, ya puede empezar a trabajar!</li>
</ol>
${cta("https://promob.ar/activar", "Activar mi licencia")}`,
      ),
      vars,
    ),
};

// --- receipt: comprobante de pago (tono neutro, solo datos de la operación) ---
const receiptTemplate: EmailTemplate = {
  subject: () => "Comprobante de pago — PROMOB",
  html: (vars) =>
    render(
      layout(
        "Comprobante de pago",
        `<p>Estimado {{nombre}}:</p>
<p>Confirmamos que recibimos su pago. A continuación, el detalle de la operación:</p>
<table style="width:100%;border-collapse:collapse;font-size:16px;">
  <tr>
    <td style="padding:8px 0;color:#6b7280;width:40%;">Producto</td>
    <td style="padding:8px 0;">{{producto}}</td>
  </tr>
  <tr>
    <td style="padding:8px 0;color:#6b7280;">Monto</td>
    <td style="padding:8px 0;">{{monto}}</td>
  </tr>
  <tr>
    <td style="padding:8px 0;color:#6b7280;">Fecha</td>
    <td style="padding:8px 0;">{{fecha}}</td>
  </tr>
  <tr>
    <td style="padding:8px 0;color:#6b7280;">Medio de pago</td>
    <td style="padding:8px 0;">{{medio}}</td>
  </tr>
</table>
<p style="margin-top:16px;">Le recomendamos conservar este comprobante como constancia de su operación.</p>`,
      ),
      vars,
    ),
};

registerTemplate("welcome-code", welcomeCodeTemplate);
registerTemplate("receipt", receiptTemplate);
