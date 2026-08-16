import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

export default function Categories() {
  return (
    <main className="min-h-screen p-5 pt-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">Kelola Kategori</h1>
        </div>
        <button className="p-2 bg-primary/20 text-primary rounded-full">
          <Plus size={20} />
        </button>
      </header>

      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Pemasukan</h2>
          <div className="glass-panel rounded-2xl divide-y divide-white/5">
            {['Gaji', 'Bonus', 'Saldo Awal'].map((cat) => (
              <div key={cat} className="p-4 text-sm font-medium">{cat}</div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Pengeluaran</h2>
          <div className="glass-panel rounded-2xl divide-y divide-white/5">
            {['Makan', 'Transport', 'Tagihan', 'Belanja Rumah Tangga'].map((cat) => (
              <div key={cat} className="p-4 text-sm font-medium">{cat}</div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
