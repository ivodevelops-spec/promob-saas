# Contrato de API y modo demo (interno)

> **Fuente de verdad** para el sitio (`web/`), el panel (`admin/`), las funciones (`netlify/functions/`) y el servidor de demo.
> Versión 1.0 — 21/9/2026. Si algo de acá cambia, se actualiza este archivo ANTES de tocar código.

## 1. Drivers (modo de ejecución)

El sistema corre con **drivers intercambiables** por variable de entorno. El modo demo (default) no necesita ninguna cuenta externa.

| Variable | Valores | Default | Qué hace |
|---|---|---|---|
| `DATA_DRIVER` | `memory` \| `supabase` | `memory` | Repositorio de datos |
| `PAY_DRIVER` | `mock` \| `real` | `mock` | MercadoPago (real = API REST con credenciales) |
| `MAIL_DRIVER` | `outbox` \| `resend` | `outbox` | Emails (outbox = archivos locales + registro) |
| `DEMO_MODE` | `true` \| `false` | `true` | Sesión de panel simplificada + endpoints de simulación |

**Comportamiento por driver:**
- `memory`: datos persistidos en `out/demo-db.json` (se crea con seed si no existe). Operaciones atómicas en proceso.
- `mock` (pagos): decide aprobado/rechazado según regla demo (ver §4) o según `scenario` explícito. No llama a MercadoPago.
- `outbox` (emails): renderiza el email y lo escribe en `out/outbox/<timestamp>-<template>.html`; registra en `email_logs`.
- `DEMO_MODE=true`: el panel entra directo con una sesión fija (sin login); se habilitan los endpoints `/api/demo/*`.

## 2. Endpoints HTTP

Todos bajo `/api/*` (en Netlify: redirect a `/.netlify/functions/:splat`; en demo local: ruteo directo).

### GET /api/health
`200 { ok: true, drivers: { data, pay, mail }, demo: true, version }`

### POST /api/checkout — compra única
```json
// request
{ "productSlug": "promob-plus-anual", "customer": { "fullName": "Ana Pérez", "email": "ana@demo.com", "country": "AR" }, "card": { "token": "demo-token", "last4": "4242" } }
// 200
{ "orderId": "uuid", "status": "paid" | "rejected" | "pending", "codeEmailSent": true }
```
Reglas: `paid` → orden `paid` + asigna código del pool + email `welcome-code` + email `receipt`. `rejected` → orden `failed`. `pending` → orden `pending`.

### POST /api/subscribe — suscripción mensual
```json
// request
{ "productSlug": "promob-plus-mensual", "customer": { "fullName": "...", "email": "...", "country": "AR" }, "card": { "token": "demo-token", "last4": "4242" } }
// 200
{ "subscriptionId": "uuid", "status": "active" | "rejected" | "pending", "nextPaymentDate": "2026-10-21" }
```
Regla: `active` → suscripción activa + primer pago registrado + email `welcome-code` (el código se entrega en el alta).

### POST /api/contact — formulario de contacto
```json
{ "name": "...", "email": "...", "company": "...", "country": "AR", "message": "..." }
// 200 { "ok": true }
```
Guarda el mensaje y notifica al dueño (`owner-alert`). Validación server-side; honeypot ignorado en API (lo maneja el form).

### POST /api/mp-webhook — notificaciones de MercadoPago
Verifica firma (`x-signature`, HMAC-SHA256 con `ts` + params + secret), deduplica por `event_id` (tabla `events`), responde `200 { ok: true }` siempre que sea procesable. Eventos soportados: `payment`, `subscription_preapproval`, `subscription_authorized_payment`.

### GET /api/admin-api?resource=... — lecturas del panel
`resource`: `dashboard` | `customers` | `subscriptions` | `orders` | `payments` | `codes` | `emails` | `reports` | `config`
Filtros por query: `status`, `q` (búsqueda), `page`, `pageSize`, `country`, `productId`.
```json
// 200
{ "items": [ ... ], "total": 123, "page": 1, "pageSize": 25 }
```
(`dashboard` devuelve KPIs + últimas actividades; `reports` devuelve series mensuales.)

### POST /api/admin-api — acciones del panel
```json
{ "action": "resend-code" | "mark-paid" | "extend" | "suspend" | "reactivate" | "cancel" | "upload-codes" | "update-config",
  "payload": { ... } }
// 200 { "ok": true, "result": { ... } }
```
Acciones y payloads:
- `resend-code`: `{ subscriptionId? , orderId?, customerId }` → reenvía código.
- `mark-paid`: `{ subscriptionId, amountArs, method, note? }` → pago manual + `active`.
- `extend`: `{ subscriptionId, days, reason? }` → prórroga.
- `suspend`: `{ subscriptionId, reason }` → `suspended`.
- `reactivate`: `{ subscriptionId }` → `active`.
- `cancel`: `{ subscriptionId, reason }` → `canceled`.
- `upload-codes`: `{ codes: string[], batch? }` → carga pool (dedupe por hash).
- `update-config`: `{ key, value }` → config (mora, fx_rates, etc.).

### POST /api/demo/simulate (solo DEMO_MODE)
```json
{ "scenario": "approve-payment" | "reject-payment" | "charge-failed" | "advance-days", "targetId": "uuid", "days": 3 }
```
- `charge-failed`: la suscripción pasa a `past_due`, se registra pago rechazado y se disparan los emails de dunning correspondientes al día simulado.
- `advance-days`: avanza el reloj de demo N días y recalcula estados + emails de mora (para mostrar el ciclo completo).

## 3. Reglas demo de pago (mock)

- Tarjeta terminada en `0002` → **rechazado**.
- Tarjeta terminada en `0009` → **pendiente**.
- Cualquier otra → **aprobado**.
- El formulario de tarjeta del sitio (modo demo) no cobra nada: arma un token local `demo-token-<last4>`.

## 4. Auth del panel

- `DEMO_MODE=true`: sesión fija "Camila · Dueño" (sin login). El rol mostrado es Dueño.
- `DEMO_MODE=false`: magic link Supabase (`profiles` + RLS). Guard: sin sesión → pantalla de acceso.

## 5. Datos demo (seed)

- **3 productos** (`is_demo=true`): suscripción mensual, pago anual, pago único — nombres y estructura reales, montos demo editables (los reales los define el cliente).
- **6 clientes demo** con estados variados: activo, past_due, suspendido, lapsed, cancelado; pagos aprobados/rechazados; códigos con stock ok y stock bajo (para mostrar alertas).
- **config**: `dunning_policy { graceDays: 14, lapseDays: 30 }`, `fx_rates` demo, `store_mode: "demo"`.

## 6. Reglas generales

- Todas las respuestas JSON; errores: `4xx/5xx { error: { code, message } }`.
- El sitio NUNCA rompe si la API no responde: muestra estado de error amable con WhatsApp.
- Dinero: montos en ARS (`amountArs`, entero de centavos NO — decimal con 2 decimales, tipo number).
- Fechas: ISO 8601 (`2026-10-21T15:04:05Z`) en API; la UI las formatea `DD/MM/AAAA`.
- Idioma: identificadores en inglés; textos de UI y mensajes en español (es-AR).
