import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, mimeType, sttConfig } = body;

    const gcsBucket = (
      sttConfig?.gcsBucket ||
      process.env.GCS_BUCKET_NAME ||
      'qtranscript-recordings'
    ).trim();

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Sanitize filename to prevent directory traversal or invalid characters
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const objectName = `recordings/${timestamp}-${sanitizedFilename}`;

    // Validate MIME type
    const contentType = mimeType || 'audio/wav';
    const isAllowedType =
      contentType.startsWith('audio/') ||
      contentType.startsWith('video/') ||
      contentType === 'application/octet-stream';

    if (!isAllowedType) {
      return NextResponse.json(
        { error: `Invalid MIME type "${contentType}". Only audio/video files are permitted.` },
        { status: 400 }
      );
    }

    // Initialize Google Cloud Storage SDK using server-side credentials
    let storageOptions: any = {};
    if (process.env.GOOGLE_CLOUD_PROJECT) {
      storageOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT;
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credVal = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
      if (credVal.startsWith('{')) {
        try {
          storageOptions.credentials = JSON.parse(credVal);
        } catch (parseErr) {
          throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable contains invalid JSON.');
        }
      } else {
        storageOptions.keyFilename = credVal;
      }
    }

    const storage = new Storage(storageOptions);
    const bucket = storage.bucket(gcsBucket);
    const file = bucket.file(objectName);

    // Generate V4 Signed URL for direct HTTP PUT from browser to Google Cloud Storage
    // Expiration: 15 minutes (900 seconds)
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });

    const gcsUri = `gs://${gcsBucket}/${objectName}`;

    return NextResponse.json({
      uploadUrl,
      objectName,
      gcsUri,
      expiresInMinutes: 15
    });

  } catch (error: any) {
    console.error('Error generating GCS V4 Signed URL:', error);
    const message = error?.message || 'Failed to generate signed URL';
    
    // Helpful guidance if Service Account credentials are missing
    let hint = '';
    if (message.includes('Could not load the default credentials') || message.includes('signing') || message.includes('private key')) {
      hint = ' Ensure GOOGLE_APPLICATION_CREDENTIALS (Service Account JSON with private key) is configured in environment variables.';
    }

    return NextResponse.json(
      { error: `${message}${hint}` },
      { status: 500 }
    );
  }
}
