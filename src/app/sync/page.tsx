import Link from 'next/link';
import { ArrowLeft, RefreshCw, FileText } from 'lucide-react';

export default function SyncSettings() {
  return (
    <main className="min-h-screen p-5 pt-8">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">Sinkronisasi Google Sheets</h1>
      </header>

      <div className="glass-panel p-6 rounded-2xl mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-green-500/20 p-3 rounded-full text-green-400">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="font-bold text-lg">Tersambung</h2>
            <p className="text-sm text-text-muted">Terakhir sinkronisasi: Hari ini, 15:30</p>
          </div>
        </div>
        
        <a href="#" className="block w-full py-3 bg-surface-light border border-white/5 rounded-xl text-center text-sm font-semibold text-blue-400 mb-4 hover:bg-white/5 transition-colors">
          Buka Spreadsheet
        </a>
      </div>

      <button className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-primary text-white hover:bg-primary-dark transition-colors font-semibold text-sm shadow-lg shadow-primary/20">
        <RefreshCw size={18} />
        Sinkronisasi Ulang (Manual Resync)
      </button>
    </main>
  );
}
