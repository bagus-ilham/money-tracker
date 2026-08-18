import { google } from 'googleapis';
import { getServiceRoleClient } from '@/lib/supabase';
import { formatHolder } from '@/lib/utils';

export async function resyncGoogleSheets(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return { success: false, count: 0, error: 'Google Sheets credentials missing in environment variables' };
    }

    const supabase = getServiceRoleClient();
    const { data: trxs, error } = await supabase
      .from('transactions')
      .select('*, categories(name), payment_methods(name)')
      .is('deleted_at', null)
      .order('trx_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Get spreadsheet metadata to retrieve sheet IDs and check for 'Ringkasan'
    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = spreadsheetMeta.data.sheets || [];
    
    let sheet1Obj = sheetList.find((s) => s.properties?.title === 'Sheet1') || sheetList[0];
    const sheet1Id = sheet1Obj?.properties?.sheetId ?? 0;
    const sheet1Title = sheet1Obj?.properties?.title || 'Sheet1';

    let ringkasanSheet = sheetList.find((s) => s.properties?.title === 'Ringkasan');
    let ringkasanSheetId = ringkasanSheet?.properties?.sheetId;

    // Create 'Ringkasan' sheet if it doesn't exist
    if (!ringkasanSheet) {
      const addSheetRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Ringkasan',
                },
              },
            },
          ],
        },
      });
      ringkasanSheetId = addSheetRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
    }

    // 2. Prepare Transactions data for Sheet1 (10 Columns)
    // A: ID | B: Tanggal | C: Jenis | D: Kategori | E: Akun / Pemegang | F: Metode Bayar | G: Catatan | H: Pemasukan | I: Pengeluaran | J: Saldo
    const headersSheet1 = [
      'ID',
      'Tanggal',
      'Jenis',
      'Kategori',
      'Akun / Pemegang',
      'Metode Bayar',
      'Catatan',
      'Pemasukan',
      'Pengeluaran',
      'Saldo',
    ];

    const rowsSheet1 = (trxs || []).map((t: any, idx: number) => {
      const rowNum = idx + 2;
      const jenis = t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer';
      const kategori = t.categories?.name || (t.type === 'transfer' ? 'Transfer Internal' : '-');
      const akun = t.type === 'transfer' ? `${formatHolder(t.from_holder)} → ${formatHolder(t.holder)}` : formatHolder(t.holder);
      const metodeBayar = t.payment_methods?.name || '-';

      const pemasukan = t.type === 'income' ? Number(t.amount) : '';
      const pengeluaran = t.type === 'expense' ? Number(t.amount) : '';
      const formulaSaldo = `=SUM($H$2:H${rowNum})-SUM($I$2:I${rowNum})`;

      return [
        t.id,
        t.trx_date,
        jenis,
        kategori,
        akun,
        metodeBayar,
        t.description || '-',
        pemasukan,
        pengeluaran,
        formulaSaldo,
      ];
    });

    // Clear & write Sheet1
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

    // 3. Prepare Summary Data for 'Ringkasan' Sheet
    // Calculate account balances
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

    // Current Month category expense grouping
    const currentYearMonth = new Date().toISOString().substring(0, 7);
    const catExpenseMap: Record<string, number> = {};
    const monthlyMap: Record<string, { income: number; expense: number }> = {};

    (trxs || []).forEach((t: any) => {
      const ym = t.trx_date ? t.trx_date.substring(0, 7) : 'Unknown';
      if (!monthlyMap[ym]) monthlyMap[ym] = { income: 0, expense: 0 };
      if (t.type === 'income') monthlyMap[ym].income += Number(t.amount);
      if (t.type === 'expense') {
        monthlyMap[ym].expense += Number(t.amount);
        if (t.trx_date && t.trx_date.startsWith(currentYearMonth)) {
          const catName = t.categories?.name || 'Lainnya';
          catExpenseMap[catName] = (catExpenseMap[catName] || 0) + Number(t.amount);
        }
      }
    });

    const summaryValues: (string | number)[][] = [
      ['RINGKASAN SALDO AKUN', ''],
      ['Akun / Pemegang', 'Saldo (Rp)'],
      ['Cash Suami', cashSuami],
      ['ATM Suami', atmSuami],
      ['Cash Istri', cashIstri],
      ['ATM Istri', atmIstri],
      ['TOTAL SALDO', totalSaldo],
      ['', ''],
      [`PENGELUARAN PER KATEGORI (${currentYearMonth})`, ''],
      ['Kategori', 'Total Pengeluaran (Rp)'],
      ...Object.entries(catExpenseMap)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => [cat, amt]),
      ['', ''],
      ['RINGKASAN BULANAN', '', '', ''],
      ['Bulan (YYYY-MM)', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Net Arus Kas (Rp)'],
      ...Object.keys(monthlyMap)
        .sort()
        .reverse()
        .map((m) => [m, monthlyMap[m].income, monthlyMap[m].expense, monthlyMap[m].income - monthlyMap[m].expense]),
    ];

    // Clear & write Ringkasan
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Ringkasan!A1:Z1000',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Ringkasan!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: summaryValues },
    });

    // 4. Batch Format Requests (Styles, Freezes, Hiding ID Column, Auto Resize, Currency Formats)
    const formatRequests: any[] = [
      // Freeze Header Row in Sheet1
      {
        updateSheetProperties: {
          properties: {
            sheetId: sheet1Id,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      // Format Sheet1 Header (Emerald green background, white bold text, centered)
      {
        repeatCell: {
          range: {
            sheetId: sheet1Id,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 10,
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
      // Hide column A (ID) in Sheet1 to keep spreadsheet clean and readable
      {
        updateDimensionProperties: {
          range: {
            sheetId: sheet1Id,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 1,
          },
          properties: {
            hiddenByUser: true,
          },
          fields: 'hiddenByUser',
        },
      },
      // Format Number currency for columns H (Pemasukan), I (Pengeluaran), J (Saldo) in Sheet1
      {
        repeatCell: {
          range: {
            sheetId: sheet1Id,
            startRowIndex: 1,
            endRowIndex: Math.max(rowsSheet1.length + 1, 100),
            startColumnIndex: 7,
            endColumnIndex: 10,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'NUMBER',
                pattern: '#,##0',
              },
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      },
      // Auto-resize columns B to J in Sheet1
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: sheet1Id,
            dimension: 'COLUMNS',
            startIndex: 1,
            endIndex: 10,
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
              endRowIndex: 50,
              startColumnIndex: 1,
              endColumnIndex: 4,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: 'NUMBER',
                  pattern: '#,##0',
                },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        }
      );
    }

    // Execute format requests
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });

    console.log('Google Sheets successfully formatted and resynced.');
    return { success: true, count: trxs?.length || 0 };
  } catch (err: any) {
    console.error('Error resyncing Google Sheets:', err);
    return { success: false, count: 0, error: err?.message || 'Unknown error' };
  }
}
