'use client';

import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { deleteTransaction, updateTransaction } from '@/app/actions';
import { useToast } from '@/components/Toast';
import CurrencyInput from '@/components/CurrencyInput';
import { formatIDR, formatHolder, HOLDER_OPTIONS } from '@/lib/utils';
import { Transaction, Category, PaymentMethod, HolderAccount, TrxType } from '@/lib/types';

type FilterType = 'all' | 'income' | 'expense' | 'transfer';
type HolderFilterType = 'all' | HolderAccount;
type DateRangeType = 'all' | 'today' | 'week' | 'month';

export default function History() {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [holderFilter, setHolderFilter] = useState<HolderFilterType>('all');
  const [dateRange, setDateRange] = useState<DateRangeType>('today');
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

  const isDateInRange = (dateStr: string, range: DateRangeType) => {
    if (range === 'all') return true;
    const today = new Date().toISOString().split('T')[0];
    if (range === 'today') return dateStr === today;
    if (range === 'month') return dateStr.startsWith(today.substring(0, 7));
    if (range === 'week') {
      const d = new Date(dateStr);
      const t = new Date(today);
      const diffTime = Math.abs(t.getTime() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    return true;
  };

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((trx) => {
      const matchType = activeFilter === 'all' ? true : trx.type === activeFilter;
      const matchDate = trx.trx_date ? isDateInRange(trx.trx_date, dateRange) : true;
      const matchHolder =
        holderFilter === 'all'
          ? true
          : trx.holder === holderFilter ||
            trx.from_holder === holderFilter ||
            (holderFilter === 'cash_suami' && (trx.holder === 'suami' || trx.from_holder === 'suami')) ||
            (holderFilter === 'cash_istri' && (trx.holder === 'istri' || trx.from_holder === 'istri'));

      // Search match
      const matchSearch =
        !q ||
        (trx.description && trx.description.toLowerCase().includes(q)) ||
        (trx.categories?.name && trx.categories.name.toLowerCase().includes(q)) ||
        (trx.payment_methods?.name && trx.payment_methods.name.toLowerCase().includes(q)) ||
        trx.amount.toString().includes(q) ||
        (trx.type === 'transfer' && 'transfer internal'.includes(q)) ||
        formatHolder(trx.holder).toLowerCase().includes(q) ||
        (trx.from_holder && formatHolder(trx.from_holder).toLowerCase().includes(q));

      return matchType && matchDate && matchHolder && matchSearch;
    });
  }, [transactions, activeFilter, dateRange, holderFilter, searchQuery]);

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

    const updatePayload: any = {
      amount: editAmount,
      description: editForm.description.trim() || null,
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

  return (
    <main className="min-h-screen p-5 pt-8 relative pb-28">
      <header className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Riwayat Transaksi</h1>
          <p className="text-xs text-text-muted mt-0.5 font-medium">
            {dateRange === 'today'
              ? 'Hari Ini'
              : dateRange === 'week'
              ? '7 Hari Terakhir'
              : dateRange === 'month'
              ? 'Bulan Ini'
              : 'Semua Waktu'}
            {` • ${filteredTransactions.length} Transaksi`}
          </p>
        </div>
        <button
          onClick={() => setShowFilterModal(true)}
          className={`p-2.5 rounded-2xl border transition-colors ${
            dateRange !== 'all'
              ? 'bg-primary/20 border-primary text-primary'
              : 'bg-surface-light border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
          }`}
          title="Filter Waktu"
        >
          <Filter size={18} />
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

      {/* Holder Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-4 mb-3 scrollbar-hide">
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

      {/* Transactions List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary w-6 h-6" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-2xl p-6 text-text-muted text-sm">
            {searchQuery ? `Tidak ada hasil pencarian "${searchQuery}".` : 'Tidak ada transaksi untuk filter ini.'}
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
                  <p className="font-semibold text-sm truncate">
                    {trx.type === 'transfer' ? 'Transfer' : trx.categories?.name || 'Lainnya'}
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
            </div>
          ))
        )}
      </div>

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

      {/* Date Filter Modal */}
      {showFilterModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setShowFilterModal(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowFilterModal(false)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-base font-bold mb-4">Filter Rentang Waktu</h2>
            <div className="space-y-2">
              {[
                { value: 'today', label: 'Hari Ini' },
                { value: 'week', label: '7 Hari Terakhir' },
                { value: 'month', label: 'Bulan Ini' },
                { value: 'all', label: 'Semua Waktu' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setDateRange(opt.value as DateRangeType);
                    setShowFilterModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold transition-colors ${
                    dateRange === opt.value
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-surface-light border border-foreground/5 dark:border-white/5 text-text-muted hover:bg-foreground/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
