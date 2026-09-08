import { google } from 'googleapis';
import { getServiceRoleClient } from '@/lib/supabase';
import { formatHolder } from '@/lib/utils';

function toWibDateTime(isoString?: string | null): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().replace('T', ' ').substring(0, 19);
}

function classifyTransaction(t: any): string {
  const catName = t.categories?.name || '';
  if (catName === 'Pelunasan Piutang') return 'Pelunasan Piutang';
  if (catName === 'Pinjaman') return 'Pinjaman Keluar';
  if (catName === 'Benangbaju') return 'Omzet Bisnis (Benangbaju)';
  if (catName === 'Gaji') return 'Gaji Pokok';
  if (t.type === 'transfer') return 'Transfer Internal';
  if (t.type === 'income') return 'Pemasukan Lainnya';
  return 'Pengeluaran Rumah Tangga';
}

export async function resyncGoogleSheets(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return { success: false, count: 0, error: 'Google Sheets credentials missing in environment variables' };
    }

    const supabase = getServiceRoleClient();

    // 1. Fetch Transactions, Loans, Loan Payments, Categories, and Saving Goals
    const [
      { data: trxs, error: trxsErr },
      { data: loans, error: loansErr },
      { data: payments, error: paymentsErr },
      { data: categoriesList, error: catsErr },
      { data: savingGoals, error: goalsErr },
      { data: savingLogs, error: logsErr },
    ] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(name), payment_methods(name)')
        .is('deleted_at', null)
        .order('trx_date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('loans')
        .select('*, payment_methods(name)')
        .is('deleted_at', null)
        .order('loan_date', { ascending: true }),
      supabase
        .from('loan_payments')
        .select('*, payment_methods(name), loans(person_name, type)')
        .is('deleted_at', null)
        .order('payment_date', { ascending: true }),
      supabase
        .from('categories')
        .select('*')
        .order('name'),
      supabase
        .from('saving_goals')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('saving_goal_logs')
        .select('*, saving_goals(name), payment_methods(name)')
        .is('deleted_at', null)
        .order('log_date', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (trxsErr) throw trxsErr;
    if (loansErr) console.warn('Warning fetching loans:', loansErr);
    if (paymentsErr) console.warn('Warning fetching payments:', paymentsErr);
    if (goalsErr) console.warn('Warning fetching saving goals:', goalsErr);
    if (logsErr) console.warn('Warning fetching saving logs:', logsErr);

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Get spreadsheet metadata and ensure all required sheets exist
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = spreadsheetMeta.data.sheets || [];

    let sheet1Obj = sheetList.find((s) => s.properties?.title === 'Sheet1') || sheetList[0];
    const sheet1Id = sheet1Obj?.properties?.sheetId ?? 0;
    const sheet1Title = sheet1Obj?.properties?.title || 'Sheet1';

    let ringkasanSheet = sheetList.find((s) => s.properties?.title === 'Ringkasan');
    let ringkasanSheetId = ringkasanSheet?.properties?.sheetId;

    let loansSheet = sheetList.find((s) => s.properties?.title === 'Hutang & Piutang');
    let loansSheetId = loansSheet?.properties?.sheetId;

    let savingsSheet = sheetList.find((s) => s.properties?.title === 'Target Tabungan');
    let savingsSheetId = savingsSheet?.properties?.sheetId;

    let transferSheet = sheetList.find((s) => s.properties?.title === 'Transfer & Mutasi Akun');
    let transferSheetId = transferSheet?.properties?.sheetId;

    const addSheetRequests: any[] = [];
    if (!ringkasanSheet) {
      addSheetRequests.push({ addSheet: { properties: { title: 'Ringkasan' } } });
    }
    if (!loansSheet) {
      addSheetRequests.push({ addSheet: { properties: { title: 'Hutang & Piutang' } } });
    }
    if (!savingsSheet) {
      addSheetRequests.push({ addSheet: { properties: { title: 'Target Tabungan' } } });
    }
    if (!transferSheet) {
      addSheetRequests.push({ addSheet: { properties: { title: 'Transfer & Mutasi Akun' } } });
    }

    if (addSheetRequests.length > 0) {
      const addRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: addSheetRequests },
      });
      addRes.data.replies?.forEach((rep) => {
        const title = rep.addSheet?.properties?.title;
        const id = rep.addSheet?.properties?.sheetId;
        if (title === 'Ringkasan') ringkasanSheetId = id;
        if (title === 'Hutang & Piutang') loansSheetId = id;
        if (title === 'Target Tabungan') savingsSheetId = id;
        if (title === 'Transfer & Mutasi Akun') transferSheetId = id;
      });
    }

    // ==========================================
    // 3. Prepare Transactions Data (Sheet1)
    // 12 Columns:
    // A: ID | B: Tanggal | C: Waktu Input (WIB) | D: Jenis | E: Klasifikasi | F: Kategori | G: Akun / Pemegang | H: Metode Bayar | I: Catatan | J: Pemasukan | K: Pengeluaran | L: Saldo
    // ==========================================
    const headersSheet1 = [
      'ID',
      'Tanggal Transaksi',
      'Waktu Input (WIB)',
      'Jenis',
      'Klasifikasi',
      'Kategori',
      'Akun / Pemegang',
      'Metode Bayar',
      'Catatan',
      'Pemasukan (Rp)',
      'Pengeluaran (Rp)',
      'Saldo Kumulatif (Rp)',
    ];

    const rowsSheet1 = (trxs || []).map((t: any, idx: number) => {
      const rowNum = idx + 2;
      const jenis = t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer';
      const klasifikasi = classifyTransaction(t);
      const kategori = t.categories?.name || (t.type === 'transfer' ? 'Transfer Internal' : '-');
      const akun = t.type === 'transfer' ? `${formatHolder(t.from_holder)} → ${formatHolder(t.holder)}` : formatHolder(t.holder);
      const metodeBayar = t.payment_methods?.name || '-';
      const waktuWib = toWibDateTime(t.created_at);

      const pemasukan = t.type === 'income' ? Number(t.amount) : '';
      const pengeluaran = t.type === 'expense' ? Number(t.amount) : '';
      const formulaSaldo = `=SUM($J$2:J${rowNum})-SUM($K$2:K${rowNum})`;

      return [
        t.id,
        t.trx_date,
        waktuWib,
        jenis,
        klasifikasi,
        kategori,
        akun,
        metodeBayar,
        t.description || '-',
        pemasukan,
        pengeluaran,
        formulaSaldo,
      ];
    });

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheet1Title}!A1:Z5000`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheet1Title}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headersSheet1, ...rowsSheet1] },
    });

    // ==========================================
    // 4. Prepare Summary Data ('Ringkasan')
    // ==========================================
    const calcHolder = (key: string, legacyKey?: string) => {
      return (trxs || []).reduce((sum: number, t: any) => {
        const matchHolder = t.holder === key || (legacyKey && t.holder === legacyKey);
        const matchFromHolder = t.from_holder === key || (legacyKey && t.from_holder === legacyKey);
        if (t.type === 'income' && matchHolder) return sum + Number(t.amount);
        if (t.type === 'expense' && matchHolder) return sum - Number(t.amount);
        if (t.type === 'transfer') {
          if (matchFromHolder) sum -= Number(t.amount);
          if (matchHolder) sum += Number(t.amount);
        }
        return sum;
      }, 0);
    };

    const cashSuami = calcHolder('cash_suami', 'suami');
    const atmSuami = calcHolder('atm_suami');
    const cashIstri = calcHolder('cash_istri', 'istri');
    const atmIstri = calcHolder('atm_istri');
    const totalSaldo = (trxs || []).reduce((sum: number, t: any) => {
      if (t.type === 'income') return sum + Number(t.amount);
      if (t.type === 'expense') return sum - Number(t.amount);
      return sum;
    }, 0);

    // Loans summary calculations
    let totalPiutangPokok = 0;
    let totalPiutangDibayar = 0;
    let totalPiutangSisa = 0;
    let totalHutangPokok = 0;
    let totalHutangDibayar = 0;
    let totalHutangSisa = 0;

    (loans || []).forEach((l: any) => {
      const pokok = Number(l.total_amount || 0);
      const dibayar = Number(l.paid_amount || 0);
      const sisa = Math.max(0, pokok - dibayar);

      if (l.type === 'receivable') {
        totalPiutangPokok += pokok;
        totalPiutangDibayar += dibayar;
        totalPiutangSisa += sisa;
      } else if (l.type === 'payable') {
        totalHutangPokok += pokok;
        totalHutangDibayar += dibayar;
        totalHutangSisa += sisa;
      }
    });

    // Current Month category expense grouping (pure living expenses)
    const currentYearMonth = new Date().toISOString().substring(0, 7);
    const catExpenseMap: Record<string, number> = {};
    const monthlyMap: Record<string, { income: number; expense: number; omzet: number }> = {};

    (trxs || []).forEach((t: any) => {
      const ym = t.trx_date ? t.trx_date.substring(0, 7) : 'Unknown';
      if (!monthlyMap[ym]) monthlyMap[ym] = { income: 0, expense: 0, omzet: 0 };
      const catName = t.categories?.name || 'Lainnya';

      if (t.type === 'income') {
        if (catName === 'Benangbaju') {
          monthlyMap[ym].omzet += Number(t.amount);
        }
        monthlyMap[ym].income += Number(t.amount);
      }
      if (t.type === 'expense') {
        monthlyMap[ym].expense += Number(t.amount);
        if (t.trx_date && t.trx_date.startsWith(currentYearMonth) && catName !== 'Pinjaman') {
          catExpenseMap[catName] = (catExpenseMap[catName] || 0) + Number(t.amount);
        }
      }
    });

    const categoryBudgetRows = Object.entries(catExpenseMap)
      .sort((a, b) => b[1] - a[1])
      .map(([catName, spent]) => {
        const catObj = (categoriesList || []).find((c: any) => c.name === catName);
        const budget = Number(catObj?.monthly_budget || 0);
        const sisa = budget > 0 ? budget - spent : '-';
        const pct = budget > 0 ? `${Math.round((spent / budget) * 100)}%` : '-';
        return [catName, spent, budget > 0 ? budget : '-', sisa, pct];
      });

    const totalSavingsLocked = (savingGoals || []).reduce(
      (sum: number, g: any) => sum + Number(g.current_amount || 0),
      0
    );

    // Per-Account flow breakdown (Inflow, Outflow, Transfer In, Transfer Out, End Balance)
    const getAccountFlow = (key: string, legacyKey?: string) => {
      let income = 0;
      let expense = 0;
      let transferIn = 0;
      let transferOut = 0;

      (trxs || []).forEach((t: any) => {
        const isHolder = t.holder === key || (legacyKey && t.holder === legacyKey);
        const isFromHolder = t.from_holder === key || (legacyKey && t.from_holder === legacyKey);

        if (t.type === 'income' && isHolder) {
          income += Number(t.amount);
        } else if (t.type === 'expense' && isHolder) {
          expense += Number(t.amount);
        } else if (t.type === 'transfer') {
          if (isFromHolder) transferOut += Number(t.amount);
          if (isHolder) transferIn += Number(t.amount);
        }
      });

      const finalBalance = income - expense + transferIn - transferOut;
      return { income, expense, transferIn, transferOut, finalBalance };
    };

    const flowCashSuami = getAccountFlow('cash_suami', 'suami');
    const flowAtmSuami = getAccountFlow('atm_suami');
    const flowCashIstri = getAccountFlow('cash_istri', 'istri');
    const flowAtmIstri = getAccountFlow('atm_istri');

    // Reconciliation transactions
    const reconciliationTrxs = (trxs || []).filter(
      (t: any) =>
        t.categories?.name === 'Penyesuaian Saldo' ||
        (t.description && t.description.startsWith('[Rekonsiliasi Saldo]'))
    );

    const summaryValues: (string | number)[][] = [
      ['RINGKASAN SALDO DOMPET & REKENING', ''],
      ['Akun / Pemegang', 'Saldo Riil (Rp)'],
      ['Cash Suami (Dompet Tunai)', cashSuami],
      ['ATM Suami (Rekening Bank)', atmSuami],
      ['Cash Istri (Dompet Tunai)', cashIstri],
      ['ATM Istri (Rekening Bank)', atmIstri],
      ['TOTAL SALDO TERSEDIA', totalSaldo],
      ['DANA TERKUNCI TABUNGAN (CELENGAN)', totalSavingsLocked],
      ['SALDO BEBAS BELANJA (SAFE TO SPEND)', totalSaldo - totalSavingsLocked],
      ['', ''],
      ['RINCIAN ARUS & POSISI SALDO PER DOMPET / REKENING', '', '', '', '', ''],
      [
        'Akun / Pemegang',
        'Pemasukan (Rp)',
        'Pengeluaran (Rp)',
        'Transfer Masuk (Rp)',
        'Transfer Keluar (Rp)',
        'Saldo Akhir Riil (Rp)',
      ],
      [
        'Cash Suami (Dompet Tunai)',
        flowCashSuami.income,
        flowCashSuami.expense,
        flowCashSuami.transferIn,
        flowCashSuami.transferOut,
        flowCashSuami.finalBalance,
      ],
      [
        'ATM Suami (Rekening Bank)',
        flowAtmSuami.income,
        flowAtmSuami.expense,
        flowAtmSuami.transferIn,
        flowAtmSuami.transferOut,
        flowAtmSuami.finalBalance,
      ],
      [
        'Cash Istri (Dompet Tunai)',
        flowCashIstri.income,
        flowCashIstri.expense,
        flowCashIstri.transferIn,
        flowCashIstri.transferOut,
        flowCashIstri.finalBalance,
      ],
      [
        'ATM Istri (Rekening Bank)',
        flowAtmIstri.income,
        flowAtmIstri.expense,
        flowAtmIstri.transferIn,
        flowAtmIstri.transferOut,
        flowAtmIstri.finalBalance,
      ],
      [
        'TOTAL GABUNGAN RUMAH TANGGA',
        flowCashSuami.income + flowAtmSuami.income + flowCashIstri.income + flowAtmIstri.income,
        flowCashSuami.expense + flowAtmSuami.expense + flowCashIstri.expense + flowAtmIstri.expense,
        flowCashSuami.transferIn + flowAtmSuami.transferIn + flowCashIstri.transferIn + flowAtmIstri.transferIn,
        flowCashSuami.transferOut + flowAtmSuami.transferOut + flowCashIstri.transferOut + flowAtmIstri.transferOut,
        totalSaldo,
      ],
      ['', ''],
      ['STATUS HUTANG & PIUTANG', ''],
      ['Keterangan', 'Nominal (Rp)'],
      ['Total Piutang Dipinjamkan (Uang di Luar)', totalPiutangPokok],
      ['Piutang Sudah Tertagih', totalPiutangDibayar],
      ['SISA PIUTANG BELUM LUNAS (AKTIVA)', totalPiutangSisa],
      ['Total Hutang Kewajiban (Pasiva)', totalHutangSisa],
      ['', ''],
      [`PENGELUARAN & ANGGARAN PER KATEGORI BULAN INI (${currentYearMonth})`, '', '', '', ''],
      ['Kategori', 'Realisasi (Rp)', 'Target Budget (Rp)', 'Sisa Budget (Rp)', '% Terpakai'],
      ...categoryBudgetRows,
      ['', ''],
      ['HISTORI ARUS KAS BULANAN', '', '', '', ''],
      ['Bulan (YYYY-MM)', 'Total Masuk (Rp)', 'Total Keluar (Rp)', 'Termasuk Omzet Benangbaju (Rp)', 'Net Arus Kas (Rp)'],
      ...Object.keys(monthlyMap)
        .sort()
        .reverse()
        .map((m) => [
          m,
          monthlyMap[m].income,
          monthlyMap[m].expense,
          monthlyMap[m].omzet,
          monthlyMap[m].income - monthlyMap[m].expense,
        ]),
    ];

    if (reconciliationTrxs.length > 0) {
      summaryValues.push(
        ['', ''],
        ['LOG RIWAYAT REKONSILIASI & OPNAME SALDO', '', '', '', ''],
        ['Tanggal', 'Waktu (WIB)', 'Akun', 'Penyesuaian (Rp)', 'Keterangan Rekonsiliasi'],
        ...reconciliationTrxs.map((r: any) => [
          r.trx_date,
          toWibDateTime(r.created_at),
          formatHolder(r.holder),
          r.type === 'income' ? Number(r.amount) : -Number(r.amount),
          r.description || '-',
        ])
      );
    }

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Ringkasan!A1:Z1500',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Ringkasan!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: summaryValues },
    });

    // ==========================================
    // 5. Prepare Loans Data ('Hutang & Piutang')
    // ==========================================
    const loanRows: (string | number)[][] = [
      ['DAFTAR PINJAMAN AKTIF & RIWAYAT (HUTANG & PIUTANG)', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', ''],
      [
        'No',
        'Nama Kontak',
        'Tipe Pinjaman',
        'Nominal Pokok (Rp)',
        'Sudah Dibayar (Rp)',
        'Sisa Tagihan (Rp)',
        '% Lunas',
        'Status',
        'Akun Sumber',
        'Metode Bayar',
        'Tanggal Pinjam',
        'Jatuh Tempo',
        'Keterangan',
      ],
    ];

    (loans || []).forEach((l: any, idx: number) => {
      const pokok = Number(l.total_amount || 0);
      const dibayar = Number(l.paid_amount || 0);
      const sisa = Math.max(0, pokok - dibayar);
      const percent = pokok > 0 ? `${Math.round((dibayar / pokok) * 100)}%` : '0%';
      const tipe = l.type === 'receivable' ? 'Piutang (Kita Pinjamkan)' : 'Hutang (Kita Pinjam)';
      const statusLabel = l.status === 'paid' ? 'LUNAS' : l.status === 'partially_paid' ? 'DICICIL' : 'BELUM DIBAYAR';

      loanRows.push([
        idx + 1,
        l.person_name,
        tipe,
        pokok,
        dibayar,
        sisa,
        percent,
        statusLabel,
        formatHolder(l.holder),
        l.payment_methods?.name || '-',
        l.loan_date,
        l.due_date || '-',
        l.description || '-',
      ]);
    });

    // Summary line for loans
    if ((loans || []).length > 0) {
      loanRows.push([
        'TOTAL',
        '',
        '',
        totalPiutangPokok + totalHutangPokok,
        totalPiutangDibayar + totalHutangDibayar,
        totalPiutangSisa + totalHutangSisa,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    }

    loanRows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    loanRows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    loanRows.push(['LOG RIWAYAT PEMBAYARAN CICILAN', '', '', '', '', '', '', '']);
    loanRows.push([
      'No',
      'Tanggal Bayar',
      'Waktu Input (WIB)',
      'Nama Kontak',
      'Tipe Pinjaman',
      'Nominal Cicilan (Rp)',
      'Akun Penampung/Bayar',
      'Metode Bayar',
      'Catatan Cicilan',
    ]);

    (payments || []).forEach((p: any, idx: number) => {
      const pTipe = p.loans?.type === 'receivable' ? 'Cicilan Piutang' : 'Pembayaran Hutang';
      loanRows.push([
        idx + 1,
        p.payment_date,
        toWibDateTime(p.created_at),
        p.loans?.person_name || '-',
        pTipe,
        Number(p.amount),
        formatHolder(p.holder),
        p.payment_methods?.name || '-',
        p.notes || '-',
      ]);
    });

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: "'Hutang & Piutang'!A1:Z1000",
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Hutang & Piutang'!A1",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: loanRows },
    });

    // ==========================================
    // 6. Prepare Saving Goals & Celengan Data (Target Tabungan)
    // ==========================================
    const savingRows: (string | number)[][] = [
      ['TARGET TABUNGAN & CELENGAN IMPIAN KELUARGA', '', '', '', '', '', '', '', '', '', ''],
      ['Terakhir Disinkronkan (WIB): ' + toWibDateTime(new Date().toISOString()), '', '', '', '', '', '', '', '', '', ''],
      [
        'No',
        'Nama Target Celengan',
        'Kategori',
        'Pemilik',
        'Terkumpul (Rp)',
        'Target Nominal (Rp)',
        'Sisa Kurang (Rp)',
        '% Progress',
        'Target Tanggal',
        'Status',
        'Catatan',
      ],
    ];

    let totalTargetAll = 0;
    let totalSavedAll = 0;

    (savingGoals || []).forEach((g: any, idx: number) => {
      const cur = Number(g.current_amount || 0);
      const tgt = Number(g.target_amount || 0);
      const sisa = Math.max(0, tgt - cur);
      const pct = tgt > 0 ? `${Math.round((cur / tgt) * 100)}%` : '0%';
      totalTargetAll += tgt;
      totalSavedAll += cur;

      savingRows.push([
        idx + 1,
        g.name,
        g.category,
        g.holder,
        cur,
        tgt,
        sisa,
        pct,
        g.target_date || '-',
        g.status === 'completed' || cur >= tgt ? 'TERCAPAI' : 'AKTIF',
        g.notes || '-',
      ]);
    });

    if ((savingGoals || []).length > 0) {
      savingRows.push([
        'TOTAL',
        '',
        '',
        '',
        totalSavedAll,
        totalTargetAll,
        Math.max(0, totalTargetAll - totalSavedAll),
        totalTargetAll > 0 ? `${Math.round((totalSavedAll / totalTargetAll) * 100)}%` : '0%',
        '',
        '',
        '',
      ]);
    }

    savingRows.push(['', '', '', '', '', '', '', '', '', '', '']);
    savingRows.push(['', '', '', '', '', '', '', '', '', '', '']);
    savingRows.push(['LOG RIWAYAT MUTASI SETOR & TARIK TABUNGAN', '', '', '', '', '', '', '', '']);
    savingRows.push([
      'No',
      'Tanggal Mutasi',
      'Waktu Input (WIB)',
      'Target Celengan',
      'Jenis Mutasi',
      'Nominal (Rp)',
      'Pemilik',
      'Rekening / Kas Terkait',
      'Catatan',
    ]);

    (savingLogs || []).forEach((l: any, idx: number) => {
      const jenisLabel = l.type === 'deposit' ? 'Setor Tabungan (+)' : 'Tarik Tabungan (-)';
      savingRows.push([
        idx + 1,
        l.log_date,
        toWibDateTime(l.created_at),
        l.saving_goals?.name || '-',
        jenisLabel,
        Number(l.amount),
        l.holder,
        l.payment_methods?.name || '-',
        l.notes || '-',
      ]);
    });

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: "'Target Tabungan'!A1:Z1000",
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Target Tabungan'!A1",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: savingRows },
    });

    // ==========================================
    // 7. Prepare Transfer & Mutations Data ('Transfer & Mutasi Akun')
    // ==========================================
    const transferTrxs = (trxs || []).filter((t: any) => t.type === 'transfer');
    const totalTransferAmount = transferTrxs.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

    const transferRows: (string | number)[][] = [
      ['LOG MUTASI & TRANSFER INTERNAL ANTAR AKUN', '', '', '', '', '', '', ''],
      ['Terakhir Disinkronkan (WIB): ' + toWibDateTime(new Date().toISOString()), '', '', '', '', '', '', ''],
      [
        'No',
        'Tanggal Transaksi',
        'Waktu Input (WIB)',
        'Dari Akun (Pengirim)',
        'Ke Akun (Penerima)',
        'Nominal Transfer (Rp)',
        'Metode Bayar',
        'Catatan / Keterangan',
      ],
    ];

    transferTrxs.forEach((t: any, idx: number) => {
      transferRows.push([
        idx + 1,
        t.trx_date,
        toWibDateTime(t.created_at),
        formatHolder(t.from_holder),
        formatHolder(t.holder),
        Number(t.amount),
        t.payment_methods?.name || '-',
        t.description || '-',
      ]);
    });

    if (transferTrxs.length > 0) {
      transferRows.push([
        'TOTAL',
        '',
        '',
        '',
        '',
        totalTransferAmount,
        '',
        '',
      ]);
    }

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: "'Transfer & Mutasi Akun'!A1:Z2000",
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Transfer & Mutasi Akun'!A1",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: transferRows },
    });

    // ==========================================
    // 8. Batch Format Requests (Styles, Colors, Column Resizing)
    // ==========================================
    const formatRequests: any[] = [
      // Freeze Header Row in Sheet1
      {
        updateSheetProperties: {
          properties: {
            sheetId: sheet1Id,
            gridProperties: { frozenRowCount: 1 },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      // Format Sheet1 Header (Emerald green background, white bold text)
      {
        repeatCell: {
          range: {
            sheetId: sheet1Id,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 12,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.063, green: 0.725, blue: 0.506 },
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
        },
      },
      // Hide column A (ID) in Sheet1 to keep view clean
      {
        updateDimensionProperties: {
          range: {
            sheetId: sheet1Id,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 1,
          },
          properties: { hiddenByUser: true },
          fields: 'hiddenByUser',
        },
      },
      // Format Number currency for columns J, K, L in Sheet1
      {
        repeatCell: {
          range: {
            sheetId: sheet1Id,
            startRowIndex: 1,
            endRowIndex: Math.max(rowsSheet1.length + 1, 100),
            startColumnIndex: 9,
            endColumnIndex: 12,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'NUMBER', pattern: '#,##0' },
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      },
      // Auto-resize columns B to L in Sheet1
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: sheet1Id,
            dimension: 'COLUMNS',
            startIndex: 1,
            endIndex: 12,
          },
        },
      },
    ];

    // Format Ringkasan sheet if ID is available
    if (ringkasanSheetId !== undefined) {
      formatRequests.push(
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: ringkasanSheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 5,
            },
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: ringkasanSheetId,
              startRowIndex: 0,
              endRowIndex: 60,
              startColumnIndex: 1,
              endColumnIndex: 5,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        }
      );
    }

    // Format Hutang & Piutang sheet if ID is available
    if (loansSheetId !== undefined) {
      formatRequests.push(
        // Header Table Pinjaman (Indigo background)
        {
          repeatCell: {
            range: {
              sheetId: loansSheetId,
              startRowIndex: 2,
              endRowIndex: 3,
              startColumnIndex: 0,
              endColumnIndex: 13,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.18, green: 0.31, blue: 0.58 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
        // Currency formatting for Pokok, Dibayar, Sisa (Columns D, E, F)
        {
          repeatCell: {
            range: {
              sheetId: loansSheetId,
              startRowIndex: 3,
              endRowIndex: Math.max((loans || []).length + 5, 20),
              startColumnIndex: 3,
              endColumnIndex: 6,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                horizontalAlignment: 'RIGHT',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        },
        // Currency formatting for Nominal Cicilan in payment log
        {
          repeatCell: {
            range: {
              sheetId: loansSheetId,
              startRowIndex: (loans || []).length + 8,
              endRowIndex: (loans || []).length + (payments || []).length + 15,
              startColumnIndex: 5,
              endColumnIndex: 6,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                horizontalAlignment: 'RIGHT',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        },
        // Auto resize columns in Hutang & Piutang
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: loansSheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 13,
            },
          },
        }
      );
    }

    // Format Target Tabungan sheet if ID is available
    if (savingsSheetId !== undefined) {
      formatRequests.push(
        // Header Table Target Tabungan (Teal background)
        {
          repeatCell: {
            range: {
              sheetId: savingsSheetId,
              startRowIndex: 2,
              endRowIndex: 3,
              startColumnIndex: 0,
              endColumnIndex: 11,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.08, green: 0.45, blue: 0.4 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
        // Currency formatting for Terkumpul, Target, Sisa (Columns E, F, G -> idx 4, 5, 6)
        {
          repeatCell: {
            range: {
              sheetId: savingsSheetId,
              startRowIndex: 3,
              endRowIndex: Math.max((savingGoals || []).length + 5, 20),
              startColumnIndex: 4,
              endColumnIndex: 7,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                horizontalAlignment: 'RIGHT',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        },
        // Currency formatting for Mutasi Log Nominal (Column F -> idx 5)
        {
          repeatCell: {
            range: {
              sheetId: savingsSheetId,
              startRowIndex: (savingGoals || []).length + 8,
              endRowIndex: (savingGoals || []).length + (savingLogs || []).length + 15,
              startColumnIndex: 5,
              endColumnIndex: 6,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                horizontalAlignment: 'RIGHT',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        },
        // Auto resize columns in Target Tabungan
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: savingsSheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 11,
            },
          },
        }
      );
    }

    // Format Transfer & Mutasi Akun sheet if ID is available
    if (transferSheetId !== undefined) {
      formatRequests.push(
        // Header Table Transfer (Deep cyan/navy background)
        {
          repeatCell: {
            range: {
              sheetId: transferSheetId,
              startRowIndex: 2,
              endRowIndex: 3,
              startColumnIndex: 0,
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.12, green: 0.45, blue: 0.68 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
        // Currency formatting for Nominal Transfer (Column F -> idx 5)
        {
          repeatCell: {
            range: {
              sheetId: transferSheetId,
              startRowIndex: 3,
              endRowIndex: Math.max(transferTrxs.length + 5, 20),
              startColumnIndex: 5,
              endColumnIndex: 6,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                horizontalAlignment: 'RIGHT',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        },
        // Auto resize columns in Transfer & Mutasi Akun
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: transferSheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 8,
            },
          },
        }
      );
    }

    // Execute batch format
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });

    console.log('Google Sheets successfully formatted and resynced with all comprehensive data.');
    return { success: true, count: trxs?.length || 0 };
  } catch (err: any) {
    console.error('Error resyncing Google Sheets:', err);
    return { success: false, count: 0, error: err?.message || 'Unknown error' };
  }
}

