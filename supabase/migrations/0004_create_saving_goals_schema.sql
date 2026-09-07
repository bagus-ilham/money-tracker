-- 0004_create_saving_goals_schema.sql
-- Create saving_goals and saving_goal_logs tables for tracking saving goals and celengan impian

-- 1. Create saving_goals table
CREATE TABLE IF NOT EXISTS saving_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE,
  category TEXT NOT NULL DEFAULT 'Lainnya',
  holder TEXT NOT NULL DEFAULT 'Bersama',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 2. Create saving_goal_logs table
CREATE TABLE IF NOT EXISTS saving_goal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES saving_goals(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw')),
  holder TEXT NOT NULL DEFAULT 'Bersama',
  payment_method_id UUID REFERENCES payment_methods(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saving_goals_status ON saving_goals(status);
CREATE INDEX IF NOT EXISTS idx_saving_goals_active ON saving_goals(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saving_goal_logs_goal_id ON saving_goal_logs(goal_id);
CREATE INDEX IF NOT EXISTS idx_saving_goal_logs_active ON saving_goal_logs(deleted_at) WHERE deleted_at IS NULL;

-- Trigger to update updated_at on saving_goals
CREATE OR REPLACE TRIGGER trg_saving_goals_updated_at
  BEFORE UPDATE ON saving_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE saving_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE saving_goal_logs ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "allow read saving_goals" ON saving_goals FOR SELECT USING (true);
CREATE POLICY "allow read saving_goal_logs" ON saving_goal_logs FOR SELECT USING (true);

-- Write policies (service role & all access for server actions)
CREATE POLICY "allow insert saving_goals" ON saving_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "allow update saving_goals" ON saving_goals FOR UPDATE USING (true);
CREATE POLICY "allow delete saving_goals" ON saving_goals FOR DELETE USING (true);

CREATE POLICY "allow insert saving_goal_logs" ON saving_goal_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "allow update saving_goal_logs" ON saving_goal_logs FOR UPDATE USING (true);
CREATE POLICY "allow delete saving_goal_logs" ON saving_goal_logs FOR DELETE USING (true);
