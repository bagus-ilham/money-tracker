'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { addTransaction, transferFunds } from '@/app/actions';
import { useToast } from '@/components/Toast';
import CurrencyInput from '@/components/CurrencyInput';
import { HOLDER_OPTIONS } from '@/lib/utils';
import { Category, PaymentMethod, HolderAccount, TrxType } from '@/lib/types';

export default function AddTransaction() {
  const router = useRouter();
  const { showToast } = useToast();
  const [type, setType] = useState<TrxType>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [holder, setHolder] = useState<HolderAccount>('cash_suami');
  const [fromHolder, setFromHolder] = useState<HolderAccount>('atm_suami');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [description, setDescription] = useState('');
  const [adminFee, setAdminFee] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: catData }, { data: pmData }] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('payment_methods').select('*').order('name'),
      ]);

      if (catData) setCategories(catData);
      if (pmData) {
        setPaymentMethods(pmData);
        if (pmData.length > 0) {
          setPaymentMethodId(pmData[0].id);
        }
      }
    };
    fetchData();
  }, []);

  // Filter categories based on selected transaction type
  const activeCategories = categories.filter((c) => c.type === type);

  // Set default category ID when type changes
  useEffect(() => {
    if (type !== 'transfer' && activeCategories.length > 0 && !activeCategories.find((c) => c.id === categoryId)) {
      setCategoryId(activeCategories[0].id);
    }
  }, [type, activeCategories, categoryId]);

  // Ensure transfer fromHolder and holder are not identical
  useEffect(() => {
    if (type === 'transfer' && fromHolder === holder) {
      const available = HOLDER_OPTIONS.find((opt) => opt.value !== fromHolder);
      if (available) setHolder(available.value);
    }
  }, [type, fromHolder, holder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      showToast('Nominal harus lebih dari 0', 'error');
      return;
    }
    if (type === 'transfer' && fromHolder === holder) {
      showToast('Pengirim dan penerima transfer tidak boleh sama', 'error');
      return;
    }

    setIsSubmitting(true);
    const result =
      type === 'transfer'
        ? await transferFunds({
            from_holder: fromHolder,
            to_holder: holder,
            amount: Number(amount),
            trx_date: date,
            payment_method_id: paymentMethodId || undefined,
            admin_fee: Number(adminFee) || 0,
            description: description.trim() || undefined,
          })
        : await addTransaction({
            type,
            amount: Number(amount),
            holder,
            category_id: categoryId || undefined,
            payment_method_id: paymentMethodId || undefined,
            trx_date: date,
            description: description.trim() || undefined,
          });

    setIsSubmitting(false);
    if (result.success) {
      showToast('Transaksi berhasil disimpan', 'success');
      router.push('/');
    } else {
      showToast('Gagal menyimpan transaksi: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
  };

  return (
    <main className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="pt-8 pb-4 px-5 flex items-center gap-4 bg-surface/80 backdrop-blur-md sticky top-0 z-10 border-b border-foreground/10 dark:border-white/5">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-bold">Catat Transaksi</h1>
      </header>

      <div className="p-5">
        {/* Type Selector */}
        <div className="flex bg-surface-light p-1 rounded-2xl mb-6 border border-foreground/5 dark:border-white/5">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              type === 'expense'
                ? 'bg-expense text-white shadow-md'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              type === 'income'
                ? 'bg-income text-white shadow-md'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            Pemasukan
          </button>
          <button
            type="button"
            onClick={() => setType('transfer')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              type === 'transfer'
                ? 'bg-transfer text-white shadow-md'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            Transfer
          </button>
        </div>

        {/* Transfer Presets (Only when Transfer is active) */}
        {type === 'transfer' && (
          <div className="mb-5 p-3 rounded-2xl bg-surface border border-foreground/10 dark:border-white/5 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Pilihan Cepat Transfer:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFromHolder('atm_suami');
                  setHolder('cash_suami');
                  setDescription('Tarik Tunai ATM ke Dompet');
                }}
                className="p-2 rounded-xl bg-surface-light hover:border-primary/40 border border-foreground/5 text-center text-xs font-semibold active:scale-95 transition-all"
              >
                🏧 Tarik Tunai
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromHolder('atm_suami');
                  setHolder('cash_istri');
                  setDescription('Jatah Belanja Istri');
                }}
                className="p-2 rounded-xl bg-surface-light hover:border-primary/40 border border-foreground/5 text-center text-xs font-semibold active:scale-95 transition-all"
              >
                🎁 Jatah Belanja
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromHolder('cash_suami');
                  setHolder('atm_suami');
                  setDescription('Setor Tunai ke ATM');
                }}
                className="p-2 rounded-xl bg-surface-light hover:border-primary/40 border border-foreground/5 text-center text-xs font-semibold active:scale-95 transition-all"
              >
                💳 Setor Tunai
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Amount using CurrencyInput */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Nominal Transaksi</label>
            <CurrencyInput
              value={amount}
              onChange={(val) => setAmount(val)}
              placeholder="0"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
                required
              />
            </div>

            {/* Holder */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">
                {type === 'transfer' ? 'Penerima' : 'Akun / Cash'}
              </label>
              <select
                value={holder}
                onChange={(e) => setHolder(e.target.value as HolderAccount)}
                className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground appearance-none"
              >
                {HOLDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transfer From (Only for Transfer) */}
          {type === 'transfer' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Dari (Pengirim)</label>
              <select
                value={fromHolder}
                onChange={(e) => setFromHolder(e.target.value as HolderAccount)}
                className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground appearance-none"
              >
                {HOLDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category (Hide for Transfer) */}
          {type !== 'transfer' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Kategori</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground appearance-none"
                required
              >
                <option value="" disabled>
                  -- Pilih Kategori --
                </option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">
              Metode Pembayaran {type === 'expense' ? '(Wajib)' : '(Opsional)'}
            </label>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground appearance-none"
              required={type === 'expense' && paymentMethods.length > 0}
            >
              <option value="">-- Pilih Metode Pembayaran --</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </select>
          </div>

          {/* Biaya Admin for Transfer */}
          {type === 'transfer' && (
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="text-xs font-medium text-text-muted">Biaya Admin (Opsional)</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setAdminFee(0)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      adminFee === 0 ? 'bg-primary text-white font-bold' : 'bg-surface-light text-text-muted'
                    }`}
                  >
                    Rp 0
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminFee(2500)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      adminFee === 2500 ? 'bg-primary text-white font-bold' : 'bg-surface-light text-text-muted'
                    }`}
                  >
                    Rp 2.500
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminFee(6500)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      adminFee === 6500 ? 'bg-primary text-white font-bold' : 'bg-surface-light text-text-muted'
                    }`}
                  >
                    Rp 6.500
                  </button>
                </div>
              </div>
              <CurrencyInput
                value={adminFee}
                onChange={(val) => setAdminFee(val)}
                placeholder="0"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Catatan (Opsional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-text-muted/50 text-foreground"
              placeholder="Cth: Beli sayur di pasar"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary-dark hover:to-blue-600 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Menyimpan...
              </>
            ) : (
              <>
                <Save size={18} />
                Simpan Transaksi
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
