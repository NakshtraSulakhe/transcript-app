export interface STTConfig {
  provider: string; // 'GoogleCloud' | 'AssemblyAI'
  apiKey: string;
  gcsBucket?: string;
  endpoint?: string;
  model?: string;
  language?: string;
}

export interface AIConfig {
  provider: string; // 'Google AI Studio'
  apiKey: string;
  endpoint?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  customPrompt?: string;
}

export interface CRMConfig {
  crmApiUrl: string;
  crmApiKey?: string;
}

export interface ClientRecord {
  id?: number | string;
  clientCode: string;
  name: string;
  mainPrompt: string;
  clientRules: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
  campaigns?: CampaignRecord[];
}

export interface CampaignRecord {
  id?: number | string;
  clientId?: number | string;
  clientCode: string;
  campaignCode: string;
  campaignName: string;
  assetTitle: string;
  campaignRules?: string;
  valuePropositions: string[];
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadInfo {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  jobTitle: string;
}

export interface CampaignInfo {
  campaignId?: string;
  campaignName: string;
  assetTitle: string;
  valueProposition: string;
}

export type WorkflowStatus =
  | 'idle'
  | 'recording_uploaded'
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'transcription_processing'
  | 'transcription_completed'
  | 'ai_processing'
  | 'ai_processing_completed'
  | 'review_required'
  | 'error';

export interface QACheckpoints {
  prospect_identified?: boolean;
  tgs_tech_info_introduction?: boolean;
  cold_call_context?: boolean;
  value_proposition_present?: boolean;
  implementation_question_asked?: boolean;
  implementation_response?: 'Yes' | 'Probably' | 'Could be' | 'Might be' | 'No' | 'Not Captured' | string;
  implementation_timeline?: 'Zero to two months' | 'Two to three months' | 'Three to six months' | '[Not Captured]' | string;
  timeline_captured?: boolean;
  specialist_followup_mentioned?: boolean;
  call_closing_present?: boolean;
}

export interface TranscriptRecord {
  recordingPath?: string;
  transcriptionProvider: string;
  transcriptionStatus: WorkflowStatus;
  rawTranscript: string;
  
  leadInfo: LeadInfo;
  campaignInfo: CampaignInfo;
  
  aiProvider: string;
  aiModel: string;
  aiProcessingStatus: WorkflowStatus;
  modifiedTranscript: string;
  
  implementationResponse: string;
  implementationTimeline: string;
  qaCheckpoints: QACheckpoints;
  missingInformation: string[];
  processingNotes: string;
  processedAt?: string;
}

export interface StoredLead {
  id: string;
  srNo?: number;
  createdAt?: string;
  clientCode: string;
  campaignCode: string;
  campaignName?: string;
  agentName?: string;
  firstName: string;
  lastName?: string;
  email: string;
  contactNumber?: string;
  companyName?: string;
  country?: string;
  jobTitle?: string;
  formStatus?: string;
  qaStatus?: string;
  clientDeliveryStatus?: string;
  recordingUrl?: string;
  rawTranscript?: string;
  modifiedTranscript?: string;
  sttDurationMs?: number;
  aiDurationMs?: number;
  qualification?: any;
  checkpoints?: QACheckpoints;
  missingInformation?: string[];
  processingNotes?: string;
  processedAt?: string;
}

