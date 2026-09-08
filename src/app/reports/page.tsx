'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  Share2,
  Copy,
  Download,
  CheckCircle2,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Banknote,
  Target,
  HandCoins,
  PiggyBank,
  FileText,
  Sparkles,
  Loader2,
  Check,
  ChevronDown,
  Scale,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatIDR, formatHolder } from '@/lib/utils';
import { Transaction, Category, PaymentMethod, SavingGoal, Loan, SalaryCyclePeriod } from '@/lib/types';
import {
  formatIndonesianDate,
  detectSalaryCycles,
  isDateWithinRange,
  isLoanTransaction,
} from '@/lib/salaryCycle';
import {
  generateWhatsAppReportMessage,
  downloadTransactionsCSV,
  ReportSummaryData,
} from '@/lib/reportUtils';
import { useToast } from '@/components/Toast';

type PeriodPreset = 'this_month' | 'last_month' | 'salary_cycle' | 'custom';

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [savingGoals, setSavingGoals] = useState<SavingGoal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

  // Filter States
  const [preset, setPreset] = useState<PeriodPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);

  // Print Option: include full transactions appendix
  const [includeTransactionsAppendix, setIncludeTransactionsAppendix] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Current YYYY-MM
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastYM = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [
        { data: trxs },
        { data: cats },
        { data: goals },
        { data: loansData },
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, categories(name, monthly_budget), payment_methods(name)')
          .is('deleted_at', null)
          .order('trx_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('saving_goals').select('*').is('deleted_at', null),
        supabase.from('loans').select('*').is('deleted_at', null),
      ]);

      if (trxs) setTransactions(trxs as Transaction[]);
      if (cats) setCategories(cats as Category[]);
      if (goals) setSavingGoals(goals as SavingGoal[]);
      if (loansData) setLoans(loansData as Loan[]);
    } catch (err: any) {
      console.error('Error fetching report data:', err);
      showToast('Gagal memuat data laporan', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute detected salary cycles
  const salaryCycles = useMemo(() => {
    return detectSalaryCycles(transactions);
  }, [transactions]);

  // Set default custom dates
  useEffect(() => {
    if (!customStartDate) {
      setCustomStartDate(`${currentYM}-01`);
      setCustomEndDate(new Date().toISOString().split('T')[0]);
    }
  }, [currentYM, customStartDate]);

  // Resolve Active Date Range & Period Label
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (preset === 'this_month') {
      const start = `${currentYM}-01`;
      const end = new Date().toISOString().split('T')[0];
      const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now);
      return {
        startDate: start,
        endDate: end,
        periodLabel: `${monthName} (Bulan Ini)`,
      };
    }

    if (preset === 'last_month') {
      const start = `${lastYM}-01`;
      const lastDay = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate();
      const end = `${lastYM}-${String(lastDay).padStart(2, '0')}`;
      const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(lastMonthDate);
      return {
        startDate: start,
        endDate: end,
        periodLabel: `${monthName} (Bulan Lalu)`,
      };
    }

    if (preset === 'salary_cycle' && salaryCycles.length > 0) {
      const cycle = salaryCycles[selectedCycleIndex] || salaryCycles[0];
      return {
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        periodLabel: `Siklus Gajian: ${cycle.label}`,
      };
    }

    // Custom
    return {
      startDate: customStartDate,
      endDate: customEndDate,
      periodLabel: `Rentang: ${formatIndonesianDate(customStartDate)} s/d ${formatIndonesianDate(customEndDate)}`,
    };
  }, [preset, currentYM, lastYM, salaryCycles, selectedCycleIndex, customStartDate, customEndDate]);

  // Filter transactions within the selected period
  const periodTransactions = useMemo(() => {
    return transactions.filter((t) => isDateWithinRange(t.trx_date, startDate, endDate));
  }, [transactions, startDate, endDate]);

  // Compute Financial Aggregates
  const reportData: ReportSummaryData = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let omzetBenangbaju = 0;

    periodTransactions.forEach((t) => {
      const amt = Number(t.amount || 0);
      const catName = t.categories?.name || '';

      if (t.type === 'income' && !isLoanTransaction(t)) {
        totalIncome += amt;
        if (catName === 'Benangbaju') {
          omzetBenangbaju += amt;
        }
      } else if (t.type === 'expense' && !isLoanTransaction(t)) {
        totalExpense += amt;
      }
    });

    const netSavings = totalIncome - totalExpense;
    const savingsRatePct = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

    // Balances per Account (All-Time Cumulative)
    const calcAccountBalance = (key: string, legacyKey?: string) => {
      return transactions.reduce((sum, t) => {
        const isHolder = t.holder === key || (legacyKey && t.holder === legacyKey);
        const isFromHolder = t.from_holder === key || (legacyKey && t.from_holder === legacyKey);

        if (t.type === 'income' && isHolder) return sum + Number(t.amount);
        if (t.type === 'expense' && isHolder) return sum - Number(t.amount);
        if (t.type === 'transfer') {
          if (isFromHolder) return sum - Number(t.amount);
          if (isHolder) return sum + Number(t.amount);
        }
        return sum;
      }, 0);
    };

    const cashSuami = calcAccountBalance('cash_suami', 'suami');
    const atmSuami = calcAccountBalance('atm_suami');
    const cashIstri = calcAccountBalance('cash_istri', 'istri');
    const atmIstri = calcAccountBalance('atm_istri');
    const totalHouseholdBalance = cashSuami + atmSuami + cashIstri + atmIstri;

    const totalSavingsLocked = savingGoals.reduce(
      (acc, g) => acc + Number(g.current_amount || 0),
      0
    );
    const safeToSpend = totalHouseholdBalance - totalSavingsLocked;

    // Budget Calculations for period
    const catExpenseMap: Record<string, number> = {};
    periodTransactions
      .filter((t) => t.type === 'expense' && !isLoanTransaction(t))
      .forEach((t) => {
        const catName = t.categories?.name || 'Lainnya';
        catExpenseMap[catName] = (catExpenseMap[catName] || 0) + Number(t.amount);
      });

    const budgetedCategories = categories.filter(
      (c) => c.type === 'expense' && c.name !== 'Pinjaman' && Number(c.monthly_budget || 0) > 0
    );
    const totalBudget = budgetedCategories.reduce((acc, c) => acc + Number(c.monthly_budget || 0), 0);

    const overbudgetCategories: Array<{ name: string; spent: number; budget: number; excess: number }> = [];
    budgetedCategories.forEach((c) => {
      const spent = catExpenseMap[c.name] || 0;
      const b = Number(c.monthly_budget || 0);
      if (spent > b) {
        overbudgetCategories.push({
          name: c.name,
          spent,
          budget: b,
          excess: spent - b,
        });
      }
    });

    // Loans status
    let totalPiutangSisa = 0;
    let totalHutangSisa = 0;
    loans.forEach((l) => {
      const pokok = Number(l.total_amount || 0);
      const dibayar = Number(l.paid_amount || 0);
      const sisa = Math.max(0, pokok - dibayar);
      if (l.type === 'receivable') totalPiutangSisa += sisa;
      else if (l.type === 'payable') totalHutangSisa += sisa;
    });

    return {
      periodLabel,
      startDate,
      endDate,
      totalIncome,
      totalExpense,
      netSavings,
      savingsRatePct,
      omzetBenangbaju,
      cashSuami,
      atmSuami,
      cashIstri,
      atmIstri,
      totalHouseholdBalance,
      totalSavingsLocked,
      safeToSpend,
      totalBudget,
      overbudgetCategories,
      totalPiutangSisa,
      totalHutangSisa,
      transactionCount: periodTransactions.length,
    };
  }, [periodTransactions, transactions, categories, savingGoals, loans, periodLabel, startDate, endDate]);

  // Category breakdown rows for table
  const categoryBreakdownRows = useMemo(() => {
    const expenseMap: Record<string, number> = {};
    periodTransactions
      .filter((t) => t.type === 'expense' && !isLoanTransaction(t))
      .forEach((t) => {
        const catName = t.categories?.name || 'Lainnya';
        expenseMap[catName] = (expenseMap[catName] || 0) + Number(t.amount);
      });

    return Object.entries(expenseMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, spent]) => {
        const catObj = categories.find((c) => c.name === name);
        const budget = Number(catObj?.monthly_budget || 0);
        const sisa = budget > 0 ? budget - spent : null;
        const pct = budget > 0 ? Math.round((spent / budget) * 100) : null;
        const shareOfTotal = reportData.totalExpense > 0 ? Math.round((spent / reportData.totalExpense) * 100) : 0;
        return { name, spent, budget, sisa, pct, shareOfTotal };
      });
  }, [periodTransactions, categories, reportData.totalExpense]);

  // Actions
  const handlePrint = () => {
    window.print();
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppReportMessage(reportData);
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    showToast('Ringkasan laporan berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const text = generateWhatsAppReportMessage(reportData);
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleDownloadCSV = () => {
    const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadTransactionsCSV(`Laporan_Keuangan_${cleanPeriod}`, periodTransactions);
    showToast('File CSV berhasil diunduh', 'success');
  };

  const printDateWib = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  return (
    <main className="min-h-screen bg-background pb-32 print:bg-white print:p-0 print:m-0">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & FILTER BAR (Hidden on Print)             */}
      {/* ======================================================== */}
      <header className="print:hidden pt-8 pb-4 px-5 bg-surface/80 backdrop-blur-md sticky top-0 z-30 border-b border-foreground/10 dark:border-white/5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 -ml-2 rounded-full hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold leading-tight flex items-center gap-2">
                <FileText size={18} className="text-primary" /> Laporan Keuangan Keluarga
              </h1>
              <p className="text-[11px] text-text-muted">Ekspor Dokumen PDF, WhatsApp & Evaluasi Bulanan</p>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold shadow-md shadow-primary/20 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Printer size={15} />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Share2 size={14} />
              <span>Kirim ke WA</span>
            </button>
            <button
              onClick={handleCopyWhatsApp}
              className="p-2 rounded-xl bg-surface border border-foreground/15 dark:border-white/15 text-foreground hover:bg-surface-light active:scale-95 transition-all"
              title="Salin Ringkasan Teks"
            >
              {isCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            </button>
            <button
              onClick={handleDownloadCSV}
              className="p-2 rounded-xl bg-surface border border-foreground/15 dark:border-white/15 text-foreground hover:bg-surface-light active:scale-95 transition-all"
              title="Unduh Data CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Filter Presets Tabs */}
        <div className="max-w-4xl mx-auto mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setPreset('this_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              preset === 'this_month'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface border border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
            }`}
          >
            Bulan Ini
          </button>
          <button
            onClick={() => setPreset('last_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              preset === 'last_month'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface border border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
            }`}
          >
            Bulan Lalu
          </button>
          {salaryCycles.length > 0 && (
            <button
              onClick={() => setPreset('salary_cycle')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                preset === 'salary_cycle'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface border border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
              }`}
            >
              Siklus Gajian ({salaryCycles.length})
            </button>
          )}
          <button
            onClick={() => setPreset('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              preset === 'custom'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface border border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
            }`}
          >
            Rentang Bebas
          </button>
        </div>

        {/* Sub-selectors for Salary Cycle or Custom Date */}
        {preset === 'salary_cycle' && salaryCycles.length > 1 && (
          <div className="max-w-4xl mx-auto mt-2.5 flex items-center gap-2">
            <span className="text-[11px] text-text-muted font-medium">Pilih Siklus:</span>
            <select
              value={selectedCycleIndex}
              onChange={(e) => setSelectedCycleIndex(Number(e.target.value))}
              className="bg-surface border border-foreground/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              {salaryCycles.map((c, idx) => (
                <option key={idx} value={idx}>
                  {c.label} ({c.startDate} s/d {c.endDate})
                </option>
              ))}
            </select>
          </div>
        )}

        {preset === 'custom' && (
          <div className="max-w-4xl mx-auto mt-2.5 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-muted">Dari:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-surface border border-foreground/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-foreground"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-muted">Sampai:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-surface border border-foreground/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-foreground"
              />
            </div>
          </div>
        )}

        {/* Toggle include transactions appendix */}
        <div className="max-w-4xl mx-auto mt-3 flex items-center justify-between pt-2 border-t border-foreground/5 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            Periode aktif: <strong className="text-foreground">{periodLabel}</strong>
          </span>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeTransactionsAppendix}
              onChange={(e) => setIncludeTransactionsAppendix(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <span className="text-xs font-semibold text-foreground">
              Lampirkan Buku Transaksi Lengkap
            </span>
          </label>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. PRINT-READY A4 REPORT DOCUMENT CONTAINER               */}
      {/* ======================================================== */}
      <div className="p-4 sm:p-6 max-w-4xl mx-auto print:max-w-none print:p-0 print:m-0">
        {isLoading ? (
          <div className="p-16 text-center glass-panel rounded-3xl">
            <Loader2 className="animate-spin mx-auto text-primary mb-3" size={32} />
            <p className="text-sm font-semibold text-text-muted">Menyusun laporan keuangan...</p>
          </div>
        ) : (
          <article className="bg-surface dark:bg-[#12161f] text-foreground border border-foreground/10 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 print:bg-white print:text-black print:border-none print:shadow-none print:p-0 print:rounded-none">
            {/* Document Header (Kop Resmi) */}
            <div className="border-b-2 border-foreground/10 dark:border-white/10 pb-5 print:border-black/20 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-black text-sm print:border print:border-black/30">
                    RM
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight uppercase text-foreground print:text-black">
                      Laporan Keuangan Rumah Tangga
                    </h2>
                    <p className="text-xs text-text-muted print:text-gray-600 font-medium">
                      Keluarga Bahagia • Evaluasi Keuangan Suami & Istri
                    </p>
                  </div>
                </div>
              </div>

              <div className="sm:text-right text-xs text-text-muted print:text-gray-600 space-y-0.5">
                <p>
                  <strong className="text-foreground print:text-black">Periode:</strong>{' '}
                  <span className="font-semibold text-primary print:text-black">{periodLabel}</span>
                </p>
                <p>
                  Dicetak: <span className="font-medium">{printDateWib}</span>
                </p>
                <p>
                  Total Mutasi: <span className="font-medium">{reportData.transactionCount} transaksi</span>
                </p>
              </div>
            </div>

            {/* Section 1: Executive Cashflow KPI Cards */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted print:text-gray-700 mb-2.5 flex items-center gap-1.5">
                <Sparkles size={14} className="text-primary" /> 1. Ringkasan Eksekutif Arus Kas (Executive Summary)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total Pemasukan */}
                <div className="p-3.5 rounded-2xl bg-income/10 border border-income/20 print:bg-gray-50 print:border-gray-300">
                  <span className="text-[10px] uppercase font-bold text-income print:text-gray-600 block mb-0.5">
                    Total Pemasukan
                  </span>
                  <p className="text-lg font-black text-income print:text-black tracking-tight">
                    {formatIDR(reportData.totalIncome)}
                  </p>
                  {reportData.omzetBenangbaju > 0 && (
                    <p className="text-[9px] text-text-muted print:text-gray-600 mt-1">
                      Bisnis: {formatIDR(reportData.omzetBenangbaju)}
                    </p>
                  )}
                </div>

                {/* Total Pengeluaran */}
                <div className="p-3.5 rounded-2xl bg-expense/10 border border-expense/20 print:bg-gray-50 print:border-gray-300">
                  <span className="text-[10px] uppercase font-bold text-expense print:text-gray-600 block mb-0.5">
                    Total Pengeluaran
                  </span>
                  <p className="text-lg font-black text-expense print:text-black tracking-tight">
                    {formatIDR(reportData.totalExpense)}
                  </p>
                  <p className="text-[9px] text-text-muted print:text-gray-600 mt-1">Belanja & kebutuhan</p>
                </div>

                {/* Net Savings */}
                <div
                  className={`p-3.5 rounded-2xl border ${
                    reportData.netSavings >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/25 print:bg-gray-50 print:border-gray-300'
                      : 'bg-rose-500/10 border-rose-500/25 print:bg-gray-50 print:border-gray-300'
                  }`}
                >
                  <span
                    className={`text-[10px] uppercase font-bold block mb-0.5 ${
                      reportData.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400 print:text-gray-600' : 'text-rose-600 print:text-gray-600'
                    }`}
                  >
                    Sisa Arus Kas
                  </span>
                  <p
                    className={`text-lg font-black tracking-tight ${
                      reportData.netSavings >= 0
                        ? 'text-emerald-600 dark:text-emerald-400 print:text-black'
                        : 'text-rose-600 print:text-black'
                    }`}
                  >
                    {reportData.netSavings >= 0 ? '+' : ''}
                    {formatIDR(reportData.netSavings)}
                  </p>
                  <p className="text-[9px] font-bold mt-1 text-text-muted print:text-gray-600">
                    {reportData.netSavings >= 0 ? '🟢 Surplus Tabungan' : '🔴 Defisit Anggaran'}
                  </p>
                </div>

                {/* Savings Rate */}
                <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 print:bg-gray-50 print:border-gray-300">
                  <span className="text-[10px] uppercase font-bold text-primary print:text-gray-600 block mb-0.5">
                    Rasio Tabungan
                  </span>
                  <p className="text-lg font-black text-primary print:text-black tracking-tight">
                    {reportData.savingsRatePct}%
                  </p>
                  <p className="text-[9px] text-text-muted print:text-gray-600 mt-1">
                    {reportData.savingsRatePct >= 20 ? '✨ Ideal (≥ 20%)' : '💡 Usahakan ≥ 20%'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Posisi Likuiditas & 4 Dompet */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted print:text-gray-700 mb-2.5 flex items-center gap-1.5">
                <Wallet size={14} className="text-primary" /> 2. Posisi Saldo Kas & Rekening Bank (Liquidity Snapshot)
              </h3>

              <div className="overflow-hidden rounded-2xl border border-foreground/10 dark:border-white/10 print:border-gray-300">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-light dark:bg-white/5 print:bg-gray-100 font-bold border-b border-foreground/10 dark:border-white/10 print:border-gray-300">
                    <tr>
                      <th className="py-2.5 px-3">Dompet / Rekening</th>
                      <th className="py-2.5 px-3">Pemilik</th>
                      <th className="py-2.5 px-3 text-right">Saldo Riil Terkini (Rp)</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foreground/5 dark:divide-white/5 print:divide-gray-200">
                    <tr>
                      <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                        <Banknote size={14} className="text-emerald-500" /> Cash Suami
                      </td>
                      <td className="py-2 px-3 text-text-muted print:text-gray-600">Dompet Tunai</td>
                      <td className="py-2 px-3 text-right font-bold">{formatIDR(reportData.cashSuami)}</td>
                      <td className="py-2 px-3 text-right text-[10px] text-emerald-600 font-semibold">Aktif</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                        <CreditCard size={14} className="text-blue-500" /> ATM Suami
                      </td>
                      <td className="py-2 px-3 text-text-muted print:text-gray-600">Rekening Bank</td>
                      <td className="py-2 px-3 text-right font-bold">{formatIDR(reportData.atmSuami)}</td>
                      <td className="py-2 px-3 text-right text-[10px] text-blue-600 font-semibold">Aktif</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                        <Banknote size={14} className="text-pink-500" /> Cash Istri
                      </td>
                      <td className="py-2 px-3 text-text-muted print:text-gray-600">Dompet Tunai</td>
                      <td className="py-2 px-3 text-right font-bold">{formatIDR(reportData.cashIstri)}</td>
                      <td className="py-2 px-3 text-right text-[10px] text-pink-600 font-semibold">Aktif</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                        <CreditCard size={14} className="text-purple-500" /> ATM Istri
                      </td>
                      <td className="py-2 px-3 text-text-muted print:text-gray-600">Rekening Bank</td>
                      <td className="py-2 px-3 text-right font-bold">{formatIDR(reportData.atmIstri)}</td>
                      <td className="py-2 px-3 text-right text-[10px] text-purple-600 font-semibold">Aktif</td>
                    </tr>
                    {/* Total Row */}
                    <tr className="bg-surface-light/80 dark:bg-white/5 print:bg-gray-100 font-bold border-t border-foreground/10 print:border-gray-300">
                      <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider">
                        Total Saldo Rumah Tangga
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-sm text-primary print:text-black">
                        {formatIDR(reportData.totalHouseholdBalance)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[10px] font-bold">100% Klop</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Celengan & Safe-to-Spend Callout */}
              <div className="grid grid-cols-2 gap-3 mt-2.5 text-xs">
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 print:bg-gray-50 print:border-gray-300">
                  <span className="text-[10px] font-bold uppercase text-teal-700 dark:text-teal-400 print:text-gray-600 block">
                    🔒 Dana Terkunci Celengan / Tabungan
                  </span>
                  <p className="text-sm font-black text-teal-700 dark:text-teal-300 print:text-black mt-0.5">
                    {formatIDR(reportData.totalSavingsLocked)}
                  </p>
                  <p className="text-[10px] text-text-muted print:text-gray-600">
                    Alokasi dana darurat & rencana impian
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 print:bg-gray-50 print:border-gray-300">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 print:text-gray-600 block">
                    ✨ Saldo Bebas Belanja (Safe to Spend)
                  </span>
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 print:text-black mt-0.5">
                    {formatIDR(reportData.safeToSpend)}
                  </p>
                  <p className="text-[10px] text-text-muted print:text-gray-600">
                    Aman dipakai tanpa mengganggu tabungan
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Budgeting vs Realisasi Belanja */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted print:text-gray-700 flex items-center gap-1.5">
                  <Target size={14} className="text-primary" /> 3. Evaluasi Anggaran & Realisasi Belanja (Budget Performance)
                </h3>
                {reportData.totalBudget > 0 && (
                  <span className="text-[11px] font-semibold text-text-muted print:text-gray-600">
                    Target Total: {formatIDR(reportData.totalBudget)}
                  </span>
                )}
              </div>

              {categoryBreakdownRows.length === 0 ? (
                <p className="text-xs text-text-muted italic">Tidak ada transaksi pengeluaran pada periode ini.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-foreground/10 dark:border-white/10 print:border-gray-300">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-light dark:bg-white/5 print:bg-gray-100 font-bold border-b border-foreground/10 dark:border-white/10 print:border-gray-300">
                      <tr>
                        <th className="py-2.5 px-3">Kategori Pengeluaran</th>
                        <th className="py-2.5 px-3 text-right">Realisasi (Rp)</th>
                        <th className="py-2.5 px-3 text-right">Anggaran (Rp)</th>
                        <th className="py-2.5 px-3 text-right">Sisa / Selisih (Rp)</th>
                        <th className="py-2.5 px-3 text-right">% Porsi</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/5 dark:divide-white/5 print:divide-gray-200">
                      {categoryBreakdownRows.map((cat) => {
                        const isOver = cat.budget > 0 && cat.spent > cat.budget;
                        const isNear = cat.budget > 0 && cat.spent >= cat.budget * 0.85 && !isOver;

                        return (
                          <tr key={cat.name} className={isOver ? 'bg-rose-500/5 print:bg-red-50' : ''}>
                            <td className="py-2 px-3 font-semibold">{cat.name}</td>
                            <td className="py-2 px-3 text-right font-bold text-foreground print:text-black">
                              {formatIDR(cat.spent)}
                            </td>
                            <td className="py-2 px-3 text-right text-text-muted print:text-gray-600 font-medium">
                              {cat.budget > 0 ? formatIDR(cat.budget) : '-'}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-semibold ${
                                isOver
                                  ? 'text-rose-600'
                                  : cat.sisa !== null
                                  ? 'text-emerald-600'
                                  : 'text-text-muted'
                              }`}
                            >
                              {cat.sisa !== null
                                ? `${cat.sisa >= 0 ? '+' : ''}${formatIDR(cat.sisa)}`
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-text-muted print:text-gray-600">
                              {cat.shareOfTotal}%
                            </td>
                            <td className="py-2 px-3 text-right">
                              {isOver ? (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600">
                                  OVER
                                </span>
                              ) : isNear ? (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">
                                  HATI-HATI
                                </span>
                              ) : cat.budget > 0 ? (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">
                                  AMAN
                                </span>
                              ) : (
                                <span className="text-[10px] text-text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total Expense Summary Row */}
                      <tr className="bg-surface-light/80 dark:bg-white/5 print:bg-gray-100 font-bold border-t border-foreground/10 print:border-gray-300">
                        <td className="py-2.5 px-3 uppercase tracking-wider">Total Belanja Hidup</td>
                        <td className="py-2.5 px-3 text-right font-black text-sm text-expense print:text-black">
                          {formatIDR(reportData.totalExpense)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          {reportData.totalBudget > 0 ? formatIDR(reportData.totalBudget) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          {reportData.totalBudget > 0
                            ? `${reportData.totalBudget - reportData.totalExpense >= 0 ? '+' : ''}${formatIDR(
                                reportData.totalBudget - reportData.totalExpense
                              )}`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">100%</td>
                        <td className="py-2.5 px-3 text-right text-[10px] font-bold">
                          {reportData.totalBudget > 0 && reportData.totalExpense > reportData.totalBudget
                            ? 'OVER'
                            : 'TERKENDALI'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 4: Hutang & Piutang Berjalan */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted print:text-gray-700 mb-2.5 flex items-center gap-1.5">
                <HandCoins size={14} className="text-primary" /> 4. Posisi Hutang & Piutang (Liabilities & Receivables)
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 print:bg-gray-50 print:border-gray-300">
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 print:text-gray-600 block mb-0.5">
                    Piutang di Luar (Uang Kita yang Dipinjam)
                  </span>
                  <p className="text-base font-black text-amber-700 dark:text-amber-400 print:text-black">
                    {formatIDR(reportData.totalPiutangSisa)}
                  </p>
                  <p className="text-[10px] text-text-muted print:text-gray-600 mt-0.5">
                    Aktiva lancar yang menunggu tertagih
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-light border border-foreground/10 dark:border-white/10 print:bg-gray-50 print:border-gray-300">
                  <span className="text-[10px] uppercase font-bold text-text-muted print:text-gray-600 block mb-0.5">
                    Kewajiban Hutang ke Pihak Luar
                  </span>
                  <p className="text-base font-black text-foreground print:text-black">
                    {formatIDR(reportData.totalHutangSisa)}
                  </p>
                  <p className="text-[10px] text-text-muted print:text-gray-600 mt-0.5">
                    {reportData.totalHutangSisa === 0
                      ? '✨ Alhamdulillah, bebas dari hutang kewajiban'
                      : 'Kewajiban yang perlu dilunasi'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 5 (Optional): Lampiran Buku Transaksi Lengkap */}
            {includeTransactionsAppendix && (
              <div className="pt-2 print:break-before-page">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted print:text-gray-700 mb-2.5 flex items-center gap-1.5">
                  <FileText size={14} className="text-primary" /> 5. Lampiran Rincian Transaksi ({periodTransactions.length} Baris)
                </h3>

                <div className="overflow-hidden rounded-2xl border border-foreground/10 dark:border-white/10 print:border-gray-300">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-surface-light dark:bg-white/5 print:bg-gray-100 font-bold border-b border-foreground/10 print:border-gray-300">
                      <tr>
                        <th className="py-2 px-2.5">No</th>
                        <th className="py-2 px-2.5">Tanggal</th>
                        <th className="py-2 px-2.5">Kategori / Jenis</th>
                        <th className="py-2 px-2.5">Akun</th>
                        <th className="py-2 px-2.5">Catatan</th>
                        <th className="py-2 px-2.5 text-right">Nominal (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/5 dark:divide-white/5 print:divide-gray-200">
                      {periodTransactions.map((t, idx) => {
                        const isIncome = t.type === 'income';
                        const isTransfer = t.type === 'transfer';
                        return (
                          <tr key={t.id}>
                            <td className="py-1.5 px-2.5 text-text-muted print:text-gray-600">{idx + 1}</td>
                            <td className="py-1.5 px-2.5 whitespace-nowrap font-medium">{t.trx_date}</td>
                            <td className="py-1.5 px-2.5 font-semibold">
                              {isTransfer ? 'Transfer Internal' : t.categories?.name || 'Lainnya'}
                            </td>
                            <td className="py-1.5 px-2.5 text-text-muted print:text-gray-600">
                              {isTransfer
                                ? `${formatHolder(t.from_holder)} → ${formatHolder(t.holder)}`
                                : formatHolder(t.holder)}
                            </td>
                            <td className="py-1.5 px-2.5 text-text-muted print:text-gray-600 truncate max-w-[150px]">
                              {t.description || '-'}
                            </td>
                            <td
                              className={`py-1.5 px-2.5 text-right font-bold whitespace-nowrap ${
                                isIncome
                                  ? 'text-income print:text-black'
                                  : isTransfer
                                  ? 'text-sky-600 print:text-black'
                                  : 'text-foreground print:text-black'
                              }`}
                            >
                              {isIncome ? '+' : isTransfer ? '' : '-'}
                              {formatIDR(t.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Section 6: Lembar Pengesahan & Komitmen Keluarga */}
            <div className="pt-4 border-t border-dashed border-foreground/15 dark:border-white/10 print:border-gray-400 print:break-inside-avoid">
              <p className="text-[11px] text-text-muted print:text-gray-600 italic text-center mb-6">
                &ldquo;Pengelolaan keuangan yang jujur, transparan, dan teratur adalah fondasi keberkahan dan ketenangan rumah tangga.&rdquo;
              </p>

              <div className="grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <p className="font-semibold text-text-muted print:text-gray-700">Ditinjau oleh Suami,</p>
                  <div className="h-16 flex items-end justify-center">
                    <div className="w-32 border-b border-foreground/30 print:border-black border-dashed pb-1 font-bold">
                      ( Suami )
                    </div>
                  </div>
                  <p className="text-[10px] text-text-muted print:text-gray-600 mt-1">Tanggal: _______________</p>
                </div>

                <div>
                  <p className="font-semibold text-text-muted print:text-gray-700">Ditinjau oleh Istri,</p>
                  <div className="h-16 flex items-end justify-center">
                    <div className="w-32 border-b border-foreground/30 print:border-black border-dashed pb-1 font-bold">
                      ( Istri )
                    </div>
                  </div>
                  <p className="text-[10px] text-text-muted print:text-gray-600 mt-1">Tanggal: _______________</p>
                </div>
              </div>
            </div>
          </article>
        )}
      </div>

      {/* Global CSS for Print Layout */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm 12mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav, header.print\\:hidden, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-6 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-primary mb-2" size={28} />
          <p className="text-xs text-text-muted">Menyiapkan Laporan...</p>
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
