'use client';

import React, { useState } from 'react';
import { X, Calendar, DollarSign, Clock, Check, ArrowRight } from 'lucide-react';
import { DateRangeFilter, DateFilterPreset, SalaryCyclePeriod } from '@/lib/types';
import { formatIDR } from '@/lib/utils';
import {
  getTodayString,
  addDays,
  getPresetDateRange,
  formatIndonesianDate,
} from '@/lib/salaryCycle';

interface DateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilter: DateRangeFilter;
  onSelectFilter: (filter: DateRangeFilter) => void;
  salaryCycles: SalaryCyclePeriod[];
}

type ModalTab = 'preset' | 'salary' | 'custom';

export default function DateRangeModal({
  isOpen,
  onClose,
  currentFilter,
  onSelectFilter,
  salaryCycles,
}: DateRangeModalProps) {
  const today = getTodayString();
  const [activeTab, setActiveTab] = useState<ModalTab>(
    currentFilter.preset === 'salary_cycle'
      ? 'salary'
      : currentFilter.preset === 'custom'
      ? 'custom'
      : 'preset'
  );

  const [customStart, setCustomStart] = useState<string>(
    currentFilter.preset === 'custom' ? currentFilter.startDate : addDays(today, -30)
  );
  const [customEnd, setCustomEnd] = useState<string>(
    currentFilter.preset === 'custom' ? currentFilter.endDate : today
  );

  if (!isOpen) return null;

  const handleSelectPreset = (preset: DateFilterPreset) => {
    const filter = getPresetDateRange(preset);
    onSelectFilter(filter);
    onClose();
  };

  const handleSelectCycle = (cycle: SalaryCyclePeriod) => {
    const filter = getPresetDateRange('salary_cycle', undefined, undefined, cycle);
    onSelectFilter(filter);
    onClose();
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;

    let start = customStart;
    let end = customEnd;
    if (start > end) {
      // swap if user put end before start
      const temp = start;
      start = end;
      end = temp;
    }

    const filter = getPresetDateRange('custom', start, end);
    onSelectFilter(filter);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-5 shadow-2xl relative animate-in slide-in-from-bottom-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-foreground/10 dark:border-white/5 shrink-0">
          <div>
            <h2 className="text-base font-bold">Pilih Periode Waktu</h2>
            <p className="text-[11px] text-text-muted mt-0.5 font-medium">
              Aktif: <span className="text-primary font-semibold">{currentFilter.label}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-surface-light p-1 rounded-2xl my-3.5 border border-foreground/5 dark:border-white/5 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('preset')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'preset'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            <Clock size={14} /> Preset
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('salary')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'salary'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            <DollarSign size={14} /> Siklus Gajian
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'custom'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            <Calendar size={14} /> Kustom
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="overflow-y-auto space-y-2 py-1 pr-0.5">
          {/* 1. Preset Tab */}
          {activeTab === 'preset' && (
            <div className="space-y-2">
              {[
                { preset: 'today' as DateFilterPreset, label: 'Hari Ini' },
                { preset: 'week' as DateFilterPreset, label: '7 Hari Terakhir' },
                { preset: 'month' as DateFilterPreset, label: 'Bulan Ini' },
                { preset: 'last_month' as DateFilterPreset, label: 'Bulan Lalu' },
                { preset: 'all' as DateFilterPreset, label: 'Semua Waktu' },
              ].map((item) => {
                const isSelected = currentFilter.preset === item.preset;
                return (
                  <button
                    key={item.preset}
                    onClick={() => handleSelectPreset(item.preset)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-primary/15 border-primary text-primary dark:text-emerald-400 font-bold'
                        : 'bg-surface-light/60 border-foreground/5 dark:border-white/5 text-foreground hover:bg-surface-light'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isSelected && <Check size={16} className="text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. Salary Cycles Tab */}
          {activeTab === 'salary' && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-text-muted mb-2 px-1">
                Pilih periode pengeluaran yang dihitung sejak uang gajian masuk:
              </p>

              {salaryCycles.length === 0 ? (
                <div className="p-5 text-center text-xs text-text-muted glass-panel rounded-2xl">
                  Belum ada transaksi dengan kategori &quot;Gaji&quot; yang tercatat.
                </div>
              ) : (
                salaryCycles.map((cycle) => {
                  const isSelected =
                    currentFilter.preset === 'salary_cycle' &&
                    (currentFilter.salaryCycleId === cycle.id ||
                      (currentFilter.startDate === cycle.startDate && currentFilter.endDate === cycle.endDate));

                  return (
                    <div
                      key={cycle.id}
                      onClick={() => handleSelectCycle(cycle)}
                      className={`p-3.5 rounded-2xl text-xs transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500 text-foreground dark:text-white shadow-sm'
                          : 'bg-surface-light/60 border-foreground/5 dark:border-white/5 text-foreground hover:bg-surface-light'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{cycle.label}</span>
                          {cycle.isCurrent && (
                            <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500 text-white rounded-full">
                              Siklus Aktif
                            </span>
                          )}
                        </div>
                        {isSelected && <Check size={16} className="text-emerald-500 shrink-0" />}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-foreground/5 dark:border-white/5 text-[11px]">
                        <span className="text-text-muted">
                          {formatIndonesianDate(cycle.startDate)} s/d {formatIndonesianDate(cycle.endDate)}
                        </span>
                        {cycle.salaryAmount > 0 && (
                          <span className="font-bold text-income">
                            {formatIDR(cycle.salaryAmount)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 3. Custom Date Range Tab */}
          {activeTab === 'custom' && (
            <form onSubmit={handleApplyCustom} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-1">
                  Dari Tanggal (Mulai)
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none text-foreground font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 ml-1">
                  Sampai Tanggal (Selesai)
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-surface-light border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none text-foreground font-medium"
                  required
                />
              </div>

              <div className="p-3 bg-surface-light rounded-xl border border-foreground/5 dark:border-white/5 text-xs text-text-muted flex items-center justify-between">
                <span>Rentang dipilih:</span>
                <span className="font-bold text-foreground">
                  {formatIndonesianDate(customStart)} → {formatIndonesianDate(customEnd)}
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-primary/20"
              >
                <span>Terapkan Rentang Tanggal</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
