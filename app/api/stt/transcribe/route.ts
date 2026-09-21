import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';
import { Storage } from '@google-cloud/storage';
import { STTConfig } from '@/lib/types';

// Upload helper supporting both @google-cloud/storage SDK (Service Account) and REST API Key
async function uploadFileToGCS(
  buffer: Buffer,
  gcsBucket: string,
  objectName: string,
  mimeType: string,
  apiKey: string
): Promise<void> {
  let sdkErrorMessage = '';
  // Strategy 1: Try @google-cloud/storage SDK (uses GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC)
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

    await file.save(buffer, {
      contentType: mimeType,
      resumable: false,
    });
    return;
  } catch (sdkErr: any) {
    sdkErrorMessage = sdkErr?.message || String(sdkErr);
    console.error('@google-cloud/storage SDK upload error:', sdkErr);
  }

  // Strategy 2: REST Upload fallback using API Key
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${gcsBucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}&key=${apiKey}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
    },
    body: buffer as any,
  });

  if (!uploadRes.ok) {
    const errData = await uploadRes.json().catch(() => ({}));
    const errObj = errData?.error || {};
    const rawMessage = errObj.message || `HTTP ${uploadRes.status}`;

    throw new Error(
      `Google Cloud Storage Upload Failed: SDK Error: "${sdkErrorMessage || 'N/A'}". REST Error (${uploadRes.status}): "${rawMessage}". Please check bucket permissions or run: gcloud auth application-default login`
    );
  }
}

// Google Cloud Storage + Speech longRunningRecognize implementation
async function transcribeWithGCSAndLongRunning(
  buffer: Buffer,
  fileName: string,
  apiKey: string,
  gcsBucket: string,
  language: string = 'en-US'
): Promise<string> {
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectName = `transcriptions/${Date.now()}-${cleanFileName}`;

  let mimeType = 'audio/wav';
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'mp3') mimeType = 'audio/mp3';
  if (ext === 'flac') mimeType = 'audio/flac';
  if (ext === 'ogg') mimeType = 'audio/ogg';

  // Step 1: Upload Audio to Google Cloud Storage Bucket
  await uploadFileToGCS(buffer, gcsBucket, objectName, mimeType, apiKey);

  const gsUri = `gs://${gcsBucket}/${objectName}`;

  try {
    // Step 2: Invoke longRunningRecognize
    const config: Record<string, any> = {
      languageCode: language || 'en-US',
      enableAutomaticPunctuation: true,
      model: 'default',
    };

    if (ext === 'mp3') config.encoding = 'MP3';
    if (ext === 'flac') config.encoding = 'FLAC';
    if (ext === 'wav') config.encoding = 'LINEAR16';

    const recognizeRes = await fetch(`https://speech.googleapis.com/v1/speech:longrunningrecognize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        audio: { uri: gsUri },
      }),
    });

    if (!recognizeRes.ok) {
      const errData = await recognizeRes.json().catch(() => ({}));
      const errObj = errData?.error || {};
      console.error('LongRunningRecognize Error:', {
        service: 'speech.googleapis.com',
        methodName: 'LongRunningRecognize',
        httpStatus: recognizeRes.status,
        googleStatus: errObj.status || 'RECOGNIZE_ERROR',
        googleMessage: errObj.message || `HTTP ${recognizeRes.status}`,
      });
      throw new Error(`Google Speech LongRunningRecognize Failed (${recognizeRes.status}): ${errObj.message || 'API request failed'}`);
    }

    const opData = await recognizeRes.json();
    const opName = opData.name;

    if (!opName) {
      throw new Error('LongRunningRecognize did not return a valid operation name.');
    }

    // Step 3: Poll for Operation Completion
    let isDone = false;
    let attempts = 0;
    let finalResult: any = null;

    while (!isDone && attempts < 60) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      attempts++;

      const pollRes = await fetch(`https://speech.googleapis.com/v1/operations/${opName}?key=${apiKey}`);
      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      if (pollData.done) {
        isDone = true;
        if (pollData.error) {
          console.error('Speech Operation Error:', {
            service: 'speech.googleapis.com',
            methodName: 'GetOperation',
            googleStatus: pollData.error.code,
            googleMessage: pollData.error.message,
          });
          throw new Error(`Google Speech Operation Failed: ${pollData.error.message}`);
        }
        finalResult = pollData.response;
      }
    }

    if (!isDone || !finalResult) {
      throw new Error('Speech-to-Text long-running recognition timed out after 3 minutes.');
    }

    const results = finalResult.results || [];
    const fullTranscript = results
      .map((r: any) => r.alternatives?.[0]?.transcript || '')
      .filter((t: string) => t.trim().length > 0)
      .join('\n\n');

    return fullTranscript || 'No speech recognized in audio file.';

  } finally {
    // Step 4: Temporary GCS File Cleanup
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
      await storage.bucket(gcsBucket).file(objectName).delete();
    } catch (cleanupErr) {
      const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${gcsBucket}/o/${encodeURIComponent(objectName)}?key=${apiKey}`;
      await fetch(deleteUrl, { method: 'DELETE' }).catch(() => {});
    }
  }
}

async function transcribeWithGoogleCloud(
  buffer: Buffer,
  fileName: string,
  apiKey: string,
  gcsBucket?: string,
  language: string = 'en-US'
): Promise<string> {
  // If a GCS Bucket is configured, use Google Cloud Storage + LongRunningRecognize
  if (gcsBucket && gcsBucket.trim().length > 0) {
    return await transcribeWithGCSAndLongRunning(buffer, fileName, apiKey, gcsBucket, language);
  }

  // Synchronous recognize request for short audio (< 1 min)
  const base64Audio = buffer.toString('base64');
  const config: Record<string, any> = {
    languageCode: language || 'en-US',
    enableAutomaticPunctuation: true,
    model: 'default',
  };

  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'mp3') config.encoding = 'MP3';
  if (ext === 'flac') config.encoding = 'FLAC';
  if (ext === 'wav') config.encoding = 'LINEAR16';

  const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config,
      audio: { content: base64Audio },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errObj = errData?.error || {};
    const message = errObj.message || `Google API HTTP ${response.status}`;

    console.error('Synchronous Recognize Error:', {
      service: 'speech.googleapis.com',
      methodName: 'Recognize',
      httpStatus: response.status,
      googleStatus: errObj.status || 'RECOGNIZE_ERROR',
      googleReason: errObj.reason || 'SYNC_AUDIO_ERROR',
      googleMessage: message,
    });

    if (message.toLowerCase().includes('too long') || message.toLowerCase().includes('longrunningrecognize')) {
      throw new Error(
        `Google Cloud Speech-to-Text: Audio recording is longer than 1 minute. Please enter your Google Cloud Storage Bucket Name in Transcription API Settings (API 1) to enable LongRunningRecognize.`
      );
    }

    throw new Error(`Google Cloud Speech-to-Text (${response.status}): ${message}`);
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    return 'No speech recognized in audio file.';
  }

  const fullTranscript = data.results
    .map((result: any) => result.alternatives?.[0]?.transcript || '')
    .filter((text: string) => text.trim().length > 0)
    .join('\n\n');

  return fullTranscript || 'No speech recognized in audio file.';
}

async function transcribeWithAssemblyAI(buffer: Buffer, apiKey: string): Promise<string> {
  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: buffer as any,
  });

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json().catch(() => ({}));
    throw new Error(`AssemblyAI upload failed (${uploadResponse.status}): ${JSON.stringify(errorData)}`);
  }

  const uploadData = await uploadResponse.json();
  const audioUrl = uploadData.upload_url;

  if (!audioUrl) {
    throw new Error('AssemblyAI upload did not return an audio URL');
  }

  const client = new AssemblyAI({ apiKey });
  const transcriptResponse = await client.transcripts.transcribe({
    audio_url: audioUrl,
    speaker_labels: true,
    disfluencies: true,
    speakers_expected: 2,
  }) as any;

  if (transcriptResponse.error) {
    throw new Error(`AssemblyAI transcription failed: ${transcriptResponse.error}`);
  }

  let rawTranscript = '';
  if (transcriptResponse.utterances && transcriptResponse.utterances.length > 0) {
    transcriptResponse.utterances.forEach((utterance: any) => {
      const startTime = (utterance.start / 1000).toFixed(2);
      const endTime = (utterance.end / 1000).toFixed(2);
      const speaker = utterance.speaker ? `Speaker ${utterance.speaker}` : 'Unknown';
      const text = utterance.text;
      
      rawTranscript += `[${startTime}s-${endTime}s] [${speaker}]: ${text}\n\n`;
    });
  } else if (transcriptResponse.text) {
    rawTranscript = transcriptResponse.text;
  }

  return rawTranscript.trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const configStr = formData.get('sttConfig') as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Audio file is required for API 1 transcription.' }, { status: 400 });
    }

    let sttConfig: STTConfig = {
      provider: 'GoogleCloud',
      apiKey: process.env.STT_API_KEY || process.env.GOOGLE_SPEECH_API_KEY || '',
      gcsBucket: process.env.GCS_BUCKET_NAME || '',
      language: 'en-US'
    };

    if (configStr) {
      try {
        const parsed = JSON.parse(configStr);
        if (parsed.apiKey) sttConfig.apiKey = parsed.apiKey;
        if (parsed.provider) sttConfig.provider = parsed.provider;
        if (parsed.gcsBucket) sttConfig.gcsBucket = parsed.gcsBucket;
        if (parsed.language) sttConfig.language = parsed.language;
      } catch (e) {
        console.warn('Failed to parse sttConfig, fallback to defaults');
      }
    }

    if (!sttConfig.apiKey) {
      return NextResponse.json(
        { error: 'API 1 Key Missing. Please enter your API Key in Transcription API Settings (API 1).' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawTranscript = '';

    if (sttConfig.provider === 'AssemblyAI') {
      rawTranscript = await transcribeWithAssemblyAI(buffer, sttConfig.apiKey);
    } else {
      rawTranscript = await transcribeWithGoogleCloud(
        buffer,
        file.name,
        sttConfig.apiKey,
        sttConfig.gcsBucket,
        sttConfig.language
      );
    }

    return NextResponse.json({
      success: true,
      transcriptionStatus: 'transcription_completed',
      rawTranscript,
      transcriptionProvider: sttConfig.provider,
      filename: file.name,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('API 1 Transcription Error:', error);
    const details = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        transcriptionStatus: 'error',
        error: details,
        details
      },
      { status: 400 }
    );
  }
}
