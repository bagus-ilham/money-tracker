import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('Starting Full Resync to Google Sheets...');
    
    const supabase = getServiceRoleClient();
    
    // 1. Fetch all active transactions
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        categories(name),
        payment_methods(name)
      `)
      .is('deleted_at', null)
      .order('trx_date', { ascending: true });
      
    if (error) throw error;
    
    console.log(`Fetched ${transactions.length} active transactions.`);

    // TODO: Google Sheets Logic
    // 2. Clear existing sheet data (except headers)
    // await sheets.spreadsheets.values.clear({ ... })
    
    // 3. Format data into rows
    // const rows = transactions.map(t => [t.id, t.trx_date, t.type, ...]);
    
    // 4. Append all rows
    // await sheets.spreadsheets.values.append({ ... })

    return NextResponse.json({ 
      success: true, 
      message: 'Full resync processed (Mock)',
      count: transactions.length 
    });
  } catch (error) {
    console.error('Full Resync Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
