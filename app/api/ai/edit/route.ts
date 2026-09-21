import { NextRequest, NextResponse } from 'next/server';
import { LeadInfo, CampaignInfo, AIConfig } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawTranscript: string = body.rawTranscript || '';
    const leadInfo: LeadInfo = body.leadInfo || {};
    const campaignInfo: CampaignInfo = body.campaignInfo || {};
    const aiConfig: AIConfig = body.aiConfig || {
      provider: 'Google AI Studio',
      apiKey: process.env.GEMINI_API_KEY || '',
      model: 'gemini-2.0-flash',
      temperature: 0.2,
      maxTokens: 2048,
    };

    if (!rawTranscript.trim()) {
      return NextResponse.json({ error: 'API 2 requires a non-empty raw_transcript input.' }, { status: 400 });
    }

    const apiKey = aiConfig.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 2 Key Missing. Please enter your API key in AI Processing API settings.' },
        { status: 400 }
      );
    }

    const prompt = `
ROLE:
You are an AI Call Transcript Editing and QA Engine.

CALL TYPE:
Cold Call

CALLING COMPANY:
TGS Tech Info

LEAD REFERENCE INFORMATION:
- First Name: ${leadInfo.firstName || 'Not Provided'}
- Last Name: ${leadInfo.lastName || 'Not Provided'}
- Company Name: ${leadInfo.companyName || 'Not Provided'}
- Email Address: ${leadInfo.email || 'Not Provided'}
- Job Title: ${leadInfo.jobTitle || 'Not Provided'}

CAMPAIGN INFORMATION:
- Campaign Name: ${campaignInfo.campaignName || 'Outreach'}
- Asset Title: ${campaignInfo.assetTitle || 'Solution'}
- Value Proposition: ${campaignInfo.valueProposition || 'Helping organizations optimize performance.'}

RAW TRANSCRIPT (EVIDENCE):
"""
${rawTranscript}
"""

APPROVED COLD CALLING SCRIPT & RULES:
1. Cold Call Hook: Must position the interaction as an outbound cold call (e.g. "The reason for my call is that I recently came across your profile on LinkedIn...").
2. Calling Company: MUST refer to the calling company as "TGS Tech Info".
3. Prohibited Unsupported Claims: Must NOT introduce unsupported statements such as "I sent you an email", "I'm following up on my email", "You downloaded our report", "You filled out our form", "You requested information", unless the raw recording actually contains that evidence.
4. Dynamic Value Proposition: Must replace hardcoded LMS references with the campaign's specific Asset Title ("${campaignInfo.assetTitle}") and Value Proposition ("${campaignInfo.valueProposition}").
5. Prospect Correction: Lead data may be used to correct obvious speech-to-text spelling errors (e.g. "John from ABC Tecnology" -> "John from ABC Technology"), but NEVER manufacture spoken dialogue like "Yes I am John Smith, IT Director at ABC Tech...".
6. Implementation Question: Check if prospect was asked if they are evaluating, exploring, or researching "${campaignInfo.assetTitle}".
7. Prospect Response Checkpoint: Extract prospect's actual response as "YES", "NO", "UNCLEAR", or "NOT_CAPTURED". Do NOT manufacture a "YES" if not present in the raw transcript!
8. Implementation Timeline Extraction: Options MUST be standardized as "[0–3 Months]", "[3–6 Months]", "[6–9 Months]", or "[Not Captured]". Only extract what was actually communicated.

FINAL EDITED TRANSCRIPT REQUIREMENTS (STRICT):
1. The final edited transcript MUST contain a MAXIMUM of 3–4 paragraphs (preferably 3 to 4 concise narrative paragraphs).
   - Paragraph 1: Prospect confirmation + Agent introduction (Agent Name + TGS Tech Info) + Cold-call context (e.g., LinkedIn outreach).
   - Paragraph 2: Campaign context + Asset Title ("${campaignInfo.assetTitle}") + Value Proposition ("${campaignInfo.valueProposition}") + purpose of call.
   - Paragraph 3: Implementation/evaluation question + prospect's actual response + standardized Implementation Timeline in brackets (e.g. [3–6 Months] or [Not Captured]).
   - Paragraph 4: Specialist follow-up / next step + professional closing.
   (If content naturally fits into 3 paragraphs, use 3 paragraphs. Do NOT artificially expand).

REQUIRED OUTPUT FORMAT:
Return ONLY a valid JSON object matching this structure:
{
  "status": "success", // or "review_required" if missing key info
  "modified_transcript": "Paragraph 1...\\n\\nParagraph 2...\\n\\nParagraph 3...\\n\\nParagraph 4...",
  "qualification": {
    "implementation_question_asked": true,
    "implementation_response": "YES", // "YES" | "NO" | "UNCLEAR" | "NOT_CAPTURED"
    "implementation_timeline": "[3–6 Months]" // "[0–3 Months]" | "[3–6 Months]" | "[6–9 Months]" | "[Not Captured]"
  },
  "checkpoints": {
    "prospect_identification": true,
    "tgs_tech_info_introduction": true,
    "cold_call_context": true,
    "campaign_context": true,
    "value_proposition": true,
    "implementation_question": true,
    "implementation_timeline": true,
    "specialist_followup": true,
    "closing": true
  },
  "missing_information": [],
  "processing_notes": ["Summary of edits and validation results"]
}
`;

    const requestedModel = aiConfig.model || 'gemini-3.6-flash';
    const temperature = aiConfig.temperature ?? 0.2;
    const maxTokens = aiConfig.maxTokens ?? 2048;

    const modelsToTry = Array.from(new Set([
      requestedModel,
      'gemini-3.6-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ]));

    let lastError = '';
    let parsed: any = null;
    let actualModelUsed = requestedModel;

    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawContent) {
            parsed = JSON.parse(rawContent);
            actualModelUsed = model;
            break;
          }
        } else {
          const errText = await response.text();
          lastError = errText;
          const errLower = errText.toLowerCase();

          if (
            errLower.includes('high demand') ||
            errLower.includes('not found') ||
            response.status === 503 ||
            response.status === 429 ||
            response.status === 404
          ) {
            console.warn(`Model ${model} unavailable (${errText}), trying fallback model...`);
            continue;
          } else {
            throw new Error(`Gemini API error (${response.status}): ${errText}`);
          }
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Unknown error';
      }
    }

    if (!parsed) {
      return NextResponse.json(
        {
          status: 'error',
          error: `AI Processing Error: All Gemini model tiers are currently unavailable. (${lastError})`
        },
        { status: 503 }
      );
    }

    const modifiedTranscript = parsed.modified_transcript || '';
    const qualification = parsed.qualification || {};
    const checkpoints = parsed.checkpoints || {};
    const missingInfo = parsed.missing_information || [];
    const notes = parsed.processing_notes || [];

    const isComplete = qualification.implementation_response === 'YES' && qualification.implementation_timeline !== '[Not Captured]';

    return NextResponse.json({
      status: parsed.status || (isComplete ? 'success' : 'review_required'),
      aiProcessingStatus: 'ai_processing_completed',
      modifiedTranscript,
      qualification,
      checkpoints,
      missingInformation: missingInfo,
      processingNotes: Array.isArray(notes) ? notes.join(' ') : notes,
      aiProvider: aiConfig.provider || 'Google AI Studio',
      aiModel: actualModelUsed,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('API 2 Processing Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        aiProcessingStatus: 'error',
        error: 'API 2 Processing Failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
