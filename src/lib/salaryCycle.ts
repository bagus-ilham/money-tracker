import { Transaction, SalaryCyclePeriod, SalaryCycleStats, DateFilterPreset, DateRangeFilter } from './types';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_NAMES_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Format date string YYYY-MM-DD to Indonesian readable format, e.g. "28 Agu 2026"
 */
export function formatIndonesianDate(
  dateStr: string,
  opts?: { includeYear?: boolean; shortMonth?: boolean }
): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) {
    return dateStr;
  }

  const monthName = opts?.shortMonth !== false ? MONTH_NAMES_SHORT[monthIdx] : MONTH_NAMES_LONG[monthIdx];
  const includeYear = opts?.includeYear !== false;

  return includeYear ? `${day} ${monthName} ${year}` : `${day} ${monthName}`;
}

/**
 * Helper to get today's date in YYYY-MM-DD
 */
export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to add or subtract days from YYYY-MM-DD
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date string falls inside [startDate, endDate] inclusive
 */
export function isDateWithinRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  if (!dateStr) return false;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

/**
 * Check if a transaction is a loan disbursement or repayment (non-living cost/non-earned income)
 */
export function isLoanTransaction(t: Transaction): boolean {
  const catName = t.categories?.name?.toLowerCase() || '';
  const desc = t.description?.toLowerCase() || '';
  return (
    catName.includes('pinjam') ||
    catName.includes('pelunasan piutang') ||
    desc.includes('[piutang]') ||
    desc.includes('[hutang]')
  );
}

/**
 * Detect salary cycles from transactions list
 */
export function detectSalaryCycles(transactions: Transaction[]): SalaryCyclePeriod[] {
  const today = getTodayString();

  // 1. Filter all income transactions that belong to 'Gaji' or mention 'gaji'
  const salaryTrxs = transactions.filter((t) => {
    if (t.type !== 'income') return false;
    const catName = t.categories?.name?.toLowerCase() || '';
    const desc = t.description?.toLowerCase() || '';
    return catName.includes('gaji') || desc.includes('gaji') || desc.includes('gajian');
  });

  // Group salary transactions by date
  const salaryByDateMap: Record<string, { total: number; descriptions: string[]; dates: string[] }> = {};
  salaryTrxs.forEach((t) => {
    const date = t.trx_date;
    if (!salaryByDateMap[date]) {
      salaryByDateMap[date] = { total: 0, descriptions: [], dates: [] };
    }
    salaryByDateMap[date].total += Number(t.amount);
    if (t.description) {
      salaryByDateMap[date].descriptions.push(t.description);
    }
  });

  // Distinct dates sorted descending
  const sortedDates = Object.keys(salaryByDateMap).sort((a, b) => b.localeCompare(a));

  const cycles: SalaryCyclePeriod[] = [];

  if (sortedDates.length > 0) {
    for (let i = 0; i < sortedDates.length; i++) {
      const startDate = sortedDates[i];
      const salaryInfo = salaryByDateMap[startDate];
      const isCurrent = i === 0;

      let endDate: string;
      if (isCurrent) {
        endDate = today >= startDate ? today : startDate;
      } else {
        const nextDate = sortedDates[i - 1];
        endDate = addDays(nextDate, -1);
      }

      const descSnippet = salaryInfo.descriptions.length > 0 ? salaryInfo.descriptions[0] : 'Gajian';
      const label = isCurrent
        ? `Gajian ${formatIndonesianDate(startDate)} - Sekarang`
        : `Gajian ${formatIndonesianDate(startDate)} - ${formatIndonesianDate(endDate)}`;

      cycles.push({
        id: `salary_${startDate}`,
        label,
        startDate,
        endDate,
        salaryAmount: salaryInfo.total,
        isCurrent,
        description: descSnippet,
      });
    }
  }

  // If no salary transactions exist yet, provide standard monthly cycle based on 25th of month
  if (cycles.length === 0) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    // Cycle for current month
    const startCurr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const endCurr = today;
    cycles.push({
      id: 'default_cycle_current',
      label: `Siklus Bulan Berjalan (${formatIndonesianDate(startCurr)} - Sekarang)`,
      startDate: startCurr,
      endDate: endCurr,
      salaryAmount: 0,
      isCurrent: true,
      description: 'Siklus otomatis',
    });
  }

  return cycles;
}

/**
 * Calculate detailed metrics for a given salary cycle
 */
export function calculateSalaryCycleStats(
  cycle: SalaryCyclePeriod,
  transactions: Transaction[]
): SalaryCycleStats {
  const today = getTodayString();

  // Find all living expenses within the cycle range (excluding loans given out)
  const cycleExpenses = transactions.filter(
    (t) =>
      t.type === 'expense' &&
      !isLoanTransaction(t) &&
      isDateWithinRange(t.trx_date, cycle.startDate, cycle.endDate)
  );

  const totalExpense = cycleExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const remainingSalary = cycle.salaryAmount - totalExpense;

  // Calculate days
  const startD = new Date(cycle.startDate + 'T00:00:00');
  const endD = new Date(cycle.endDate + 'T00:00:00');
  const todayD = new Date(today + 'T00:00:00');

  const diffTotalMs = endD.getTime() - startD.getTime();
  const daysInPeriod = Math.max(1, Math.round(diffTotalMs / (1000 * 60 * 60 * 24)) + 1);

  const effectiveEnd = todayD < endD ? todayD : endD;
  const diffElapsedMs = effectiveEnd.getTime() - startD.getTime();
  const daysElapsed = Math.max(1, Math.round(diffElapsedMs / (1000 * 60 * 60 * 24)) + 1);

  const dailyExpenseAvg = Math.round(totalExpense / daysElapsed);

  return {
    salaryAmount: cycle.salaryAmount,
    totalExpense,
    remainingSalary,
    dailyExpenseAvg,
    daysInPeriod,
    daysElapsed,
  };
}

/**
 * Build DateRangeFilter object based on preset
 */
export function getPresetDateRange(
  preset: DateFilterPreset,
  customStart?: string,
  customEnd?: string,
  cycle?: SalaryCyclePeriod
): DateRangeFilter {
  const today = getTodayString();
  const now = new Date();

  switch (preset) {
    case 'today':
      return {
        preset: 'today',
        startDate: today,
        endDate: today,
        label: 'Hari Ini',
      };

    case 'week': {
      const start = addDays(today, -6);
      return {
        preset: 'week',
        startDate: start,
        endDate: today,
        label: '7 Hari Terakhir',
      };
    }

    case 'month': {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const start = `${year}-${month}-01`;
      return {
        preset: 'month',
        startDate: start,
        endDate: today,
        label: 'Bulan Ini',
      };
    }

    case 'last_month': {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = lastMonthDate.getFullYear();
      const month = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
      const start = `${year}-${month}-01`;
      // Last day of previous month
      const lastDayDate = new Date(now.getFullYear(), now.getMonth(), 0);
      const end = `${year}-${month}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
      return {
        preset: 'last_month',
        startDate: start,
        endDate: end,
        label: `Bulan Lalu (${MONTH_NAMES_SHORT[lastMonthDate.getMonth()]})`,
      };
    }

    case 'salary_cycle': {
      if (cycle) {
        return {
          preset: 'salary_cycle',
          startDate: cycle.startDate,
          endDate: cycle.endDate,
          label: cycle.label,
          salaryCycleId: cycle.id,
        };
      }
      return {
        preset: 'salary_cycle',
        startDate: today,
        endDate: today,
        label: 'Siklus Gajian',
      };
    }

    case 'custom': {
      const start = customStart || today;
      const end = customEnd || today;
      return {
        preset: 'custom',
        startDate: start,
        endDate: end,
        label: `${formatIndonesianDate(start)} - ${formatIndonesianDate(end)}`,
      };
    }

    case 'all':
    default:
      return {
        preset: 'all',
        startDate: '',
        endDate: '',
        label: 'Semua Waktu',
      };
  }
}
