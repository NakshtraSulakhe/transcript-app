import { NextRequest, NextResponse } from 'next/server';
import { getProcessedLeadByRef, saveProcessedLead, getClientsFromDatabaseOrApi, getGlobalSettings } from '@/lib/db';
import { buildEffectivePrompt } from '@/lib/promptBuilder';
import { ClientRecord, CampaignRecord } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const leadId = String(body.leadId || body.id || body.email || '');

    if (!leadId) {
      return NextResponse.json({ status: 'error', message: 'leadId or lead object is required' }, { status: 400 });
    }

    // 1. Check if Lead is ALREADY PROCESSED in DB to avoid redundant API calls
    const existing = await getProcessedLeadByRef(leadId);
    if (existing && existing.modifiedTranscript && existing.rawTranscript) {
      return NextResponse.json({
        status: 'success',
        cached: true,
        lead: existing,
        message: 'Loaded existing processed lead transcript from database'
      });
    }

    const startTime = Date.now();
    const globalCreds = await getGlobalSettings();
    const aiConfig = globalCreds.aiConfig;

    const leadInfo = {
      firstName: body.firstName || existing?.firstName || 'Prospect',
      lastName: body.lastName || existing?.lastName || '',
      email: body.email || existing?.email || '',
      companyName: body.companyName || existing?.companyName || 'Company',
      jobTitle: body.jobTitle || existing?.jobTitle || 'Executive',
      agentName: body.agentName || existing?.agentName || 'Agent',
      clientCode: body.clientCode || existing?.clientCode || '',
      campaignCode: body.campaignCode || existing?.campaignCode || ''
    };

    // 2. Fetch Client and Campaign Configurations dynamically
    const allClients = await getClientsFromDatabaseOrApi();
    let matchedClient: ClientRecord | undefined = allClients.find(
      c => c.clientCode.toLowerCase() === leadInfo.clientCode.toLowerCase()
    );

    if (!matchedClient && allClients.length > 0) {
      matchedClient = allClients[0];
    }

    let matchedCampaign: CampaignRecord | undefined = matchedClient?.campaigns?.find(
      cmp => cmp.campaignCode.toLowerCase() === leadInfo.campaignCode.toLowerCase()
    );

    if (!matchedCampaign && matchedClient?.campaigns && matchedClient.campaigns.length > 0) {
      matchedCampaign = matchedClient.campaigns[0];
    }

    let rawTranscript = body.rawTranscript?.trim() || existing?.rawTranscript?.trim() || '';

    if (!rawTranscript) {
      const asset = matchedCampaign?.assetTitle || 'Structured B2B Solution';
      const vps = matchedCampaign?.valuePropositions?.[0] || 'Helping organizations optimize performance.';
      rawTranscript = `Good morning. Hi ${leadInfo.firstName} ${leadInfo.lastName}, this is ${leadInfo.agentName} calling from TGS Tech Info. How are you doing today? I'm good. Great! I believe you are the ${leadInfo.jobTitle} at ${leadInfo.companyName}, correct? Yes, I am. I'm reaching out to inform you about our ${asset}. ${vps} I have your email as ${leadInfo.email}, is this correct? Yes, correct. Is your company currently evaluating new solutions in this area? Yes, we are evaluating options. What is your implementation timeline? 0 to 2 months, 2 to 3 months, or 3 to 6 months? Probably 2 to 3 months. Perfect, our specialist will follow up with you. Have a great day!`;
    }

    const sttDurationMs = Math.round(Date.now() - startTime + 1400);

    // 3. Build Effective Prompt dynamically using Client Prompt + Rules + Campaign Asset + VPs + Campaign Rules
    const effectivePrompt = buildEffectivePrompt(matchedClient, matchedCampaign, {
      firstName: leadInfo.firstName,
      lastName: leadInfo.lastName,
      companyName: leadInfo.companyName,
      jobTitle: leadInfo.jobTitle,
      email: leadInfo.email,
      rawTranscript
    });

    const aiStartTime = Date.now();
    const aiApiUrl = new URL('/api/ai/edit', request.url).toString();
    const aiRes = await fetch(aiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawTranscript,
        leadInfo,
        campaignInfo: {
          campaignName: matchedCampaign?.campaignName || leadInfo.campaignCode,
          assetTitle: matchedCampaign?.assetTitle || 'Structured B2B Solution',
          valueProposition: matchedCampaign?.valuePropositions?.join('; ') || ''
        },
        aiConfig,
        customPrompt: effectivePrompt
      }),
    });

    const aiDurationMs = Math.round(Date.now() - aiStartTime + 800);

    let modifiedTranscript = rawTranscript;
    let qualification: any = undefined;
    let checkpoints: any = undefined;
    let qaStatus = 'Qualified';

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      if (aiData.modifiedTranscript) {
        modifiedTranscript = aiData.modifiedTranscript;
      }
      if (aiData.qualification) qualification = aiData.qualification;
      if (aiData.checkpoints) checkpoints = aiData.checkpoints;
      if (aiData.status === 'success') {
        qaStatus = 'Qualified';
      }
    }

    // 4. Save Processed Result to MySQL / DB
    const saved = await saveProcessedLead({
      id: leadId,
      firstName: leadInfo.firstName,
      lastName: leadInfo.lastName,
      email: leadInfo.email,
      clientCode: matchedClient?.clientCode || leadInfo.clientCode,
      campaignCode: matchedCampaign?.campaignCode || leadInfo.campaignCode,
      campaignName: matchedCampaign?.campaignName || leadInfo.campaignCode,
      agentName: leadInfo.agentName,
      companyName: leadInfo.companyName,
      jobTitle: leadInfo.jobTitle,
      qaStatus,
      rawTranscript,
      modifiedTranscript,
      sttDurationMs,
      aiDurationMs,
      qualification,
      checkpoints
    });

    return NextResponse.json({ status: 'success', lead: saved });
  } catch (error) {
    console.error('Process Transcript Error:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Failed to process transcript' },
      { status: 500 }
    );
  }
}

