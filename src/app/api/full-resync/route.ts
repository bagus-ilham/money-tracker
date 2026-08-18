import { NextResponse } from 'next/server';
import { resyncGoogleSheets } from '@/lib/sheetsSync';

export async function POST() {
  try {
    console.log('Starting Full Resync to Google Sheets...');
    const result = await resyncGoogleSheets();

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to sync with Google Sheets' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Full resync & formatting completed successfully',
      count: result.count,
    });
  } catch (error: any) {
    console.error('Full Resync Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
