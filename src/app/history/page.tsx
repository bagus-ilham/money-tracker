'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Filter,
  X,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  Search,
  Calendar,
  Tag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { deleteTransaction, updateTransaction } from '@/app/actions';
import { useToast } from '@/components/Toast';
import CurrencyInput from '@/components/CurrencyInput';
import { formatIDR, formatHolder, HOLDER_OPTIONS } from '@/lib/utils';
import {
  Transaction,
  Category,
  PaymentMethod,
  HolderAccount,
  TrxType,
  DateRangeFilter,
} from '@/lib/types';
import {
  detectSalaryCycles,
  isDateWithinRange,
  getPresetDateRange,
  isLoanTransaction,
} from '@/lib/salaryCycle';
import DateRangeModal from '@/components/DateRangeModal';

type FilterType = 'all' | 'income' | 'expense' | 'transfer';
type HolderFilterType = 'all' | HolderAccount;

export default function History() {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [holderFilter, setHolderFilter] = useState<HolderFilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Unified Date Range Filter (Default: Bulan Ini)
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>(() => getPresetDateRange('month'));
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editForm, setEditForm] = useState<{
    description: string;
    category_id: string;
    payment_method_id: string;
    holder: HolderAccount;
    from_holder: HolderAccount;
    trx_date: string;
  }>({
    description: '',
    category_id: '',
    payment_method_id: '',
    holder: 'cash_suami',
    from_holder: 'atm_suami',
    trx_date: '',
  });

  const fetchTransactions = async () => {
    setIsLoading(true);
    const [{ data: trxData }, { data: catData }, { data: pmData }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(name), payment_methods(name)')
        .is('deleted_at', null)
        .order('trx_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
      supabase.from('payment_methods').select('*').order('name'),
    ]);

    if (trxData) setTransactions(trxData as Transaction[]);
    if (catData) setCategories(catData as Category[]);
    if (pmData) setPaymentMethods(pmData as PaymentMethod[]);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Compute detected salary cycles
  const salaryCycles = useMemo(() => {
    return detectSalaryCycles(transactions);
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((trx) => {
      // 1. Type Match
      const matchType = activeFilter === 'all' ? true : trx.type === activeFilter;

      // 2. Date Match
      const matchDate =
        dateFilter.preset === 'all'
          ? true
          : isDateWithinRange(trx.trx_date, dateFilter.startDate, dateFilter.endDate);

      // 3. Holder Match
      const matchHolder =
        holderFilter === 'all'
          ? true
          : trx.holder === holderFilter ||
            trx.from_holder === holderFilter ||
            (holderFilter === 'cash_suami' && (trx.holder === 'suami' || trx.from_holder === 'suami')) ||
            (holderFilter === 'cash_istri' && (trx.holder === 'istri' || trx.from_holder === 'istri'));

      // 4. Category Match
      const matchCategory =
        categoryFilter === 'all' ? true : trx.category_id === categoryFilter;

      // 5. Search Match
      const matchSearch =
        !q ||
        (trx.description && trx.description.toLowerCase().includes(q)) ||
        (trx.categories?.name && trx.categories.name.toLowerCase().includes(q)) ||
        (trx.payment_methods?.name && trx.payment_methods.name.toLowerCase().includes(q)) ||
        trx.amount.toString().includes(q) ||
        (trx.type === 'transfer' && 'transfer internal'.includes(q)) ||
        formatHolder(trx.holder).toLowerCase().includes(q) ||
        (trx.from_holder && formatHolder(trx.from_holder).toLowerCase().includes(q));

      return matchType && matchDate && matchHolder && matchCategory && matchSearch;
    });
  }, [transactions, activeFilter, dateFilter, holderFilter, categoryFilter, searchQuery]);

  // Mini summary of filtered transactions (living expenses and earned income)
  const summaryStats = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter((t) => t.type === 'income' && !isLoanTransaction(t))
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = filteredTransactions
      .filter((t) => t.type === 'expense' && !isLoanTransaction(t))
      .reduce((s, t) => s + Number(t.amount), 0);
    return { totalIncome, totalExpense };
  }, [filteredTransactions]);

  const handleDelete = async () => {
    if (!selectedTrx) return;
    setIsSubmitting(true);
    const res = await deleteTransaction(selectedTrx.id);
    if (res.success) {
      await fetchTransactions();
      showToast('Transaksi berhasil dihapus', 'success');
    } else {
      showToast('Gagal menghapus transaksi: ' + (res.error || 'Terjadi kesalahan'), 'error');
    }
    setShowDeleteConfirmModal(false);
    setSelectedTrx(null);
    setIsSubmitting(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrx) return;

    if (!editAmount || editAmount <= 0) {
      showToast('Nominal harus lebih dari 0', 'error');
      return;
    }

    if (selectedTrx.type === 'transfer' && editForm.from_holder === editForm.holder) {
      showToast('Pengirim dan penerima transfer tidak boleh sama', 'error');
      return;
    }

    setIsSubmitting(true);

    const updatePayload = {
      amount: editAmount,
      description: editForm.description.trim() || undefined,
      category_id: selectedTrx.type !== 'transfer' ? editForm.category_id || null : null,
      payment_method_id: editForm.payment_method_id || null,
      holder: editForm.holder,
      from_holder: selectedTrx.type === 'transfer' ? editForm.from_holder : null,
      trx_date: editForm.trx_date,
    };

    const res = await updateTransaction(selectedTrx.id, updatePayload);

    if (res.success) {
      await fetchTransactions();
      showToast('Transaksi berhasil diperbarui', 'success');
      setIsEditing(false);
      setSelectedTrx(null);
    } else {
      showToast('Gagal memperbarui transaksi: ' + (res.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const openOptions = (trx: Transaction) => {
    setSelectedTrx(trx);
    const normalizedHolder =
      trx.holder === 'suami' ? 'cash_suami' : trx.holder === 'istri' ? 'cash_istri' : trx.holder || 'cash_suami';
    const normalizedFromHolder =
      trx.from_holder === 'suami'
        ? 'cash_suami'
        : trx.from_holder === 'istri'
        ? 'cash_istri'
        : trx.from_holder || 'atm_suami';

    setEditAmount(Number(trx.amount) || 0);
    setEditForm({
      description: trx.description || '',
      category_id: trx.category_id || '',
      payment_method_id: trx.payment_method_id || '',
      holder: normalizedHolder as HolderAccount,
      from_holder: normalizedFromHolder as HolderAccount,
      trx_date: trx.trx_date || new Date().toISOString().split('T')[0],
    });
    setShowOptionsModal(true);
  };

  const hasActiveCustomFilters =
    dateFilter.preset !== 'month' ||
    categoryFilter !== 'all' ||
    holderFilter !== 'all' ||
    activeFilter !== 'all' ||
    searchQuery !== '';

  const handleResetFilters = () => {
    setDateFilter(getPresetDateRange('month'));
    setCategoryFilter('all');
    setHolderFilter('all');
    setActiveFilter('all');
    setSearchQuery('');
  };

  // Categories available for filter based on active type
  const filterCategories = useMemo(() => {
    if (activeFilter === 'income') return categories.filter((c) => c.type === 'income');
    if (activeFilter === 'expense') return categories.filter((c) => c.type === 'expense');
    return categories;
  }, [categories, activeFilter]);

  return (
    <main className="min-h-screen p-5 pt-8 relative pb-28">
      {/* Header */}
      <header className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Riwayat Transaksi</h1>
          <p className="text-xs text-text-muted mt-0.5 font-medium">
            {dateFilter.label}
            {` • ${filteredTransactions.length} Transaksi`}
          </p>
        </div>
        <button
          onClick={() => setShowFilterModal(true)}
          className={`p-2.5 rounded-2xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
            dateFilter.preset !== 'all'
              ? 'bg-primary/20 border-primary text-primary shadow-sm'
              : 'bg-surface-light border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
          }`}
          title="Filter Rentang Waktu / Siklus Gajian"
        >
          <Calendar size={16} />
          <span className="hidden sm:inline">Periode</span>
        </button>
      </header>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted select-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari transaksi, kategori, catatan, nominal..."
          className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl pl-9.5 pr-8 py-2.5 text-xs text-foreground placeholder:text-text-muted/60 focus:outline-none focus:border-primary transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Mini Summary of Filtered Items */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2.5 rounded-xl bg-surface border border-foreground/5 dark:border-white/5 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-income/15 text-income">
            <TrendingUp size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Total Masuk</p>
            <p className="text-xs font-bold text-income truncate">+{formatIDR(summaryStats.totalIncome)}</p>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-surface border border-foreground/5 dark:border-white/5 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-expense/15 text-expense">
            <TrendingDown size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Total Keluar</p>
            <p className="text-xs font-bold text-expense truncate">-{formatIDR(summaryStats.totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* Type Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeFilter === 'all'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface border border-foreground/10 dark:border-white/5 text-text-muted hover:text-foreground'
          }`}
        >
          Semua Tipe
        </button>
        <button
          onClick={() => setActiveFilter('income')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeFilter === 'income'
              ? 'bg-income text-white shadow-sm'
              : 'bg-surface border border-foreground/10 dark:border-white/5 text-text-muted hover:text-foreground'
          }`}
        >
          Pemasukan
        </button>
        <button
          onClick={() => setActiveFilter('expense')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeFilter === 'expense'
              ? 'bg-expense text-white shadow-sm'
              : 'bg-surface border border-foreground/10 dark:border-white/5 text-text-muted hover:text-foreground'
          }`}
        >
          Pengeluaran
        </button>
        <button
          onClick={() => setActiveFilter('transfer')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeFilter === 'transfer'
              ? 'bg-transfer text-white shadow-sm'
              : 'bg-surface border border-foreground/10 dark:border-white/5 text-text-muted hover:text-foreground'
          }`}
        >
          Transfer
        </button>
      </div>

      {/* Category Filter Chips (when not viewing only transfers) */}
      {activeFilter !== 'transfer' && filterCategories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              categoryFilter === 'all'
                ? 'bg-surface-light text-foreground border border-foreground/20 dark:border-white/20 font-bold'
                : 'bg-transparent text-text-muted hover:text-foreground border border-foreground/5 dark:border-white/5'
            }`}
          >
            <Tag size={12} /> Semua Kategori
          </button>
          {filterCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                categoryFilter === c.id
                  ? 'bg-primary/15 text-primary border border-primary/40 font-bold'
                  : 'bg-transparent text-text-muted hover:text-foreground border border-foreground/5 dark:border-white/5'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Holder Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-2 scrollbar-hide">
        <button
          onClick={() => setHolderFilter('all')}
          className={`px-3 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
            holderFilter === 'all'
              ? 'bg-surface-light text-foreground border border-foreground/20 dark:border-white/20 font-bold'
              : 'bg-transparent text-text-muted hover:text-foreground border border-foreground/5 dark:border-white/5'
          }`}
        >
          Semua Akun
        </button>
        {HOLDER_OPTIONS.map((h) => (
          <button
            key={h.value}
            onClick={() => setHolderFilter(h.value)}
            className={`px-3 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
              holderFilter === h.value
                ? 'bg-surface-light text-foreground border border-primary/50 font-bold'
                : 'bg-transparent text-text-muted hover:text-foreground border border-foreground/5 dark:border-white/5'
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      {/* Active Filter Pills Bar (Quick Reset) */}
      {hasActiveCustomFilters && (
        <div className="flex items-center justify-between p-2 px-3 mb-3 bg-surface-light/60 rounded-xl border border-foreground/5 dark:border-white/5 text-[11px]">
          <span className="text-text-muted font-medium truncate">
            Filter aktif: <span className="text-foreground font-semibold">{dateFilter.label}</span>
            {categoryFilter !== 'all' && (
              <span> • Kategori: {categories.find((c) => c.id === categoryFilter)?.name}</span>
            )}
            {holderFilter !== 'all' && <span> • Akun: {formatHolder(holderFilter)}</span>}
          </span>
          <button
            onClick={handleResetFilters}
            className="text-primary font-bold hover:underline shrink-0 ml-2"
          >
            Reset
          </button>
        </div>
      )}

      {/* Transactions List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary w-6 h-6" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-2xl p-6 text-text-muted text-sm">
            {searchQuery
              ? `Tidak ada hasil pencarian "${searchQuery}".`
              : 'Tidak ada transaksi untuk filter ini.'}
          </div>
        ) : (
          filteredTransactions.map((trx) => (
            <div
              key={trx.id}
              onClick={() => openOptions(trx)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-foreground/10 dark:border-white/5 active:bg-surface-light hover:border-foreground/20 dark:hover:border-white/10 transition-all cursor-pointer"
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
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {trx.type === 'transfer' ? 'Transfer' : trx.categories?.name || 'Lainnya'}
                    </p>
                    {isLoanTransaction(trx) && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                        Pinjaman
                      </span>
                    )}
                  </div>
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
            </div>
          ))
        )}
      </div>

      {/* Date Range Modal */}
      <DateRangeModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        currentFilter={dateFilter}
        onSelectFilter={(newFilter) => setDateFilter(newFilter)}
        salaryCycles={salaryCycles}
      />

      {/* Options Action Sheet Modal */}
      {showOptionsModal && selectedTrx && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setShowOptionsModal(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold mb-4 text-center">Opsi Transaksi</h2>
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  setShowOptionsModal(false);
                  setIsEditing(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                <Edit2 size={16} /> Edit Transaksi
              </button>
              <button
                onClick={() => {
                  setShowOptionsModal(false);
                  setShowDeleteConfirmModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold bg-expense/10 text-expense border border-expense/20 hover:bg-expense/20 transition-colors"
              >
                <Trash2 size={16} /> Hapus Transaksi
              </button>
              <button
                onClick={() => setShowOptionsModal(false)}
                className="w-full px-5 py-2.5 rounded-xl text-xs font-semibold text-text-muted hover:text-foreground"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-step Safe Delete Confirmation Modal */}
      {showDeleteConfirmModal && selectedTrx && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setShowDeleteConfirmModal(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-expense/15 text-expense rounded-2xl shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold">Konfirmasi Hapus</h2>
                <p className="text-xs text-text-muted">Transaksi ini akan dihapus dari riwayat.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-light border border-foreground/5 dark:border-white/5 my-4 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Nominal:</span>
                <span className="font-bold text-foreground">{formatIDR(selectedTrx.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Kategori / Tipe:</span>
                <span className="font-semibold text-foreground">
                  {selectedTrx.type === 'transfer' ? 'Transfer Internal' : selectedTrx.categories?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Tanggal:</span>
                <span className="text-foreground">{selectedTrx.trx_date}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="w-full bg-expense hover:bg-rose-600 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50 text-sm"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Ya, Hapus Sekarang'}
              </button>
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="w-full py-2.5 text-xs font-semibold text-text-muted hover:text-foreground text-center"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && selectedTrx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative my-8">
            <button
              onClick={() => setIsEditing(false)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Edit Transaksi</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Nominal</label>
                <CurrencyInput
                  value={editAmount}
                  onChange={(val) => setEditAmount(val)}
                  required
                />
              </div>

              {selectedTrx.type !== 'transfer' && (
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Kategori</label>
                  <select
                    value={editForm.category_id}
                    onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none appearance-none text-foreground"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories
                      .filter((c) => c.type === selectedTrx.type)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Holder / From Holder */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    {selectedTrx.type === 'transfer' ? 'Penerima' : 'Akun'}
                  </label>
                  <select
                    value={editForm.holder}
                    onChange={(e) => setEditForm({ ...editForm, holder: e.target.value as HolderAccount })}
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/5 rounded-xl px-3 py-3 text-xs focus:border-primary focus:outline-none appearance-none text-foreground"
                  >
                    {HOLDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTrx.type === 'transfer' ? (
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Pengirim</label>
                    <select
                      value={editForm.from_holder}
                      onChange={(e) => setEditForm({ ...editForm, from_holder: e.target.value as HolderAccount })}
                      className="w-full bg-surface-light border border-foreground/10 dark:border-white/5 rounded-xl px-3 py-3 text-xs focus:border-primary focus:outline-none appearance-none text-foreground"
                    >
                      {HOLDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Metode Bayar</label>
                    <select
                      value={editForm.payment_method_id}
                      onChange={(e) => setEditForm({ ...editForm, payment_method_id: e.target.value })}
                      className="w-full bg-surface-light border border-foreground/10 dark:border-white/5 rounded-xl px-3 py-3 text-xs focus:border-primary focus:outline-none appearance-none text-foreground"
                    >
                      <option value="">-- Bebas --</option>
                      {paymentMethods.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Tanggal</label>
                <input
                  type="date"
                  value={editForm.trx_date}
                  onChange={(e) => setEditForm({ ...editForm, trx_date: e.target.value })}
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Catatan</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none text-foreground placeholder:text-text-muted/50"
                  placeholder="Catatan transaksi..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-xl mt-2 flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
