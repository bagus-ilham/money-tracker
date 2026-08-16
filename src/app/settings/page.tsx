'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));

  return (
    <main className="min-h-screen p-5 pt-8">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">Pengaturan</h1>
      </header>

      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Tampilan</h2>
          <button 
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-full glass-panel rounded-2xl p-4 flex justify-between items-center"
          >
            <span className="text-sm font-medium">Mode Gelap (Dark Mode)</span>
            <div className={`w-12 h-6 rounded-full relative transition-colors ${isDark ? 'bg-primary' : 'bg-surface-light'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${isDark ? 'right-0.5' : 'left-0.5'}`}></div>
            </div>
          </button>
        </section>

        <section>
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Notifikasi</h2>
          <div className="glass-panel rounded-2xl p-4 flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Pengingat Tagihan</span>
            <div className="w-12 h-6 bg-surface-light rounded-full relative border border-white/10">
              <div className="w-5 h-5 bg-text-muted rounded-full absolute left-0.5 top-0.5"></div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-4 flex justify-between items-center">
            <span className="text-sm font-medium">Laporan Bulanan</span>
            <div className="w-12 h-6 bg-primary rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
