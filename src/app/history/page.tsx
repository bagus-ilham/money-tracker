'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowRightLeft, Filter, X, Edit2, Trash2, MoreVertical, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { deleteTransaction, updateTransaction } from '@/app/actions';

type FilterType = 'all' | 'income' | 'expense' | 'transfer';
type DateRangeType = 'all' | 'today' | 'week' | 'month' | 'custom';

export default function History() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [dateRange, setDateRange] = useState<DateRangeType>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [selectedTrx, setSelectedTrx] = useState<any>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({ amount: '', description: '', category_id: '', trx_date: '' });

  const fetchTransactions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .is('deleted_at', null)
      .order('trx_date', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setTransactions(data);
    }
    
    // Fetch categories for edit form
    const { data: catData } = await supabase.from('categories').select('*');
    if (catData) setCategories(catData);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

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

  const filteredTransactions = transactions.filter(trx => {
    const matchType = activeFilter === 'all' ? true : trx.type === activeFilter;
    const matchDate = trx.trx_date ? isDateInRange(trx.trx_date, dateRange) : true;
    return matchType && matchDate;
  });

  const handleDelete = async () => {
    if (!selectedTrx) return;
    setIsSubmitting(true);
    await deleteTransaction(selectedTrx.id);
    await fetchTransactions();
    setShowOptionsModal(false);
    setSelectedTrx(null);
    setIsSubmitting(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrx) return;
    setIsSubmitting(true);
    
    await updateTransaction(selectedTrx.id, {
      amount: parseInt(editForm.amount) || selectedTrx.amount,
      description: editForm.description,
      category_id: editForm.category_id || undefined,
      trx_date: editForm.trx_date
    });
    
    await fetchTransactions();
    setIsEditing(false);
    setSelectedTrx(null);
    setIsSubmitting(false);
  };

  const openOptions = (trx: any) => {
    setSelectedTrx(trx);
    setEditForm({
      amount: trx.amount.toString(),
      description: trx.description || '',
      category_id: trx.category_id || '',
      trx_date: trx.trx_date || new Date().toISOString().split('T')[0]
    });
    setShowOptionsModal(true);
  };

  return (
    <main className="min-h-screen p-5 pt-8 relative">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold">Riwayat Transaksi</h1>
        <button 
          onClick={() => setShowFilterModal(true)}
          className={`p-2 rounded-full border transition-colors ${
            dateRange !== 'all' 
              ? 'bg-primary/20 border-primary text-primary' 
              : 'bg-surface-light border-white/10 text-text-muted hover:text-white'
          }`}
        >
          <Filter size={18} />
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
        <button onClick={() => setActiveFilter('all')} className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeFilter === 'all' ? 'bg-primary text-white' : 'bg-surface border border-white/5 text-text-muted hover:text-white'}`}>Semua</button>
        <button onClick={() => setActiveFilter('income')} className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeFilter === 'income' ? 'bg-primary text-white' : 'bg-surface border border-white/5 text-text-muted hover:text-white'}`}>Pemasukan</button>
        <button onClick={() => setActiveFilter('expense')} className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeFilter === 'expense' ? 'bg-primary text-white' : 'bg-surface border border-white/5 text-text-muted hover:text-white'}`}>Pengeluaran</button>
        <button onClick={() => setActiveFilter('transfer')} className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeFilter === 'transfer' ? 'bg-primary text-white' : 'bg-surface border border-white/5 text-text-muted hover:text-white'}`}>Transfer</button>
      </div>

      <div className="space-y-3 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">Tidak ada transaksi untuk filter ini.</div>
        ) : (
          filteredTransactions.map((trx) => (
            <div key={trx.id} onClick={() => openOptions(trx)} className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-white/5 active:bg-surface-light transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-full ${
                  trx.type === 'income' ? 'bg-income/20 text-income' :
                  trx.type === 'expense' ? 'bg-expense/20 text-expense' :
                  'bg-transfer/20 text-transfer'
                }`}>
                  {trx.type === 'income' ? <ArrowDownRight size={18} strokeWidth={2.5} /> :
                   trx.type === 'expense' ? <ArrowUpRight size={18} strokeWidth={2.5} /> :
                   <ArrowRightLeft size={18} strokeWidth={2.5} />}
                </div>
                <div>
                  <p className="font-semibold text-sm">{trx.categories?.name || 'Transfer'}</p>
                  <p className="text-xs text-text-muted mt-0.5">{trx.trx_date} • {trx.description || 'Tidak ada catatan'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${
                  trx.type === 'income' ? 'text-income' :
                  trx.type === 'expense' ? 'text-foreground' : 'text-transfer'
                }`}>
                  {trx.type === 'income' ? '+' : trx.type === 'expense' ? '-' : ''}
                  {formatIDR(trx.amount)}
                </p>
                <p className="text-[10px] text-text-muted mt-1 uppercase tracking-wider font-medium">
                  {trx.type === 'transfer' ? `${trx.from_holder} → ${trx.holder}` : trx.holder}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Options Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowOptionsModal(false)}>
          <div className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-5 text-center">Opsi Transaksi</h2>
            <div className="space-y-3">
              <button onClick={() => { setShowOptionsModal(false); setIsEditing(true); }} className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90">
                <Edit2 size={18} /> Edit Transaksi
              </button>
              <button onClick={handleDelete} disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl text-sm font-semibold bg-expense/10 text-expense border border-expense/20 hover:bg-expense/20">
                {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <><Trash2 size={18} /> Hapus Transaksi</>}
              </button>
              <button onClick={() => setShowOptionsModal(false)} className="w-full px-5 py-4 rounded-xl text-sm font-semibold text-text-muted hover:text-white pt-2">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setIsEditing(false)} className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-white">
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Edit Transaksi</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Nominal</label>
                <input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} className="w-full bg-surface-light border border-white/5 rounded-lg px-4 py-3 text-sm focus:border-primary focus:outline-none" required />
              </div>
              {selectedTrx?.type !== 'transfer' && (
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Kategori</label>
                  <select value={editForm.category_id} onChange={e => setEditForm({...editForm, category_id: e.target.value})} className="w-full bg-surface-light border border-white/5 rounded-lg px-4 py-3 text-sm focus:border-primary focus:outline-none">
                    <option value="">Pilih Kategori</option>
                    {categories.filter(c => c.type === selectedTrx?.type).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Tanggal</label>
                <input type="date" value={editForm.trx_date} onChange={e => setEditForm({...editForm, trx_date: e.target.value})} className="w-full bg-surface-light border border-white/5 rounded-lg px-4 py-3 text-sm focus:border-primary focus:outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Catatan</label>
                <input type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full bg-surface-light border border-white/5 rounded-lg px-4 py-3 text-sm focus:border-primary focus:outline-none" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-white font-bold py-3 rounded-xl mt-2 flex justify-center items-center">
                {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : 'Simpan Perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Date Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button onClick={() => setShowFilterModal(false)} className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-white"><X size={18} /></button>
            <h2 className="text-lg font-bold mb-5">Filter Waktu</h2>
            <div className="space-y-3">
              {[
                { value: 'all', label: 'Semua Waktu' },
                { value: 'today', label: 'Hari Ini' },
                { value: 'week', label: '7 Hari Terakhir' },
                { value: 'month', label: 'Bulan Ini' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => { setDateRange(opt.value as DateRangeType); setShowFilterModal(false); }} className={`w-full text-left px-5 py-4 rounded-xl text-sm font-semibold transition-colors ${dateRange === opt.value ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-light border border-white/5 text-text-muted hover:bg-white/5'}`}>
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
