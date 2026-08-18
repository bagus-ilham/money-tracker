'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Link as LinkIcon,
  Database,
  CreditCard,
  RefreshCw,
  Moon,
  Sun,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import InstallButton from '@/components/InstallButton';
import { useToast } from '@/components/Toast';

export default function Profile() {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    status: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark =
    mounted &&
    (theme === 'dark' ||
      (theme === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches));

  const sheetsUrl =
    process.env.NEXT_PUBLIC_SHEETS_URL ||
    'https://docs.google.com/spreadsheets/d/1Ts4gqrcRJuf7gx8kfll4k7DGw7PXDMWeaQ0WWPJNnjI/edit';

  const handleFullResync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);

    try {
      const res = await fetch('/api/full-resync', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        const msg = `Sinkronisasi berhasil (${data.count || 0} transaksi)`;
        setSyncStatus({ status: 'success', message: msg });
        showToast(msg, 'success');
      } else {
        const errorMsg = data.error || 'Gagal melakukan sinkronisasi';
        setSyncStatus({ status: 'error', message: errorMsg });
        showToast(errorMsg, 'error');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Terjadi kesalahan jaringan';
      setSyncStatus({ status: 'error', message: errorMsg });
      showToast(errorMsg, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <main className="min-h-screen p-5 pt-8 pb-28">
      <header className="mb-6">
        <h1 className="text-xl font-bold">Profil & Pengaturan</h1>
      </header>

      {/* User Info Card */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-bl-full -mr-4 -mt-4" />
        <div className="w-20 h-20 bg-surface border-4 border-primary/20 rounded-full mb-4 flex items-center justify-center relative z-10 shadow-sm">
          <span className="text-3xl font-extrabold text-gradient">RM</span>
        </div>
        <h2 className="text-lg font-bold relative z-10">Keuangan Rumah Tangga</h2>
        <p className="text-xs text-text-muted mt-1 relative z-10 font-medium">Suami & Istri</p>
      </div>

      {/* Master Data Section */}
      <div className="space-y-2 mb-6">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-2">Master Data</h3>

        <Link
          href="/categories"
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface border border-foreground/10 dark:border-white/5 active:bg-surface-light transition-colors"
        >
          <div className="flex items-center gap-3 text-sm font-medium">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Database size={18} />
            </div>
            <span>Kelola Kategori</span>
          </div>
        </Link>

        <Link
          href="/payment-methods"
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface border border-foreground/10 dark:border-white/5 active:bg-surface-light transition-colors"
        >
          <div className="flex items-center gap-3 text-sm font-medium">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <CreditCard size={18} />
            </div>
            <span>Kelola Metode Pembayaran</span>
          </div>
        </Link>
      </div>

      {/* Tampilan / Theme Section */}
      <div className="space-y-2 mb-6">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-2">Tampilan</h3>

        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="w-full glass-panel rounded-2xl p-4 flex justify-between items-center transition-colors hover:bg-surface-light"
        >
          <div className="flex items-center gap-3 text-sm font-medium">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              {isDark ? <Moon size={18} /> : <Sun size={18} />}
            </div>
            <span>Mode Gelap (Dark Mode)</span>
          </div>
          <div
            className={`w-12 h-6 rounded-full relative transition-colors ${
              isDark ? 'bg-primary' : 'bg-surface-light border border-foreground/15'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                isDark ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </div>
        </button>
      </div>

      {/* Google Sheets Sync & Backup Section */}
      <div className="space-y-3 mb-6">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-2">Sinkronisasi Google Sheets</h3>

        <div className="glass-panel p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <a
              href={sheetsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-xs font-semibold text-primary hover:underline"
            >
              <LinkIcon size={14} />
              Buka Google Spreadsheet
            </a>

            <button
              onClick={handleFullResync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSyncing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  Full Resync
                </>
              )}
            </button>
          </div>

          {syncStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                syncStatus.status === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'
              }`}
            >
              {syncStatus.status === 'success' ? (
                <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle size={14} className="shrink-0 text-rose-500" />
              )}
              <span className="truncate">{syncStatus.message}</span>
            </div>
          )}
        </div>

        <InstallButton />
      </div>

      <div className="text-center mt-8 mb-4">
        <p className="text-xs text-text-muted font-medium">Money Tracker v1.0.0</p>
      </div>
    </main>
  );
}
