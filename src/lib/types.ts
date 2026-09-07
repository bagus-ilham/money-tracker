export type TrxType = 'income' | 'expense' | 'transfer';

export type HolderAccount = 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri';

export type LegacyHolderAccount = HolderAccount | 'suami' | 'istri';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string | null;
  monthly_budget?: number | null;
  created_at?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  created_at?: string;
}

export interface Transaction {
  id: string;
  type: TrxType;
  amount: number;
  holder: LegacyHolderAccount;
  from_holder?: LegacyHolderAccount | null;
  category_id?: string | null;
  payment_method_id?: string | null;
  description?: string | null;
  trx_date: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  categories?: { name: string } | null;
  payment_methods?: { name: string } | null;
}

export type DateFilterPreset = 'today' | 'week' | 'month' | 'last_month' | 'salary_cycle' | 'custom' | 'all';

export interface DateRangeFilter {
  preset: DateFilterPreset;
  startDate: string;
  endDate: string;
  label: string;
  salaryCycleId?: string;
}

export interface SalaryCyclePeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  salaryAmount: number;
  isCurrent: boolean;
  description?: string;
}

export interface SalaryCycleStats {
  salaryAmount: number;
  totalExpense: number;
  remainingSalary: number;
  dailyExpenseAvg: number;
  daysInPeriod: number;
  daysElapsed: number;
}

export type LoanType = 'receivable' | 'payable';
export type LoanStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface Loan {
  id: string;
  type: LoanType;
  person_name: string;
  total_amount: number;
  paid_amount: number;
  holder: LegacyHolderAccount;
  payment_method_id?: string | null;
  loan_date: string;
  due_date?: string | null;
  description?: string | null;
  status: LoanStatus;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  payment_methods?: { name: string } | null;
  loan_payments?: LoanPayment[];
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  holder: LegacyHolderAccount;
  payment_method_id?: string | null;
  notes?: string | null;
  created_at?: string;
  deleted_at?: string | null;
  payment_methods?: { name: string } | null;
}

export type SavingGoalStatus = 'active' | 'completed' | 'paused';
export type SavingGoalLogType = 'deposit' | 'withdraw';

export interface SavingGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  category: string;
  holder: string;
  notes?: string | null;
  status: SavingGoalStatus;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  saving_goal_logs?: SavingGoalLog[];
}

export interface SavingGoalLog {
  id: string;
  goal_id: string;
  amount: number;
  type: SavingGoalLogType;
  holder: string;
  payment_method_id?: string | null;
  log_date: string;
  notes?: string | null;
  created_at?: string;
  deleted_at?: string | null;
  payment_methods?: { name: string } | null;
}
