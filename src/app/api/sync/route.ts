import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Environment variables
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';
const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('Received Webhook:', payload);

    const { type, record, old_record } = payload;

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
    const range = 'Sheet1!A:I';

    const rowData = [
      record.id,
      record.trx_date,
      record.type,
      record.amount,
      record.holder,
      record.from_holder || '-',
      record.category_id || '-',
      record.description || '-',
      record.created_at
    ];

    if (type === 'INSERT') {
      console.log('Action: Appending to Google Sheets', record.id);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    } 
    else if (type === 'UPDATE' || type === 'DELETE') {
      console.log('Action:', type, 'on Google Sheets row for ID:', record.id);
      
      // Fetch existing rows to find the row index
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      
      const rows = response.data.values;
      if (rows && rows.length > 0) {
        // Find the index of the row with the matching ID (Column A is index 0)
        const rowIndex = rows.findIndex(row => row[0] === record.id);
        
        if (rowIndex !== -1) {
          // Google Sheets rows are 1-indexed. Array index 0 is row 1.
          const actualRowNumber = rowIndex + 1;
          const updateRange = `Sheet1!A${actualRowNumber}:I${actualRowNumber}`;
          
          if (type === 'UPDATE') {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: updateRange,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [rowData] },
            });
          } else if (type === 'DELETE') {
            // For delete, we overwrite the row with a deleted note or clear it
            const deletedRowData = [record.id, record.trx_date, 'DELETED', 0, record.holder, '-', '-', 'Dihapus dari aplikasi', record.created_at];
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
