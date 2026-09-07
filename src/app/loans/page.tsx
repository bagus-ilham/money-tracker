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
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  CreditCard,
  Banknote,
  Search,
  HandCoins,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addLoan, addLoanPayment, deleteLoan, deleteLoanPayment } from '@/app/actions';
import { useToast } from '@/components/Toast';
import CurrencyInput from '@/components/CurrencyInput';
import { formatIDR, formatHolder, HOLDER_OPTIONS } from '@/lib/utils';
import { formatIndonesianDate } from '@/lib/salaryCycle';
import { Loan, LoanPayment, LoanType, LoanStatus, HolderAccount, PaymentMethod } from '@/lib/types';

type FilterType = 'all' | LoanType;
type FilterStatus = 'all' | 'unsettled' | 'paid';

export default function LoansPage() {
  const { showToast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('unsettled');

  // Accordion state: which loan ID is expanded to view payment history
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  // Form states - Add Loan
  const [addType, setAddType] = useState<LoanType>('receivable');
  const [addPersonName, setAddPersonName] = useState('');
  const [addTotalAmount, setAddTotalAmount] = useState<number>(0);
  const [addHolder, setAddHolder] = useState<HolderAccount>('atm_istri');
  const [addPaymentMethodId, setAddPaymentMethodId] = useState('');
  const [addLoanDate, setAddLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [addDueDate, setAddDueDate] = useState('');
  const [addDescription, setAddDescription] = useState('');

  // Form states - Add Payment
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentHolder, setPaymentHolder] = useState<HolderAccount>('atm_istri');
  const [paymentNotes, setPaymentNotes] = useState('');

  const fetchLoans = async () => {
    setIsLoading(true);
    const [{ data: loansData }, { data: pmData }] = await Promise.all([
      supabase
        .from('loans')
        .select('*, payment_methods(name), loan_payments(*)')
        .is('deleted_at', null)
        .order('loan_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('payment_methods').select('*').order('name'),
    ]);

    if (loansData) {
      // Filter out deleted payments and sort payments descending by date
      const parsed = loansData.map((l: any) => ({
        ...l,
        loan_payments: (l.loan_payments || [])
          .filter((p: any) => !p.deleted_at)
          .sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date)),
      }));
      setLoans(parsed as Loan[]);
    }
    if (pmData) setPaymentMethods(pmData as PaymentMethod[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalReceivableUnpaid = 0;
    let totalPayableUnpaid = 0;
    let receivableCount = 0;
    let payableCount = 0;

    loans.forEach((l) => {
      const remaining = Math.max(0, Number(l.total_amount) - Number(l.paid_amount));
      if (l.type === 'receivable') {
        if (remaining > 0) {
          totalReceivableUnpaid += remaining;
          receivableCount += 1;
        }
      } else {
        if (remaining > 0) {
          totalPayableUnpaid += remaining;
          payableCount += 1;
        }
      }
    });

    return {
      totalReceivableUnpaid,
      totalPayableUnpaid,
      receivableCount,
      payableCount,
    };
  }, [loans]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return loans.filter((l) => {
      // Type match
      const matchType = typeFilter === 'all' ? true : l.type === typeFilter;

      // Status match
      const remaining = Number(l.total_amount) - Number(l.paid_amount);
      const isPaid = remaining <= 0 || l.status === 'paid';
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'unsettled'
          ? !isPaid
          : isPaid;

      // Search match
      const matchSearch =
        !q ||
        l.person_name.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        l.total_amount.toString().includes(q);

      return matchType && matchStatus && matchSearch;
    });
  }, [loans, typeFilter, statusFilter, searchQuery]);

  // Submit Add Loan
  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPersonName.trim()) {
      showToast('Nama orang / pihak wajib diisi', 'error');
      return;
    }
    if (!addTotalAmount || addTotalAmount <= 0) {
      showToast('Nominal pinjaman harus lebih dari 0', 'error');
      return;
    }

    setIsSubmitting(true);
    const result = await addLoan({
      type: addType,
      person_name: addPersonName.trim(),
      total_amount: addTotalAmount,
      holder: addHolder,
      payment_method_id: addPaymentMethodId || undefined,
      loan_date: addLoanDate,
      due_date: addDueDate || undefined,
      description: addDescription.trim() || undefined,
    });

    if (result.success) {
      await fetchLoans();
      setShowAddModal(false);
      // Reset form
      setAddPersonName('');
      setAddTotalAmount(0);
      setAddDescription('');
      setAddDueDate('');
      showToast(
        `Berhasil mencatat ${addType === 'receivable' ? 'piutang' : 'hutang'} baru`,
        'success'
      );
    } else {
      showToast('Gagal menambahkan pinjaman: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  // Submit Add Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    if (!paymentAmount || paymentAmount <= 0) {
      showToast('Nominal pembayaran harus lebih dari 0', 'error');
      return;
    }

    setIsSubmitting(true);
    const result = await addLoanPayment({
      loan_id: selectedLoan.id,
      amount: paymentAmount,
      payment_date: paymentDate,
      holder: paymentHolder,
      notes: paymentNotes.trim() || undefined,
    });

    if (result.success) {
      await fetchLoans();
      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentNotes('');
      showToast('Cicilan berhasil dicatat & saldo diperbarui', 'success');
    } else {
      showToast('Gagal mencatat cicilan: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  // Delete Loan
  const handleDeleteLoan = async () => {
    if (!selectedLoan) return;
    setIsSubmitting(true);
    const result = await deleteLoan(selectedLoan.id);
    if (result.success) {
      await fetchLoans();
      setShowDeleteModal(false);
      setSelectedLoan(null);
      showToast('Pinjaman berhasil dihapus', 'success');
    } else {
      showToast('Gagal menghapus pinjaman: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  // Delete single payment
  const handleDeletePayment = async (paymentId: string, loanId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus cicilan ini?')) return;
    const result = await deleteLoanPayment(paymentId, loanId);
    if (result.success) {
      await fetchLoans();
      showToast('Cicilan berhasil dihapus', 'success');
    } else {
      showToast('Gagal menghapus cicilan: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
  };

  const openPaymentModal = (loan: Loan) => {
    setSelectedLoan(loan);
    const remaining = Math.max(0, Number(loan.total_amount) - Number(loan.paid_amount));
    setPaymentAmount(remaining);
    setPaymentHolder(
      loan.holder === 'suami' ? 'cash_suami' : loan.holder === 'istri' ? 'cash_istri' : loan.holder
    );
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  return (
    <main className="min-h-screen p-5 pt-8 relative pb-28">
      {/* Header */}
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="p-2 -ml-2 rounded-full hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Hutang & Piutang</h1>
            <p className="text-xs text-text-muted mt-0.5 font-medium">
              Kelola pinjaman & cicilan pelunasan
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="p-2 bg-primary hover:bg-primary-dark text-white rounded-2xl transition-all flex items-center gap-1.5 px-3 text-xs font-semibold shadow-md shadow-primary/20"
        >
          <Plus size={16} /> Catat Baru
        </button>
      </header>

      {/* Summary Cards (Top) */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Piutang Card */}
        <div className="glass-panel p-4 rounded-3xl border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-surface to-surface relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Piutang (Uang di Luar)
            </span>
            <div className="p-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ArrowUpRight size={14} />
            </div>
          </div>
          <p className="text-base font-black text-foreground">
            {formatIDR(summary.totalReceivableUnpaid)}
          </p>
          <p className="text-[10px] text-text-muted mt-1 font-medium">
            {summary.receivableCount} orang belum lunas
          </p>
        </div>

        {/* Hutang Card */}
        <div className="glass-panel p-4 rounded-3xl border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-surface to-surface relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Hutang (Kewajiban)
            </span>
            <div className="p-1.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-xl">
              <ArrowDownRight size={14} />
            </div>
          </div>
          <p className="text-base font-black text-foreground">
            {formatIDR(summary.totalPayableUnpaid)}
          </p>
          <p className="text-[10px] text-text-muted mt-1 font-medium">
            {summary.payableCount} pinjaman belum lunas
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted select-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama orang, catatan, nominal..."
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
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            typeFilter === 'all'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface border border-foreground/10 dark:border-white/5 text-text-muted hover:text-foreground'
          }`}
        >
          Semua Tipe
        </button>
        <button
          onClick={() => setTypeFilter('receivable')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            typeFilter === 'receivable'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-surface border border-foreground/10 dark:border-white/5 text-text-muted hover:text-foreground'
          }`}
        >
          Piutang (Kita Pinjamkan)
        </button>
        <button
          onClick={() => setTypeFilter('payable')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            typeFilter === 'payable'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-surface border border-foreground/10 dark:border-white/5 text-text-muted hover:text-foreground'
          }`}
        >
          Hutang (Kita Meminjam)
        </button>
      </div>

      {/* Status Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 scrollbar-hide">
        <button
          onClick={() => setStatusFilter('unsettled')}
          className={`px-3 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
            statusFilter === 'unsettled'
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40 font-bold'
              : 'bg-transparent text-text-muted hover:text-foreground border border-foreground/5 dark:border-white/5'
          }`}
        >
          Belum Lunas
        </button>
        <button
          onClick={() => setStatusFilter('paid')}
          className={`px-3 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
            statusFilter === 'paid'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 font-bold'
              : 'bg-transparent text-text-muted hover:text-foreground border border-foreground/5 dark:border-white/5'
          }`}
        >
          Sudah Lunas
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
            statusFilter === 'all'
              ? 'bg-surface-light text-foreground border border-foreground/20 dark:border-white/20 font-bold'
              : 'bg-transparent text-text-muted hover:text-foreground border border-foreground/5 dark:border-white/5'
          }`}
        >
          Semua Status
        </button>
      </div>

      {/* Loans List */}
      <div className="space-y-3.5">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary w-8 h-8" />
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="text-center py-14 glass-panel rounded-3xl p-6 text-text-muted text-xs space-y-2">
            <HandCoins className="w-8 h-8 mx-auto opacity-30 text-primary" />
            <p>
              {searchQuery
                ? `Tidak ada hasil pencarian "${searchQuery}".`
                : 'Belum ada data pinjaman untuk filter ini.'}
            </p>
          </div>
        ) : (
          filteredLoans.map((loan) => {
            const isReceivable = loan.type === 'receivable';
            const remaining = Math.max(0, Number(loan.total_amount) - Number(loan.paid_amount));
            const percentage =
              loan.total_amount > 0 ? Math.min(100, Math.round((Number(loan.paid_amount) / Number(loan.total_amount)) * 100)) : 0;
            const isFullyPaid = remaining <= 0 || loan.status === 'paid';
            const isExpanded = expandedLoanId === loan.id;
            const payments = loan.loan_payments || [];

            return (
              <div
                key={loan.id}
                className="glass-panel rounded-3xl p-4 border border-foreground/10 dark:border-white/5 shadow-sm transition-all"
              >
                {/* Top Row: Person, Type & Status Badges */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-2.5 rounded-2xl shrink-0 ${
                        isReceivable
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isReceivable ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm truncate">{loan.person_name}</h3>
                        <span
                          className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                            isReceivable
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isReceivable ? 'Piutang' : 'Hutang'}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {formatIndonesianDate(loan.loan_date)} • {formatHolder(loan.holder)}
                        {loan.description ? ` • ${loan.description}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isFullyPaid
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : percentage > 0
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-foreground/10 text-text-muted'
                      }`}
                    >
                      {isFullyPaid ? 'Lunas' : percentage > 0 ? `Dicicil ${percentage}%` : 'Belum Lunas'}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setShowDeleteModal(true);
                      }}
                      className="p-1.5 text-text-muted hover:text-expense transition-colors rounded-lg"
                      title="Hapus Pinjaman"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Amount Metrics */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-surface-light/60 rounded-2xl border border-foreground/5 dark:border-white/5 text-xs mb-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Total</p>
                    <p className="font-bold text-foreground truncate mt-0.5">
                      {formatIDR(loan.total_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Terbayar</p>
                    <p className="font-bold text-income truncate mt-0.5">
                      {formatIDR(loan.paid_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
                      {isReceivable ? 'Sisa Tagihan' : 'Sisa Hutang'}
                    </p>
                    <p
                      className={`font-black truncate mt-0.5 ${
                        isFullyPaid ? 'text-text-muted' : isReceivable ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {formatIDR(remaining)}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="w-full bg-surface-light h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isFullyPaid ? 'bg-emerald-500' : isReceivable ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <button
                    onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-foreground transition-colors p-1"
                  >
                    <span>Riwayat Cicilan ({payments.length})</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {!isFullyPaid && (
                    <button
                      onClick={() => openPaymentModal(loan)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-dark shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Catat Cicilan
                    </button>
                  )}
                </div>

                {/* Accordion Payment History */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-foreground/5 dark:border-white/5 space-y-2 animate-in slide-in-from-top-2">
                    {payments.length === 0 ? (
                      <p className="text-center py-2 text-[11px] text-text-muted">
                        Belum ada riwayat cicilan untuk pinjaman ini.
                      </p>
                    ) : (
                      payments.map((pmt) => (
                        <div
                          key={pmt.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-surface border border-foreground/5 dark:border-white/5 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-foreground truncate">
                              {pmt.notes || 'Pembayaran Cicilan'}
                            </p>
                            <p className="text-[10px] text-text-muted mt-0.5">
                              {formatIndonesianDate(pmt.payment_date)} • {formatHolder(pmt.holder)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-income">{formatIDR(pmt.amount)}</span>
                            <button
                              onClick={() => handleDeletePayment(pmt.id, loan.id)}
                              className="text-text-muted hover:text-expense p-1 transition-colors"
                              title="Hapus Cicilan"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Tambah Pinjaman Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div
            className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-4">Catat Pinjaman Baru</h2>

            <form onSubmit={handleAddLoan} className="space-y-4">
              {/* Type Toggle */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">Tipe Pinjaman</label>
                <div className="flex bg-surface-light p-1 rounded-xl border border-foreground/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setAddType('receivable')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                      addType === 'receivable'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-text-muted hover:text-foreground'
                    }`}
                  >
                    Piutang (Kita Meminjamkan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddType('payable')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                      addType === 'payable'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'text-text-muted hover:text-foreground'
                    }`}
                  >
                    Hutang (Kita Meminjam)
                  </button>
                </div>
              </div>

              {/* Person Name */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  {addType === 'receivable' ? 'Nama Peminjam (Yang Meminjam)' : 'Nama Pemberi Pinjaman'}
                </label>
                <input
                  type="text"
                  value={addPersonName}
                  onChange={(e) => setAddPersonName(e.target.value)}
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground placeholder:text-text-muted/50"
                  placeholder="Cth: Aulia"
                  required
                  autoFocus
                />
              </div>

              {/* Total Amount */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Total Nominal Pinjaman
                </label>
                <CurrencyInput
                  value={addTotalAmount}
                  onChange={(val) => setAddTotalAmount(val)}
                  placeholder="0"
                  required
                />
              </div>

              {/* Account & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    {addType === 'receivable' ? 'Sumber Uang' : 'Penerima Uang'}
                  </label>
                  <select
                    value={addHolder}
                    onChange={(e) => setAddHolder(e.target.value as HolderAccount)}
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-3 text-xs focus:border-primary focus:outline-none text-foreground appearance-none"
                  >
                    {HOLDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Tanggal Pinjam
                  </label>
                  <input
                    type="date"
                    value={addLoanDate}
                    onChange={(e) => setAddLoanDate(e.target.value)}
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-3 text-xs focus:border-primary focus:outline-none text-foreground"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground placeholder:text-text-muted/50"
                  placeholder="Cth: Pinjam untuk belanja modal"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl mt-2 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Pinjaman'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Catat Cicilan */}
      {showPaymentModal && selectedLoan && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div
            className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-1">Catat Pembayaran Cicilan</h2>
            <p className="text-xs text-text-muted mb-4">
              {selectedLoan.type === 'receivable' ? 'Pengembalian dari' : 'Pembayaran ke'}{' '}
              <span className="font-bold text-foreground">{selectedLoan.person_name}</span>
            </p>

            {/* Reminder remaining */}
            <div className="p-3 bg-surface-light rounded-2xl border border-foreground/5 dark:border-white/5 mb-4 flex justify-between items-center text-xs">
              <span className="text-text-muted">Sisa yang belum lunas:</span>
              <span className="font-extrabold text-foreground">
                {formatIDR(
                  Math.max(0, Number(selectedLoan.total_amount) - Number(selectedLoan.paid_amount))
                )}
              </span>
            </div>

            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Nominal Pembayaran
                </label>
                <CurrencyInput
                  value={paymentAmount}
                  onChange={(val) => setPaymentAmount(val)}
                  placeholder="0"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    {selectedLoan.type === 'receivable' ? 'Masuk ke Akun' : 'Bayar dari Akun'}
                  </label>
                  <select
                    value={paymentHolder}
                    onChange={(e) => setPaymentHolder(e.target.value as HolderAccount)}
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-3 text-xs focus:border-primary focus:outline-none text-foreground appearance-none"
                  >
                    {HOLDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Tanggal Pembayaran
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-3 text-xs focus:border-primary focus:outline-none text-foreground"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground placeholder:text-text-muted/50"
                  placeholder="Cth: Cicilan transfer bank"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl mt-2 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Pembayaran'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus */}
      {showDeleteModal && selectedLoan && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div
            className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-expense/15 text-expense rounded-2xl shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold">Hapus Pinjaman</h2>
                <p className="text-xs text-text-muted">
                  Apakah Anda yakin ingin menghapus catatan pinjaman{' '}
                  <span className="font-bold text-foreground">{selectedLoan.person_name}</span>?
                </p>
              </div>
            </div>

            <div className="p-3 bg-surface-light rounded-2xl border border-foreground/5 dark:border-white/5 my-4 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Total Pinjaman:</span>
                <span className="font-bold text-foreground">{formatIDR(selectedLoan.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Sudah Dibayar:</span>
                <span className="font-bold text-income">{formatIDR(selectedLoan.paid_amount)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleDeleteLoan}
                disabled={isSubmitting}
                className="w-full bg-expense hover:bg-rose-600 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50 text-sm"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Ya, Hapus Sekarang'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedLoan(null);
                }}
                className="w-full py-2.5 text-xs font-semibold text-text-muted hover:text-foreground text-center"
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
