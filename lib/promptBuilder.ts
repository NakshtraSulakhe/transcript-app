import { ClientRecord, CampaignRecord } from './types';
import { DEFAULT_AI_PROMPT_TEMPLATE } from './defaultPrompt';

interface LeadPromptContext {
  firstName: string;
  lastName: string;
  companyName: string;
  jobTitle: string;
  email: string;
  rawTranscript: string;
}

export function buildEffectivePrompt(
  client?: Partial<ClientRecord> | null,
  campaign?: Partial<CampaignRecord> | null,
  context?: Partial<LeadPromptContext> | null
): string {
  const clientPrompt = client?.mainPrompt?.trim() || DEFAULT_AI_PROMPT_TEMPLATE;
  const clientRules = client?.clientRules?.trim() || '';
  
  const assetTitle = campaign?.assetTitle?.trim() || 'Structured B2B Solution';
  const valueProps = Array.isArray(campaign?.valuePropositions) && campaign.valuePropositions.length > 0
    ? campaign.valuePropositions.map((vp, idx) => `  ${idx + 1}. ${vp}`).join('\n')
    : '  1. We help organizations identify and implement solutions to optimize workforce management.';
  
  const campaignRules = campaign?.campaignRules?.trim() || '';

  const prospectName = `${context?.firstName || ''} ${context?.lastName || ''}`.trim() || '[Prospect Name]';
  const prospectCompany = context?.companyName || '[Company Name]';
  const prospectTitle = context?.jobTitle || '[Job Title]';
  const prospectEmail = context?.email || '[Email Address]';

  let effectivePrompt = clientPrompt;

  // Replace placeholders if present
  effectivePrompt = effectivePrompt.replace(/\{\{PROSPECT_FULL_NAME\}\}/g, prospectName);
  effectivePrompt = effectivePrompt.replace(/\{\{PROSPECT_COMPANY\}\}/g, prospectCompany);
  effectivePrompt = effectivePrompt.replace(/\{\{PROSPECT_JOB_TITLE\}\}/g, prospectTitle);
  effectivePrompt = effectivePrompt.replace(/\{\{PROSPECT_EMAIL\}\}/g, prospectEmail);
  effectivePrompt = effectivePrompt.replace(/\{\{ASSET_TITLE\}\}/g, assetTitle);
  effectivePrompt = effectivePrompt.replace(/\{\{VALUE_PROPOSITION\}\}/g, valueProps);
  if (context?.rawTranscript) {
    effectivePrompt = effectivePrompt.replace(/\{\{RAW_TRANSCRIPT\}\}/g, context.rawTranscript);
  }

  // Append Client Level Instructions/Rules
  if (clientRules) {
    effectivePrompt += `\n\nCLIENT-LEVEL RULES & INSTRUCTIONS:\n${clientRules}`;
  }

  // Append Campaign Level Asset & Value Propositions
  effectivePrompt += `\n\nCAMPAIGN CONFIGURATION:\n- Campaign Code: ${campaign?.campaignCode || 'DEFAULT'}\n- Campaign Name: ${campaign?.campaignName || 'Campaign'}\n- Asset Title: ${assetTitle}\n- Value Propositions:\n${valueProps}`;

  // Append Campaign Level Rules
  if (campaignRules) {
    effectivePrompt += `\n\nCAMPAIGN-SPECIFIC RULES:\n${campaignRules}`;
  }

  return effectivePrompt;
}
