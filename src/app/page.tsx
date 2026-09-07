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
  HandCoins,
  Target,
  AlertTriangle,
  PiggyBank,
} from 'lucide-react';
import { getServiceRoleClient } from '@/lib/supabase';
import { formatIDR, formatHolder } from '@/lib/utils';
import { Transaction } from '@/lib/types';
import { isLoanTransaction } from '@/lib/salaryCycle';
import ExpenseChart, { CategoryExpenseItem } from '@/components/ExpenseChart';

export const revalidate = 0; // Real-time dashboard

export default async function Home() {
  const supabase = getServiceRoleClient();

  // Fetch all active transactions, unsettled loans, categories, and saving goals
  const [
    { data: transactions },
    { data: activeLoans },
    { data: categoriesData },
    { data: savingGoalsData },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, categories(name), payment_methods(name)')
      .is('deleted_at', null)
      .order('trx_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('loans')
      .select('*')
      .is('deleted_at', null)
      .neq('status', 'paid'),
    supabase
      .from('categories')
      .select('*')
      .order('name'),
    supabase
      .from('saving_goals')
      .select('*')
      .is('deleted_at', null),
  ]);

  const totalReceivableUnpaid = (activeLoans || [])
    .filter((l: any) => l.type === 'receivable')
    .reduce((sum: number, l: any) => sum + Math.max(0, Number(l.total_amount) - Number(l.paid_amount)), 0);

  const receivableCount = (activeLoans || []).filter(
    (l: any) => l.type === 'receivable' && Number(l.total_amount) > Number(l.paid_amount)
  ).length;

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
    .filter((t) => t.type === 'income' && !isLoanTransaction(t))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenseThisMonth = thisMonthTrxs
    .filter((t) => t.type === 'expense' && !isLoanTransaction(t))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Group current month living expenses by category for chart (excluding loan disbursements)
  const categoryExpenseMap: Record<string, number> = {};
  thisMonthTrxs
    .filter((t) => t.type === 'expense' && !isLoanTransaction(t))
    .forEach((t) => {
      const catName = t.categories?.name || 'Lainnya';
      categoryExpenseMap[catName] = (categoryExpenseMap[catName] || 0) + Number(t.amount);
    });

  const categoryExpenses: CategoryExpenseItem[] = Object.entries(categoryExpenseMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Calculate Monthly Budgeting Stats for Home Widget
  const expenseCategoriesWithBudget = (categoriesData || []).filter(
    (c: any) => c.type === 'expense' && c.name !== 'Pinjaman' && Number(c.monthly_budget || 0) > 0
  );

  const totalMonthlyBudget = expenseCategoriesWithBudget.reduce(
    (sum: number, c: any) => sum + Number(c.monthly_budget || 0),
    0
  );

  const overbudgetCategories: Array<{ name: string; amount: number; budget: number; excess: number }> = [];

  expenseCategoriesWithBudget.forEach((c: any) => {
    const spent = categoryExpenseMap[c.name] || 0;
    const b = Number(c.monthly_budget || 0);
    if (spent > b) {
      overbudgetCategories.push({
        name: c.name,
        amount: spent,
        budget: b,
        excess: spent - b,
      });
    }
  });

  const overallBudgetPct =
    totalMonthlyBudget > 0 ? Math.round((totalExpenseThisMonth / totalMonthlyBudget) * 100) : 0;
  const remainingTotalBudget = totalMonthlyBudget - totalExpenseThisMonth;

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

  // Savings metrics
  const totalSavingsLocked = (savingGoalsData || []).reduce(
    (sum: number, g: any) => sum + Number(g.current_amount || 0),
    0
  );
  const safeToSpend = totalBalance - totalSavingsLocked;
  const totalSavingsTarget = (savingGoalsData || []).reduce(
    (sum: number, g: any) => sum + Number(g.target_amount || 0),
    0
  );
  const activeGoalsCount = (savingGoalsData || []).length;

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
      <header className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-xs text-text-muted font-semibold tracking-wider uppercase mb-1">
            Total Saldo Rumah Tangga
          </h1>
          <div className="text-3xl font-extrabold text-gradient tracking-tight">
            {formatIDR(totalBalance)}
          </div>
          {totalSavingsLocked > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                🟢 Bebas: {formatIDR(safeToSpend)}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-text-muted bg-surface-light px-2 py-0.5 rounded-lg border border-foreground/5">
                🔒 Celengan: {formatIDR(totalSavingsLocked)}
              </span>
            </div>
          )}
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
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className={`p-1.5 rounded-lg ${acc.bgTint}`}>
                  <Icon size={16} className={acc.iconColor} />
                </div>
                <span className="text-xs font-medium text-text-muted">{acc.title}</span>
              </div>
              <p className="text-base font-bold text-foreground relative z-10">{formatIDR(acc.amount)}</p>
            </div>
          );
        })}
      </section>

      {/* Active Receivables / Loans Banner */}
      {totalReceivableUnpaid > 0 && (
        <Link
          href="/loans"
          className="glass-panel p-3.5 rounded-2xl mb-4 flex items-center justify-between border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-surface to-surface hover:border-amber-500/40 transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <HandCoins size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Piutang Belum Tertagih
              </p>
              <p className="text-xs font-black text-foreground truncate mt-0.5">
                {formatIDR(totalReceivableUnpaid)} • {receivableCount} Orang
              </p>
            </div>
          </div>
          <span className="text-xs text-primary font-bold flex items-center gap-0.5 shrink-0 ml-2">
            Lihat <ChevronRight size={14} />
          </span>
        </Link>
      )}

      {/* Celengan & Target Tabungan Widget */}
      <Link
        href="/savings"
        className="glass-panel p-3.5 rounded-2xl mb-4 flex items-center justify-between border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-surface to-surface hover:border-emerald-500/40 transition-all group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
            <PiggyBank size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Target Tabungan & Celengan
              </p>
              {totalSavingsTarget > 0 && (
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 px-1.5 py-0.2 rounded-md">
                  {Math.min(100, Math.round((totalSavingsLocked / totalSavingsTarget) * 100))}%
                </span>
              )}
            </div>
            <p className="text-xs font-black text-foreground truncate mt-0.5">
              {formatIDR(totalSavingsLocked)}{' '}
              <span className="font-medium text-text-muted">
                {activeGoalsCount > 0
                  ? `terkumpul • ${activeGoalsCount} celengan`
                  : 'Mulai rencanakan tabungan impian'}
              </span>
            </p>
          </div>
        </div>
        <span className="text-xs text-primary font-bold flex items-center gap-0.5 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">
          Buka <ChevronRight size={14} />
        </span>
      </Link>

      {/* Monthly Budget Summary Widget */}
      {totalMonthlyBudget > 0 && (
        <Link
          href="/categories"
          className="glass-panel p-4 rounded-2xl mb-6 block border border-foreground/10 dark:border-white/10 hover:border-primary/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Target size={16} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Anggaran Belanja ({monthName})
              </span>
            </div>
            <span className="text-xs text-primary font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Kelola <ChevronRight size={14} />
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div>
              <span className="text-lg font-extrabold text-foreground">
                {formatIDR(totalExpenseThisMonth)}
              </span>
              <span className="text-xs text-text-muted font-medium ml-1">
                / {formatIDR(totalMonthlyBudget)}
              </span>
            </div>
            <span
              className={`text-xs font-extrabold px-2 py-0.5 rounded-lg ${
                overallBudgetPct >= 100
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : overallBudgetPct >= 75
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {overallBudgetPct}%
            </span>
          </div>

          <div className="w-full bg-surface-light h-2 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                overallBudgetPct >= 100
                  ? 'bg-rose-500'
                  : overallBudgetPct >= 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, overallBudgetPct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">
              {remainingTotalBudget >= 0
                ? `Sisa Anggaran: ${formatIDR(remainingTotalBudget)}`
                : `Overbudget: +${formatIDR(Math.abs(remainingTotalBudget))}`}
            </span>
            {overbudgetCategories.length > 0 && (
              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                <AlertTriangle size={12} /> {overbudgetCategories.length} Kategori Melebihi Limit
              </span>
            )}
          </div>
        </Link>
      )}

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
