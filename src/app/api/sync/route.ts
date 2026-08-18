import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getServiceRoleClient } from '@/lib/supabase';
import { formatHolder } from '@/lib/utils';

// Environment variables
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';
const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('Received Webhook:', payload);

    const { type, record } = payload;

    if (!type || !record) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.warn('Google Credentials missing. Skipping sync.');
      return NextResponse.json({ success: true, message: 'Skipped (No credentials)' });
    }

    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Sheet1!A:J';

    const supabase = getServiceRoleClient();

    // Fetch category name if present
    let categoryName = '';
    if (record.category_id) {
      const { data: cat } = await supabase.from('categories').select('name').eq('id', record.category_id).single();
      if (cat) categoryName = cat.name;
    }

    // Fetch payment method name if present
    let paymentMethodName = '-';
    if (record.payment_method_id) {
      const { data: pm } = await supabase.from('payment_methods').select('name').eq('id', record.payment_method_id).single();
      if (pm) paymentMethodName = pm.name;
    }

    const jenis = record.type === 'income' ? 'Pemasukan' : record.type === 'expense' ? 'Pengeluaran' : 'Transfer';
    const kategori = categoryName || (record.type === 'transfer' ? 'Transfer Internal' : '-');
    const akun = record.type === 'transfer' ? `${formatHolder(record.from_holder)} → ${formatHolder(record.holder)}` : formatHolder(record.holder);

    const pemasukan = record.type === 'income' ? Number(record.amount) : '';
    const pengeluaran = record.type === 'expense' ? Number(record.amount) : '';

    // Fetch existing rows for row index and formula calculation
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = response.data.values || [];

    if (type === 'INSERT') {
      const newRowNumber = rows.length + 1;
      const formulaSaldo = `=SUM($H$2:H${newRowNumber})-SUM($I$2:I${newRowNumber})`;

      const rowData = [
        record.id,
        record.trx_date,
        jenis,
        kategori,
        akun,
        paymentMethodName,
        record.description || '-',
        pemasukan,
        pengeluaran,
        formulaSaldo,
      ];

      console.log('Action: Appending to Google Sheets', record.id);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    } else if (type === 'UPDATE' || type === 'DELETE') {
      console.log('Action:', type, 'on Google Sheets row for ID:', record.id);

      if (rows.length > 0) {
        const rowIndex = rows.findIndex((row) => row[0] === record.id);

        if (rowIndex !== -1) {
          const actualRowNumber = rowIndex + 1;
          const updateRange = `Sheet1!A${actualRowNumber}:J${actualRowNumber}`;
          const formulaSaldo = `=SUM($H$2:H${actualRowNumber})-SUM($I$2:I${actualRowNumber})`;

          if (type === 'UPDATE') {
            const rowData = [
              record.id,
              record.trx_date,
              jenis,
              kategori,
              akun,
              paymentMethodName,
              record.description || '-',
              pemasukan,
              pengeluaran,
              formulaSaldo,
            ];

            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: updateRange,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [rowData] },
            });
          } else if (type === 'DELETE') {
            const deletedRowData = [
              record.id,
              record.trx_date,
              'Dihapus',
              '-',
              akun,
              '-',
              'Dihapus dari aplikasi',
              '',
              '',
              formulaSaldo,
            ];
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: updateRange,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [deletedRowData] },
            });
          }
        } else {
          console.log('Row ID not found in Sheets. Cannot update/delete.');
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Sync processed successfully' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
