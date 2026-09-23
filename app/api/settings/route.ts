import { NextRequest, NextResponse } from 'next/server';
import { getGlobalSettings, saveGlobalSettings } from '@/lib/db';

export async function GET() {
  try {
    const settings = await getGlobalSettings();
    return NextResponse.json({ status: 'success', settings });
  } catch (error) {
    console.error('API GET Settings Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch settings from database' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = await saveGlobalSettings(body);
    return NextResponse.json({ status: 'success', settings: updated });
  } catch (error) {
    console.error('API POST Settings Error:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Failed to save settings to database' },
      { status: 500 }
    );
  }
}

