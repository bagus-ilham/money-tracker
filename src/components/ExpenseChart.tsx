'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils';
import { PieChart as PieIcon, ChevronRight } from 'lucide-react';

export interface CategoryExpenseItem {
  name: string;
  amount: number;
}

interface ExpenseChartProps {
  data: CategoryExpenseItem[];
  totalExpense: number;
  monthName: string;
}

const PALETTE = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#64748b', // slate
];

export default function ExpenseChart({ data, totalExpense, monthName }: ExpenseChartProps) {
  // Pure computation of SVG donut segments without mutable variable reassignment in render
  const segments = useMemo(() => {
    if (data.length === 0 || totalExpense <= 0) return [];
    const size = 160;
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let offsetAcc = 0;
    return data.map((item, idx) => {
      const percentage = item.amount / totalExpense;
      const strokeDasharray = `${percentage * circumference} ${circumference}`;
      const strokeDashoffset = -offsetAcc;
      offsetAcc += percentage * circumference;
      const color = PALETTE[idx % PALETTE.length];

      return {
        name: item.name,
        amount: item.amount,
        percentage: Math.round(percentage * 100),
        color,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [data, totalExpense]);

  if (data.length === 0 || totalExpense <= 0) {
    return (
      <div className="glass-panel p-5 rounded-2xl mb-8 text-center text-xs text-text-muted">
        <PieIcon className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary" />
        <p>Belum ada pengeluaran di bulan {monthName}.</p>
        <Link
          href="/categories"
          className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-semibold mt-2"
        >
          Cek Keuangan Kategori <ChevronRight size={13} />
        </Link>
      </div>
    );
  }

  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;

  return (
    <div className="glass-panel p-5 rounded-2xl mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
            Pengeluaran per Kategori ({monthName})
          </h2>
          <Link
            href="/categories"
            className="text-[11px] text-primary hover:underline font-semibold inline-flex items-center gap-0.5 mt-0.5"
          >
            Cek Rincian Lengkap <ChevronRight size={12} />
          </Link>
        </div>
        <span className="text-[10px] font-bold text-expense px-2.5 py-1 bg-expense/10 rounded-full">
          {formatIDR(totalExpense)}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* SVG Donut Chart */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-surface-light"
            />
            {/* Slices */}
            {segments.map((seg, i) => (
              <circle
                key={seg.name + i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500 hover:opacity-80"
              />
            ))}
          </svg>

          {/* Center text */}
          <div className="absolute flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <span className="text-[10px] text-text-muted font-medium">Kategori</span>
            <span className="text-sm font-black text-foreground">{data.length}</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="w-full space-y-2 max-h-48 overflow-y-auto pr-1">
          {segments.map((seg) => (
            <div key={seg.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="font-medium text-foreground truncate">{seg.name}</span>
                <span className="text-[10px] text-text-muted shrink-0 font-semibold">{seg.percentage}%</span>
              </div>
              <span className="font-bold text-foreground shrink-0 ml-2">{formatIDR(seg.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
