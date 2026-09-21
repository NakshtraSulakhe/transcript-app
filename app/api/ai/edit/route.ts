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

    const prospectFullName = [leadInfo.firstName, leadInfo.lastName].filter(Boolean).join(' ') || leadInfo.firstName || 'Laura McDurmont';
    const prospectJobTitle = leadInfo.jobTitle || 'Director, Network, Voice, Cloud and Datacenter Services';
    const prospectCompany = leadInfo.companyName || 'Energizer Holdings';
    const prospectEmail = leadInfo.email || `${leadInfo.firstName?.toLowerCase() || 'prospect'}.${leadInfo.lastName?.toLowerCase() || 'contact'}@${(leadInfo.companyName || 'energizer').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

    const prompt = `
ROLE:
You are an expert AI Call Transcript Editor and Quality Assurance Engine for TGS Tech Info.

OBJECTIVE:
Transform the raw, unedited speech-to-text call audio transcript into an EDITED, PROFESSIONALLY FORMATTED CALL TRANSCRIPT arranged into EXACTLY 4 CONVERSATIONAL PARAGRAPHS.

CRITICAL INSTRUCTION:
This must NOT be a third-person call summary (do not write "An outbound cold call was initiated by...").
It MUST be an EDITED, FORMATTED CONVERSATIONAL TRANSCRIPT reflecting the real spoken dialogue between the Agent and the Prospect, cleaned of filler words, noise, tangents, and negative sentences, arranged into 4 distinct conversational paragraphs following the exact flow shown below.

LEAD REFERENCE DATA:
- Prospect Full Name: ${prospectFullName}
- Company: ${prospectCompany}
- Job Title: ${prospectJobTitle}
- Email: ${prospectEmail}
- Calling Company: TGS Tech Info

RAW TRANSCRIPT (EVIDENCE):
"""
${rawTranscript}
"""

APPROVED 4-PARAGRAPH CONVERSATIONAL CALL FLOW:

Paragraph 1 (Greeting, Introduction, Company & Role Confirmation):
Good morning, how can I help you? Hi, good morning, is this ${prospectFullName}? This is. Hi, my name is [Detected Agent Name or Jason Smith]. I'm calling you from TGS Tech Info. How are you doing today? I am doing well. Great. Thanks for asking. I believe you're the ${prospectJobTitle} for ${prospectCompany}, correct? Yes, I am.

Paragraph 2 (Outreach Purpose, Structured LMS Resource & Email Verification):
Actually, I'm just reaching out quickly to inform you about the structured LMS resource. We help learning and development teams find and implement Learning Management System solutions that make it easier to deliver training, engage learners, and track progress, helping organizations improve employee learning and development. For that, I have your email, that is ${prospectEmail} is this correct? Yeah, correct.

Paragraph 3 (The Two Key Evaluation & Timeframe Questions):
Wonderful. I just want to understand, whether your organization is currently evaluating a new Learning Management System solution? [Prospect Response 1: e.g. I believe so. / I think so. / Yes. / Probably. / Could be. / Might be.] Then, how much time do you know roughly it would take for your company to evaluate or explore an LMS solution? Would it be on immediate basis or it will take time like zero to three months or three to six months? [Prospect Response 2: e.g. I would probably be six months. / I think three months would be the good time. / Zero to three months. / Three to six months.]

Paragraph 4 (Follow-up & Professional Closing):
Wonderful. Then one of our representatives will follow up with you just to answer any questions you may have around this. And it was a pleasure speaking with you. Have a great day. Bye-bye. Okay, bye.

EDITING RULES:
1. Detect the Agent's name from the raw transcript (e.g. Jason Smith, Alex, etc.). If none is found, use "Jason Smith".
2. Match and insert the Lead Reference Data (${prospectFullName}, ${prospectJobTitle}, ${prospectCompany}, ${prospectEmail}) seamlessly into the conversational dialogue.
3. Clean out all conversational garbage: filler words ("um", "uh", "like", "you know"), stuttering, audio dropouts, and irrelevant small talk.
4. Replace or remove any negative sentences, objections, hesitation, or awkward interruptions from the raw audio so that the dialogue reads cleanly, naturally, and positively.
5. In Paragraph 3, extract the prospect's actual evaluation sentiment and timeframe sentiment from the evidence.
6. The final output must consist of EXACTLY 4 paragraphs separated by blank lines (\n\n).

REQUIRED OUTPUT FORMAT:
Return ONLY a valid JSON object matching this structure:
{
  "status": "success", // or "review_required" if missing key info
  "agent_name": "[Agent Name]",
  "prospect_name": "${prospectFullName}",
  "modified_transcript": "Paragraph 1...\\n\\nParagraph 2...\\n\\nParagraph 3...\\n\\nParagraph 4...",
  "qualification": {
    "implementation_question_asked": true,
    "implementation_response": "I believe so", // or "Yes", "Probably", "Could be", "Might be", "I think so"
    "implementation_timeline": "Three to six months" // or "Zero to three months", "Three to six months", "Six months"
  },
  "checkpoints": {
    "prospect_identified": true,
    "tgs_tech_info_introduction": true,
    "role_and_company_confirmed": true,
    "lms_value_proposition": true,
    "email_verified": true,
    "evaluation_question_asked": true,
    "evaluation_timeline_asked": true,
    "specialist_followup": true,
    "call_closing_present": true
  },
  "missing_information": [],
  "processing_notes": ["Summary of edits and extracted details"]
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
