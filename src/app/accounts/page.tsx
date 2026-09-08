'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Wallet,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Loader2,
  Trash2,
  SlidersHorizontal,
  History,
  Sparkles,
  ChevronRight,
  Tag,
  PiggyBank,
  RefreshCw,
  HelpCircle,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { transferFunds, reconcileAccountBalance, deleteTransaction } from '@/app/actions';
import { useToast } from '@/components/Toast';
import CurrencyInput from '@/components/CurrencyInput';
import { formatIDR, formatHolder, HOLDER_OPTIONS } from '@/lib/utils';
import { Transaction, HolderAccount, PaymentMethod, Category } from '@/lib/types';

interface AccountMeta {
  key: HolderAccount;
  title: string;
  subtitle: string;
  type: 'cash' | 'atm';
  owner: 'suami' | 'istri';
  icon: typeof Banknote;
  iconBg: string;
  iconColor: string;
  gradient: string;
  borderColor: string;
}

const ACCOUNT_CONFIGS: AccountMeta[] = [
  {
    key: 'cash_suami',
    title: 'Cash Suami',
    subtitle: 'Dompet Tunai Suami',
    type: 'cash',
    owner: 'suami',
    icon: Banknote,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-500/10 via-surface to-surface',
    borderColor: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  {
    key: 'atm_suami',
    title: 'ATM Suami',
    subtitle: 'Rekening Bank Suami',
    type: 'atm',
    owner: 'suami',
    icon: CreditCard,
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-500/10 via-surface to-surface',
    borderColor: 'border-blue-500/20 hover:border-blue-500/40',
  },
  {
    key: 'cash_istri',
    title: 'Cash Istri',
    subtitle: 'Dompet Tunai Istri',
    type: 'cash',
    owner: 'istri',
    icon: Banknote,
    iconBg: 'bg-pink-500/15',
    iconColor: 'text-pink-600 dark:text-pink-400',
    gradient: 'from-pink-500/10 via-surface to-surface',
    borderColor: 'border-pink-500/20 hover:border-pink-500/40',
  },
  {
    key: 'atm_istri',
    title: 'ATM Istri',
    subtitle: 'Rekening Bank Istri',
    type: 'atm',
    owner: 'istri',
    icon: CreditCard,
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-600 dark:text-purple-400',
    gradient: 'from-purple-500/10 via-surface to-surface',
    borderColor: 'border-purple-500/20 hover:border-purple-500/40',
  },
];

const RECONCILIATION_PRESET_REASONS = [
  'Belanja/jajan kecil belum tercatat',
  'Parkir / uang tip lupa dicatat',
  'Biaya admin bank bulanan',
  'Pendapatan bunga / bagi hasil bank',
  'Penyesuaian saldo awal',
  'Uang kembalian receh tidak dicatat',
  'Koreksi pembulatan saldo',
];

function AccountsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [savingGoalsLocked, setSavingGoalsLocked] = useState<number>(0);

  // Filter state for Ledger: 'all' or one of the 4 accounts
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<'all' | HolderAccount>('all');

  // Modals state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transfer Form state
  const [transferForm, setTransferForm] = useState<{
    from_holder: HolderAccount;
    to_holder: HolderAccount;
    amount: number;
    trx_date: string;
    payment_method_id: string;
    admin_fee: number;
    description: string;
  }>({
    from_holder: 'atm_suami',
    to_holder: 'cash_suami',
    amount: 0,
    trx_date: new Date().toISOString().split('T')[0],
    payment_method_id: '',
    admin_fee: 0,
    description: '',
  });

  // Reconcile Form state
  const [reconcileHolder, setReconcileHolder] = useState<HolderAccount>('cash_suami');
  const [reconcileActualAmount, setReconcileActualAmount] = useState<number>(0);
  const [reconcileReason, setReconcileReason] = useState<string>(RECONCILIATION_PRESET_REASONS[0]);
  const [reconcileCustomReason, setReconcileCustomReason] = useState<string>('');
  const [reconcileNotes, setReconcileNotes] = useState<string>('');
  const [reconcileDate, setReconcileDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [
        { data: trxData, error: trxErr },
        { data: pmData },
        { data: goalsData },
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, categories(name), payment_methods(name)')
          .is('deleted_at', null)
          .order('trx_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('payment_methods').select('*').order('name'),
        supabase.from('saving_goals').select('current_amount').is('deleted_at', null),
      ]);

      if (trxErr) throw trxErr;
      if (trxData) setTransactions(trxData as Transaction[]);
      if (pmData) {
        setPaymentMethods(pmData as PaymentMethod[]);
        if (pmData.length > 0 && !transferForm.payment_method_id) {
          setTransferForm((prev) => ({ ...prev, payment_method_id: pmData[0].id }));
        }
      }

      if (goalsData) {
        const locked = (goalsData || []).reduce(
          (sum: number, g: any) => sum + Number(g.current_amount || 0),
          0
        );
        setSavingGoalsLocked(locked);
      }
    } catch (err: any) {
      console.error('Error loading account data:', err);
      showToast('Gagal memuat data akun: ' + (err?.message || 'Error'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle URL query parameters for shortcuts e.g. /accounts?action=transfer or /accounts?account=atm_suami
  useEffect(() => {
    const action = searchParams.get('action');
    const acc = searchParams.get('account') as HolderAccount | null;

    if (acc && ['cash_suami', 'atm_suami', 'cash_istri', 'atm_istri'].includes(acc)) {
      setSelectedLedgerAccount(acc);
    }

    if (action === 'transfer') {
      if (acc) {
        setTransferForm((prev) => ({
          ...prev,
          from_holder: acc,
          to_holder: acc === 'atm_suami' ? 'cash_suami' : 'atm_suami',
        }));
      }
      setShowTransferModal(true);
    } else if (action === 'reconcile') {
      if (acc) {
        setReconcileHolder(acc);
      }
      setShowReconcileModal(true);
    }
  }, [searchParams]);

  // Compute Account Balances & Flows
  const accountBalances = useMemo(() => {
    const stats: Record<
      HolderAccount,
      {
        balance: number;
        inflow: number;
        outflow: number;
        transferIn: number;
        transferOut: number;
        transferCount: number;
      }
    > = {
      cash_suami: { balance: 0, inflow: 0, outflow: 0, transferIn: 0, transferOut: 0, transferCount: 0 },
      atm_suami: { balance: 0, inflow: 0, outflow: 0, transferIn: 0, transferOut: 0, transferCount: 0 },
      cash_istri: { balance: 0, inflow: 0, outflow: 0, transferIn: 0, transferOut: 0, transferCount: 0 },
      atm_istri: { balance: 0, inflow: 0, outflow: 0, transferIn: 0, transferOut: 0, transferCount: 0 },
    };

    transactions.forEach((t) => {
      const amt = Number(t.amount || 0);

      // Normalise legacy holder names
      const h = (t.holder === 'suami' ? 'cash_suami' : t.holder === 'istri' ? 'cash_istri' : t.holder) as HolderAccount;
      const fh = (t.from_holder === 'suami' ? 'cash_suami' : t.from_holder === 'istri' ? 'cash_istri' : t.from_holder) as HolderAccount;

      if (t.type === 'income' && h && stats[h]) {
        stats[h].inflow += amt;
        stats[h].balance += amt;
      } else if (t.type === 'expense' && h && stats[h]) {
        stats[h].outflow += amt;
        stats[h].balance -= amt;
      } else if (t.type === 'transfer') {
        if (fh && stats[fh]) {
          stats[fh].transferOut += amt;
          stats[fh].balance -= amt;
          stats[fh].transferCount += 1;
        }
        if (h && stats[h]) {
          stats[h].transferIn += amt;
          stats[h].balance += amt;
          stats[h].transferCount += 1;
        }
      }
    });

    return stats;
  }, [transactions]);

  const totalHouseholdBalance = useMemo(() => {
    return Object.values(accountBalances).reduce((acc, curr) => acc + curr.balance, 0);
  }, [accountBalances]);

  const safeToSpendBalance = Math.max(0, totalHouseholdBalance - savingGoalsLocked);

  // Sync actual amount input in Reconcile modal when holder changes or modal opens
  useEffect(() => {
    if (showReconcileModal) {
      const currentRecorded = accountBalances[reconcileHolder]?.balance || 0;
      setReconcileActualAmount(currentRecorded);
    }
  }, [showReconcileModal, reconcileHolder, accountBalances]);

  // Handle Transfer Presets
  const applyTransferPreset = (type: 'tarik_tunai' | 'jatah_belanja' | 'setor_tunai' | 'suami_ke_istri_atm') => {
    switch (type) {
      case 'tarik_tunai':
        setTransferForm((prev) => ({
          ...prev,
          from_holder: 'atm_suami',
          to_holder: 'cash_suami',
          description: 'Tarik Tunai dari Rekening ke Dompet',
          admin_fee: 0,
        }));
        break;
      case 'jatah_belanja':
        setTransferForm((prev) => ({
          ...prev,
          from_holder: 'atm_suami',
          to_holder: 'cash_istri',
          description: 'Jatah Belanja Rumah Tangga (Tunai Istri)',
          admin_fee: 0,
        }));
        break;
      case 'setor_tunai':
        setTransferForm((prev) => ({
          ...prev,
          from_holder: 'cash_suami',
          to_holder: 'atm_suami',
          description: 'Setor Tunai Dompet ke Rekening ATM',
          admin_fee: 0,
        }));
        break;
      case 'suami_ke_istri_atm':
        setTransferForm((prev) => ({
          ...prev,
          from_holder: 'atm_suami',
          to_holder: 'atm_istri',
          description: 'Transfer Bank ke Rekening Istri',
          admin_fee: 0,
        }));
        break;
    }
  };

  // Submit Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.from_holder === transferForm.to_holder) {
      showToast('Akun asal dan tujuan tidak boleh sama', 'error');
      return;
    }
    if (!transferForm.amount || transferForm.amount <= 0) {
      showToast('Nominal transfer harus lebih dari 0', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await transferFunds({
        from_holder: transferForm.from_holder,
        to_holder: transferForm.to_holder,
        amount: Number(transferForm.amount),
        trx_date: transferForm.trx_date,
        payment_method_id: transferForm.payment_method_id || undefined,
        admin_fee: Number(transferForm.admin_fee) || 0,
        description: transferForm.description.trim() || undefined,
      });

      if (res.success) {
        showToast('Transfer dana berhasil dicatat & disinkronkan', 'success');
        setShowTransferModal(false);
        setTransferForm((prev) => ({ ...prev, amount: 0, admin_fee: 0, description: '' }));
        await fetchData();
      } else {
        showToast('Gagal transfer: ' + (res.error || 'Terjadi kesalahan'), 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + (err?.message || 'Terjadi kesalahan'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Reconciliation
  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentRecorded = accountBalances[reconcileHolder]?.balance || 0;
    const diff = Number(reconcileActualAmount) - currentRecorded;

    if (diff === 0) {
      showToast('Saldo fisik sama persis dengan saldo tercatat. Tidak ada selisih yang perlu disesuaikan.', 'info');
      setShowReconcileModal(false);
      return;
    }

    const finalReason =
      reconcileReason === 'Lainnya' && reconcileCustomReason.trim()
        ? reconcileCustomReason.trim()
        : reconcileReason;

    setIsSubmitting(true);
    try {
      const res = await reconcileAccountBalance({
        holder: reconcileHolder,
        actual_balance: Number(reconcileActualAmount),
        current_recorded_balance: currentRecorded,
        reason: finalReason,
        notes: reconcileNotes.trim() || undefined,
        trx_date: reconcileDate,
      });

      if (res.success) {
        showToast(`Rekonsiliasi berhasil! Saldo ${formatHolder(reconcileHolder)} kini cocok 100%`, 'success');
        setShowReconcileModal(false);
        setReconcileCustomReason('');
        setReconcileNotes('');
        await fetchData();
      } else {
        showToast('Gagal mencocokkan saldo: ' + (res.error || 'Terjadi kesalahan'), 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + (err?.message || 'Terjadi kesalahan'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered transactions for Ledger
  const ledgerTransactions = useMemo(() => {
    if (selectedLedgerAccount === 'all') return transactions;

    return transactions.filter((t) => {
      const h = t.holder === 'suami' ? 'cash_suami' : t.holder === 'istri' ? 'cash_istri' : t.holder;
      const fh = t.from_holder === 'suami' ? 'cash_suami' : t.from_holder === 'istri' ? 'cash_istri' : t.from_holder;
      return h === selectedLedgerAccount || fh === selectedLedgerAccount;
    });
  }, [transactions, selectedLedgerAccount]);

  // Compute Running Balance for selected Ledger Account
  const transactionsWithRunningBalance = useMemo(() => {
    if (selectedLedgerAccount === 'all') {
      return ledgerTransactions.map((t) => ({ ...t, runningBalance: null }));
    }

    // Sort ascending by date and created_at
    const sortedAsc = [...ledgerTransactions].sort((a, b) => {
      if (a.trx_date !== b.trx_date) return a.trx_date.localeCompare(b.trx_date);
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    let running = 0;
    const balanceMap = new Map<string, number>();

    sortedAsc.forEach((t) => {
      const amt = Number(t.amount || 0);
      const h = t.holder === 'suami' ? 'cash_suami' : t.holder === 'istri' ? 'cash_istri' : t.holder;
      const fh = t.from_holder === 'suami' ? 'cash_suami' : t.from_holder === 'istri' ? 'cash_istri' : t.from_holder;

      if (t.type === 'income' && h === selectedLedgerAccount) {
        running += amt;
      } else if (t.type === 'expense' && h === selectedLedgerAccount) {
        running -= amt;
      } else if (t.type === 'transfer') {
        if (fh === selectedLedgerAccount) running -= amt;
        if (h === selectedLedgerAccount) running += amt;
      }

      balanceMap.set(t.id, running);
    });

    // Return in original order (descending) with calculated running balance
    return ledgerTransactions.map((t) => ({
      ...t,
      runningBalance: balanceMap.get(t.id) ?? null,
    }));
  }, [ledgerTransactions, selectedLedgerAccount]);

  return (
    <main className="min-h-screen bg-background pb-32">
      {/* Top App Bar */}
      <header className="pt-8 pb-4 px-5 bg-surface/80 backdrop-blur-md sticky top-0 z-20 border-b border-foreground/10 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 -ml-2 rounded-full hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold leading-tight">Dompet & Rekening</h1>
              <p className="text-[11px] text-text-muted">Transfer Antar Akun & Rekonsiliasi Saldo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <ArrowRightLeft size={14} />
              <span>Transfer</span>
            </button>
            <button
              onClick={() => setShowReconcileModal(true)}
              className="px-3 py-1.5 rounded-xl bg-surface border border-foreground/15 dark:border-white/15 text-foreground text-xs font-bold hover:bg-surface-light flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Scale size={14} className="text-amber-500" />
              <span>Opname</span>
            </button>
          </div>
        </div>
      </header>

      <div className="p-5 max-w-2xl mx-auto space-y-6">
        {/* Total Household Liquidity Card */}
        <section className="glass-panel p-5 rounded-3xl relative overflow-hidden bg-gradient-to-br from-primary/10 via-surface to-surface border border-primary/20 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/15 rounded-bl-full -mr-6 -mt-6 pointer-events-none" />

          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Wallet size={15} className="text-primary" /> Total Saldo Rumah Tangga
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              4 Akun Aktif
            </span>
          </div>

          <p className="text-3xl font-black text-foreground relative z-10 mb-4 tracking-tight">
            {formatIDR(totalHouseholdBalance)}
          </p>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-foreground/10 dark:border-white/10 relative z-10">
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase">Bebas Belanja</p>
              <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatIDR(safeToSpendBalance)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase flex items-center gap-1">
                <PiggyBank size={12} className="text-teal-500" /> Terkunci Celengan
              </p>
              <p className="text-sm font-extrabold text-teal-600 dark:text-teal-400 mt-0.5">
                {formatIDR(savingGoalsLocked)}
              </p>
            </div>
          </div>
        </section>

        {/* 4 Interactive Account Cards */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Posisi Saldo Tiap Kantong
            </h2>
            <span className="text-[11px] text-text-muted">Klik kartu untuk filter mutasi</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {ACCOUNT_CONFIGS.map((acc) => {
              const Icon = acc.icon;
              const stats = accountBalances[acc.key] || {
                balance: 0,
                inflow: 0,
                outflow: 0,
                transferIn: 0,
                transferOut: 0,
              };
              const isSelected = selectedLedgerAccount === acc.key;

              return (
                <div
                  key={acc.key}
                  onClick={() =>
                    setSelectedLedgerAccount(isSelected ? 'all' : acc.key)
                  }
                  className={`glass-panel p-4 rounded-2xl relative overflow-hidden transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 shadow-lg bg-primary/5'
                      : acc.borderColor
                  }`}
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${acc.iconBg}`}>
                        <Icon size={18} className={acc.iconColor} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground leading-tight">{acc.title}</h3>
                        <p className="text-[10px] text-text-muted">{acc.subtitle}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary text-white">
                        Aktif
                      </span>
                    )}
                  </div>

                  <div className="mb-3">
                    <span className="text-[10px] text-text-muted uppercase font-semibold">Saldo Riil</span>
                    <p className="text-xl font-black text-foreground tracking-tight">
                      {formatIDR(stats.balance)}
                    </p>
                  </div>

                  {/* Flow Pills */}
                  <div className="flex items-center justify-between text-[11px] pt-2.5 border-t border-foreground/5 dark:border-white/5">
                    <span className="text-text-muted">
                      Masuk:{' '}
                      <strong className="text-income font-bold">
                        +{formatIDR(stats.inflow + stats.transferIn)}
                      </strong>
                    </span>
                    <span className="text-text-muted">
                      Keluar:{' '}
                      <strong className="text-expense font-bold">
                        -{formatIDR(stats.outflow + stats.transferOut)}
                      </strong>
                    </span>
                  </div>

                  {/* Quick Card Action Buttons */}
                  <div className="mt-3 pt-2.5 flex items-center gap-2 border-t border-dashed border-foreground/10 dark:border-white/10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTransferForm((prev) => ({
                          ...prev,
                          from_holder: acc.key,
                          to_holder: acc.key === 'atm_suami' ? 'cash_suami' : 'atm_suami',
                        }));
                        setShowTransferModal(true);
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-surface hover:bg-surface-light border border-foreground/10 dark:border-white/10 text-[11px] font-bold text-foreground flex items-center justify-center gap-1 transition-colors"
                    >
                      <ArrowRightLeft size={12} className="text-primary" /> Transfer
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReconcileHolder(acc.key);
                        setShowReconcileModal(true);
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-surface hover:bg-surface-light border border-foreground/10 dark:border-white/10 text-[11px] font-bold text-foreground flex items-center justify-center gap-1 transition-colors"
                    >
                      <Scale size={12} className="text-amber-500" /> Opname
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Fast Transfer Shortcuts Banner */}
        <section className="glass-panel p-4 rounded-2xl border border-foreground/10 dark:border-white/10">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles size={16} className="text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Pilihan Transfer Cepat (1-Klik)
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => {
                applyTransferPreset('tarik_tunai');
                setShowTransferModal(true);
              }}
              className="p-2.5 rounded-xl bg-surface hover:bg-surface-light border border-foreground/10 dark:border-white/10 text-left transition-all active:scale-95"
            >
              <span className="text-base block mb-0.5">🏧</span>
              <p className="text-xs font-bold text-foreground leading-tight">Tarik Tunai</p>
              <p className="text-[10px] text-text-muted">ATM ➔ Kas Suami</p>
            </button>

            <button
              onClick={() => {
                applyTransferPreset('jatah_belanja');
                setShowTransferModal(true);
              }}
              className="p-2.5 rounded-xl bg-surface hover:bg-surface-light border border-foreground/10 dark:border-white/10 text-left transition-all active:scale-95"
            >
              <span className="text-base block mb-0.5">🎁</span>
              <p className="text-xs font-bold text-foreground leading-tight">Jatah Belanja</p>
              <p className="text-[10px] text-text-muted">ATM Suami ➔ Istri</p>
            </button>

            <button
              onClick={() => {
                applyTransferPreset('setor_tunai');
                setShowTransferModal(true);
              }}
              className="p-2.5 rounded-xl bg-surface hover:bg-surface-light border border-foreground/10 dark:border-white/10 text-left transition-all active:scale-95"
            >
              <span className="text-base block mb-0.5">💳</span>
              <p className="text-xs font-bold text-foreground leading-tight">Setor Tunai</p>
              <p className="text-[10px] text-text-muted">Kas Tunai ➔ ATM</p>
            </button>

            <button
              onClick={() => {
                applyTransferPreset('suami_ke_istri_atm');
                setShowTransferModal(true);
              }}
              className="p-2.5 rounded-xl bg-surface hover:bg-surface-light border border-foreground/10 dark:border-white/10 text-left transition-all active:scale-95"
            >
              <span className="text-base block mb-0.5">📲</span>
              <p className="text-xs font-bold text-foreground leading-tight">Kirim Rekening</p>
              <p className="text-[10px] text-text-muted">ATM ➔ ATM Istri</p>
            </button>
          </div>
        </section>

        {/* Account Ledger (Buku Mutasi Akun) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Buku Mutasi & Riwayat Saldo
              </h2>
            </div>
            <span className="text-xs font-semibold text-text-muted">
              {transactionsWithRunningBalance.length} transaksi
            </span>
          </div>

          {/* Ledger Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedLedgerAccount('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedLedgerAccount === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface border border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
              }`}
            >
              Semua Akun
            </button>
            {ACCOUNT_CONFIGS.map((acc) => (
              <button
                key={acc.key}
                onClick={() => setSelectedLedgerAccount(acc.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedLedgerAccount === acc.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface border border-foreground/10 dark:border-white/10 text-text-muted hover:text-foreground'
                }`}
              >
                {acc.title}
              </button>
            ))}
          </div>

          {/* Ledger Items List */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="p-8 text-center glass-panel rounded-2xl">
                <Loader2 className="animate-spin mx-auto text-primary mb-2" size={24} />
                <p className="text-xs text-text-muted">Memuat mutasi akun...</p>
              </div>
            ) : transactionsWithRunningBalance.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-2xl border border-dashed border-foreground/15">
                <p className="text-sm font-semibold text-text-muted">Belum ada transaksi di akun ini</p>
                <p className="text-xs text-text-muted mt-1">
                  Gunakan tombol Transfer atau Catat Pengeluaran untuk memulai.
                </p>
              </div>
            ) : (
              transactionsWithRunningBalance.map((trx) => {
                const isTransfer = trx.type === 'transfer';
                const isReconcile =
                  trx.categories?.name === 'Penyesuaian Saldo' ||
                  (trx.description && trx.description.startsWith('[Rekonsiliasi Saldo]'));

                // Determine directional flow for the selected account
                let isOutflow = trx.type === 'expense';
                let isInflow = trx.type === 'income';

                if (isTransfer) {
                  const fh = trx.from_holder === 'suami' ? 'cash_suami' : trx.from_holder === 'istri' ? 'cash_istri' : trx.from_holder;
                  const th = trx.holder === 'suami' ? 'cash_suami' : trx.holder === 'istri' ? 'cash_istri' : trx.holder;

                  if (selectedLedgerAccount !== 'all') {
                    if (fh === selectedLedgerAccount) {
                      isOutflow = true;
                      isInflow = false;
                    } else if (th === selectedLedgerAccount) {
                      isInflow = true;
                      isOutflow = false;
                    }
                  }
                }

                return (
                  <div
                    key={trx.id}
                    className="glass-panel p-3.5 rounded-2xl flex items-center justify-between border border-foreground/5 dark:border-white/5 hover:border-foreground/15 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isReconcile
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : isTransfer
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                            : isInflow
                            ? 'bg-income/15 text-income'
                            : 'bg-expense/15 text-expense'
                        }`}
                      >
                        {isReconcile ? (
                          <Scale size={17} strokeWidth={2.5} />
                        ) : isTransfer ? (
                          <ArrowRightLeft size={17} strokeWidth={2.5} />
                        ) : isInflow ? (
                          <ArrowDownRight size={17} strokeWidth={2.5} />
                        ) : (
                          <ArrowUpRight size={17} strokeWidth={2.5} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-bold text-sm truncate text-foreground">
                            {isTransfer
                              ? 'Transfer Saldo'
                              : isReconcile
                              ? 'Penyesuaian Saldo'
                              : trx.categories?.name || 'Lainnya'}
                          </p>
                          {isReconcile && (
                            <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                              Opname
                            </span>
                          )}
                          {isTransfer && (
                            <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0">
                              Internal
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-text-muted truncate mt-0.5">
                          {trx.trx_date}
                          {trx.payment_methods?.name ? ` • ${trx.payment_methods.name}` : ''}
                          {trx.description ? ` • ${trx.description}` : ''}
                        </p>

                        <p className="text-[10px] text-text-muted mt-0.5 font-medium">
                          {isTransfer
                            ? `${formatHolder(trx.from_holder)} ➔ ${formatHolder(trx.holder)}`
                            : formatHolder(trx.holder)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      <p
                        className={`font-black text-sm ${
                          isTransfer && selectedLedgerAccount === 'all'
                            ? 'text-sky-600 dark:text-sky-400'
                            : isInflow
                            ? 'text-income'
                            : 'text-foreground'
                        }`}
                      >
                        {isTransfer && selectedLedgerAccount === 'all'
                          ? ''
                          : isInflow
                          ? '+'
                          : '-'}
                        {formatIDR(trx.amount)}
                      </p>

                      {/* Running Balance if filtering specific account */}
                      {trx.runningBalance !== null && (
                        <p className="text-[10px] font-semibold text-text-muted mt-0.5">
                          Saldo: {formatIDR(trx.runningBalance)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ======================================================== */}
      {/* MODAL: TRANSFER FUNDS                                     */}
      {/* ======================================================== */}
      {showTransferModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !isSubmitting && setShowTransferModal(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-foreground/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/15 text-primary">
                  <ArrowRightLeft size={18} />
                </div>
                <h3 className="text-base font-bold text-foreground">Transfer Dana Internal</h3>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                disabled={isSubmitting}
                className="p-1 rounded-full text-text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Preset Buttons inside modal */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                Pilihan Cepat
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyTransferPreset('tarik_tunai')}
                  className="p-2 rounded-xl bg-surface-light border border-foreground/5 hover:border-primary/40 text-center text-xs font-semibold"
                >
                  🏧 Tarik Tunai
                </button>
                <button
                  type="button"
                  onClick={() => applyTransferPreset('jatah_belanja')}
                  className="p-2 rounded-xl bg-surface-light border border-foreground/5 hover:border-primary/40 text-center text-xs font-semibold"
                >
                  🎁 Jatah Belanja
                </button>
                <button
                  type="button"
                  onClick={() => applyTransferPreset('setor_tunai')}
                  className="p-2 rounded-xl bg-surface-light border border-foreground/5 hover:border-primary/40 text-center text-xs font-semibold"
                >
                  💳 Setor Tunai
                </button>
              </div>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Nominal Transfer (Rp)
                </label>
                <CurrencyInput
                  value={transferForm.amount}
                  onChange={(val) => setTransferForm((prev) => ({ ...prev, amount: val }))}
                  placeholder="0"
                  required
                  autoFocus
                />
              </div>

              {/* Source & Destination Accounts */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Dari (Sumber)
                  </label>
                  <select
                    value={transferForm.from_holder}
                    onChange={(e) => {
                      const newFrom = e.target.value as HolderAccount;
                      setTransferForm((prev) => ({
                        ...prev,
                        from_holder: newFrom,
                        to_holder: prev.to_holder === newFrom
                          ? (HOLDER_OPTIONS.find((o) => o.value !== newFrom)?.value || 'cash_suami')
                          : prev.to_holder,
                      }));
                    }}
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                  >
                    {HOLDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} ({formatIDR(accountBalances[opt.value]?.balance || 0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Ke (Tujuan)
                  </label>
                  <select
                    value={transferForm.to_holder}
                    onChange={(e) =>
                      setTransferForm((prev) => ({
                        ...prev,
                        to_holder: e.target.value as HolderAccount,
                      }))
                    }
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                  >
                    {HOLDER_OPTIONS.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        disabled={opt.value === transferForm.from_holder}
                      >
                        {opt.label} ({formatIDR(accountBalances[opt.value]?.balance || 0)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    value={transferForm.trx_date}
                    onChange={(e) =>
                      setTransferForm((prev) => ({ ...prev, trx_date: e.target.value }))
                    }
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Metode (Opsional)
                  </label>
                  <select
                    value={transferForm.payment_method_id}
                    onChange={(e) =>
                      setTransferForm((prev) => ({ ...prev, payment_method_id: e.target.value }))
                    }
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Tanpa Metode --</option>
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Admin Fee Support */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-text-muted">
                    Biaya Admin Transfer (Opsional)
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setTransferForm((p) => ({ ...p, admin_fee: 0 }))}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        transferForm.admin_fee === 0
                          ? 'bg-primary text-white font-bold'
                          : 'bg-surface-light text-text-muted'
                      }`}
                    >
                      Rp 0
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferForm((p) => ({ ...p, admin_fee: 2500 }))}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        transferForm.admin_fee === 2500
                          ? 'bg-primary text-white font-bold'
                          : 'bg-surface-light text-text-muted'
                      }`}
                    >
                      Rp 2.500
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferForm((p) => ({ ...p, admin_fee: 6500 }))}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        transferForm.admin_fee === 6500
                          ? 'bg-primary text-white font-bold'
                          : 'bg-surface-light text-text-muted'
                      }`}
                    >
                      Rp 6.500
                    </button>
                  </div>
                </div>
                <CurrencyInput
                  value={transferForm.admin_fee}
                  onChange={(val) => setTransferForm((p) => ({ ...p, admin_fee: val }))}
                  placeholder="0"
                />
                {transferForm.admin_fee > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                    *Biaya admin {formatIDR(transferForm.admin_fee)} akan dicatat sebagai pengeluaran terpisah dari{' '}
                    {formatHolder(transferForm.from_holder)}.
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={transferForm.description}
                  onChange={(e) =>
                    setTransferForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Cth: Tarik tunai untuk pegangan mingguan"
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Live Preview Box */}
              {transferForm.amount > 0 && (
                <div className="p-3 rounded-xl bg-surface-light/80 border border-foreground/5 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase">Preview Mutasi:</span>
                  <div className="flex justify-between text-text-muted">
                    <span>{formatHolder(transferForm.from_holder)}:</span>
                    <span className="text-expense font-bold">
                      -{formatIDR(transferForm.amount + (Number(transferForm.admin_fee) || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>{formatHolder(transferForm.to_holder)}:</span>
                    <span className="text-income font-bold">+{formatIDR(transferForm.amount)}</span>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-surface hover:bg-surface-light border border-foreground/10 dark:border-white/10 text-xs font-bold text-text-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || transferForm.amount <= 0}
                  className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold shadow-md shadow-primary/25 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> Memproses...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft size={14} /> Pindahkan Saldo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: BALANCE RECONCILIATION (OPNAME KAS)                */}
      {/* ======================================================== */}
      {showReconcileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !isSubmitting && setShowReconcileModal(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-foreground/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Scale size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Rekonsiliasi Saldo (Opname)</h3>
                  <p className="text-[10px] text-text-muted">Audit saldo fisik dompet vs catatan sistem</p>
                </div>
              </div>
              <button
                onClick={() => setShowReconcileModal(false)}
                disabled={isSubmitting}
                className="p-1 rounded-full text-text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="space-y-4">
              {/* Account Selection */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Pilih Akun yang Ingin Dicocokkan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCOUNT_CONFIGS.map((acc) => (
                    <button
                      key={acc.key}
                      type="button"
                      onClick={() => setReconcileHolder(acc.key)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        reconcileHolder === acc.key
                          ? 'border-amber-500 bg-amber-500/10 text-foreground font-bold'
                          : 'border-foreground/10 dark:border-white/10 bg-surface-light text-text-muted font-medium'
                      }`}
                    >
                      <p className="text-xs">{acc.title}</p>
                      <p className="text-[11px] font-bold text-foreground mt-0.5">
                        {formatIDR(accountBalances[acc.key]?.balance || 0)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Balance Comparison Display */}
              <div className="p-3.5 rounded-2xl bg-surface-light/80 border border-foreground/5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted font-medium">Saldo Tercatat Saat Ini:</span>
                  <span className="font-extrabold text-foreground">
                    {formatIDR(accountBalances[reconcileHolder]?.balance || 0)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Hitung Uang Fisik / Saldo Rekening Riil Sekarang:
                  </label>
                  <CurrencyInput
                    value={reconcileActualAmount}
                    onChange={(val) => setReconcileActualAmount(val)}
                    placeholder="0"
                    required
                  />
                </div>

                {/* Diff Calculation */}
                {(() => {
                  const currentRecorded = accountBalances[reconcileHolder]?.balance || 0;
                  const diff = Number(reconcileActualAmount) - currentRecorded;

                  if (diff === 0) {
                    return (
                      <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                        <CheckCircle2 size={16} /> Saldo klop 100%! Tidak ada selisih.
                      </div>
                    );
                  }

                  const isDeficit = diff < 0;
                  return (
                    <div
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                        isDeficit
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      <span>
                        {isDeficit ? '⚠️ Selisih Kurang (Defisit):' : '✨ Selisih Lebih (Surplus):'}
                      </span>
                      <span>
                        {isDeficit ? '-' : '+'}
                        {formatIDR(Math.abs(diff))}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Reason Preset Selection */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Alasan Selisih / Keterangan Opname
                </label>
                <select
                  value={reconcileReason}
                  onChange={(e) => setReconcileReason(e.target.value)}
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground focus:outline-none focus:border-amber-500"
                >
                  {RECONCILIATION_PRESET_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Lainnya">Lainnya (Ketik sendiri)</option>
                </select>
              </div>

              {reconcileReason === 'Lainnya' && (
                <div>
                  <input
                    type="text"
                    value={reconcileCustomReason}
                    onChange={(e) => setReconcileCustomReason(e.target.value)}
                    placeholder="Tuliskan alasan penyesuaian..."
                    className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              )}

              {/* Additional Notes */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  placeholder="Cth: Opname bulanan tanggal 8"
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Tanggal Opname</label>
                <input
                  type="date"
                  value={reconcileDate}
                  onChange={(e) => setReconcileDate(e.target.value)}
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-surface hover:bg-surface-light border border-foreground/10 dark:border-white/10 text-xs font-bold text-text-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    Number(reconcileActualAmount) ===
                      (accountBalances[reconcileHolder]?.balance || 0)
                  }
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/25 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> Menyesuaikan...
                    </>
                  ) : (
                    <>
                      <Scale size={14} /> Cocokkan Saldo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-5 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-primary mb-2" size={28} />
          <p className="text-xs text-text-muted">Memuat Dompet & Rekening...</p>
        </div>
      }
    >
      <AccountsContent />
    </Suspense>
  );
}
