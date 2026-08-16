import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    // Payload from Supabase Webhook
    // { type: 'INSERT', table: 'transactions', record: { ... }, old_record: { ... } }
    console.log('Received Webhook:', payload);

    const { type, record, old_record } = payload;

    if (!type || !record) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // TODO: Initialize Google Sheets Client here using Service Account
    // const auth = new google.auth.GoogleAuth({ ... });
    // const sheets = google.sheets({ version: 'v4', auth });

    if (type === 'INSERT') {
      console.log('Action: Appending to Google Sheets', record);
      // await sheets.spreadsheets.values.append({ ... })
    } 
    else if (type === 'UPDATE') {
      console.log('Action: Updating Google Sheets row for ID:', record.id);
      // 1. Find row index by ID
      // 2. Update that specific row
    } 
    else if (type === 'DELETE' || (record.deleted_at !== null && old_record?.deleted_at === null)) {
      console.log('Action: Marking row as deleted in Google Sheets for ID:', record.id);
      // Soft delete logic: strike through or add 'DELETED' tag to the row
    }

    return NextResponse.json({ success: true, message: 'Sync processed successfully (Mock)' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
