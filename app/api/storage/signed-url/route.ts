import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { filename } = body;

    // On VPS hosting (Docker + Nginx), GCS Signed URLs are fully bypassed.
    // Audio is posted directly to /api/stt/transcribe without body size limits.
    return NextResponse.json({
      success: true,
      message: 'VPS Direct Upload enabled. GCS Signed URLs and GOOGLE_APPLICATION_CREDENTIALS are bypassed.',
      filename: filename || 'recording.wav',
      directUploadEndpoint: '/api/stt/transcribe'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'VPS Direct Upload route active.' },
      { status: 200 }
    );
  }
}

