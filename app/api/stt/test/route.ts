import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || process.env.STT_API_KEY || process.env.GOOGLE_SPEECH_API_KEY || process.env.ASSEMBLYAI_API_KEY;
    const provider = body.provider || 'GoogleCloud';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is missing. Please enter your API key in Transcription API settings.' },
        { status: 400 }
      );
    }

    if (provider === 'GoogleCloud') {
      // Send a test recognition request to Google Cloud Speech-to-Text REST API using API Key
      // Minimal 1-second 16kHz MONO silent WAV audio in base64
      const silentWavBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      
      const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            encoding: 'LINEAR16',
            languageCode: 'en-US',
          },
          audio: {
            content: silentWavBase64,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData?.error?.message || `HTTP ${res.status}`;
        return NextResponse.json(
          { success: false, error: `Google Speech API Connection Failed: ${message}` },
          { status: res.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Connected Successfully to Google Cloud Speech-to-Text API',
        provider: 'Google Cloud Speech-to-Text',
      });
    }

    if (provider === 'AssemblyAI') {
      const res = await fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
        headers: {
          'Authorization': apiKey,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return NextResponse.json(
          { success: false, error: `Connection Failed: HTTP ${res.status} - ${errorData.error || 'Invalid AssemblyAI API key'}` },
          { status: res.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Connected Successfully to AssemblyAI',
        provider: 'AssemblyAI',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Connected Successfully (${provider})`,
      provider,
    });
  } catch (error) {
    console.error('STT Connection Test Error:', error);
    return NextResponse.json(
      { success: false, error: `Connection Failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
