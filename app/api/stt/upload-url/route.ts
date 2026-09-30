import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, mimeType, sttConfig } = body;

    const gcsBucket = (sttConfig?.gcsBucket || process.env.GCS_BUCKET_NAME || 'qtranscript-recordings').trim();
    const apiKey = (
      sttConfig?.apiKey ||
      process.env.STT_API_KEY ||
      process.env.GOOGLE_SPEECH_API_KEY ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();
    const provider = sttConfig?.provider || 'GoogleCloud';

    if (provider === 'AssemblyAI') {
      const assemblyKey = (sttConfig?.apiKey || process.env.ASSEMBLYAI_API_KEY || '').trim();
      return NextResponse.json({
        success: true,
        provider: 'AssemblyAI',
        uploadUrl: 'https://api.assemblyai.com/v2/upload',
        method: 'POST',
        headers: {
          'Authorization': assemblyKey
        }
      });
    }

    const cleanFileName = (filename || 'audio.wav').replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectName = `recordings/${Date.now()}-${cleanFileName}`;
    const contentType = mimeType || 'audio/wav';

    // Strategy 1: Try GCS V4 Signed URL using @google-cloud/storage SDK (requires Service Account / IAM credentials)
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
        success: true,
        uploadUrl,
        gcsUri: `gs://${gcsBucket}/${objectName}`,
        objectName,
        method: 'PUT',
        headers: {
          'Content-Type': contentType
        },
        provider: 'GCS_SIGNED_URL'
      });
    } catch (sdkErr: any) {
      console.warn('SDK getSignedUrl failed, trying GCS REST Resumable upload fallback:', sdkErr?.message);
    }

    // Strategy 2: GCS Resumable Upload Session URL using REST API Key
    if (apiKey) {
      try {
        const initiateUrl = `https://storage.googleapis.com/upload/storage/v1/b/${gcsBucket}/o?uploadType=resumable&name=${encodeURIComponent(objectName)}&key=${apiKey}`;
        const initRes = await fetch(initiateUrl, {
          method: 'POST',
          headers: {
            'X-Upload-Content-Type': contentType,
            'Content-Type': 'application/json'
          }
        });

        const locationHeader = initRes.headers.get('location');
        if (initRes.ok && locationHeader) {
          return NextResponse.json({
            success: true,
            uploadUrl: locationHeader,
            gcsUri: `gs://${gcsBucket}/${objectName}`,
            objectName,
            method: 'PUT',
            headers: {
              'Content-Type': contentType
            },
            provider: 'GCS_RESUMABLE'
          });
        }
      } catch (restErr: any) {
        console.warn('GCS Resumable upload session init failed:', restErr?.message);
      }

      // Strategy 3: GCS Direct Media Upload REST URL fallback
      const directUploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${gcsBucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}&key=${apiKey}`;
      return NextResponse.json({
        success: true,
        uploadUrl: directUploadUrl,
        gcsUri: `gs://${gcsBucket}/${objectName}`,
        objectName,
        method: 'POST',
        headers: {
          'Content-Type': contentType
        },
        provider: 'GCS_MEDIA_REST'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Could not generate GCS upload URL. Please verify GCS Bucket name and API Key.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Upload URL Generation Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
