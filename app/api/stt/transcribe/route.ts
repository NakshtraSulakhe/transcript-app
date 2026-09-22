import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';
import { Storage } from '@google-cloud/storage';
import { SpeechClient } from '@google-cloud/speech';
import { STTConfig } from '@/lib/types';

function getSpeechClient(): SpeechClient {
  let speechOptions: any = {};
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    speechOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credVal = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    if (credVal.startsWith('{')) {
      speechOptions.credentials = JSON.parse(credVal);
    } else {
      speechOptions.keyFilename = credVal;
    }
  }
  return new SpeechClient(speechOptions);
}

// Upload helper supporting both @google-cloud/storage SDK (Service Account / ADC) and REST API Key
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

// Helper to format Google Speech results word-by-word and line-by-line with speaker diarization and timestamps
function formatGoogleSpeechResults(results: any[]): string {
  if (!results || results.length === 0) {
    return 'No speech recognized in audio file.';
  }

  // In Google Cloud Speech v1, the last result often contains the full diarized word array
  const lastResult = results[results.length - 1];
  const lastWords = lastResult?.alternatives?.[0]?.words || [];
  const hasDiarizationInLast = lastWords.some((w: any) => w.speakerTag && w.speakerTag > 0);

  let wordsToProcess: any[] = [];
  if (hasDiarizationInLast && lastWords.length > 5) {
    wordsToProcess = lastWords.filter((w: any) => w.speakerTag && w.speakerTag > 0);
  } else {
    for (const res of results) {
      const words = res.alternatives?.[0]?.words || [];
      for (const w of words) {
        if (w.speakerTag && w.speakerTag > 0) {
          wordsToProcess.push(w);
        }
      }
    }
  }

  if (wordsToProcess.length > 0) {
    const turns: { speaker: number; words: string[]; start: string; end: string }[] = [];
    let currentTurn: { speaker: number; words: string[]; start: string; end: string } | null = null;

    for (const w of wordsToProcess) {
      const speaker = w.speakerTag || 1;
      const wordText = w.word || '';
      const startSec = (parseFloat(w.startTime?.seconds || '0') + (w.startTime?.nanos || 0) / 1e9).toFixed(1);
      const endSec = (parseFloat(w.endTime?.seconds || '0') + (w.endTime?.nanos || 0) / 1e9).toFixed(1);

      if (!currentTurn || currentTurn.speaker !== speaker) {
        if (currentTurn) turns.push(currentTurn);
        currentTurn = { speaker, words: [wordText], start: startSec, end: endSec };
      } else {
        currentTurn.words.push(wordText);
        currentTurn.end = endSec;
      }
    }
    if (currentTurn) turns.push(currentTurn);

    if (turns.length > 0) {
      return turns
        .map(t => `[${t.start}s - ${t.end}s] [Speaker ${t.speaker}]: ${t.words.join(' ')}`)
        .join('\n\n');
    }
  }

  // Line-by-line utterance segmentation with timestamps
  const lines: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const alt = results[i].alternatives?.[0];
    const text = alt?.transcript?.trim();
    if (!text) continue;

    const words = alt?.words || [];
    let timeLabel = '';
    if (words.length > 0) {
      const firstWord = words[0];
      const lastWord = words[words.length - 1];
      const startSec = (parseFloat(firstWord.startTime?.seconds || '0') + (firstWord.startTime?.nanos || 0) / 1e9).toFixed(1);
      const endSec = (parseFloat(lastWord.endTime?.seconds || '0') + (lastWord.endTime?.nanos || 0) / 1e9).toFixed(1);
      timeLabel = `[${startSec}s - ${endSec}s] `;
    }

    lines.push(`${timeLabel}[Line ${i + 1}]: ${text}`);
  }

  return lines.join('\n\n') || 'No speech recognized in audio file.';
}

// Gemini Multimodal Native Audio Transcription (Ultra-High Precision)
async function transcribeWithGeminiAudio(buffer: Buffer, fileName: string, apiKey: string): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop() || 'wav';
  let mimeType = 'audio/wav';
  if (ext === 'mp3') mimeType = 'audio/mp3';
  if (ext === 'm4a') mimeType = 'audio/m4a';
  if (ext === 'aac') mimeType = 'audio/aac';
  if (ext === 'ogg') mimeType = 'audio/ogg';
  if (ext === 'flac') mimeType = 'audio/flac';
  if (ext === 'webm') mimeType = 'audio/webm';
  if (ext === 'mp4') mimeType = 'audio/mp4';

  const base64Audio = buffer.toString('base64');
  const prompt = `You are an expert verbatim audio transcriptionist.
Your mission is to produce an EXACT, 100% VERBATIM Speech-to-Text transcript of this call audio recording.

RULES:
1. Transcribe EVERY single word spoken accurately word-for-word and line-by-line.
2. Accurately identify distinct speakers (e.g. [Speaker 1], [Speaker 2]) and include timestamps for each turn: [MM:SS - MM:SS] [Speaker X]: ...
3. Do NOT summarize. Do NOT skip quiet words, background confirmations, names, emails, or numbers.
4. Capture natural speech accurately including affirmations ("Yes", "I believe so", "I think so", "Ok", "Yeah") and numbers/timelines ("six months", "three months").
5. Return ONLY the verbatim transcript lines.`;

  const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
  let lastError = '';

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Audio
                  }
                },
                { text: prompt }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      } else {
        lastError = await response.text();
      }
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }

  throw new Error(`Gemini Audio Transcription failed: ${lastError}`);
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
  if (ext === 'm4a') mimeType = 'audio/m4a';

  // Step 1: Upload Audio to Google Cloud Storage Bucket
  await uploadFileToGCS(buffer, gcsBucket, objectName, mimeType, apiKey);

  const gsUri = `gs://${gcsBucket}/${objectName}`;

  try {
    const config: Record<string, any> = {
      languageCode: language || 'en-US',
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      useEnhanced: true,
      model: 'latest_long',
      diarizationConfig: {
        enableSpeakerDiarization: true,
        minSpeakerCount: 2,
        maxSpeakerCount: 3,
      },
      speechContexts: [
        {
          phrases: [
            'TGS Tech Info',
            'Learning Management System',
            'LMS',
            'Director',
            'VP',
            'Manager',
            'evaluate',
            'exploring',
            'zero to three months',
            'three to six months',
            'six months',
            'three months',
            'representative',
            'follow up'
          ],
          boost: 15.0
        }
      ]
    };

    if (ext === 'mp3') config.encoding = 'MP3';
    if (ext === 'flac') config.encoding = 'FLAC';
    if (ext === 'ogg') config.encoding = 'OGG_OPUS';

    // Strategy 1: Use @google-cloud/speech SDK (authenticated with Google Cloud IAM / ADC)
    try {
      const speechClient = getSpeechClient();
      const [operation] = await speechClient.longRunningRecognize({
        config,
        audio: { uri: gsUri },
      });
      const [response] = await operation.promise();
      const results = response.results || [];
      return formatGoogleSpeechResults(results);
    } catch (sdkError: any) {
      console.warn('SpeechClient SDK longRunningRecognize failed, attempting REST API fallback:', sdkError?.message);

      // Strategy 2: REST fallback with API key
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
        throw new Error(
          `Google Speech LongRunningRecognize Failed: SDK Error: "${sdkError?.message || 'N/A'}". REST Error (${recognizeRes.status}): "${errObj.message || 'API request failed'}"`
        );
      }

      const opData = await recognizeRes.json();
      const opName = opData.name;

      if (!opName) {
        throw new Error('LongRunningRecognize did not return a valid operation name.');
      }

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
            throw new Error(`Google Speech Operation Failed: ${pollData.error.message}`);
          }
          finalResult = pollData.response;
        }
      }

      if (!isDone || !finalResult) {
        throw new Error('Speech-to-Text long-running recognition timed out after 3 minutes.');
      }

      const results = finalResult.results || [];
      return formatGoogleSpeechResults(results);
    }
  } finally {
    // Cleanup temporary GCS object
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
    try {
      return await transcribeWithGCSAndLongRunning(buffer, fileName, apiKey, gcsBucket, language);
    } catch (gcsErr: any) {
      console.warn('GCS LongRunningRecognize error, checking if synchronous recognize can process audio:', gcsErr?.message);
      if (buffer.length > 10 * 1024 * 1024) {
        throw gcsErr;
      }
    }
  }

  // Synchronous recognize request for audio
  const config: Record<string, any> = {
    languageCode: language || 'en-US',
    enableAutomaticPunctuation: true,
    enableWordTimeOffsets: true,
    useEnhanced: true,
    model: 'latest_long',
    speechContexts: [
      {
        phrases: [
          'TGS Tech Info',
          'Learning Management System',
          'LMS',
          'Director',
          'VP',
          'Manager',
          'evaluate',
          'exploring',
          'zero to three months',
          'three to six months',
          'six months',
          'three months',
          'representative',
          'follow up'
        ],
        boost: 15.0
      }
    ]
  };

  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'mp3') config.encoding = 'MP3';
  if (ext === 'flac') config.encoding = 'FLAC';
  if (ext === 'ogg') config.encoding = 'OGG_OPUS';

  // Strategy 1: SpeechClient SDK (IAM / ADC)
  try {
    const speechClient = getSpeechClient();
    const [response] = await speechClient.recognize({
      config,
      audio: { content: buffer },
    });

    const dataResults = response.results || [];
    if (dataResults.length > 0) {
      return formatGoogleSpeechResults(dataResults);
    }
  } catch (sdkErr: any) {
    console.warn('SpeechClient synchronous recognize failed, trying REST recognize fallback:', sdkErr?.message);
  }

  // Strategy 2: REST recognize with API key
  const base64Audio = buffer.toString('base64');
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

    if (message.toLowerCase().includes('too long') || message.toLowerCase().includes('longrunningrecognize')) {
      throw new Error(
        `Google Cloud Speech-to-Text: Audio recording is longer than 1 minute. Please enter your Google Cloud Storage Bucket Name in Transcription API Settings (API 1) to enable LongRunningRecognize.`
      );
    }

    throw new Error(`Google Cloud Speech-to-Text (${response.status}): ${message}`);
  }

  const data = await response.json();
  return formatGoogleSpeechResults(data.results || []);
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

    const isGeminiProvider = sttConfig.provider === 'Gemini' || sttConfig.provider === 'GoogleGemini';
    const effectiveApiKey = isGeminiProvider
      ? (sttConfig.apiKey || process.env.GEMINI_API_KEY || '')
      : (sttConfig.apiKey || process.env.STT_API_KEY || process.env.GOOGLE_SPEECH_API_KEY || process.env.GEMINI_API_KEY || '');

    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: 'API 1 Key Missing. Please enter your API Key in Transcription API Settings (API 1).' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawTranscript = '';
    let actualProviderUsed = sttConfig.provider;

    if (sttConfig.provider === 'AssemblyAI') {
      rawTranscript = await transcribeWithAssemblyAI(buffer, effectiveApiKey);
    } else if (isGeminiProvider) {
      rawTranscript = await transcribeWithGeminiAudio(buffer, file.name, effectiveApiKey);
      actualProviderUsed = 'Gemini Multimodal STT';
    } else {
      // Default: Google Cloud Speech-to-Text with automatic Gemini fallback
      try {
        rawTranscript = await transcribeWithGoogleCloud(
          buffer,
          file.name,
          effectiveApiKey,
          sttConfig.gcsBucket,
          sttConfig.language
        );
        if (!rawTranscript || rawTranscript.trim() === '' || rawTranscript.includes('No speech recognized')) {
          throw new Error('Google Cloud Speech returned no speech for this audio format.');
        }
      } catch (googleErr: any) {
        const geminiKey = process.env.GEMINI_API_KEY || (effectiveApiKey.startsWith('AQ') ? effectiveApiKey : '');
        if (geminiKey) {
          console.warn('Google Cloud Speech encountered an issue, falling back to Gemini Multimodal Audio STT:', googleErr.message);
          rawTranscript = await transcribeWithGeminiAudio(buffer, file.name, geminiKey);
          actualProviderUsed = 'Gemini Multimodal STT (High Precision)';
        } else {
          throw googleErr;
        }
      }
    }

    return NextResponse.json({
      success: true,
      transcriptionStatus: 'transcription_completed',
      rawTranscript,
      transcriptionProvider: actualProviderUsed,
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
