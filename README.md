# promob-saas

Web nueva + tienda online + cobro recurrente para el **distribuidor argentino de Promob**.

Stack: **Astro** (sitio) · **SPA admin** (Vite + vanilla-ts) · **Netlify Functions** (API) · **Supabase** (Postgres + Auth + RLS) · **Resend** (emails) · **MercadoPago** (pagos).

> Estado actual: **Wave 0 — Fundación**. Todo corre local; sin deploy, sin remote, sin cuentas de cliente.

## Setup local

1. **Clonar / posicionarse** en `promob-saas/`.
2. **Variables de entorno:**
   ```bash
   # Windows (PowerShell) / macOS·Linux
   cp .env.example .env
   ```
   Completar `.env` con valores reales (placeholders por ahora).
3. **Instalar dependencias:**
   ```bash
   npm install
   ```
4. **Aplicar migraciones** en Supabase (SQL Editor o CLI):
   - `supabase/migrations/0001_init.sql` (esquema + RLS)
   - `supabase/migrations/0002_seed.sql` (config + productos demo)
5. **Desarrollo:**
   ```bash
   npm run dev:web     # Astro en http://localhost:4321
   npm run dev:admin   # Vite SPA admin
   ```

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev:web` | Dev server de Astro |
| `npm run dev:admin` | Dev server del SPA admin |
| `npm run build` | Compila web + admin a `web/dist` (admin en `web/dist/admin`) |
| `npm run typecheck` | TypeScript estricto (src + functions + tests + admin + e2e) |
| `npm test` | Tests unitarios (Vitest) |
| `npm run lint` | ESLint (flat config + typescript-eslint) |
| `npm run format` | Prettier write |
| `npm run e2e` | Playwright (skipped salvo `E2E=1`) |

## Estructura

```
promob-saas/
  web/                     # Sitio Astro (src/pages, src/components, public)
  admin/                   # SPA admin (Vite + vanilla-ts), bajo /admin
  netlify/functions/       # mp-webhook, checkout, subscribe, mail, cron-dunning,
                           # cron-backup, admin-api, health, contact
  src/                     # TS compartido: config, db, mp, state-machine, codes, mail, netlify
  supabase/migrations/     # 0001_init.sql, 0002_seed.sql
  tests/                   # Vitest (unit)
  e2e/                     # Playwright skeleton (skipped salvo E2E=1)
  docs/                    # Documentación del proyecto
  .env.example  .gitignore  netlify.toml  package.json  tsconfig.base.json
  README.md  vitest.config.ts
```

## Convenciones

- **Commits atómicos**, conventional commits **en español**: `feat(db): …`, `fix(api): …`, `chore(tooling): …`.
- **Nunca** commitear `.env` ni secretos (solo placeholders en `.env.example`).
- **Identificadores de código en inglés**; comentarios/commits/docs en español; copy de UI en español.
- **TypeScript estricto**: sin `any`, sin `@ts-ignore`, sin catch vacíos.
- **TDD**: vitest (unit) + Playwright (E2E sandbox, `E2E=1` para activar).

## Documentación

- Plan y contexto completo: `docs/` (y carpeta `Documentacion y analisis/` fuera del repo).
- Máquina de estados, dunning y flujo de códigos: ver `PROMPT-PROMOB.md` (secciones 4–5).
