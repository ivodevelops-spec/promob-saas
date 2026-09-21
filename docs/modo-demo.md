# Modo demo — arquitectura (interno)

> Decisiones validadas en la revisión de arquitectura (Oracle, 21/9/2026) para el demo local **sin cuentas externas**. Fuente de verdad para el servidor de demo y los drivers.

## Servidor de demo (`npm run demo`)

- Adapter Node 22: `IncomingMessage → Request`, `Response → ServerResponse`. **Reconstruir la URL absoluta preservando el query string crudo** (MercadoPago firma con `data.id` del query param).
- Rutas: `/api/*` → módulo de función (import dinámico); `/admin/*` → estático con fallback a `/admin/index.html`; `/` → `web/dist` estático (tabla MIME por extensión); 404 al resto. Bloquear `out/`, `netlify/`, `.env`.
- `Set-Cookie`: usar `response.headers.getSetCookie()` y emitir cada cookie en su propia línea (no comma-join).
- Errores: try/catch → 500 JSON; inyectar `ctx = { requestId, log }`.
- Ejecutar TS: `tsx` como entrypoint del demo (o `node --experimental-strip-types`). Los cron no disparan por `schedule` en local → exponer `/api/demo/run-cron`.
- Una sola instancia de driver a nivel módulo (no por request).

## Drivers (memory / mock / outbox)

- **Todas** las mutaciones serializadas por un único mutex (promise-chain); las lecturas también (escala demo, sin costo).
- `allocateNextCode`: reserve→issue bajo el mutex; **plaintext solo en memoria** (nunca persistido); hash SHA-256 en el JSON.
- Dedupe de webhooks: `claimEvent(eventId)` atómico (check-and-insert bajo el mutex).
- Persistencia: write-temp + rename, cola de flush serializada; solo valores JSON-safe (fechas ISO string); al iniciar, liberar `reserved` vencidos; archivo corrupto → `.bak` + reseed (nunca crashear).
- **Reloj inyectable**: offset `demoNow` (nunca `new Date()` directo dentro del driver).
- En modo memoria, `getDb()` (Supabase) se **evita por completo**.

## MercadoPago (verificado)

- Header `x-signature`: `ts=<ms>,v1=<hex>`.
- Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — **`data.id` sale del QUERY PARAM (no del body)**, en minúsculas si es alfanumérico; segmentos ausentes se omiten.
- HMAC-SHA256, clave = webhook secret, salida hex; comparar con `crypto.timingSafeEqual`.
- Responder 200 < 22 s; dedupe por id de la notificación; siempre re-consultar el recurso por API; transiciones **solo hacia adelante**.
- **El cron es el ÚNICO que envía emails de dunning**; el webhook sólo registra el rechazo y pasa a `past_due`.
- Mapeo: preapproval `authorized` → `active`; pago rechazado / `paused` → `past_due` (inicia dunning); `paused`/auto-cancel → `suspended`; `cancelled` → `canceled` (`lapsed` es sólo etiqueta interna de fin de dunning).

## Simulador (mora)

- **Reloj virtual**: `advance-days` mueve el offset y llama `runDunning(now)` — el mismo código del cron real (no un mock).
- Presets: `approve-payment`, `reject-payment`, `charge-failed`, `advance-days`.
- El offset se persiste en `out/demo-db.json` (re-ejecutable; admite valores negativos).

## Honestidad del demo

- Panel: banner persistente "MODO DEMO — montos de ejemplo".
- Sitio: chip "VISTA PREVIA" (como los mockups aprobados).
- Checkout demo: "no se cobra"; tarjeta terminada en `0002` rechaza / `0009` pendiente / resto aprueba.
- Productos `is_demo` con SKUs placeholder (la estructura de planes cambió en mar-2026).

## De-scope consciente para el MVP

- `cron-backup` y alertas por WhatsApp: hooks, sin implementación.
- Export CSV **sí** (está prometido en la propuesta: "Exportación a Excel").
