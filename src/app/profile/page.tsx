import { Settings, RefreshCw, LogOut, Info, Link as LinkIcon, Database } from 'lucide-react';
import Link from 'next/link';

export default function Profile() {
  return (
    <main className="min-h-screen p-5 pt-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold">Profil</h1>
      </header>
      
      {/* User Info Card */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-bl-full -mr-4 -mt-4" />
        <div className="w-20 h-20 bg-surface border-4 border-primary/20 rounded-full mb-4 flex items-center justify-center relative z-10">
          <span className="text-3xl font-bold text-gradient">RM</span>
        </div>
        <h2 className="text-lg font-bold relative z-10">Rumah Tangga</h2>
        <p className="text-sm text-text-muted mt-1 relative z-10">Suami & Istri</p>
      </div>

      {/* Settings Menu */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 ml-2">Pengaturan Sinkronisasi</h3>
        
        <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface border border-white/5 active:bg-surface-light transition-colors">
          <div className="flex items-center gap-3 text-sm font-medium">
            <RefreshCw size={18} className="text-primary" />
            <span>Sync Google Sheets (Manual)</span>
          </div>
          <span className="text-xs text-text-muted bg-surface-light px-2 py-1 rounded-full">Pro</span>
        </button>
        
        <Link href="/sync" className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface border border-white/5 active:bg-surface-light transition-colors mt-2">
          <div className="flex items-center gap-3 text-sm font-medium">
            <LinkIcon size={18} className="text-blue-400" />
            <span>Lihat Google Sheets</span>
          </div>
        </Link>
      </div>

      <div className="space-y-2 mt-6">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 ml-2">Aplikasi</h3>
        
        <Link href="/categories" className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface border border-white/5 active:bg-surface-light transition-colors">
          <div className="flex items-center gap-3 text-sm font-medium">
            <Database size={18} className="text-green-400" />
            <span>Kelola Kategori & Metode</span>
          </div>
        </Link>

        <Link href="/settings" className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface border border-white/5 active:bg-surface-light transition-colors">
          <div className="flex items-center gap-3 text-sm font-medium">
            <Settings size={18} className="text-text-muted" />
            <span>Pengaturan Tema & Notifikasi</span>
          </div>
        </Link>

        <Link href="/about" className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface border border-white/5 active:bg-surface-light transition-colors">
          <div className="flex items-center gap-3 text-sm font-medium">
            <Info size={18} className="text-text-muted" />
            <span>Tentang Aplikasi</span>
          </div>
        </Link>
      </div>

      {/* Logout / Exit */}
      <button className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-expense/10 text-expense border border-expense/20 hover:bg-expense/20 transition-colors mt-8 font-semibold text-sm">
        <LogOut size={18} />
        Keluar
      </button>

      <div className="text-center mt-6 mb-4">
        <p className="text-xs text-text-muted">Money Tracker v1.0.0</p>
      </div>
    </main>
  );
}
