import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || '';
const client = new AssemblyAI({
  apiKey: ASSEMBLYAI_API_KEY,
});

export interface LeadInfo {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  jobTitle: string;
}

export interface CampaignInfo {
  campaignName: string;
  assetTitle: string;
  valueProposition: string;
}

export interface GeminiConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface RequestSettings {
  leadInfo: LeadInfo;
  campaignInfo: CampaignInfo;
  geminiConfig?: GeminiConfig;
}

async function transcribeAudio(file: File): Promise<string> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('AssemblyAI API key not configured. Please set ASSEMBLYAI_API_KEY environment variable.');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload audio file to AssemblyAI using REST API
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;

    if (!audioUrl) {
      throw new Error('Upload did not return an audio URL');
    }

    // Transcribe the audio
    const transcriptResponse = await client.transcripts.transcribe({
      audio_url: audioUrl,
      speaker_labels: true,
      disfluencies: true,
      speakers_expected: 2,
    }) as any;

    if (transcriptResponse.error) {
      throw new Error(`Transcription failed: ${transcriptResponse.error}`);
    }

    let formattedTranscript = '';
    if (transcriptResponse.utterances && transcriptResponse.utterances.length > 0) {
      transcriptResponse.utterances.forEach((utterance: any) => {
        const startTime = (utterance.start / 1000).toFixed(2);
        const endTime = (utterance.end / 1000).toFixed(2);
        const speaker = utterance.speaker ? `Speaker ${utterance.speaker}` : 'Unknown';
        const text = utterance.text;
        
        formattedTranscript += `[${startTime}s-${endTime}s] [${speaker}]: ${text}\n\n`;
      });
    } else if (transcriptResponse.text) {
      formattedTranscript = transcriptResponse.text;
    }

    return formattedTranscript.trim();
  } catch (error) {
    console.error('AssemblyAI error:', error);
    throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function processTranscriptWithGemini(
  rawTranscript: string,
  leadInfo: LeadInfo,
  campaignInfo: CampaignInfo,
  geminiConfig?: GeminiConfig
) {
  const apiKey = geminiConfig?.apiKey || process.env.GEMINI_API_KEY;
  const model = geminiConfig?.model || 'gemini-2.0-flash';
  const temperature = geminiConfig?.temperature ?? 0.2;
  const maxTokens = geminiConfig?.maxTokens ?? 2048;

  if (!apiKey) {
    return {
      modifiedTranscript: generateFallbackModifiedTranscript(rawTranscript, leadInfo, campaignInfo),
      qaCheckpoints: generateFallbackQACheckpoints(rawTranscript),
      missingInformation: ['Gemini API key not configured. Output generated using basic rule engine.'],
      processingNotes: 'Gemini API Key missing. Configure in Settings to enable full AI QA and structuring.'
    };
  }

  const prompt = `
SYSTEM ROLE: Call Transcript QA & Standardization Engine
CALL TYPE: Cold Call
CALLING COMPANY: TGS Tech Info

LEAD REFERENCE DATA:
- First Name: ${leadInfo.firstName || 'Not Provided'}
- Last Name: ${leadInfo.lastName || 'Not Provided'}
- Company: ${leadInfo.companyName || 'Not Provided'}
- Email: ${leadInfo.email || 'Not Provided'}
- Job Title: ${leadInfo.jobTitle || 'Not Provided'}

CAMPAIGN DETAILS:
- Campaign Name: ${campaignInfo.campaignName || 'General Outreach'}
- Asset Title: ${campaignInfo.assetTitle || 'Solution'}
- Value Proposition: ${campaignInfo.valueProposition || 'Helping organizations optimize performance.'}

RAW TRANSCRIPT (EVIDENCE):
"""
${rawTranscript}
"""

COLD CALL MANDATORY RULES:
1. This is strictly a cold call.
2. The transcript must NOT introduce unsupported statements such as "I sent you an email", "I'm following up on my email", "You downloaded our report", "You filled out our form", "You requested information", unless the raw recording actually contains that evidence.
3. The preferred cold call hook is: "The reason for my call is that I recently came across your profile on LinkedIn..."
4. The calling company MUST be referenced as "TGS Tech Info".
5. Use Lead Reference Data to correct obvious speech-to-text name misspellings, but NEVER fabricate spoken dialogue where the prospect speaks out their email or title if not actually in the raw transcript.
6. The value proposition must dynamically feature the Asset Title ("${campaignInfo.assetTitle}") and Value Proposition ("${campaignInfo.valueProposition}").

CHECKPOINT DETECTION RULES:
- Implementation Question: Has the prospect been asked if they are evaluating/exploring/researching ${campaignInfo.assetTitle}?
- Implementation Response: Determine if the prospect gave an affirmative response ("YES"), negative ("NO"), "UNCLEAR", or if it was "NOT_CAPTURED". Do NOT manufacture a "YES" if not present in raw transcript!
- Implementation Timeline Options: "[0–3 Months]", "[3–6 Months]", "[6–9 Months]", or "[Not Captured]". Only extract what was actually communicated.

FINAL MODIFIED TRANSCRIPT RESTRICTIONS (STRICT):
1. The modified transcript MUST contain a MAXIMUM of 3–4 paragraphs (preferably 3 to 4 concise narrative paragraphs).
2. Paragraph 1: Prospect identification confirmation + Agent introduction (Agent Name + TGS Tech Info) + Cold-call context (e.g., LinkedIn outreach hook).
3. Paragraph 2: Campaign context + Asset Title ("${campaignInfo.assetTitle}") + Value Proposition ("${campaignInfo.valueProposition}") + Reason for call.
4. Paragraph 3: Implementation/evaluation question + prospect's actual response + standardized Implementation Timeline in brackets (e.g. [3–6 Months] or [Not Captured]).
5. Paragraph 4: Specialist follow-up + professional call closing.
(If all content fits naturally in 3 paragraphs, use 3 paragraphs).

OUTPUT FORMAT REQUIRED:
Return ONLY a valid JSON object with the following exact keys:
{
  "modified_transcript": "Paragraph 1...\\n\\nParagraph 2...\\n\\nParagraph 3...\\n\\nParagraph 4...",
  "qa_checkpoints": {
    "prospect_identified": true/false,
    "tgs_tech_info_introduction": true/false,
    "cold_call_context": true/false,
    "value_proposition_present": true/false,
    "implementation_question_asked": true/false,
    "implementation_response": "YES" | "NO" | "UNCLEAR" | "NOT_CAPTURED",
    "implementation_timeline": "[0–3 Months]" | "[3–6 Months]" | "[6–9 Months]" | "[Not Captured]",
    "timeline_captured": true/false,
    "specialist_followup_mentioned": true/false,
    "call_closing_present": true/false
  },
  "missing_information": ["List any uncaptured or non-compliant checkpoints"],
  "processing_notes": "Brief explanation of changes and QA findings"
}
`;

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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      throw new Error('Gemini returned an empty response');
    }

    const parsed = JSON.parse(rawContent);
    return {
      modifiedTranscript: parsed.modified_transcript || '',
      qaCheckpoints: parsed.qa_checkpoints || {},
      missingInformation: parsed.missing_information || [],
      processingNotes: parsed.processing_notes || ''
    };
  } catch (error) {
    console.error('Gemini processing error:', error);
    return {
      modifiedTranscript: generateFallbackModifiedTranscript(rawTranscript, leadInfo, campaignInfo),
      qaCheckpoints: generateFallbackQACheckpoints(rawTranscript),
      missingInformation: [`AI processing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      processingNotes: 'Fell back to rule engine due to AI processing error.'
    };
  }
}

function generateFallbackModifiedTranscript(rawTranscript: string, lead: LeadInfo, campaign: CampaignInfo): string {
  const prospectName = `${lead.firstName || 'Prospect'} ${lead.lastName || ''}`.trim();
  const p1 = `The agent confirmed they were speaking with ${prospectName}, introduced themselves from TGS Tech Info, and established context for the cold call based on professional outreach.`;
  const p2 = `The agent explained that TGS Tech Info works with organizations around ${campaign.assetTitle || 'solutions'}, specifically helping teams with: ${campaign.valueProposition || 'improving operational effectiveness'}.`;
  const p3 = `When discussed regarding evaluation of ${campaign.assetTitle || 'solutions'}, the transcript was processed. Implementation timeline was recorded as [Not Captured].`;
  const p4 = `The agent thanked ${prospectName} for their time, indicated a specialist may reach out if appropriate, and concluded the call professionally.`;

  return `${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;
}

function generateFallbackQACheckpoints(rawTranscript: string) {
  const lower = rawTranscript.toLowerCase();
  return {
    prospect_identified: lower.includes('speaking') || lower.includes('hello') || lower.includes('hi'),
    tgs_tech_info_introduction: lower.includes('tgs tech info') || lower.includes('tgs'),
    cold_call_context: !lower.includes('sent an email') && !lower.includes('downloaded'),
    value_proposition_present: true,
    implementation_question_asked: lower.includes('evaluating') || lower.includes('looking for') || lower.includes('exploring'),
    implementation_response: lower.includes('yes') || lower.includes('sure') ? 'YES' : 'NOT_CAPTURED',
    implementation_timeline: '[Not Captured]',
    timeline_captured: false,
    specialist_followup_mentioned: lower.includes('specialist') || lower.includes('follow up'),
    call_closing_present: lower.includes('thank') || lower.includes('goodbye') || lower.includes('have a')
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const settingsStr = formData.get('settings') as string;
    const rawTranscriptInput = formData.get('rawTranscript') as string | null;

    if (!settingsStr) {
      return NextResponse.json({ error: 'Settings payload is required' }, { status: 400 });
    }

    const settings: RequestSettings = JSON.parse(settingsStr);
    let rawTranscript = rawTranscriptInput || '';

    // If an audio file is uploaded, perform STT transcription first
    if (file && file.size > 0) {
      try {
        rawTranscript = await transcribeAudio(file);
      } catch (sttError) {
        console.error('STT Error:', sttError);
        return NextResponse.json(
          { error: sttError instanceof Error ? sttError.message : 'Audio transcription failed' },
          { status: 500 }
        );
      }
    }

    if (!rawTranscript) {
      return NextResponse.json({ error: 'Please provide either an audio file or raw transcript text.' }, { status: 400 });
    }

    // Process with Gemini AI Call Transcript Modification Engine
    const geminiResult = await processTranscriptWithGemini(
      rawTranscript,
      settings.leadInfo,
      settings.campaignInfo,
      settings.geminiConfig
    );

    return NextResponse.json({
      rawTranscript,
      modifiedTranscript: geminiResult.modifiedTranscript,
      qaCheckpoints: geminiResult.qaCheckpoints,
      missingInformation: geminiResult.missingInformation,
      processingNotes: geminiResult.processingNotes,
      leadInfo: settings.leadInfo,
      campaignInfo: settings.campaignInfo
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}