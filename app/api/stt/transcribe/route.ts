import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';
import { STTConfig } from '@/lib/types';

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

  const models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
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
      return NextResponse.json({ error: 'Audio file is required for transcription.' }, { status: 400 });
    }

    let sttConfig: STTConfig = {
      provider: 'Gemini',
      apiKey: process.env.GEMINI_API_KEY || process.env.STT_API_KEY || '',
      language: 'en-US'
    };

    if (configStr) {
      try {
        const parsed = JSON.parse(configStr);
        if (parsed.provider) sttConfig.provider = parsed.provider;
        if (parsed.apiKey) sttConfig.apiKey = parsed.apiKey;
        if (parsed.language) sttConfig.language = parsed.language;
      } catch (e) {
        console.warn('Failed to parse sttConfig, using defaults');
      }
    }

    const effectiveApiKey = (sttConfig.apiKey || process.env.GEMINI_API_KEY || process.env.STT_API_KEY || '').trim();

    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: 'API Key Missing. Please set GEMINI_API_KEY in your environment variables (.env.local).' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawTranscript = '';
    let actualProviderUsed = sttConfig.provider;

    if (sttConfig.provider === 'AssemblyAI') {
      rawTranscript = await transcribeWithAssemblyAI(buffer, effectiveApiKey);
    } else {
      // Default & Gemini: Direct Gemini Multimodal STT (Zero GCS / Service Account dependencies!)
      rawTranscript = await transcribeWithGeminiAudio(buffer, file.name, effectiveApiKey);
      actualProviderUsed = 'Gemini Multimodal STT (High Precision)';
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
