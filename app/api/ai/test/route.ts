import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || process.env.GEMINI_API_KEY;
    const requestedModel = body.model || 'gemini-3.6-flash';
    const provider = body.provider || 'Google AI Studio';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'AI API key missing. Please enter your API key in AI Processing API settings.' },
        { status: 400 }
      );
    }

    // List of valid model identifiers for Google AI Studio v1beta API
    const modelsToTry = Array.from(new Set([
      requestedModel,
      'gemini-3.6-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ]));

    let lastErrorMessage = '';
    let successfulModel = '';

    for (const m of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Ping test' }] }],
            }),
          }
        );

        if (response.ok) {
          successfulModel = m;
          break;
        }

        const errorData = await response.json().catch(() => ({}));
        lastErrorMessage = errorData?.error?.message || `HTTP ${response.status}`;
        const errLower = lastErrorMessage.toLowerCase();

        // If model is busy, unavailable, or model name not found in this region/version, try next fallback model
        if (
          errLower.includes('high demand') ||
          errLower.includes('not found') ||
          response.status === 503 ||
          response.status === 429 ||
          response.status === 404
        ) {
          console.warn(`Model ${m} unavailable (${lastErrorMessage}), trying fallback model...`);
          continue;
        } else {
          // Hard error like invalid API key (400 API_KEY_INVALID / 403 PERMISSION_DENIED)
          return NextResponse.json(
            { success: false, error: `Connection Failed: ${lastErrorMessage}` },
            { status: response.status }
          );
        }
      } catch (err) {
        lastErrorMessage = err instanceof Error ? err.message : 'Network error';
      }
    }

    if (!successfulModel) {
      return NextResponse.json(
        { success: false, error: `Connection Failed: ${lastErrorMessage}. All tested Gemini model tiers are currently unavailable. Please check your API key or try again in a moment.` },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: successfulModel === requestedModel 
        ? 'Connected Successfully' 
        : `Connected Successfully (Using ${successfulModel})`,
      provider,
      model: successfulModel,
    });

  } catch (error) {
    console.error('AI Connection Test Error:', error);
    return NextResponse.json(
      { success: false, error: `Connection Failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
