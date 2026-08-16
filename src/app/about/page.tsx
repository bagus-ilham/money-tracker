import Link from 'next/link';
import { ArrowLeft, Globe } from 'lucide-react';

export default function About() {
  return (
    <main className="min-h-screen p-5 pt-8 text-center flex flex-col items-center">
      <header className="w-full mb-12 flex items-center gap-4 text-left">
        <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">Tentang Aplikasi</h1>
      </header>

      <div className="w-24 h-24 bg-gradient-to-tr from-primary to-blue-500 rounded-3xl shadow-xl shadow-primary/30 flex items-center justify-center mb-6">
        <span className="text-4xl font-black text-white">MT</span>
      </div>
      
      <h2 className="text-2xl font-bold mb-2">Money Tracker</h2>
      <p className="text-text-muted mb-8 max-w-[250px]">
        Aplikasi pencatat keuangan rumah tangga yang dirancang khusus untuk memisahkan kepemilikan cash suami & istri.
      </p>

      <div className="glass-panel p-4 rounded-2xl w-full flex justify-around mb-8">
        <div className="text-center">
          <p className="text-sm font-bold">1.0.0</p>
          <p className="text-xs text-text-muted">Versi</p>
        </div>
        <div className="w-px bg-white/10"></div>
        <div className="text-center">
          <p className="text-sm font-bold">MVP</p>
          <p className="text-xs text-text-muted">Fase</p>
        </div>
      </div>

      <div className="flex gap-4">
        <button className="p-3 bg-surface border border-white/5 rounded-full hover:bg-surface-light transition-colors">
          <Globe size={20} />
        </button>
      </div>
    </main>
  );
}
