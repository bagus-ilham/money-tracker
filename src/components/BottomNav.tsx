'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, List, User, PieChart } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Riwayat', href: '/history', icon: List },
    { name: 'Catat', href: '/add', icon: PlusCircle, isMain: true },
    { name: 'Kategori', href: '/categories', icon: PieChart },
    { name: 'Profil', href: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-surface/95 backdrop-blur-lg border-t border-foreground/10 dark:border-white/10 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
      <div className="flex justify-around items-center px-3 py-2.5 pb-safe-area">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isMain) {
            return (
              <Link key={item.name} href={item.href} className="relative -top-5">
                <div className="bg-gradient-to-tr from-primary to-blue-500 p-3.5 rounded-full shadow-lg shadow-primary/30 transform transition-transform hover:scale-105 active:scale-95">
                  <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center p-1.5 transition-colors ${
                isActive ? 'text-primary' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
