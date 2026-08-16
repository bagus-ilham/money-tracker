import { ArrowUpRight, ArrowDownRight, ArrowRightLeft, Wallet } from 'lucide-react';
import Link from 'next/link';
// import { supabase } from '@/lib/supabase'; // We will use this when ready

// Mock data for UI development
const mockData = {
  totalBalance: 12500000,
  suamiCash: 8000000,
  istriCash: 4500000,
  recentTransactions: [
    { id: '1', type: 'expense', amount: 150000, holder: 'istri', category: 'Belanja Dapur', date: 'Hari ini', description: 'Sayur & Buah' },
    { id: '2', type: 'transfer', amount: 2000000, holder: 'istri', from_holder: 'suami', date: 'Kemarin', description: 'Uang Bulanan' },
    { id: '3', type: 'income', amount: 15000000, holder: 'suami', category: 'Gaji', date: '1 Agustus', description: 'Gaji Juli' },
  ]
};

export default function Home() {
  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <main className="min-h-screen p-5 pt-8">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-sm text-text-muted font-medium mb-1">Total Rumah Tangga</h1>
          <div className="text-3xl font-bold text-gradient tracking-tight">
            {formatIDR(mockData.totalBalance)}
          </div>
        </div>
        <div className="bg-surface-light p-2.5 rounded-full border border-white/10">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
      </header>

      {/* Cash per Holder Cards */}
      <section className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-panel p-4 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <h2 className="text-xs text-text-muted font-medium mb-2 relative z-10">Cash Suami</h2>
          <p className="text-lg font-bold text-white relative z-10">{formatIDR(mockData.suamiCash)}</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-pink-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <h2 className="text-xs text-text-muted font-medium mb-2 relative z-10">Cash Istri</h2>
          <p className="text-lg font-bold text-white relative z-10">{formatIDR(mockData.istriCash)}</p>
        </div>
      </section>

      {/* Recent Transactions */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Transaksi Terbaru</h2>
          <Link href="/history" className="text-xs text-primary font-medium">Lihat Semua</Link>
        </div>
        
        <div className="space-y-3">
          {mockData.recentTransactions.map((trx) => (
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
                  <p className="text-xs text-text-muted mt-0.5">{trx.description || 'Tidak ada catatan'}</p>
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
          ))}
        </div>
      </section>
    </main>
  );
}
