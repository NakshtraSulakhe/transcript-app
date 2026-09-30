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

    const apiKey = (
      sttConfig?.apiKey ||
      process.env.STT_API_KEY ||
      process.env.GOOGLE_SPEECH_API_KEY ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const objectName = `recordings/${timestamp}-${sanitizedFilename}`;
    const contentType = mimeType || 'audio/wav';
    const gcsUri = `gs://${gcsBucket}/${objectName}`;

    // STRATEGY 1: GCS V4 Signed URL using @google-cloud/storage SDK (requires Service Account with private key)
    try {
      let storageOptions: any = {};
      if (process.env.GOOGLE_CLOUD_PROJECT) {
        storageOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT;
      }
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const credVal = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
        if (credVal.startsWith('{')) {
          storageOptions.credentials = JSON.parse(credVal);
        } else {
          storageOptions.keyFilename = credVal;
        }
      }

      const storage = new Storage(storageOptions);
      const bucket = storage.bucket(gcsBucket);
      const file = bucket.file(objectName);

      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
      });

      return NextResponse.json({
        uploadUrl,
        objectName,
        gcsUri,
        strategy: 'V4_SIGNED_URL'
      });
    } catch (sdkErr: any) {
      console.warn('GCS SDK V4 getSignedUrl failed (Service Account JSON missing or unparseable):', sdkErr?.message);
    }

    // STRATEGY 2: GCS Resumable Upload Session URL via REST API Key (fallback when Service Account JSON is not set)
    if (apiKey) {
      try {
        const initUrl = `https://storage.googleapis.com/upload/storage/v1/b/${gcsBucket}/o?uploadType=resumable&name=${encodeURIComponent(objectName)}&key=${apiKey}`;
        const initRes = await fetch(initUrl, {
          method: 'POST',
          headers: {
            'X-Upload-Content-Type': contentType,
            'Content-Type': 'application/json'
          }
        });

        const locationHeader = initRes.headers.get('location');
        if (initRes.ok && locationHeader) {
          return NextResponse.json({
            uploadUrl: locationHeader,
            objectName,
            gcsUri,
            strategy: 'GCS_RESUMABLE_SESSION'
          });
        }
      } catch (restErr: any) {
        console.warn('GCS Resumable session init fallback failed:', restErr?.message);
      }
    }

    // Helpful diagnostic if credentials are missing
    return NextResponse.json(
      {
        error: `Google Cloud Service Account Credentials Missing.
Please configure GOOGLE_APPLICATION_CREDENTIALS in your Vercel Environment Variables with your Service Account JSON content (containing "private_key" and "client_email").`
      },
      { status: 500 }
    );

  } catch (error: any) {
    console.error('Error generating GCS upload URL:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate GCS upload URL' },
      { status: 500 }
    );
  }
}
