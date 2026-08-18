export type TrxType = 'income' | 'expense' | 'transfer';

export type HolderAccount = 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri';

export type LegacyHolderAccount = HolderAccount | 'suami' | 'istri';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string | null;
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
