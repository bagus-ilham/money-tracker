'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { addTransaction } from '@/app/actions';

type TrxType = 'income' | 'expense' | 'transfer';
type Category = { id: string, name: string, type: 'income' | 'expense' };

export default function AddTransaction() {
  const router = useRouter();
  const [type, setType] = useState<TrxType>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [holder, setHolder] = useState<'suami' | 'istri'>('suami');
  const [fromHolder, setFromHolder] = useState<'suami' | 'istri'>('suami');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  // Filter categories based on selected transaction type
  const activeCategories = categories.filter(c => c.type === type);

  // Set default category ID when type changes
  useEffect(() => {
    if (type !== 'transfer' && activeCategories.length > 0 && !activeCategories.find(c => c.id === categoryId)) {
      setCategoryId(activeCategories[0].id);
    }
  }, [type, activeCategories, categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert('Nominal harus lebih dari 0');

    setIsSubmitting(true);
    const result = await addTransaction({
      type,
      amount: Number(amount),
      holder,
      from_holder: type === 'transfer' ? fromHolder : undefined,
      category_id: type !== 'transfer' ? categoryId : undefined,
      trx_date: date,
      description
    });

    setIsSubmitting(false);
    if (result.success) {
      router.push('/');
    } else {
      alert('Gagal menyimpan transaksi: ' + result.error);
    }
  };

  return (
    <main className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="pt-8 pb-4 px-5 flex items-center gap-4 bg-surface/50 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-bold">Catat Transaksi</h1>
      </header>

      <div className="p-5">
        {/* Type Selector */}
        <div className="flex bg-surface-light p-1 rounded-xl mb-6">
          <button 
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${type === 'expense' ? 'bg-expense text-white shadow-md' : 'text-text-muted hover:text-white'}`}
          >
            Pengeluaran
          </button>
          <button 
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${type === 'income' ? 'bg-income text-white shadow-md' : 'text-text-muted hover:text-white'}`}
          >
            Pemasukan
          </button>
          <button 
            type="button"
            onClick={() => setType('transfer')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${type === 'transfer' ? 'bg-transfer text-white shadow-md' : 'text-text-muted hover:text-white'}`}
          >
            Transfer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Nominal</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">Rp</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-xl font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-surface-light"
                placeholder="0"
                min="1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Tanggal</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
                required
              />
            </div>
            
            {/* Holder */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">
                {type === 'transfer' ? 'Penerima' : 'Pemegang Cash'}
              </label>
              <select 
                value={holder}
                onChange={(e) => setHolder(e.target.value as 'suami'|'istri')}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all appearance-none"
              >
                <option value="suami">Suami</option>
                <option value="istri">Istri</option>
              </select>
            </div>
          </div>

          {/* Transfer From (Only for Transfer) */}
          {type === 'transfer' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Dari (Pengirim)</label>
              <select 
                value={fromHolder}
                onChange={(e) => setFromHolder(e.target.value as 'suami'|'istri')}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all appearance-none"
              >
                <option value="suami">Suami</option>
                <option value="istri">Istri</option>
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
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all appearance-none"
                required
              >
                <option value="" disabled>-- Pilih Kategori --</option>
                {activeCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Catatan (Opsional)</label>
            <input 
              type="text" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-text-muted/50"
              placeholder="Cth: Beli sayur di pasar"
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary-dark hover:to-blue-600 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={18} />
            {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        </form>
      </div>
    </main>
  );
}
