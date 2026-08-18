import Link from 'next/link';
import {
  Wallet,
  CreditCard,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { getServiceRoleClient } from '@/lib/supabase';
import { formatIDR, formatHolder } from '@/lib/utils';
import { Transaction } from '@/lib/types';
import ExpenseChart, { CategoryExpenseItem } from '@/components/ExpenseChart';

export const revalidate = 0; // Real-time dashboard

export default async function Home() {
  const supabase = getServiceRoleClient();

  // Fetch all active transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, categories(name), payment_methods(name)')
    .is('deleted_at', null)
    .order('trx_date', { ascending: false })
    .order('created_at', { ascending: false });

  const trxs: Transaction[] = (transactions as Transaction[]) || [];

  // Calculate total balance: sum(income) - sum(expense)
  const totalBalance = trxs.reduce((sum, t) => {
    if (t.type === 'income') return sum + Number(t.amount);
    if (t.type === 'expense') return sum - Number(t.amount);
    return sum;
  }, 0);

  // Calculate this month's stats
  const currentYearMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
  const thisMonthTrxs = trxs.filter((t) => t.trx_date && t.trx_date.startsWith(currentYearMonth));

  const totalIncomeThisMonth = thisMonthTrxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenseThisMonth = thisMonthTrxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Group current month expenses by category for chart
  const categoryExpenseMap: Record<string, number> = {};
  thisMonthTrxs
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const catName = t.categories?.name || 'Lainnya';
      categoryExpenseMap[catName] = (categoryExpenseMap[catName] || 0) + Number(t.amount);
    });

  const categoryExpenses: CategoryExpenseItem[] = Object.entries(categoryExpenseMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

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

  const accounts = [
    { title: 'Cash Suami', amount: cashSuami, bgTint: 'bg-blue-500/10', icon: Banknote, iconColor: 'text-blue-500' },
    { title: 'ATM Suami', amount: atmSuami, bgTint: 'bg-indigo-500/10', icon: CreditCard, iconColor: 'text-indigo-500' },
    { title: 'Cash Istri', amount: cashIstri, bgTint: 'bg-pink-500/10', icon: Banknote, iconColor: 'text-pink-500' },
    { title: 'ATM Istri', amount: atmIstri, bgTint: 'bg-purple-500/10', icon: CreditCard, iconColor: 'text-purple-500' },
  ];

  const recentTransactions = trxs.slice(0, 8);

  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date());

  return (
    <main className="min-h-screen p-5 pt-8 pb-28">
      {/* Header Total Balance */}
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xs text-text-muted font-semibold tracking-wider uppercase mb-1">
            Total Saldo Rumah Tangga
          </h1>
          <div className="text-3xl font-extrabold text-gradient tracking-tight">
            {formatIDR(totalBalance)}
          </div>
        </div>
        <div className="bg-surface-light p-3 rounded-2xl border border-foreground/10 dark:border-white/10 shadow-sm">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
      </header>

      {/* Monthly Summary Mini Stats */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass-panel p-3.5 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-income/15 text-income shrink-0">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider truncate">
              Masuk ({monthName})
            </p>
            <p className="text-xs font-bold text-income truncate mt-0.5">{formatIDR(totalIncomeThisMonth)}</p>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-expense/15 text-expense shrink-0">
            <TrendingDown size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider truncate">
              Keluar ({monthName})
            </p>
            <p className="text-xs font-bold text-expense truncate mt-0.5">{formatIDR(totalExpenseThisMonth)}</p>
          </div>
        </div>
      </section>

      {/* Cash & ATM per Holder Cards (4 accounts) */}
      <section className="grid grid-cols-2 gap-3.5 mb-6">
        {accounts.map((acc) => {
          const Icon = acc.icon;
          return (
            <div key={acc.title} className="glass-panel p-4 rounded-2xl relative overflow-hidden group">
              <div
                className={`absolute top-0 right-0 w-16 h-16 ${acc.bgTint} rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}
              />
              <div className="flex items-center justify-between mb-2 relative z-10">
                <h2 className="text-xs text-text-muted font-medium">{acc.title}</h2>
                <Icon className={`w-4 h-4 ${acc.iconColor}`} />
              </div>
              <p className="text-base font-bold text-foreground relative z-10">{formatIDR(acc.amount)}</p>
            </div>
          );
        })}
      </section>

      {/* Expense Donut Chart Section */}
      <ExpenseChart
        data={categoryExpenses}
        totalExpense={totalExpenseThisMonth}
        monthName={monthName}
      />

      {/* Recent Transactions Section */}
      <section>
        <div className="flex items-center justify-between mb-3.5 px-1">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Transaksi Terbaru</h2>
          <Link
            href="/history"
            className="text-xs text-primary hover:text-primary-dark font-semibold flex items-center gap-0.5 transition-colors"
          >
            Lihat Semua <ChevronRight size={14} />
          </Link>
        </div>

        <div className="space-y-2.5">
          {recentTransactions.length === 0 ? (
            <div className="glass-panel rounded-2xl p-6 text-center text-sm text-text-muted">
              Belum ada transaksi. Klik tombol <span className="font-semibold text-primary">+</span> di bawah untuk mulai mencatat.
            </div>
          ) : (
            recentTransactions.map((trx) => (
              <Link
                key={trx.id}
                href="/history"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-foreground/10 dark:border-white/5 hover:bg-surface-light active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      trx.type === 'income'
                        ? 'bg-income/15 text-income'
                        : trx.type === 'expense'
                        ? 'bg-expense/15 text-expense'
                        : 'bg-transfer/15 text-transfer'
                    }`}
                  >
                    {trx.type === 'income' ? (
                      <ArrowDownRight size={18} strokeWidth={2.5} />
                    ) : trx.type === 'expense' ? (
                      <ArrowUpRight size={18} strokeWidth={2.5} />
                    ) : (
                      <ArrowRightLeft size={18} strokeWidth={2.5} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {trx.type === 'transfer' ? 'Transfer Internal' : trx.categories?.name || 'Lainnya'}
                    </p>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {trx.trx_date}
                      {trx.payment_methods?.name ? ` • ${trx.payment_methods.name}` : ''}
                      {trx.description ? ` • ${trx.description}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <p
                    className={`font-bold text-sm ${
                      trx.type === 'income'
                        ? 'text-income'
                        : trx.type === 'expense'
                        ? 'text-foreground'
                        : 'text-transfer'
                    }`}
                  >
                    {trx.type === 'income' ? '+' : trx.type === 'expense' ? '-' : ''}
                    {formatIDR(trx.amount)}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wider font-medium">
                    {trx.type === 'transfer'
                      ? `${formatHolder(trx.from_holder)} → ${formatHolder(trx.holder)}`
                      : formatHolder(trx.holder)}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
