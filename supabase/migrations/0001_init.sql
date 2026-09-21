-- ============================================================
-- 0001_init.sql — Esquema inicial de promob-saas
-- Postgres 15+ (Supabase). UUID PKs, timestamps, FKs, CHECK enums,
-- índices de búsqueda y RLS habilitado en todas las tablas.
-- ============================================================

-- ------------------------------------------------------------
-- customers — datos de contacto de quien compra/suscribe
-- ------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  phone text,
  country text not null default 'AR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_country_check check (country in ('AR', 'UY', 'CL', 'PY'))
);

-- ------------------------------------------------------------
-- products — catálogo (suscripción o compra única)
-- ------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  kind text not null default 'subscription',
  price_ars numeric(12, 2) not null default 0,
  currency text not null default 'ARS',
  is_demo boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_kind_check check (kind in ('subscription', 'one_time'))
);

-- ------------------------------------------------------------
-- orders — compras únicas
-- ------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  amount_ars numeric(12, 2) not null,
  status text not null default 'pending',
  mp_payment_id text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (
    status in ('pending', 'paid', 'failed', 'refunded', 'delivered')
  )
);

-- ------------------------------------------------------------
-- subscriptions — suscripciones mensuales (Preapproval MP)
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  mp_preapproval_id text unique,
  status text not null default 'active',
  next_payment_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (
    status in ('active', 'past_due', 'suspended', 'lapsed', 'canceled')
  )
);

-- ------------------------------------------------------------
-- payments — pagos (order única o cuota de suscripción)
-- ------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  mp_payment_id text not null unique,
  amount_ars numeric(12, 2) not null,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_status_check check (status in ('pending', 'approved', 'rejected', 'refunded')),
  constraint payments_order_xor_subscription_check check (
    (order_id is not null)::int + (subscription_id is not null)::int = 1
  )
);

-- ------------------------------------------------------------
-- code_pool — códigos de acceso hasheados (SHA-256 en reposo)
-- ------------------------------------------------------------
create table if not exists public.code_pool (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  batch text,
  status text not null default 'unissued',
  reserved_until timestamptz,
  issued_at timestamptz,
  order_id uuid references public.orders(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint code_pool_status_check check (status in ('unissued', 'reserved', 'issued', 'voided'))
);

-- ------------------------------------------------------------
-- email_logs — registro de envíos (Resend)
-- ------------------------------------------------------------
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  template text not null,
  to_email text not null,
  subject text,
  status text not null default 'sent',
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint email_logs_status_check check (status in ('sent', 'failed', 'queued'))
);

-- ------------------------------------------------------------
-- events — eventos recibidos (dedupe por event_id)
-- ------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  source text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- config — clave/valor (dunning_policy, fx_rates, store_mode, ...)
-- ------------------------------------------------------------
create table if not exists public.config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- profiles — perfil del usuario autenticado (Supabase Auth)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('owner', 'staff'))
);

-- ============================================================
-- Índices de búsqueda
-- ============================================================
create index if not exists idx_customers_email on public.customers(email);
create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_mp_payment on public.orders(mp_payment_id);
create index if not exists idx_subscriptions_customer on public.subscriptions(customer_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_subscriptions_mp_preapproval on public.subscriptions(mp_preapproval_id);
create index if not exists idx_subscriptions_next_payment on public.subscriptions(next_payment_date);
create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_payments_subscription on public.payments(subscription_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_code_pool_status on public.code_pool(status);
create index if not exists idx_code_pool_batch on public.code_pool(batch);
create index if not exists idx_email_logs_customer on public.email_logs(customer_id);
create index if not exists idx_events_source_type on public.events(source, type);
create index if not exists idx_events_processed on public.events(processed_at);

-- ============================================================
-- updated_at automático
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger trg_products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger trg_payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger trg_code_pool_updated_at before update on public.code_pool
  for each row execute function public.set_updated_at();
create trigger trg_config_updated_at before update on public.config
  for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
-- anon/authenticated: sin acceso directo (denegación por defecto).
-- service-role: saltea RLS (built-in). profiles: el usuario lee su propia fila.
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.code_pool enable row level security;
alter table public.email_logs enable row level security;
alter table public.events enable row level security;
alter table public.config enable row level security;
alter table public.profiles enable row level security;

-- profiles: el usuario autenticado lee/actualiza su propia fila.
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);
