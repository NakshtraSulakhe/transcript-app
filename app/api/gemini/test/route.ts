import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || process.env.GEMINI_API_KEY;
    const model = body.model || 'gemini-2.0-flash';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Gemini API key is missing. Please provide an API key in settings or set GEMINI_API_KEY environment variable.' },
        { status: 400 }
      );
    }

    // Call Gemini API REST endpoint with a lightweight prompt
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Respond with "OK" if this connection test is successful.' }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData?.error?.message || `HTTP error ${response.status}`;
      return NextResponse.json(
        { success: false, error: `Connection Failed — ${message}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({
      success: true,
      message: 'Connected Successfully',
      model,
      sampleResponse: reply.trim(),
    });
  } catch (error) {
    console.error('Gemini connection test error:', error);
    return NextResponse.json(
      { success: false, error: `Connection Failed — ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
