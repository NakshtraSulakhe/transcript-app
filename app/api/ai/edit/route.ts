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
      model: 'gemini-3.6-flash',
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

    const targetCompany = leadInfo.companyName || 'the prospect organization';
    const defaultAsset = campaignInfo.assetTitle || 'Learning Management System (LMS)';
    const defaultValueProp = campaignInfo.valueProposition || 'identifying and implementing Learning Management System (LMS) solutions that streamline training delivery, learner engagement, and performance tracking, enabling organizations to enhance workforce development and achieve better learning outcomes';

    const prompt = `
ROLE:
You are an expert AI Cold Call Quality Assurance and Transcript Editing Engine.

OBJECTIVE:
Transform the raw spoken audio transcript into a polished, professional, cohesive narrative transcript composed of EXACTLY 3 TO 4 PARAGRAPHS.

STRICT ANONYMITY REQUIREMENT:
- DO NOT INCLUDE ANY PERSONAL NAMES for either the prospect or the agent anywhere in the edited transcript.
- Do NOT use names like "Alex", "John", "Sarah", or any spoken personal names.
- Refer to the caller as "the representative", "the caller", or "the TGS Tech Info specialist".
- Refer to the person called as "the prospect", "the contact", or "the organization's representative".
- The calling company name MUST be referenced as "TGS Tech Info".
- The target company name ("${targetCompany}") may be referenced.

PARAGRAPH STRUCTURE (MUST BE 3 TO 4 PARAGRAPHS):

Paragraph 1 (Introduction & Cold Call Context):
- Position the interaction as an outbound cold call from TGS Tech Info.
- Reference that the outreach was initiated following a review of the prospect's professional profile on LinkedIn.
- Confirm establishing contact with the organization's representative in a professional, courteous manner, without using any personal names.

Paragraph 2 (Purpose of Call & LMS Value Proposition):
- Clearly articulate the core purpose of the outreach on behalf of TGS Tech Info.
- Introduce the Learning Management System (LMS) value proposition: explaining that TGS Tech Info helps learning and development teams with ${defaultValueProp}.

Paragraph 3 (The Two Key Questions & Standardized Responses):
- Incorporate Question 1: The representative asked whether the organization is currently evaluating, exploring, or researching a new Learning Management System (LMS) solution.
  - The prospect's evaluation status MUST be classified and reflected as exactly one of these four standardized options:
    "Yes", "Probably", "Could be", or "Might be".
- Incorporate Question 2: The representative inquired about how much time they expect it will take to evaluate, explore, or research the solution.
  - The prospect's expected timeframe MUST be classified and reflected as exactly one of these three standardized options:
    "Zero to two months", "Two to three months", or "Three to six months".

Paragraph 4 (Comprehensive Closing Statement):
- A comprehensive closing statement that unifies all the preceding elements.
- State that based on their interest and expected evaluation timeframe ("Zero to two months", "Two to three months", or "Three to six months"), a solutions specialist from TGS Tech Info will follow up to share tailored insights, provide strategic recommendations, and answer any questions.
- Conclude by expressing gratitude for their time and wishing them a productive day ahead.

RAW TRANSCRIPT (EVIDENCE):
"""
${rawTranscript}
"""

CLEANING RULES:
- Remove all conversational tangents, filler words ("um", "uh", "like"), audio dropouts, and stuttering.
- Replace or remove all negative sentences, friction, hesitation, or awkward interruptions from the raw audio so that the final narrative is smooth, relevant, positive, and professional.

REQUIRED OUTPUT FORMAT:
Return ONLY a valid JSON object matching this structure:
{
  "status": "success", // or "review_required" if evaluation or timeline wasn't captured
  "modified_transcript": "Paragraph 1...\\n\\nParagraph 2...\\n\\nParagraph 3...\\n\\nParagraph 4...",
  "qualification": {
    "implementation_question_asked": true,
    "implementation_response": "Yes", // Must be one of: "Yes" | "Probably" | "Could be" | "Might be" | "No" | "Not Captured"
    "implementation_timeline": "Three to six months" // Must be one of: "Zero to two months" | "Two to three months" | "Three to six months" | "[Not Captured]"
  },
  "checkpoints": {
    "anonymous_no_personal_names": true,
    "tgs_tech_info_introduction": true,
    "cold_call_linkedin_context": true,
    "lms_value_proposition": true,
    "evaluation_question_asked": true,
    "evaluation_timeline_asked": true,
    "specialist_followup": true,
    "comprehensive_closing_statement": true
  },
  "missing_information": [],
  "processing_notes": ["Summary of edits, negative sentence removals, and standardized question extractions"]
}
`;

    const requestedModel = aiConfig.model || 'gemini-3.6-flash';
    const temperature = aiConfig.temperature ?? 0.2;
    const maxTokens = aiConfig.maxTokens ?? 2048;

    const modelsToTry = Array.from(new Set([
      requestedModel,
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview'
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

          if (response.status === 402) {
            throw new Error(`Google AI Studio credits depleted (402). Please check your project billing or use an active key.`);
          }

          if (
            errLower.includes('high demand') ||
            errLower.includes('not found') ||
            errLower.includes('no longer available') ||
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

    const validResponses = ['Yes', 'Probably', 'Could be', 'Might be', 'YES'];
    const isComplete = validResponses.includes(qualification.implementation_response) &&
      qualification.implementation_timeline &&
      qualification.implementation_timeline !== '[Not Captured]' &&
      qualification.implementation_timeline !== 'Not Captured';

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
