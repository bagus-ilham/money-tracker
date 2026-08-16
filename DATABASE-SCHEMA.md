# Database Schema — Money Tracker

**Database:** Supabase (Postgres)

---

## 1. Entity Relationship (ringkas)

```
categories ─────┐
                 ├──< transactions >── payment_methods
holders (enum)───┘
```

Tidak ada tabel `holders` terpisah — cukup pakai `check constraint` / enum karena hanya 2 nilai tetap (`suami`, `istri`). Kalau nanti mau extend (misal tambah anak/rekening bersama), baru dijadikan tabel referensi.

## 2. Tabel

### 2.1 `categories`
```sql
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income','expense')),
  icon text,
  created_at timestamptz default now()
);
```
Dipakai hanya untuk transaksi `income` dan `expense`. Transfer tidak butuh kategori.

### 2.2 `payment_methods`
```sql
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- Cash, Transfer BCA, GoPay, QRIS, dll
  created_at timestamptz default now()
);
```

### 2.3 `transactions`
```sql
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

-- Auto-update updated_at
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
```

**Catatan field per tipe:**

| Field | income | expense | transfer |
|---|---|---|---|
| `holder` | penerima income | yang mengeluarkan | penerima transfer |
| `from_holder` | — | — | pengirim transfer |
| `category_id` | wajib | wajib | tidak dipakai (null) |
| `payment_method_id` | opsional | wajib | opsional |
| `updated_at` | otomatis (trigger) | otomatis (trigger) | otomatis (trigger) |
| `deleted_at` | `null` (diisi saat soft delete) | `null` (diisi saat soft delete) | `null` (diisi saat soft delete) |

## 3. View untuk Perhitungan Saldo

### 3.1 Saldo Total Rumah Tangga
```sql
create view v_total_balance as
select
  coalesce(sum(case when type = 'income' then amount end), 0)
  - coalesce(sum(case when type = 'expense' then amount end), 0) as total_balance
from transactions
where deleted_at is null;
```

### 3.2 Cash per Holder
```sql
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
```

## 4. Row Level Security (RLS)

Karena tidak ada auth per-user, RLS diarahkan untuk **membatasi akses hanya lewat service role** (dipakai server-side di Next.js API route / Edge Function), bukan diakses langsung dari client dengan anon key untuk operasi write.

```sql
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
```

## 5. Database Webhook → Sync ke Google Sheets

```sql
-- Diaktifkan lewat Supabase Dashboard: Database > Webhooks
-- Trigger: AFTER INSERT, UPDATE, DELETE ON transactions
-- Target: Edge Function `sync-to-sheets`
```

Payload webhook (contoh) yang diterima Edge Function:
```json
{
  "type": "INSERT",
  "table": "transactions",
  "record": {
    "id": "...",
    "type": "transfer",
    "amount": 500000,
    "holder": "istri",
    "from_holder": "suami",
    "trx_date": "2026-08-16"
  }
}
```

Edge Function menangani 3 event:

| Event | Aksi di Google Sheets |
|---|---|
| `INSERT` | Append row baru |
| `UPDATE` | Cari row berdasarkan `id`, update isinya |
| `DELETE` (soft delete) | Cari row berdasarkan `id`, tandai/hapus dari sheet |

Edge Function bertugas mapping payload ke format row Google Sheets (join manual ke nama kategori/payment method jika perlu).

**Fallback: Full Resync**
Jika terjadi desync (misal webhook gagal), sediakan Edge Function `full-resync-sheets` yang:
1. Hapus semua data di sheet
2. Query seluruh transaksi aktif (`WHERE deleted_at IS NULL`) dari database
3. Tulis ulang ke sheet

Bisa dipanggil manual via tombol di dashboard atau API endpoint.

## 6. Seed Data Awal (opsional)

```sql
insert into payment_methods (name) values
  ('Cash'), ('Transfer Bank'), ('QRIS'), ('E-Wallet');

insert into categories (name, type) values
  ('Gaji', 'income'), ('Bonus', 'income'), ('Saldo Awal', 'income'), ('Lainnya', 'income'),
  ('Makan', 'expense'), ('Transport', 'expense'), ('Tagihan', 'expense'),
  ('Belanja Rumah Tangga', 'expense'), ('Lainnya', 'expense');
```
