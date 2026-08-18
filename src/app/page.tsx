import { Wallet, CreditCard, Banknote } from 'lucide-react';
import { getServiceRoleClient } from '@/lib/supabase';

export const revalidate = 0; // Disable cache for MVP

export default async function Home() {
  const supabase = getServiceRoleClient();

  // Fetch all active transactions to calculate accurate balance per holder & total
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .is('deleted_at', null);

  const trxs = transactions || [];

  // Calculate total balance: sum(income) - sum(expense)
  const totalBalance = trxs.reduce((sum, t) => {
    if (t.type === 'income') return sum + Number(t.amount);
    if (t.type === 'expense') return sum - Number(t.amount);
    return sum;
  }, 0);

  // Helper to calculate balance per holder account key
  const calculateHolderBalance = (key: string, legacyKey?: string) => {
    return trxs.reduce((sum, t) => {
      const matchHolder = t.holder === key || (legacyKey && t.holder === legacyKey);
      const matchFromHolder = t.from_holder === key || (legacyKey && t.from_holder === legacyKey);

      if (t.type === 'income' && matchHolder) {
        return sum + Number(t.amount);
      }
      if (t.type === 'expense' && matchHolder) {
        return sum - Number(t.amount);
      }
      if (t.type === 'transfer') {
        if (matchFromHolder) sum -= Number(t.amount);
        if (matchHolder) sum += Number(t.amount);
      }
      return sum;
    }, 0);
  };

  const cashSuami = calculateHolderBalance('cash_suami', 'suami');
  const atmSuami = calculateHolderBalance('atm_suami');
  const cashIstri = calculateHolderBalance('cash_istri', 'istri');
  const atmIstri = calculateHolderBalance('atm_istri');

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const accounts = [
    { title: 'Cash Suami', amount: cashSuami, bgTint: 'bg-blue-500/10', icon: Banknote, iconColor: 'text-blue-400' },
    { title: 'ATM Suami', amount: atmSuami, bgTint: 'bg-indigo-500/10', icon: CreditCard, iconColor: 'text-indigo-400' },
    { title: 'Cash Istri', amount: cashIstri, bgTint: 'bg-pink-500/10', icon: Banknote, iconColor: 'text-pink-400' },
    { title: 'ATM Istri', amount: atmIstri, bgTint: 'bg-purple-500/10', icon: CreditCard, iconColor: 'text-purple-400' },
  ];

  return (
    <main className="min-h-screen p-5 pt-8 pb-24">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-sm text-text-muted font-medium mb-1">Total Rumah Tangga</h1>
          <div className="text-3xl font-bold text-gradient tracking-tight">
            {formatIDR(totalBalance)}
          </div>
        </div>
        <div className="bg-surface-light p-2.5 rounded-full border border-white/10">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
      </header>

      {/* Cash & ATM per Holder Cards (4 accounts) */}
      <section className="grid grid-cols-2 gap-4">
        {accounts.map((acc) => {
          const Icon = acc.icon;
          return (
            <div key={acc.title} className="glass-panel p-4 rounded-2xl relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-16 h-16 ${acc.bgTint} rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`} />
              <div className="flex items-center justify-between mb-2 relative z-10">
                <h2 className="text-xs text-text-muted font-medium">{acc.title}</h2>
                <Icon className={`w-4 h-4 ${acc.iconColor}`} />
              </div>
              <p className="text-lg font-bold text-white relative z-10">{formatIDR(acc.amount)}</p>
            </div>
          );
        })}
      </section>
    </main>
  );
}
