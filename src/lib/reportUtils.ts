import { Transaction, HolderAccount } from './types';
import { formatIDR, formatHolder } from './utils';

export interface ReportSummaryData {
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRatePct: number;
  omzetBenangbaju: number;
  // Per Account balances
  cashSuami: number;
  atmSuami: number;
  cashIstri: number;
  atmIstri: number;
  totalHouseholdBalance: number;
  totalSavingsLocked: number;
  safeToSpend: number;
  // Budgeting
  totalBudget: number;
  overbudgetCategories: Array<{ name: string; spent: number; budget: number; excess: number }>;
  // Loans
  totalPiutangSisa: number;
  totalHutangSisa: number;
  transactionCount: number;
}

/**
 * Generate formatted WhatsApp message for quick sharing between husband & wife
 */
export function generateWhatsAppReportMessage(data: ReportSummaryData): string {
  const isSurplus = data.netSavings >= 0;
  const statusEmoji = isSurplus ? '🟢 SURPLUS' : '🔴 DEFISIT';

  const lines: string[] = [
    `📊 *LAPORAN EVALUASI KEUANGAN KELUARGA*`,
    `🗓️ *Periode:* ${data.periodLabel}`,
    `----------------------------------------`,
    `💰 *Total Pemasukan:* ${formatIDR(data.totalIncome)}`,
    data.omzetBenangbaju > 0 ? `   _(termasuk Benangbaju: ${formatIDR(data.omzetBenangbaju)})_` : '',
    `💸 *Total Pengeluaran:* ${formatIDR(data.totalExpense)}`,
    `📈 *Sisa Arus Kas:* ${isSurplus ? '+' : ''}${formatIDR(data.netSavings)} (${statusEmoji})`,
    data.totalIncome > 0 ? `🎯 *Tingkat Tabungan (Savings Rate):* ${data.savingsRatePct}%` : '',
    `----------------------------------------`,
    `🏦 *POSISI SALDO DOMPET & REKENING:*`,
    `• Cash Suami: ${formatIDR(data.cashSuami)}`,
    `• ATM Suami: ${formatIDR(data.atmSuami)}`,
    `• Cash Istri: ${formatIDR(data.cashIstri)}`,
    `• ATM Istri: ${formatIDR(data.atmIstri)}`,
    `👉 *Total Likuiditas:* ${formatIDR(data.totalHouseholdBalance)}`,
    data.totalSavingsLocked > 0 ? `🔒 *Terkunci Celengan:* ${formatIDR(data.totalSavingsLocked)}` : '',
    `✨ *Bebas Belanja (Safe to Spend):* ${formatIDR(data.safeToSpend)}`,
  ];

  // Budget status
  if (data.totalBudget > 0) {
    lines.push(`----------------------------------------`);
    lines.push(`🎯 *EVALUASI ANGGARAN BELANJA:*`);
    if (data.overbudgetCategories.length > 0) {
      lines.push(`⚠️ *Perlu Perhatian (Overbudget):*`);
      data.overbudgetCategories.forEach((c) => {
        lines.push(`• ${c.name}: ${formatIDR(c.spent)} (Budget: ${formatIDR(c.budget)}, Over: +${formatIDR(c.excess)})`);
      });
    } else {
      lines.push(`✅ _Hebat! Semua kategori belanja terkendali di bawah anggaran._`);
    }
  }

  // Loans status
  if (data.totalPiutangSisa > 0 || data.totalHutangSisa > 0) {
    lines.push(`----------------------------------------`);
    lines.push(`🤝 *HUTANG & PIUTANG:*`);
    if (data.totalPiutangSisa > 0) {
      lines.push(`• Sisa Piutang di Luar: ${formatIDR(data.totalPiutangSisa)}`);
    }
    if (data.totalHutangSisa > 0) {
      lines.push(`• Sisa Hutang Kewajiban: ${formatIDR(data.totalHutangSisa)}`);
    }
  }

  lines.push(`----------------------------------------`);
  lines.push(`💬 _Dibuat dengan cinta untuk evaluasi berkala keuangan rumah tangga kita._ ❤️`);

  return lines.filter((l) => l !== '').join('\n');
}

/**
 * Generate and trigger download of CSV file
 */
export function downloadTransactionsCSV(
  filename: string,
  transactions: Transaction[]
) {
  const headers = [
    'No',
    'Tanggal Transaksi',
    'Jenis',
    'Kategori',
    'Akun / Pemegang',
    'Metode Pembayaran',
    'Catatan / Deskripsi',
    'Pemasukan (Rp)',
    'Pengeluaran (Rp)',
  ];

  const rows = transactions.map((t, index) => {
    const jenis =
      t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer Internal';
    const kategori = t.categories?.name || (t.type === 'transfer' ? 'Transfer' : '-');
    const akun =
      t.type === 'transfer'
        ? `${formatHolder(t.from_holder)} -> ${formatHolder(t.holder)}`
        : formatHolder(t.holder);
    const metode = t.payment_methods?.name || '-';
    const catatan = `"${(t.description || '-').replace(/"/g, '""')}"`;
    const pemasukan = t.type === 'income' ? Number(t.amount || 0) : '';
    const pengeluaran = t.type === 'expense' ? Number(t.amount || 0) : '';

    return [
      index + 1,
      t.trx_date,
      jenis,
      `"${kategori}"`,
      `"${akun}"`,
      `"${metode}"`,
      catatan,
      pemasukan,
      pengeluaran,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
