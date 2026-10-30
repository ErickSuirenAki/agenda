create table if not exists public.professionals (
  id text primary key,
  name text not null,
  category text not null,
  neighborhood text not null,
  phone text not null,
  description text not null,
  whatsapp integer not null default 0 check (whatsapp in (0, 1)),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  constraint professionals_phone_category_key unique (phone, category)
);
create index if not exists professionals_status_name_idx on public.professionals (status, name);
alter table public.professionals enable row level security;
revoke all on public.professionals from anon, authenticated;
grant select, insert, update, delete on public.professionals to service_role;
