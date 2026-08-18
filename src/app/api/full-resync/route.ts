import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getServiceRoleClient } from '@/lib/supabase';

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';
const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

function formatHolder(h?: string) {
  switch (h) {
    case 'cash_suami': case 'suami': return 'Cash Suami';
    case 'atm_suami': return 'ATM Suami';
    case 'cash_istri': case 'istri': return 'Cash Istri';
    case 'atm_istri': return 'ATM Istri';
    default: return h || '';
  }
}

export async function POST() {
  try {
    console.log('Starting Full Resync to Google Sheets...');
    
    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ error: 'Google credentials missing' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    
    // Fetch all active transactions
    const { data: trxs, error } = await supabase
      .from('transactions')
      .select('*, categories(name)')
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

    const headers = ['ID', 'Tanggal', 'Jenis', 'Kategori', 'Akun / Pemegang', 'Catatan', 'Pemasukan', 'Pengeluaran', 'Saldo'];

    const rows = (trxs || []).map((t, idx) => {
      const rowNum = idx + 2;
      const jenis = t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer';
      const kategori = t.categories?.name || (t.type === 'transfer' ? 'Transfer Internal' : '-');
      const akun = t.type === 'transfer' ? `${formatHolder(t.from_holder)} → ${formatHolder(t.holder)}` : formatHolder(t.holder);

      const pemasukan = t.type === 'income' ? Number(t.amount) : '';
      const pengeluaran = t.type === 'expense' ? Number(t.amount) : '';
      const formulaSaldo = `=SUM($G$2:G${rowNum})-SUM($H$2:H${rowNum})`;

      return [
        t.id,
        t.trx_date,
        jenis,
        kategori,
        akun,
        t.description || '-',
        pemasukan,
        pengeluaran,
        formulaSaldo
      ];
    });

    const allValues = [headers, ...rows];

    // Clear sheet and update
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Sheet1!A1:Z5000',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: allValues },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Full resync completed successfully',
      count: trxs?.length || 0 
    });
  } catch (error: any) {
    console.error('Full Resync Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
