-- ============================================================
-- 0002_seed.sql — Config inicial + productos demo (provisorios)
-- ============================================================

-- Config: política de mora (defaults editables en admin), fx_rates (placeholder) y modo demo.
insert into public.config (key, value) values
  ('dunning_policy', '{"graceDays": 14, "lapseDays": 30}'::jsonb),
  ('fx_rates', '{"ARS": 1.0, "UYU": 1.0, "CLP": 1.0, "PYG": 1.0}'::jsonb),
  ('store_mode', '"demo"'::jsonb)
on conflict (key) do nothing;

-- Productos demo/provisorios. Reemplazar por SKUs reales (W4, previa confirmación del cliente).
insert into public.products (slug, name, description, kind, price_ars, is_demo, active) values
  ('promob-plus-demo', 'Promob Plus (DEMO)', 'Producto demo provisorio — reemplazar por SKU real', 'subscription', 0, true, true),
  ('promob-cut-demo', 'Promob Cut (DEMO)', 'Producto demo provisorio — reemplazar por SKU real', 'subscription', 0, true, true),
  ('promob-start-demo', 'Promob Start (DEMO)', 'Producto demo provisorio — reemplazar por SKU real', 'one_time', 0, true, true)
on conflict (slug) do nothing;
