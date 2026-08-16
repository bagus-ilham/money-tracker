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

    if (type === 'INSERT') {
      console.log('Action: Appending to Google Sheets', record.id);
      
      // We need to fetch the category name if we want to show it.
      // But webhook payload only contains category_id. We'll just write category_id for now, 
      // or you can do a supabase fetch here if needed. To keep it simple and robust, we write the raw data.
      
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

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:I', // Assuming default sheet name is 'Sheet1'
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });
    } 
    else if (type === 'UPDATE' || type === 'DELETE') {
      console.log('Action:', type, 'on Google Sheets row for ID:', record.id);
      // NOTE: Updating/Deleting specific rows in Sheets via API is complex (requires searching for the row index first).
      // For MVP, we will only handle Append for new transactions. 
      // If a user deletes a row in the app, it won't automatically delete in the sheet for now, to keep the audit trail safe.
    }

    return NextResponse.json({ success: true, message: 'Sync processed successfully' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
