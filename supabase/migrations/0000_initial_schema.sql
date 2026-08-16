-- Database Schema — Money Tracker
-- Run this in Supabase SQL Editor

-- 1. categories table
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income','expense')),
  icon text,
  created_at timestamptz default now()
);

alter table categories add constraint uq_categories_name_type unique (name, type);

-- 2. payment_methods table
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

alter table payment_methods add constraint uq_payment_methods_name unique (name);

-- 3. transactions table
create table transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income','expense','transfer')),
  amount numeric not null check (amount > 0),
  holder text not null check (holder in ('suami','istri')),
  from_holder text check (from_holder in ('suami','istri')),
  category_id uuid references categories(id),
  payment_method_id uuid references payment_methods(id),
  description text,
  trx_date date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz default null,

  -- transfer wajib punya from_holder & beda dari holder tujuan
  constraint transfer_requires_from_holder check (
    (type = 'transfer' and from_holder is not null and from_holder <> holder)
    or (type <> 'transfer' and from_holder is null)
  )
);

create index idx_transactions_date on transactions(trx_date desc);
create index idx_transactions_holder on transactions(holder);
create index idx_transactions_active on transactions(deleted_at) where deleted_at is null;

-- Auto-update updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function update_updated_at();

-- 4. Views

create view v_total_balance as
select
  coalesce(sum(case when type = 'income' then amount end), 0)
  - coalesce(sum(case when type = 'expense' then amount end), 0) as total_balance
from transactions
where deleted_at is null;

create view v_cash_per_holder as
select
  h.holder,
  coalesce(sum(case when t.type = 'income' and t.holder = h.holder then t.amount end), 0)
  - coalesce(sum(case when t.type = 'expense' and t.holder = h.holder then t.amount end), 0)
  - coalesce(sum(case when t.type = 'transfer' and t.from_holder = h.holder then t.amount end), 0)
  + coalesce(sum(case when t.type = 'transfer' and t.holder = h.holder then t.amount end), 0)
    as cash_balance
from (values ('suami'), ('istri')) as h(holder)
left join transactions t on t.deleted_at is null
group by h.holder;


-- 5. Row Level Security (RLS)

alter table transactions enable row level security;
alter table categories enable row level security;
alter table payment_methods enable row level security;

-- Read: boleh diakses via anon key (dashboard baca langsung)
create policy "allow read" on transactions for select using (true);
create policy "allow read categories" on categories for select using (true);
create policy "allow read payment_methods" on payment_methods for select using (true);

-- Write: hanya lewat service role (dipanggil dari Next.js API route)
create policy "allow insert via service role" on transactions for insert
  with check (auth.role() = 'service_role');
create policy "allow update via service role" on transactions for update
  using (auth.role() = 'service_role');
create policy "allow delete via service role" on transactions for delete
  using (auth.role() = 'service_role');

