# Guía del modo demo — Promob

> Cómo levantar la v1 usable en local y cómo recorrerla en 15 minutos.
> Modo demo = **sin cuentas externas**: datos en memoria persistida, pagos simulados y emails a una bandeja local.

---

## 1. Levantarlo

```bash
npm install          # una sola vez
npm run build        # compila sitio (web/dist) + panel (web/dist/admin)
npm run demo         # servidor local en http://localhost:8787
```

| URL | Qué es |
|---|---|
| `http://localhost:8787/` | Sitio público (home, productos, planes, checkout, contacto, soporte, legales) |
| `http://localhost:8787/admin` | Panel de gestión (modo demo: entra directo como "Camila · Dueño") |
| `http://localhost:8787/api/health` | Estado de drivers (data/pay/mail) |
| `POST http://localhost:8787/api/demo/simulate` | Simulador (mora, cobros rechazados, reset) |

**Dónde quedan las cosas:** los datos viven en `out/demo-db.json`; los emails enviados se escriben como archivos HTML en `out/outbox/`. Para reiniciar el demo de cero, usar el escenario `reset` del simulador.

## 2. Guion de demo (15 minutos)

1. **Sitio (3 min).** Recorrer home → productos → planes. Mostrar el selector de país, el estado "precios próximamente" (los montos finales los define el cliente) y el chip **VISTA PREVIA**.
2. **Compra única (2 min).** En `/checkout/`, elegir el plan anual/pago único, completar datos y usar una tarjeta de prueba:
   - terminada en `4242` (o cualquier otra) → **aprobada**;
   - terminada en `0002` → **rechazada**;
   - terminada en `0009` → **pendiente**.
   Al aprobar: pantalla de éxito + **dos emails** en `out/outbox/` (`welcome-code` con el código y `receipt` con el comprobante).
3. **Suscripción (2 min).** Suscribirse al plan mensual (tarjeta `4242`). Mostrar que el alta **entrega el código al instante** y que el próximo cobro queda agendado.
4. **Panel (3 min).** En `/admin`: KPIs del dashboard, avisos del día, clientes, suscripciones. Abrir una suscripción y mostrar las acciones (reenviar código, marcar pagado, extender, suspender, cancelar — con confirmación y registro).
5. **Mora en vivo (4 min).** Desde el simulador (o usando la API):
   - `charge-failed` sobre una suscripción activa → pasa a **en mora**;
   - `advance-days` con `40` → aparece la secuencia de avisos en `out/outbox/` (`reminder-7`, `reminder-3`, `dunning-1`, `dunning-4`, `dunning-8`);
   - `advance-days` con `30` → **suspensión** (con alerta al dueño) y luego **baja**;
   - volver al panel: los badges de estado cambiaron en vivo.
6. **Cierre (1 min).** `GET /api/health` mostrando los drivers activos. Mensaje clave: **lo mismo que vieron corre igual con cuentas reales** cambiando solo las credenciales.

### Simulador — ejemplos

```powershell
# Cobro rechazado de una suscripción
Invoke-RestMethod -Method Post -Uri http://localhost:8787/api/demo/simulate `
  -ContentType "application/json" -Body '{"scenario":"charge-failed","targetId":"<subscriptionId>"}'

# Avanzar el reloj del demo (y correr la mora)
Invoke-RestMethod -Method Post -Uri http://localhost:8787/api/demo/simulate `
  -ContentType "application/json" -Body '{"scenario":"advance-days","days":40}'

# Reiniciar los datos del demo
Invoke-RestMethod -Method Post -Uri http://localhost:8787/api/demo/simulate `
  -ContentType "application/json" -Body '{"scenario":"reset"}'
```

## 3. Qué es real y qué es simulado (honestidad del demo)

| Frente | En el demo | Con cuentas reales |
|---|---|---|
| Pagos | Simulados por reglas de tarjeta (no se cobra nada) | MercadoPago real (`PAY_DRIVER=real` + credenciales) |
| Emails | Archivos HTML en `out/outbox/` | Resend (`MAIL_DRIVER=resend` + API key) |
| Datos | `out/demo-db.json` (memoria persistida) | Supabase (`DATA_DRIVER=supabase` — cableado pendiente) |
| Productos/skus | Nombres y montos **de ejemplo** (`is_demo: true`) | Catálogo y precios confirmados por el cliente |
| Firma de webhooks | Se verifica si `MP_WEBHOOK_SECRET` está configurado | Igual, con el secreto de producción |
| Mora | Reloj virtual (`advance-days`) | Cron diario de Netlify (`cron-dunning`) |

> Los montos que se ven son de ejemplo. La estructura de planes de Promob cambió en marzo 2026:
> el catálogo definitivo lo confirma el cliente antes de publicar la tienda.
