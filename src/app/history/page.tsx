'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowRightLeft, Filter, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type FilterType = 'all' | 'income' | 'expense' | 'transfer';
type DateRangeType = 'all' | 'today' | 'week' | 'month' | 'custom';

export default function History() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [dateRange, setDateRange] = useState<DateRangeType>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        <button 
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeFilter === 'all' ? 'bg-primary text-white' : 'bg-surface border border-white/5 text-text-muted hover:text-white'
          }`}
        >
          Semua
        </button>
        <button 
          onClick={() => setActiveFilter('income')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeFilter === 'income' ? 'bg-primary text-white' : 'bg-surface border border-white/5 text-text-muted hover:text-white'
          }`}
        >
          Pemasukan
        </button>
        <button 
          onClick={() => setActiveFilter('expense')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeFilter === 'expense' ? 'bg-primary text-white' : 'bg-surface border border-white/5 text-text-muted hover:text-white'
          }`}
        >
          Pengeluaran
        </button>
        <button 
          onClick={() => setActiveFilter('transfer')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeFilter === 'transfer' ? 'bg-primary text-white' : 'bg-surface border border-white/5 text-text-muted hover:text-white'
          }`}
        >
          Transfer
        </button>
      </div>

      <div className="space-y-3 pb-24">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">
            Tidak ada transaksi untuk filter ini.
          </div>
        ) : (
          filteredTransactions.map((trx) => (
            <div key={trx.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-white/5 active:bg-surface-light transition-colors">
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
                  <p className="font-semibold text-sm">{trx.category || 'Transfer'}</p>
                  <p className="text-xs text-text-muted mt-0.5">{trx.date} • {trx.description || 'Tidak ada catatan'}</p>
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

      {/* Date Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button 
              onClick={() => setShowFilterModal(false)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-white"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Filter Waktu</h2>
            
            <div className="space-y-3">
              {[
                { value: 'all', label: 'Semua Waktu' },
                { value: 'today', label: 'Hari Ini' },
                { value: 'week', label: '7 Hari Terakhir' },
                { value: 'month', label: 'Bulan Ini' },
                { value: 'custom', label: 'Pilih Rentang Waktu...' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setDateRange(opt.value as DateRangeType);
                    if (opt.value !== 'custom') setShowFilterModal(false);
                  }}
                  className={`w-full text-left px-5 py-4 rounded-xl text-sm font-semibold transition-colors ${
                    dateRange === opt.value
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-surface-light border border-white/5 text-text-muted hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              {dateRange === 'custom' && (
                <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-3 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Mulai</label>
                    <input type="date" className="w-full bg-surface-light border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Sampai</label>
                    <input type="date" className="w-full bg-surface-light border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <button 
                    onClick={() => setShowFilterModal(false)}
                    className="col-span-2 mt-2 bg-primary text-white font-bold py-3 rounded-xl"
                  >
                    Terapkan Rentang Waktu
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
