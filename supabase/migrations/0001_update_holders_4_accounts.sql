-- Update holders constraint and view for 4 accounts (Cash Suami, ATM Suami, Cash Istri, ATM Istri)

-- 1. Drop old constraints on transactions table
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_holder_check;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_from_holder_check;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transfer_requires_from_holder;

-- 2. Add updated check constraints supporting 4 holders: cash_suami, atm_suami, cash_istri, atm_istri (and legacy suami, istri)
ALTER TABLE transactions ADD CONSTRAINT transactions_holder_check 
  CHECK (holder IN ('cash_suami', 'atm_suami', 'cash_istri', 'atm_istri', 'suami', 'istri'));

ALTER TABLE transactions ADD CONSTRAINT transactions_from_holder_check 
  CHECK (from_holder IS NULL OR from_holder IN ('cash_suami', 'atm_suami', 'cash_istri', 'atm_istri', 'suami', 'istri'));

ALTER TABLE transactions ADD CONSTRAINT transfer_requires_from_holder CHECK (
  (type = 'transfer' AND from_holder IS NOT NULL AND from_holder <> holder)
  OR (type <> 'transfer' AND from_holder IS NULL)
);

-- 3. Migrate existing transactions (if any)
UPDATE transactions SET holder = 'cash_suami' WHERE holder = 'suami';
UPDATE transactions SET holder = 'cash_istri' WHERE holder = 'istri';
UPDATE transactions SET from_holder = 'cash_suami' WHERE from_holder = 'suami';
UPDATE transactions SET from_holder = 'cash_istri' WHERE from_holder = 'istri';

-- 4. Update v_cash_per_holder view
CREATE OR REPLACE VIEW v_cash_per_holder AS
SELECT
  h.holder,
  COALESCE(SUM(CASE WHEN t.type = 'income' AND t.holder = h.holder THEN t.amount END), 0)
  - COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.holder = h.holder THEN t.amount END), 0)
  - COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.from_holder = h.holder THEN t.amount END), 0)
  + COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.holder = h.holder THEN t.amount END), 0)
    AS cash_balance
FROM (VALUES ('cash_suami'), ('atm_suami'), ('cash_istri'), ('atm_istri'), ('suami'), ('istri')) AS h(holder)
LEFT JOIN transactions t ON t.deleted_at IS NULL
GROUP BY h.holder;
