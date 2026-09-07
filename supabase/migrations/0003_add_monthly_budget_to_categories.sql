-- 0003_add_monthly_budget_to_categories.sql
-- Add monthly_budget column to categories table for category budgeting (budget vs actual)

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC DEFAULT 0 CHECK (monthly_budget >= 0);

COMMENT ON COLUMN categories.monthly_budget IS 'Target batas anggaran belanja bulanan untuk kategori ini (dalam Rupiah). 0 berarti tidak ada batas khusus.';
