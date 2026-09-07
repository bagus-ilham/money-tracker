'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  Tag,
  PieChart as PieChartIcon,
  Calendar,
  TrendingDown,
  TrendingUp,
  Wallet,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Target,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addCategory, updateCategory, deleteCategory, setCategoryBudget } from '@/app/actions';
import { useToast } from '@/components/Toast';
import CurrencyInput from '@/components/CurrencyInput';
import {
  Category,
  Transaction,
  DateRangeFilter,
  SalaryCyclePeriod,
  TrxType,
} from '@/lib/types';
import { formatIDR, formatHolder } from '@/lib/utils';
import {
  detectSalaryCycles,
  calculateSalaryCycleStats,
  getPresetDateRange,
  isDateWithinRange,
  isLoanTransaction,
} from '@/lib/salaryCycle';
import DateRangeModal from '@/components/DateRangeModal';

const PALETTE = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#84cc16', // lime
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f97316', // orange
  '#64748b', // slate
];

type MainTab = 'finance' | 'manage';

export default function Categories() {
  const { showToast } = useToast();
  const [mainTab, setMainTab] = useState<MainTab>('finance');
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date Filter State (default to current month)
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>(() => getPresetDateRange('month'));
  const [showDateModal, setShowDateModal] = useState(false);

  // Category Finance Type Toggle: 'expense' | 'income'
  const [viewType, setViewType] = useState<TrxType>('expense');

  // Accordion state: which category ID is expanded to view its transactions
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [newCatBudget, setNewCatBudget] = useState<number>(0);

  // Edit modal state
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatBudget, setEditCatBudget] = useState<number>(0);

  // Quick Set Budget modal state
  const [budgetModalCategory, setBudgetModalCategory] = useState<Category | null>(null);
  const [budgetInputAmount, setBudgetInputAmount] = useState<number>(0);

  // Delete modal state
  const [deleteCategoryItem, setDeleteCategoryItem] = useState<Category | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    const [{ data: catData }, { data: trxData }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase
        .from('transactions')
        .select('*, categories(name), payment_methods(name)')
        .is('deleted_at', null)
        .order('trx_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);

    if (catData) setCategories(catData as Category[]);
    if (trxData) setTransactions(trxData as Transaction[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute detected salary cycles
  const salaryCycles = useMemo(() => {
    return detectSalaryCycles(transactions);
  }, [transactions]);

  // Filter transactions by selected date range
  const filteredTrxs = useMemo(() => {
    return transactions.filter((t) => {
      if (dateFilter.preset === 'all') return true;
      return isDateWithinRange(t.trx_date, dateFilter.startDate, dateFilter.endDate);
    });
  }, [transactions, dateFilter]);

  // Financial Stats for selected period (living expenses and earned income only)
  const totalIncomeInPeriod = useMemo(() => {
    return filteredTrxs
      .filter((t) => t.type === 'income' && !isLoanTransaction(t))
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [filteredTrxs]);

  const totalExpenseInPeriod = useMemo(() => {
    return filteredTrxs
      .filter((t) => t.type === 'expense' && !isLoanTransaction(t))
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [filteredTrxs]);

  const netBalanceInPeriod = totalIncomeInPeriod - totalExpenseInPeriod;

  // Active Salary Cycle Stats (if salary cycle preset is active)
  const activeCycleStats = useMemo(() => {
    if (dateFilter.preset !== 'salary_cycle') return null;
    const currentCycle = salaryCycles.find(
      (c) =>
        c.id === dateFilter.salaryCycleId ||
        (c.startDate === dateFilter.startDate && c.endDate === dateFilter.endDate)
    );
    if (!currentCycle) return null;
    return calculateSalaryCycleStats(currentCycle, transactions);
  }, [dateFilter, salaryCycles, transactions]);

  // Aggregate by Category for the selected viewType (excluding loan disbursements/repayments)
  const categoryStats = useMemo(() => {
    const relevantTrxs = filteredTrxs.filter(
      (t) => t.type === viewType && !isLoanTransaction(t)
    );
    const totalAmount = relevantTrxs.reduce((sum, t) => sum + Number(t.amount), 0);

    const map: Record<
      string,
      {
        id: string;
        name: string;
        amount: number;
        count: number;
        transactions: Transaction[];
      }
    > = {};

    relevantTrxs.forEach((t) => {
      const catId = t.category_id || 'uncategorized';
      const catName = t.categories?.name || 'Tanpa Kategori';

      if (!map[catId]) {
        map[catId] = {
          id: catId,
          name: catName,
          amount: 0,
          count: 0,
          transactions: [],
        };
      }
      map[catId].amount += Number(t.amount);
      map[catId].count += 1;
      map[catId].transactions.push(t);
    });

    const list = Object.values(map).map((item, idx) => {
      const percentage = totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0;
      return {
        ...item,
        percentage,
        color: PALETTE[idx % PALETTE.length],
      };
    });

    list.sort((a, b) => b.amount - a.amount);
    return { list, totalAmount };
  }, [filteredTrxs, viewType]);

  // Overall Household Budget Statistics for Expense Categories
  const overallBudgetStats = useMemo(() => {
    const expenseCategoriesWithBudget = categories.filter(
      (c) => c.type === 'expense' && c.name !== 'Pinjaman' && Number(c.monthly_budget || 0) > 0
    );
    const totalBudget = expenseCategoriesWithBudget.reduce(
      (sum, c) => sum + Number(c.monthly_budget || 0),
      0
    );

    let budgetedExpense = 0;
    let overbudgetCount = 0;

    categoryStats.list.forEach((cat) => {
      const catObj = categories.find((c) => c.id === cat.id);
      const budget = Number(catObj?.monthly_budget || 0);
      if (budget > 0) {
        budgetedExpense += cat.amount;
        if (cat.amount > budget) overbudgetCount++;
      }
    });

    const totalExpense = categoryStats.totalAmount;
    const overallPct = totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0;
    const remainingBudget = totalBudget - totalExpense;

    return {
      totalBudget,
      totalExpense,
      budgetedExpense,
      overallPct,
      remainingBudget,
      overbudgetCount,
      hasBudgetSet: totalBudget > 0,
      budgetedCategoriesCount: expenseCategoriesWithBudget.length,
    };
  }, [categories, categoryStats]);

  // Donut chart calculations (pure computation, no variable mutation during render)
  const chartSegments = useMemo(() => {
    const { list, totalAmount } = categoryStats;
    if (list.length === 0 || totalAmount <= 0) return [];

    const size = 160;
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let offsetAcc = 0;
    return list.map((item) => {
      const percentageDecimal = item.amount / totalAmount;
      const strokeDasharray = `${percentageDecimal * circumference} ${circumference}`;
      const strokeDashoffset = -offsetAcc;
      offsetAcc += percentageDecimal * circumference;

      return {
        id: item.id,
        name: item.name,
        color: item.color,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [categoryStats]);

  // Handlers for Category CRUD & Budgeting
  const openBudgetModal = (category: Category) => {
    setBudgetModalCategory(category);
    setBudgetInputAmount(Number(category.monthly_budget || 0));
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetModalCategory) return;

    setIsSubmitting(true);
    const result = await setCategoryBudget(budgetModalCategory.id, budgetInputAmount);

    if (result.success) {
      await fetchData();
      setBudgetModalCategory(null);
      showToast(`Anggaran "${budgetModalCategory.name}" berhasil disimpan`, 'success');
    } else {
      showToast('Gagal menyimpan anggaran: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsSubmitting(true);
    const budgetVal = newCatType === 'expense' ? newCatBudget : 0;
    const result = await addCategory(newCatName.trim(), newCatType, budgetVal);

    if (result.success && result.data) {
      setCategories([...categories, result.data as Category]);
      setShowAddModal(false);
      setNewCatName('');
      setNewCatBudget(0);
      showToast('Kategori berhasil ditambahkan', 'success');
    } else {
      showToast('Gagal menambahkan kategori: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory || !editCatName.trim()) return;

    setIsSubmitting(true);
    const budgetVal = editCategory.type === 'expense' ? editCatBudget : 0;
    const result = await updateCategory(editCategory.id, editCatName.trim(), budgetVal);

    if (result.success) {
      await fetchData();
      setEditCategory(null);
      setEditCatName('');
      setEditCatBudget(0);
      showToast('Kategori berhasil diperbarui & disinkronkan', 'success');
    } else {
      showToast('Gagal memperbarui kategori: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCategoryItem) return;

    setIsSubmitting(true);
    const result = await deleteCategory(deleteCategoryItem.id);

    if (result.success) {
      await fetchData();
      setDeleteCategoryItem(null);
      showToast('Kategori berhasil dihapus', 'success');
    } else {
      showToast('Gagal menghapus kategori: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const incomes = categories.filter((c) => c.type === 'income');
  const expenses = categories.filter((c) => c.type === 'expense');

  return (
    <main className="min-h-screen p-5 pt-8 relative pb-28">
      {/* Top Header */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 rounded-full hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Keuangan & Kategori</h1>
            <p className="text-xs text-text-muted mt-0.5 font-medium">
              Analisis pengeluaran, pemasukan & master kategori
            </p>
          </div>
        </div>

        {mainTab === 'finance' ? (
          <button
            onClick={() => setShowDateModal(true)}
            className="p-2.5 rounded-2xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="Filter Rentang Tanggal / Siklus Gajian"
          >
            <Calendar size={16} />
            <span className="hidden sm:inline">Filter Periode</span>
          </button>
        ) : (
          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors flex items-center gap-1 px-3 text-xs font-semibold"
          >
            <Plus size={16} /> Tambah
          </button>
        )}
      </header>

      {/* Main Tabs (Dual Mode) */}
      <div className="flex bg-surface-light p-1 rounded-2xl mb-5 border border-foreground/5 dark:border-white/5 text-xs font-bold">
        <button
          onClick={() => setMainTab('finance')}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            mainTab === 'finance'
              ? 'bg-primary text-white shadow-md'
              : 'text-text-muted hover:text-foreground'
          }`}
        >
          <PieChartIcon size={15} /> Keuangan per Kategori
        </button>
        <button
          onClick={() => setMainTab('manage')}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            mainTab === 'manage'
              ? 'bg-surface text-foreground shadow-sm border border-foreground/10 dark:border-white/10'
              : 'text-text-muted hover:text-foreground'
          }`}
        >
          <Tag size={15} /> Kelola Kategori ({categories.length})
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-primary w-8 h-8" />
        </div>
      ) : mainTab === 'finance' ? (
        /* TAB 1: KEUANGAN PER KATEGORI */
        <div className="space-y-4">
          {/* Active Date Filter Bar Button */}
          <button
            onClick={() => setShowDateModal(true)}
            className="w-full p-3 rounded-2xl bg-surface border border-foreground/10 dark:border-white/5 flex items-center justify-between hover:border-primary/50 transition-all text-left shadow-sm group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 group-hover:scale-105 transition-transform">
                {dateFilter.preset === 'salary_cycle' ? <DollarSign size={16} /> : <Calendar size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Periode Terpilih
                </p>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">
                  {dateFilter.label}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-primary px-3 py-1 bg-primary/10 rounded-xl shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
              Ubah
            </span>
          </button>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="glass-panel p-3 rounded-2xl">
              <div className="flex items-center gap-1.5 text-income mb-1">
                <TrendingUp size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Masuk</span>
              </div>
              <p className="text-xs font-black text-income truncate">{formatIDR(totalIncomeInPeriod)}</p>
            </div>

            <div className="glass-panel p-3 rounded-2xl">
              <div className="flex items-center gap-1.5 text-expense mb-1">
                <TrendingDown size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Keluar</span>
              </div>
              <p className="text-xs font-black text-expense truncate">{formatIDR(totalExpenseInPeriod)}</p>
            </div>

            <div className="glass-panel p-3 rounded-2xl">
              <div className="flex items-center gap-1.5 text-primary mb-1">
                <Wallet size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Sisa Net</span>
              </div>
              <p
                className={`text-xs font-black truncate ${
                  netBalanceInPeriod >= 0 ? 'text-primary' : 'text-expense'
                }`}
              >
                {formatIDR(netBalanceInPeriod)}
              </p>
            </div>
          </div>

          {/* Special Salary Cycle Health Banner */}
          {activeCycleStats && (
            <div className="glass-panel p-4 rounded-3xl border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-surface to-surface relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500 text-white rounded-lg">
                    <DollarSign size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-foreground">Analisis Siklus Gajian</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  Hari ke-{activeCycleStats.daysElapsed}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-foreground/5 dark:border-white/5 text-xs">
                <div>
                  <p className="text-[10px] text-text-muted font-medium">Gaji Masuk</p>
                  <p className="font-bold text-income">{formatIDR(activeCycleStats.salaryAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted font-medium">Sisa Uang Gaji</p>
                  <p
                    className={`font-black ${
                      activeCycleStats.remainingSalary >= 0 ? 'text-emerald-500' : 'text-expense'
                    }`}
                  >
                    {formatIDR(activeCycleStats.remainingSalary)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted font-medium">Pengeluaran Terpakai</p>
                  <p className="font-bold text-expense">{formatIDR(activeCycleStats.totalExpense)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted font-medium">Rata-rata Harian</p>
                  <p className="font-bold text-foreground">
                    {formatIDR(activeCycleStats.dailyExpenseAvg)}/hari
                  </p>
                </div>
              </div>

              {/* Progress bar of salary spent */}
              {activeCycleStats.salaryAmount > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className="text-text-muted">Gaji Terpakai</span>
                    <span
                      className={
                        activeCycleStats.totalExpense > activeCycleStats.salaryAmount
                          ? 'text-expense'
                          : 'text-foreground'
                      }
                    >
                      {Math.round(
                        (activeCycleStats.totalExpense / activeCycleStats.salaryAmount) * 100
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-surface-light h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        activeCycleStats.totalExpense > activeCycleStats.salaryAmount
                          ? 'bg-expense'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (activeCycleStats.totalExpense / activeCycleStats.salaryAmount) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* View Type Toggle (Pengeluaran vs Pemasukan) */}
          <div className="flex bg-surface-light p-1 rounded-2xl border border-foreground/5 dark:border-white/5">
            <button
              onClick={() => {
                setViewType('expense');
                setExpandedCategoryId(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                viewType === 'expense'
                  ? 'bg-expense text-white shadow-md'
                  : 'text-text-muted hover:text-foreground'
              }`}
            >
              Pengeluaran per Kategori
            </button>
            <button
              onClick={() => {
                setViewType('income');
                setExpandedCategoryId(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                viewType === 'income'
                  ? 'bg-income text-white shadow-md'
                  : 'text-text-muted hover:text-foreground'
              }`}
            >
              Pemasukan per Kategori
            </button>
          </div>

          {/* Overall Budgeting Card (when viewing Expenses) */}
          {viewType === 'expense' && (
            <div className="glass-panel p-4 rounded-3xl mb-4 border border-foreground/10 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Target size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Anggaran Belanja Bulanan
                    </h3>
                    <p className="text-[11px] text-text-muted">
                      {overallBudgetStats.hasBudgetSet
                        ? `${overallBudgetStats.budgetedCategoriesCount} Kategori Diberi Batas Anggaran`
                        : 'Belum ada target anggaran bulanan'}
                    </p>
                  </div>
                </div>

                {overallBudgetStats.hasBudgetSet && (
                  <span
                    className={`text-[11px] font-extrabold px-2.5 py-1 rounded-xl ${
                      overallBudgetStats.overallPct >= 100
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : overallBudgetStats.overallPct >= 75
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {overallBudgetStats.overallPct}% Terpakai
                  </span>
                )}
              </div>

              {overallBudgetStats.hasBudgetSet ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-surface-light/50 border border-foreground/5 dark:border-white/5 text-center">
                    <div>
                      <p className="text-[10px] text-text-muted">Target Budget</p>
                      <p className="text-xs font-bold text-foreground mt-0.5 truncate">
                        {formatIDR(overallBudgetStats.totalBudget)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-muted">Realisasi Belanja</p>
                      <p className="text-xs font-bold text-expense mt-0.5 truncate">
                        {formatIDR(overallBudgetStats.totalExpense)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-muted">
                        {overallBudgetStats.remainingBudget >= 0 ? 'Sisa Anggaran' : 'Overbudget'}
                      </p>
                      <p
                        className={`text-xs font-bold mt-0.5 truncate ${
                          overallBudgetStats.remainingBudget >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatIDR(Math.abs(overallBudgetStats.remainingBudget))}
                      </p>
                    </div>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="w-full bg-surface-light h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        overallBudgetStats.overallPct >= 100
                          ? 'bg-rose-500'
                          : overallBudgetStats.overallPct >= 75
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, overallBudgetStats.overallPct)}%` }}
                    />
                  </div>

                  {/* Overbudget Alert if any */}
                  {overallBudgetStats.overbudgetCount > 0 && (
                    <div className="flex items-center gap-2 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-medium">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>
                        Perhatian: Terdapat <strong>{overallBudgetStats.overbudgetCount} kategori</strong> yang telah melebihi batas anggaran!
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-surface-light/40 rounded-xl text-xs text-text-muted flex items-center justify-between">
                  <span>Tetapkan batas belanja pada kategori agar pengeluaran terkontrol.</span>
                  <span className="text-primary font-bold">Atur di bawah ↓</span>
                </div>
              )}
            </div>
          )}

          {/* Donut Chart & Category Breakdown Card */}
          <div className="glass-panel p-5 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                {viewType === 'expense' ? 'Total Pengeluaran' : 'Total Pemasukan'}
              </h2>
              <span
                className={`text-xs font-extrabold px-2.5 py-1 rounded-xl ${
                  viewType === 'expense'
                    ? 'bg-expense/15 text-expense'
                    : 'bg-income/15 text-income'
                }`}
              >
                {formatIDR(categoryStats.totalAmount)}
              </span>
            </div>

            {categoryStats.list.length === 0 ? (
              <div className="text-center py-8 text-xs text-text-muted">
                Belum ada transaksi {viewType === 'expense' ? 'pengeluaran' : 'pemasukan'} pada periode ini.
              </div>
            ) : (
              <div>
                {/* SVG Donut */}
                <div className="flex justify-center mb-6">
                  <div className="relative flex items-center justify-center">
                    <svg width={160} height={160} viewBox="0 0 160 160" className="-rotate-90">
                      <circle
                        cx={80}
                        cy={80}
                        r={68}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth={24}
                        className="text-surface-light"
                      />
                      {chartSegments.map((seg) => (
                        <circle
                          key={seg.id}
                          cx={80}
                          cy={80}
                          r={68}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth={24}
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          strokeLinecap="round"
                          className="transition-all duration-500 hover:opacity-80"
                        />
                      ))}
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none select-none">
                      <span className="text-[10px] text-text-muted font-medium">Kategori</span>
                      <span className="text-base font-black text-foreground">
                        {categoryStats.list.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ranked Category Items */}
                <div className="space-y-3">
                  <p className="text-[11px] text-text-muted font-medium">
                    Ketuk kategori untuk melihat rincian transaksi:
                  </p>

                  {categoryStats.list.map((cat, idx) => {
                    const isExpanded = expandedCategoryId === cat.id;
                    const categoryObj = categories.find((c) => c.id === cat.id);
                    const monthlyBudget = Number(categoryObj?.monthly_budget || 0);
                    const hasBudget = monthlyBudget > 0;
                    const budgetPct = hasBudget ? Math.round((cat.amount / monthlyBudget) * 100) : 0;
                    const remaining = monthlyBudget - cat.amount;
                    const isOverbudget = hasBudget && remaining < 0;
                    const isWarning = hasBudget && !isOverbudget && budgetPct >= 75;

                    return (
                      <div
                        key={cat.id}
                        className={`rounded-2xl border bg-surface transition-all overflow-hidden ${
                          isOverbudget
                            ? 'border-rose-500/40 dark:border-rose-500/30'
                            : isWarning
                            ? 'border-amber-500/40 dark:border-amber-500/30'
                            : 'border-foreground/10 dark:border-white/5 hover:border-foreground/20 dark:hover:border-white/10'
                        }`}
                      >
                        {/* Header Item */}
                        <div
                          onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-surface-light/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: cat.color }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs truncate">{cat.name}</span>
                                <span className="text-[10px] text-text-muted font-semibold shrink-0">
                                  #{idx + 1}
                                </span>
                                {isOverbudget && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                                    OVERBUDGET
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-text-muted mt-0.5">
                                {cat.count} Transaksi • {Math.round(cat.percentage)}%
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <div className="text-right">
                              <p className="font-extrabold text-xs text-foreground">
                                {formatIDR(cat.amount)}
                              </p>
                              {viewType === 'expense' && hasBudget && (
                                <p className="text-[10px] text-text-muted mt-0.5">
                                  dari {formatIDR(monthlyBudget)}
                                </p>
                              )}
                            </div>
                            <div className="text-text-muted p-1 rounded-lg">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* Budget Status and Bar for Expense */}
                        {viewType === 'expense' && (
                          <div className="px-3.5 pb-3 pt-0">
                            {hasBudget ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`font-extrabold ${
                                        isOverbudget
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : isWarning
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      {budgetPct}%
                                    </span>
                                    <span className="text-text-muted">
                                      {isOverbudget
                                        ? `(Over +${formatIDR(Math.abs(remaining))})`
                                        : `(Sisa ${formatIDR(remaining)})`}
                                    </span>
                                  </div>
                                  {categoryObj && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openBudgetModal(categoryObj);
                                      }}
                                      className="text-text-muted hover:text-primary transition-colors flex items-center gap-1 font-medium text-[10px]"
                                    >
                                      <Edit2 size={11} /> Ubah Budget
                                    </button>
                                  )}
                                </div>

                                <div className="w-full bg-surface-light h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 rounded-full ${
                                      isOverbudget
                                        ? 'bg-rose-500'
                                        : isWarning
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(100, budgetPct)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between text-[10px] text-text-muted pt-1">
                                <span>Belum ada batas anggaran</span>
                                {categoryObj && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openBudgetModal(categoryObj);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-bold transition-colors flex items-center gap-1"
                                  >
                                    <Plus size={11} /> Atur Budget
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Normal Category Distribution bar for Income */}
                        {viewType === 'income' && (
                          <div className="w-full bg-surface-light h-1">
                            <div
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${cat.percentage}%`,
                                backgroundColor: cat.color,
                              }}
                            />
                          </div>
                        )}

                        {/* Accordion Content: List of Transactions */}
                        {isExpanded && (
                          <div className="p-3.5 bg-surface-light/40 border-t border-foreground/5 dark:border-white/5 space-y-2 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-text-muted mb-1 px-1">
                              <span>Daftar Transaksi ({cat.transactions.length})</span>
                              <span>Nominal</span>
                            </div>

                            {cat.transactions.map((trx) => (
                              <div
                                key={trx.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-surface border border-foreground/5 dark:border-white/5 text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-semibold text-foreground truncate">
                                    {trx.description || cat.name}
                                  </p>
                                  <p className="text-[10px] text-text-muted mt-0.5">
                                    {trx.trx_date}
                                    {trx.payment_methods?.name ? ` • ${trx.payment_methods.name}` : ''}
                                    {` • ${formatHolder(trx.holder)}`}
                                  </p>
                                </div>
                                <span
                                  className={`font-bold shrink-0 text-xs ${
                                    trx.type === 'expense' ? 'text-foreground' : 'text-income'
                                  }`}
                                >
                                  {trx.type === 'expense' ? '-' : '+'}
                                  {formatIDR(trx.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB 2: KELOLA KATEGORI (CRUD) */
        <div className="space-y-6">
          {/* Income Categories */}
          <section>
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-1">
              Kategori Pemasukan ({incomes.length})
            </h2>
            <div className="glass-panel rounded-2xl divide-y divide-foreground/5 dark:divide-white/5 overflow-hidden">
              {incomes.length === 0 ? (
                <div className="p-4 text-sm text-text-muted text-center">
                  Belum ada kategori pemasukan.
                </div>
              ) : (
                incomes.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 flex items-center justify-between hover:bg-foreground/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Tag size={15} className="text-income" />
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditCategory(cat);
                          setEditCatName(cat.name);
                        }}
                        className="p-2 text-text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors"
                        title="Edit Kategori"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteCategoryItem(cat)}
                        className="p-2 text-expense/70 hover:text-expense rounded-lg hover:bg-expense/10 transition-colors"
                        title="Hapus Kategori"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Expense Categories */}
          <section>
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-1">
              Kategori Pengeluaran ({expenses.length})
            </h2>
            <div className="glass-panel rounded-2xl divide-y divide-foreground/5 dark:divide-white/5 overflow-hidden">
              {expenses.length === 0 ? (
                <div className="p-4 text-sm text-text-muted text-center">
                  Belum ada kategori pengeluaran.
                </div>
              ) : (
                expenses.map((cat) => {
                  const budgetVal = Number(cat.monthly_budget || 0);

                  return (
                    <div
                      key={cat.id}
                      className="p-4 flex items-center justify-between hover:bg-foreground/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Tag size={15} className="text-expense shrink-0" />
                          <span className="text-sm font-medium truncate">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-6">
                          {budgetVal > 0 ? (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              Target: {formatIDR(budgetVal)} / bln
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-muted">
                              Tanpa batas anggaran
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openBudgetModal(cat)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
                          title="Atur Anggaran"
                        >
                          <Target size={14} />
                          <span className="hidden sm:inline">Anggaran</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditCategory(cat);
                            setEditCatName(cat.name);
                            setEditCatBudget(Number(cat.monthly_budget || 0));
                          }}
                          className="p-2 text-text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors"
                          title="Edit Kategori"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteCategoryItem(cat)}
                          className="p-2 text-expense/70 hover:text-expense rounded-lg hover:bg-expense/10 transition-colors"
                          title="Hapus Kategori"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* Date Range Modal */}
      <DateRangeModal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        currentFilter={dateFilter}
        onSelectFilter={(newFilter) => setDateFilter(newFilter)}
        salaryCycles={salaryCycles}
      />

      {/* Quick Set Budget Modal */}
      {budgetModalCategory && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button
              onClick={() => setBudgetModalCategory(null)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-primary/15 text-primary">
                <Target size={18} />
              </div>
              <h2 className="text-lg font-bold">Atur Batas Anggaran</h2>
            </div>
            <p className="text-xs text-text-muted mb-5">
              Tentukan target batas belanja bulanan untuk kategori{' '}
              <strong className="text-foreground">{budgetModalCategory.name}</strong>.
            </p>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Batas Anggaran Bulanan (Rp)
                </label>
                <CurrencyInput
                  value={budgetInputAmount}
                  onChange={(val) => setBudgetInputAmount(val)}
                  placeholder="0"
                  autoFocus
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-text-muted w-full font-medium mb-0.5">Preset Cepat:</span>
                {[200000, 500000, 1000000, 1500000, 2000000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBudgetInputAmount(preset)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                      budgetInputAmount === preset
                        ? 'bg-primary text-white border-primary font-bold shadow-sm'
                        : 'bg-surface-light border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
                    }`}
                  >
                    {formatIDR(preset)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBudgetInputAmount(0)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    budgetInputAmount === 0
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold'
                      : 'bg-surface-light border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
                  }`}
                >
                  Hapus Anggaran (Rp 0)
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Anggaran & Sync'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Tambah Kategori Baru</h2>

            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Tipe Kategori</label>
                <div className="flex bg-surface-light p-1 rounded-xl border border-foreground/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setNewCatType('expense')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      newCatType === 'expense'
                        ? 'bg-expense text-white shadow-md'
                        : 'text-text-muted hover:text-foreground'
                    }`}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCatType('income')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      newCatType === 'income'
                        ? 'bg-income text-white shadow-md'
                        : 'text-text-muted hover:text-foreground'
                    }`}
                  >
                    Pemasukan
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Nama Kategori</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-text-muted/50 text-foreground"
                  placeholder="Cth: Belanja Harian"
                  required
                  autoFocus
                />
              </div>

              {newCatType === 'expense' && (
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Target Anggaran Bulanan (Opsional)
                  </label>
                  <CurrencyInput
                    value={newCatBudget}
                    onChange={(val) => setNewCatBudget(val)}
                    placeholder="0 (Tanpa batas)"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl mt-2 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Kategori'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editCategory && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button
              onClick={() => setEditCategory(null)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Edit Kategori</h2>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Nama Kategori</label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
                  required
                  autoFocus
                />
              </div>

              {editCategory.type === 'expense' && (
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Target Anggaran Bulanan (Rp)
                  </label>
                  <CurrencyInput
                    value={editCatBudget}
                    onChange={(val) => setEditCatBudget(val)}
                    placeholder="0 (Tanpa batas)"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl mt-2 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Perubahan & Sync Sheets'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {deleteCategoryItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <h2 className="text-lg font-bold mb-2">Hapus Kategori</h2>
            <p className="text-sm text-text-muted mb-6">
              Apakah Anda yakin ingin menghapus kategori{' '}
              <span className="font-bold text-foreground">&quot;{deleteCategoryItem.name}&quot;</span>?
            </p>

            <div className="space-y-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="w-full bg-expense/10 text-expense border border-expense/20 hover:bg-expense/20 font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Ya, Hapus Kategori'}
              </button>
              <button
                onClick={() => setDeleteCategoryItem(null)}
                className="w-full text-text-muted hover:text-foreground py-2 text-sm font-semibold"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
