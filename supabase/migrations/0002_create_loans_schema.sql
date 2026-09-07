-- 0002_create_loans_schema.sql
-- Create loans and loan_payments tables for tracking receivables (piutang) and payables (hutang)

-- 1. Create loans table
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
  person_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  holder TEXT NOT NULL CHECK (holder IN ('cash_suami', 'atm_suami', 'cash_istri', 'atm_istri', 'suami', 'istri')),
  payment_method_id UUID REFERENCES payment_methods(id),
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 2. Create loan_payments table
CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  holder TEXT NOT NULL CHECK (holder IN ('cash_suami', 'atm_suami', 'cash_istri', 'atm_istri', 'suami', 'istri')),
  payment_method_id UUID REFERENCES payment_methods(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_type ON loans(type);
CREATE INDEX IF NOT EXISTS idx_loans_active ON loans(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_active ON loan_payments(deleted_at) WHERE deleted_at IS NULL;

-- Trigger to update updated_at on loans
CREATE OR REPLACE TRIGGER trg_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- Allow read for anon (consistent with other tables)
CREATE POLICY "allow read loans" ON loans FOR SELECT USING (true);
CREATE POLICY "allow read loan_payments" ON loan_payments FOR SELECT USING (true);

-- Allow write for service role
CREATE POLICY "allow insert loans via service role" ON loans FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "allow update loans via service role" ON loans FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "allow delete loans via service role" ON loans FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "allow insert loan_payments via service role" ON loan_payments FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "allow update loan_payments via service role" ON loan_payments FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "allow delete loan_payments via service role" ON loan_payments FOR DELETE USING (auth.role() = 'service_role');
