'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Minus,
  X,
  Edit3,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  PiggyBank,
  Target,
  ShieldCheck,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  History,
  Sparkles,
  Wallet,
  Coins,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  createSavingGoal,
  updateSavingGoal,
  deleteSavingGoal,
  depositToSavingGoal,
  withdrawFromSavingGoal,
  deleteSavingGoalLog,
} from '@/app/actions';
import { useToast } from '@/components/Toast';
import CurrencyInput from '@/components/CurrencyInput';
import { formatIDR } from '@/lib/utils';
import { SavingGoal, SavingGoalLog, PaymentMethod } from '@/lib/types';

const CATEGORY_PRESETS = [
  { label: '🏥 Dana Darurat', value: 'Dana Darurat' },
  { label: '✈️ Liburan & Traveling', value: 'Liburan' },
  { label: '🚗 Kendaraan & Servis', value: 'Kendaraan' },
  { label: '🏠 Rumah & Properti', value: 'Rumah' },
  { label: '📱 Gadget & Elektronik', value: 'Gadget' },
  { label: '🎓 Pendidikan & Kursus', value: 'Pendidikan' },
  { label: '🕌 Qurban & Ibadah', value: 'Ibadah' },
  { label: '🎯 Lainnya', value: 'Lainnya' },
];

const HOLDER_OPTIONS = [
  { label: 'Bersama (Keluarga)', value: 'Bersama' },
  { label: 'Bagus (Suami)', value: 'Bagus' },
  { label: 'Aulia (Istri)', value: 'Aulia' },
];

export default function SavingsPage() {
  const { showToast } = useToast();
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [totalAccountBalance, setTotalAccountBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Accordion for viewing logs
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingGoal | null>(null);

  // Form states - Create / Edit
  const [formName, setFormName] = useState('');
  const [formTargetAmount, setFormTargetAmount] = useState<number>(0);
  const [formCategory, setFormCategory] = useState('Dana Darurat');
  const [formHolder, setFormHolder] = useState('Bersama');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formInitialAmount, setFormInitialAmount] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');

  // Form states - Deposit / Withdraw
  const [actionAmount, setActionAmount] = useState<number>(0);
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionHolder, setActionHolder] = useState('Bersama');
  const [actionPaymentMethodId, setActionPaymentMethodId] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [{ data: goalsData }, { data: pmData }, { data: txData }, { data: loanPaymentsData }] =
        await Promise.all([
          supabase
            .from('saving_goals')
            .select('*, saving_goal_logs(*)')
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase.from('payment_methods').select('*').order('name'),
          supabase
            .from('transactions')
            .select('type, amount')
            .is('deleted_at', null),
          supabase
            .from('loan_payments')
            .select('amount, loans(type)')
            .is('deleted_at', null),
        ]);

      if (goalsData) {
        const parsedGoals = goalsData.map((g: any) => ({
          ...g,
          saving_goal_logs: (g.saving_goal_logs || [])
            .filter((l: any) => !l.deleted_at)
            .sort((a: any, b: any) => b.log_date.localeCompare(a.log_date) || b.created_at.localeCompare(a.created_at)),
        }));
        setGoals(parsedGoals as SavingGoal[]);
      }

      if (pmData) setPaymentMethods(pmData as PaymentMethod[]);

      // Calculate total cash/bank balance
      let totalBalance = 0;
      if (txData) {
        txData.forEach((tx: any) => {
          if (tx.type === 'income') totalBalance += Number(tx.amount);
          else if (tx.type === 'expense') totalBalance -= Number(tx.amount);
        });
      }
      if (loanPaymentsData) {
        loanPaymentsData.forEach((lp: any) => {
          const loanType = lp.loans?.type;
          if (loanType === 'receivable') totalBalance += Number(lp.amount);
          else if (loanType === 'payable') totalBalance -= Number(lp.amount);
        });
      }
      setTotalAccountBalance(totalBalance);
    } catch (err) {
      console.error('Error fetching savings data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalSaved = goals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0);
    const totalTarget = goals.reduce((sum, g) => sum + Number(g.target_amount || 0), 0);
    const safeToSpend = totalAccountBalance - totalSaved;
    const globalProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
    const completedGoals = goals.filter((g) => g.status === 'completed' || Number(g.current_amount) >= Number(g.target_amount)).length;

    return {
      totalSaved,
      totalTarget,
      safeToSpend,
      globalProgress,
      activeCount: goals.length - completedGoals,
      completedCount: completedGoals,
    };
  }, [goals, totalAccountBalance]);

  // Filtered goals
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      const isDone = g.status === 'completed' || Number(g.current_amount) >= Number(g.target_amount);
      if (statusFilter === 'active' && isDone) return false;
      if (statusFilter === 'completed' && !isDone) return false;
      if (selectedCategory !== 'all' && g.category !== selectedCategory) return false;
      return true;
    });
  }, [goals, statusFilter, selectedCategory]);

  // Modal Triggers
  const openCreateModal = () => {
    setFormName('');
    setFormTargetAmount(0);
    setFormCategory('Dana Darurat');
    setFormHolder('Bersama');
    setFormTargetDate('');
    setFormInitialAmount(0);
    setFormNotes('');
    setShowCreateModal(true);
  };

  const openEditModal = (goal: SavingGoal) => {
    setSelectedGoal(goal);
    setFormName(goal.name);
    setFormTargetAmount(Number(goal.target_amount));
    setFormCategory(goal.category || 'Lainnya');
    setFormHolder(goal.holder || 'Bersama');
    setFormTargetDate(goal.target_date || '');
    setFormNotes(goal.notes || '');
    setShowEditModal(true);
  };

  const openDepositModal = (goal: SavingGoal) => {
    setSelectedGoal(goal);
    setActionAmount(0);
    setActionDate(new Date().toISOString().split('T')[0]);
    setActionHolder(goal.holder || 'Bersama');
    setActionPaymentMethodId('');
    setActionNotes('');
    setShowDepositModal(true);
  };

  const openWithdrawModal = (goal: SavingGoal) => {
    setSelectedGoal(goal);
    setActionAmount(0);
    setActionDate(new Date().toISOString().split('T')[0]);
    setActionHolder(goal.holder || 'Bersama');
    setActionPaymentMethodId('');
    setActionNotes('');
    setShowWithdrawModal(true);
  };

  const openDeleteModal = (goal: SavingGoal) => {
    setSelectedGoal(goal);
    setShowDeleteModal(true);
  };

  // Handlers
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Nama target tabungan wajib diisi', 'error');
      return;
    }
    if (formTargetAmount <= 0) {
      showToast('Nominal target harus lebih dari 0', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await createSavingGoal({
      name: formName,
      target_amount: formTargetAmount,
      category: formCategory,
      holder: formHolder,
      target_date: formTargetDate || null,
      notes: formNotes || null,
      initial_amount: formInitialAmount > 0 ? formInitialAmount : undefined,
    });

    setIsSubmitting(false);
    if (res.success) {
      showToast('Target tabungan berhasil dibuat! 🎯', 'success');
      setShowCreateModal(false);
      fetchData();
    } else {
      showToast(res.error || 'Gagal membuat target tabungan', 'error');
    }
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    if (!formName.trim()) {
      showToast('Nama target tabungan wajib diisi', 'error');
      return;
    }
    if (formTargetAmount <= 0) {
      showToast('Nominal target harus lebih dari 0', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await updateSavingGoal(selectedGoal.id, {
      name: formName,
      target_amount: formTargetAmount,
      category: formCategory,
      holder: formHolder,
      target_date: formTargetDate || null,
      notes: formNotes || null,
    });

    setIsSubmitting(false);
    if (res.success) {
      showToast('Target tabungan diperbarui! ✨', 'success');
      setShowEditModal(false);
      fetchData();
    } else {
      showToast(res.error || 'Gagal memperbarui target tabungan', 'error');
    }
  };

  const handleDeleteGoal = async () => {
    if (!selectedGoal) return;
    setIsSubmitting(true);
    const res = await deleteSavingGoal(selectedGoal.id);
    setIsSubmitting(false);
    if (res.success) {
      showToast('Target tabungan dihapus', 'info');
      setShowDeleteModal(false);
      fetchData();
    } else {
      showToast(res.error || 'Gagal menghapus target tabungan', 'error');
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    if (actionAmount <= 0) {
      showToast('Nominal setoran harus lebih dari 0', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await depositToSavingGoal({
      goal_id: selectedGoal.id,
      amount: actionAmount,
      holder: actionHolder,
      payment_method_id: actionPaymentMethodId || null,
      log_date: actionDate,
      notes: actionNotes || null,
    });

    setIsSubmitting(false);
    if (res.success) {
      showToast(`Setoran ${formatIDR(actionAmount)} berhasil dicatat! 💰`, 'success');
      setShowDepositModal(false);
      fetchData();
    } else {
      showToast(res.error || 'Gagal mencatat setoran', 'error');
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    if (actionAmount <= 0) {
      showToast('Nominal penarikan harus lebih dari 0', 'error');
      return;
    }
    if (actionAmount > Number(selectedGoal.current_amount)) {
      showToast('Saldo tabungan tidak mencukupi untuk penarikan ini', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await withdrawFromSavingGoal({
      goal_id: selectedGoal.id,
      amount: actionAmount,
      holder: actionHolder,
      payment_method_id: actionPaymentMethodId || null,
      log_date: actionDate,
      notes: actionNotes || null,
    });

    setIsSubmitting(false);
    if (res.success) {
      showToast(`Penarikan ${formatIDR(actionAmount)} berhasil dicatat`, 'info');
      setShowWithdrawModal(false);
      fetchData();
    } else {
      showToast(res.error || 'Gagal mencatat penarikan', 'error');
    }
  };

  const handleDeleteLog = async (logId: string, goalId: string) => {
    if (!confirm('Hapus riwayat mutasi tabungan ini?')) return;
    const res = await deleteSavingGoalLog(logId, goalId);
    if (res.success) {
      showToast('Riwayat dihapus & saldo tabungan disesuaikan', 'info');
      fetchData();
    } else {
      showToast(res.error || 'Gagal menghapus riwayat', 'error');
    }
  };

  // Days remaining helper
  const getDaysRemaining = (targetDateStr?: string | null) => {
    if (!targetDateStr) return null;
    const target = new Date(targetDateStr);
    const now = new Date();
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  Target Tabungan & Celengan
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alokasi dana darurat & celengan impian keluarga
              </p>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Buat Target Baru</span>
            <span className="sm:hidden">Target Baru</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Total Terkumpul */}
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-900/10">
            <div className="flex items-center justify-between opacity-90 mb-1.5">
              <span className="text-xs font-medium text-emerald-100 flex items-center gap-1.5">
                <PiggyBank className="w-4 h-4" />
                Total Terkumpul
              </span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                {summary.globalProgress}%
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight mb-1">
              {formatIDR(summary.totalSaved)}
            </div>
            <div className="text-xs text-emerald-100/90 flex items-center justify-between">
              <span>Target: {formatIDR(summary.totalTarget)}</span>
              <span>{summary.completedCount} selesai</span>
            </div>
            {/* Mini progress bar inside card */}
            <div className="mt-3 w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-white rounded-full h-1.5 transition-all duration-500"
                style={{ width: `${summary.globalProgress}%` }}
              />
            </div>
          </div>

          {/* Card 2: Saldo Bebas Belanja (Safe to Spend) */}
          <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-500" />
                Saldo Bebas Belanja
              </span>
              <span className="text-[10px] font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded-md">
                Safe-to-Spend
              </span>
            </div>
            <div className={`text-2xl font-bold tracking-tight mb-1 ${summary.safeToSpend < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
              {formatIDR(summary.safeToSpend)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Total Saldo ({formatIDR(totalAccountBalance)}) dikurangi Tabungan Terkunci.
            </p>
          </div>

          {/* Card 3: Status Ringkas */}
          <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-500" />
                Sisa Target Tabungan
              </span>
              <span className="text-xs text-slate-500">
                {summary.activeCount} aktif
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
              {formatIDR(Math.max(0, summary.totalTarget - summary.totalSaved))}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                {summary.completedCount} Target Tercapai
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua ({goals.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Berjalan ({summary.activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'completed'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tercapai ({summary.completedCount})
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Semua Kategori
            </button>
            {CATEGORY_PRESETS.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors whitespace-nowrap ${
                  selectedCategory === cat.value
                    ? 'bg-emerald-600 text-white font-medium shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Goals List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-500" />
            <p className="text-sm">Memuat target tabungan...</p>
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <PiggyBank className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Belum Ada Target Tabungan
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              Mulai rencanakan Dana Darurat, Liburan, atau celengan impian keluarga Anda sekarang.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Buat Celengan Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGoals.map((goal) => {
              const current = Number(goal.current_amount || 0);
              const target = Number(goal.target_amount || 1);
              const pct = Math.min(100, Math.round((current / target) * 100));
              const isCompleted = goal.status === 'completed' || current >= target;
              const remaining = Math.max(0, target - current);
              const daysRemaining = getDaysRemaining(goal.target_date);
              const isExpanded = expandedGoalId === goal.id;

              return (
                <div
                  key={goal.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                    isCompleted
                      ? 'bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900 border-emerald-200 dark:border-emerald-800/60 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md'
                  }`}
                >
                  <div className="p-4 space-y-3">
                    {/* Header: Category & Holder & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {goal.category}
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900">
                            👤 {goal.holder}
                          </span>
                          {isCompleted ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Tercapai 🎉
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                              Berjalan
                            </span>
                          )}
                        </div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                          {goal.name}
                        </h2>
                      </div>

                      {/* Edit / Delete actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(goal)}
                          title="Ubah Target"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(goal)}
                          title="Hapus Target"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Numbers */}
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            {formatIDR(current)}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                            / {formatIDR(target)}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-bold ${
                            isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : pct >= 75
                              ? 'text-teal-600 dark:text-teal-400'
                              : 'text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden relative">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            isCompleted
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : pct >= 75
                              ? 'bg-gradient-to-r from-teal-500 to-emerald-400'
                              : 'bg-gradient-to-r from-sky-500 to-teal-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Remaining info & Deadline */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        <span>
                          {isCompleted
                            ? 'Target terpenuhi sepenuhnya'
                            : `Kurang ${formatIDR(remaining)} lagi`}
                        </span>
                        {goal.target_date && (
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {daysRemaining !== null ? (
                              daysRemaining > 0 ? (
                                <span className="text-slate-600 dark:text-slate-300">
                                  {daysRemaining} hari lagi
                                </span>
                              ) : daysRemaining === 0 ? (
                                <span className="text-amber-600 font-semibold">
                                  Hari ini!
                                </span>
                              ) : (
                                <span className="text-rose-500">
                                  Lewat {Math.abs(daysRemaining)} hari
                                </span>
                              )
                            ) : null}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notes if any */}
                    {goal.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl italic">
                        "{goal.notes}"
                      </p>
                    )}

                    {/* Action Buttons: Setor & Tarik */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => openDepositModal(goal)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 font-semibold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                        + Setor Tabungan
                      </button>

                      <button
                        onClick={() => openWithdrawModal(goal)}
                        disabled={current <= 0}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium text-xs hover:bg-slate-100 dark:hover:bg-slate-700/70 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                      >
                        <Minus className="w-3.5 h-3.5 text-slate-500" />
                        - Tarik Saldo
                      </button>
                    </div>
                  </div>

                  {/* History Accordion Toggle */}
                  <div className="border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                      className="w-full px-4 py-2 flex items-center justify-between text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-slate-400" />
                        Riwayat Mutasi ({goal.saving_goal_logs?.length || 0} catatan)
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-950/50 space-y-1.5 border-t border-slate-100 dark:border-slate-800 max-h-56 overflow-y-auto">
                        {!goal.saving_goal_logs || goal.saving_goal_logs.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-2">
                            Belum ada riwayat setoran/penarikan.
                          </p>
                        ) : (
                          goal.saving_goal_logs.map((log) => (
                            <div
                              key={log.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                    log.type === 'deposit'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                                  }`}
                                >
                                  {log.type === 'deposit' ? '+' : '-'}
                                </span>
                                <div>
                                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                                    {log.type === 'deposit' ? 'Setoran' : 'Penarikan'} {formatIDR(Number(log.amount))}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {log.log_date} • {log.holder} {log.notes ? `• ${log.notes}` : ''}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteLog(log.id, goal.id)}
                                title="Hapus mutasi ini"
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------------ */}
      {/* MODAL: BUAT TARGET BARU                                                  */}
      {/* ------------------------------------------------------------------------ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Buat Target Tabungan Baru
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="p-5 space-y-4 overflow-y-auto">
              {/* Nama Target */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Target / Celengan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Dana Darurat 6 Bulan, Liburan Bali"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kategori
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {CATEGORY_PRESETS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Nominal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Nominal (Rp) <span className="text-rose-500">*</span>
                </label>
                <CurrencyInput
                  value={formTargetAmount}
                  onChange={setFormTargetAmount}
                  placeholder="0"
                />
              </div>

              {/* Setoran Awal (Opsional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Setoran Awal (Opsional)
                </label>
                <CurrencyInput
                  value={formInitialAmount}
                  onChange={setFormInitialAmount}
                  placeholder="0"
                />
              </div>

              {/* Pemilik & Tenggat Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Penanggung Jawab
                  </label>
                  <select
                    value={formHolder}
                    onChange={(e) => setFormHolder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {HOLDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Selesai (Opsional)
                  </label>
                  <input
                    type="date"
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Catatan / Keterangan
                </label>
                <textarea
                  rows={2}
                  placeholder="Alasan menabung atau catatan tambahan..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Simpan Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------ */}
      {/* MODAL: EDIT TARGET                                                       */}
      {/* ------------------------------------------------------------------------ */}
      {showEditModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Ubah Target Tabungan
                </h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateGoal} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Target
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kategori
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {CATEGORY_PRESETS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Nominal (Rp)
                </label>
                <CurrencyInput
                  value={formTargetAmount}
                  onChange={setFormTargetAmount}
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Penanggung Jawab
                  </label>
                  <select
                    value={formHolder}
                    onChange={(e) => setFormHolder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {HOLDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Selesai
                  </label>
                  <input
                    type="date"
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Catatan
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-md shadow-teal-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Perbarui Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------ */}
      {/* MODAL: SETOR TABUNGAN                                                    */}
      {/* ------------------------------------------------------------------------ */}
      {showDepositModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  Setor ke: {selectedGoal.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Terkumpul saat ini: {formatIDR(Number(selectedGoal.current_amount))} / {formatIDR(Number(selectedGoal.target_amount))}
                </p>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeposit} className="p-5 space-y-4 overflow-y-auto">
              {/* Nominal Setoran */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nominal Setoran (Rp) <span className="text-rose-500">*</span>
                </label>
                <CurrencyInput
                  value={actionAmount}
                  onChange={setActionAmount}
                  placeholder="0"
                />

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[50000, 100000, 250000, 500000, 1000000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setActionAmount((prev) => prev + preset)}
                      className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] font-medium hover:bg-emerald-100 transition-colors active:scale-95"
                    >
                      +{formatIDR(preset)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActionAmount(0)}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] hover:bg-slate-200 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Tanggal & Penyetor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tanggal Setor
                  </label>
                  <input
                    type="date"
                    required
                    value={actionDate}
                    onChange={(e) => setActionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Disetor Oleh
                  </label>
                  <select
                    value={actionHolder}
                    onChange={(e) => setActionHolder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {HOLDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rekening Sumber (Opsional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Dari Rekening / Kas (Opsional)
                </label>
                <select
                  value={actionPaymentMethodId}
                  onChange={(e) => setActionPaymentMethodId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Tanpa rekening khusus --</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Catatan Setoran
                </label>
                <input
                  type="text"
                  placeholder="Misal: Tabungan gaji bulanan, bonus..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || actionAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                  Konfirmasi Setoran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------ */}
      {/* MODAL: TARIK SALDO TABUNGAN                                              */}
      {/* ------------------------------------------------------------------------ */}
      {showWithdrawModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Minus className="w-5 h-5 text-amber-600" />
                  Tarik dari: {selectedGoal.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Saldo yang tersedia untuk ditarik: {formatIDR(Number(selectedGoal.current_amount))}
                </p>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="p-5 space-y-4 overflow-y-auto">
              {/* Nominal Tarik */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nominal Penarikan (Rp) <span className="text-rose-500">*</span>
                </label>
                <CurrencyInput
                  value={actionAmount}
                  onChange={setActionAmount}
                  placeholder="0"
                />

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setActionAmount(Number(selectedGoal.current_amount))}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 text-[11px] font-semibold hover:bg-amber-100 transition-colors"
                  >
                    Tarik Semua ({formatIDR(Number(selectedGoal.current_amount))})
                  </button>
                </div>
              </div>

              {/* Tanggal & Penarik */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tanggal Tarik
                  </label>
                  <input
                    type="date"
                    required
                    value={actionDate}
                    onChange={(e) => setActionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ditarik Oleh
                  </label>
                  <select
                    value={actionHolder}
                    onChange={(e) => setActionHolder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  >
                    {HOLDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rekening Tujuan Masuk (Opsional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Masuk ke Rekening / Kas (Opsional)
                </label>
                <select
                  value={actionPaymentMethodId}
                  onChange={(e) => setActionPaymentMethodId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Tanpa rekening khusus --</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Alasan / Catatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Alasan Penarikan
                </label>
                <input
                  type="text"
                  placeholder="Misal: Keperluan darurat, beli tiket liburan..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || actionAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Konfirmasi Penarikan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------ */}
      {/* MODAL: HAPUS TARGET                                                      */}
      {/* ------------------------------------------------------------------------ */}
      {showDeleteModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Hapus Target Tabungan?
                </h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl space-y-1">
              <p>Target: <strong className="text-slate-900 dark:text-white">{selectedGoal.name}</strong></p>
              <p>Saldo Terkumpul: <strong className="text-emerald-600">{formatIDR(Number(selectedGoal.current_amount))}</strong></p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteGoal}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
