import { NextRequest, NextResponse } from 'next/server';
import { LeadInfo, CampaignInfo, AIConfig } from '@/lib/types';
import { DEFAULT_AI_PROMPT_TEMPLATE } from '@/lib/defaultPrompt';

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

    // Support user-provided custom instructions/prompt from UI, otherwise use 29-Point Engine Specification
    const userPromptInput: string = (body.customPrompt || aiConfig.customPrompt || '').trim();
    const baseTemplate = userPromptInput || DEFAULT_AI_PROMPT_TEMPLATE;

    let resolvedPrompt = baseTemplate
      .replace(/\{\{PROSPECT_FULL_NAME\}\}/g, prospectFullName)
      .replace(/\{\{PROSPECT_COMPANY\}\}/g, prospectCompany)
      .replace(/\{\{PROSPECT_JOB_TITLE\}\}/g, prospectJobTitle)
      .replace(/\{\{PROSPECT_EMAIL\}\}/g, prospectEmail)
      .replace(/\{\{CAMPAIGN_NAME\}\}/g, campaignInfo.campaignName || 'B2B Outreach')
      .replace(/\{\{ASSET_TITLE\}\}/g, campaignInfo.assetTitle || 'Solution')
      .replace(/\{\{VALUE_PROPOSITION\}\}/g, campaignInfo.valueProposition || 'Helping organizations optimize performance.')
      .replace(/\{\{RAW_TRANSCRIPT\}\}/g, rawTranscript);

    // If user provided custom prompt without raw transcript placeholders, append the context automatically
    if (!resolvedPrompt.includes(rawTranscript) && !userPromptInput.includes('{{RAW_TRANSCRIPT}}')) {
      resolvedPrompt += `\n\nLEAD REFERENCE DATA:\n- Prospect Full Name: ${prospectFullName}\n- Company Name: ${prospectCompany}\n- Job Title: ${prospectJobTitle}\n- Verified Email: ${prospectEmail}\n- Calling Company: TGS Tech Info\n\nRAW TRANSCRIPT (SOURCE OF TRUTH):\n"""\n${rawTranscript}\n"""`;
    }

    // Ensure required JSON contract is preserved so UI tabs and checkpoints work seamlessly
    if (!resolvedPrompt.includes('REQUIRED OUTPUT JSON FORMAT') && !resolvedPrompt.includes('modified_transcript')) {
      resolvedPrompt += `\n\nREQUIRED OUTPUT JSON FORMAT:\nReturn ONLY a valid JSON object matching this structure:\n{\n  "status": "success",\n  "agent_name": "[Detected Agent Name or Jason Smith]",\n  "prospect_name": "${prospectFullName}",\n  "modified_transcript": "Paragraph 1...\\n\\nParagraph 2...\\n\\nParagraph 3...",\n  "qualification": {\n    "implementation_question_asked": true,\n    "implementation_response": "[Prospect's actual confirmed evaluation answer]",\n    "implementation_timeline": "[Prospect's actual confirmed timeline in months]"\n  },\n  "checkpoints": {\n    "prospect_identified": true,\n    "tgs_tech_info_introduction": true,\n    "role_and_company_confirmed": true,\n    "lms_value_proposition": true,\n    "email_verified": true,\n    "no_send_or_share_mentions": true,\n    "evaluation_question_asked": true,\n    "evaluation_timeline_asked": true,\n    "specialist_followup": true,\n    "call_closing_present": true\n  },\n  "missing_information": [],\n  "processing_notes": "Brief summary of edits, confirmed details, and timeline captured in months"\n}`;
    }

    const prompt = resolvedPrompt;

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

    let modifiedTranscript = parsed.modified_transcript || '';
    
    // Safety Net: Ensure all references to sending/sharing guides, reports, collateral, or emails are eliminated
    modifiedTranscript = modifiedTranscript
      .replace(/(can\s+I|I\s+will|I'll|we\s+will|we'll|let\s+me|I'd\s+like\s+to|I\s+wanted\s+to|wanted\s+to|reaching\s+out\s+to)?\s*(send|sending|share|sharing|email)\s+(you\s+)?(a\s+|the\s+|any\s+|our\s+)?(guide|report|collateral|whitepaper|overview|material|details)?\s*(via|over|through|by|to)?\s*(your\s+)?emails?/gi, 'inform you about our structured LMS resource')
      .replace(/(send|sending|share|sharing|email)\s+(you\s+)?(this|that|it|details|information|the\s+information)\s*(over|via|through|to\s+your)?\s*emails?/gi, 'connect with you regarding this')
      .replace(/(send|sending|share|sharing)\s+(you\s+)?(a\s+|the\s+|any\s+|our\s+)?(guide|report|collateral|whitepaper)\b/gi, 'discuss our structured LMS resource')
      .replace(/(is\s+this\s+the\s+best\s+email\s+to\s+send|where\s+should\s+I\s+send|can\s+I\s+email\s+you)\b/gi, 'is this the correct email address for you')
      .replace(/\b(collaterals?|whitepapers?)\b/gi, 'LMS resources')
      .replace(/(send|share)\s+(you\s+)?(an?\s+)?emails?/gi, 'connect with you')
      .replace(/(to\s+send|to\s+share)\s+(via|over|through)\s+email/gi, 'for our records');

    const qualification = parsed.qualification || {};
    const checkpoints = parsed.checkpoints || {};
    const missingInfo = parsed.missing_information || [];
    const notes = parsed.processing_notes || '';
    
    const validAffirmations = [
      'yes',
      'probably',
      'could be',
      'might be',
      'i believe so',
      'believe so',
      'i think so',
      'think so',
      'ok',
      'okay',
      'sure',
      'yeah',
      'yep',
      'correct',
      'right'
    ];
    const rawResp = (qualification.implementation_response || '').toLowerCase().trim();
    const isAffirmative = validAffirmations.some(v => rawResp.includes(v));
    const isTimelineCaptured = qualification.implementation_timeline &&
      !qualification.implementation_timeline.includes('Not Captured');
    const isComplete = isAffirmative && isTimelineCaptured;

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
