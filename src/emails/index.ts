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

// --- recordatorios previos al vencimiento ---
const reminder7Template: EmailTemplate = {
  subject: () => "Su suscripción PROMOB se renueva en 7 días",
  html: (vars) =>
    render(
      layout(
        "Su suscripción se renueva en 7 días",
        `<p>Estimado {{nombre}}:</p>
<p>Le recordamos que la suscripción a <strong>{{producto}}</strong> se renueva el <strong>{{fecha}}</strong> con el cobro automático mensual.</p>
<p>No hace falta que haga nada: el cobro se procesa solo. Si necesita actualizar su tarjeta, puede hacerlo desde el siguiente enlace.</p>
${cta("https://promob.ar/cuenta", "Ver mi suscripción")}`,
      ),
      vars,
    ),
};

const reminder3Template: EmailTemplate = {
  subject: () => "Su suscripción PROMOB se renueva en 3 días",
  html: (vars) =>
    render(
      layout(
        "La renovación es en 3 días",
        `<p>Estimado {{nombre}}:</p>
<p>El cobro de <strong>{{producto}}</strong> se procesará el <strong>{{fecha}}</strong>. Si su tarjeta cambió, actualícela hoy para evitar interrupciones.</p>
${cta("https://promob.ar/cuenta", "Actualizar mi tarjeta")}`,
      ),
      vars,
    ),
};

// --- avisos de pago rechazado (dunning) ---
const dunning1Template: EmailTemplate = {
  subject: () => "No pudimos procesar su pago — PROMOB",
  html: (vars) =>
    render(
      layout(
        "No pudimos procesar su pago",
        `<p>Estimado {{nombre}}:</p>
<p>El cobro de <strong>{{producto}}</strong> correspondiente al <strong>{{fecha}}</strong> no pudo procesarse. Vamos a reintentarlo automáticamente en los próximos días.</p>
<p>Si el problema es de fondos o de la tarjeta, puede resolverlo actualizando su medio de pago:</p>
${cta("https://promob.ar/cuenta", "Verificar mi tarjeta")}
<p style="color:#6b7280;font-size:14px;">Si ya regularizó el pago, ignore este mensaje.</p>`,
      ),
      vars,
    ),
};

const dunning4Template: EmailTemplate = {
  subject: () => "Atención: su pago sigue pendiente — PROMOB",
  html: (vars) =>
    render(
      layout(
        "Su pago sigue pendiente",
        `<p>Estimado {{nombre}}:</p>
<p>El cobro de <strong>{{producto}}</strong> continúa rechazado. Quedan pocos reintentos automáticos antes de que la suscripción entre en suspensión.</p>
<p>Para mantener su acceso sin interrupciones, regularice el pago desde el siguiente enlace:</p>
${cta("https://promob.ar/cuenta", "Regularizar el pago")}`,
      ),
      vars,
    ),
};

const dunning8Template: EmailTemplate = {
  subject: () => "Último aviso antes de la suspensión — PROMOB",
  html: (vars) =>
    render(
      layout(
        "Último aviso antes de la suspensión",
        `<p>Estimado {{nombre}}:</p>
<p>El pago de <strong>{{producto}}</strong> sigue sin procesarse. Si no se regulariza antes del <strong>{{fecha}}</strong>, la suscripción quedará suspendida y el acceso al software se cortará.</p>
${cta("https://promob.ar/cuenta", "Pagar ahora")}`,
      ),
      vars,
    ),
};

// --- suspensión y baja ---
const suspensionTemplate: EmailTemplate = {
  subject: () => "Su suscripción PROMOB fue suspendida",
  html: (vars) =>
    render(
      layout(
        "Su suscripción fue suspendida",
        `<p>Estimado {{nombre}}:</p>
<p>Como el pago de <strong>{{producto}}</strong> no pudo procesarse dentro del plazo, la suscripción quedó suspendida y el acceso al software se encuentra pausado.</p>
<p>Puede reactivarla en cualquier momento regularizando el pago; su información y su configuración se conservan intactas.</p>
${cta("https://promob.ar/cuenta", "Reactivar mi suscripción")}`,
      ),
      vars,
    ),
};

const lapseTemplate: EmailTemplate = {
  subject: () => "Su suscripción PROMOB fue dada de baja",
  html: (vars) =>
    render(
      layout(
        "Su suscripción fue dada de baja",
        `<p>Estimado {{nombre}}:</p>
<p>Transcurrido el plazo de suspensión sin regularizar el pago, la suscripción a <strong>{{producto}}</strong> quedó dada de baja.</p>
<p>Si desea volver a trabajar con PROMOB, puede contratar una nueva licencia cuando quiera: el acceso se entrega por email en minutos.</p>
${cta("https://promob.ar/planes", "Ver planes y precios")}`,
      ),
      vars,
    ),
};

// --- alerta interna al dueño (formato utilitario) ---
const ownerAlertTemplate: EmailTemplate = {
  subject: () => "Alerta interna — PROMOB",
  html: (vars) =>
    render(
      layout(
        "Alerta interna",
        `<p><strong>Detalle:</strong> {{detalle}}</p>
<p><strong>Fecha:</strong> {{fecha}}</p>
<p>Abra el panel de gestión para revisar el caso:</p>
${cta("https://promob.ar/admin", "Abrir el panel")}`,
      ),
      vars,
    ),
};

registerTemplate("welcome-code", welcomeCodeTemplate);
registerTemplate("receipt", receiptTemplate);
registerTemplate("reminder-7", reminder7Template);
registerTemplate("reminder-3", reminder3Template);
registerTemplate("dunning-1", dunning1Template);
registerTemplate("dunning-4", dunning4Template);
registerTemplate("dunning-8", dunning8Template);
registerTemplate("suspension", suspensionTemplate);
registerTemplate("lapse", lapseTemplate);
registerTemplate("owner-alert", ownerAlertTemplate);
