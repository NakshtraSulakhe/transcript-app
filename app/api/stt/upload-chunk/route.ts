import { NextRequest, NextResponse } from 'next/server';
import { POST as handleSignedUrl } from '@/app/api/storage/signed-url/route';

export async function POST(request: NextRequest) {
  return handleSignedUrl(request);
}
