'use client';

import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

type TrxType = 'income' | 'expense' | 'transfer';

export default function AddTransaction() {
  const [type, setType] = useState<TrxType>('expense');

  return (
    <main className="min-h-screen bg-background">
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
            onClick={() => setType('expense')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${type === 'expense' ? 'bg-expense text-white shadow-md' : 'text-text-muted hover:text-white'}`}
          >
            Pengeluaran
          </button>
          <button 
            onClick={() => setType('income')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${type === 'income' ? 'bg-income text-white shadow-md' : 'text-text-muted hover:text-white'}`}
          >
            Pemasukan
          </button>
          <button 
            onClick={() => setType('transfer')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${type === 'transfer' ? 'bg-transfer text-white shadow-md' : 'text-text-muted hover:text-white'}`}
          >
            Transfer
          </button>
        </div>

        <form className="space-y-5">
          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Nominal</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">Rp</span>
              <input 
                type="number" 
                className="w-full bg-surface border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-xl font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-surface-light"
                placeholder="0"
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
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
                required
              />
            </div>
            
            {/* Holder */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">
                {type === 'transfer' ? 'Penerima' : 'Pemegang Cash'}
              </label>
              <select className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all appearance-none">
                <option value="suami">Suami</option>
                <option value="istri">Istri</option>
              </select>
            </div>
          </div>

          {/* Transfer From (Only for Transfer) */}
          {type === 'transfer' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Dari (Pengirim)</label>
              <select className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all appearance-none">
                <option value="suami">Suami</option>
                <option value="istri">Istri</option>
              </select>
            </div>
          )}

          {/* Category (Hide for Transfer) */}
          {type !== 'transfer' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Kategori</label>
              <select className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all appearance-none">
                {type === 'expense' ? (
                  <>
                    <option>Makan</option>
                    <option>Transport</option>
                    <option>Tagihan</option>
                    <option>Belanja Rumah Tangga</option>
                  </>
                ) : (
                  <>
                    <option>Gaji</option>
                    <option>Bonus</option>
                    <option>Saldo Awal</option>
                  </>
                )}
                <option>Lainnya</option>
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Catatan (Opsional)</label>
            <input 
              type="text" 
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-text-muted/50"
              placeholder="Cth: Beli sayur di pasar"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary-dark hover:to-blue-600 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Save size={18} />
            Simpan Transaksi
          </button>
        </form>
      </div>
    </main>
  );
}
