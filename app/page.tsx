'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_CAMPAIGNS } from '@/lib/campaigns';
import { STTConfig, AIConfig, LeadInfo, CampaignInfo, WorkflowStatus } from '@/lib/types';
import { DEFAULT_AI_PROMPT_TEMPLATE } from '@/lib/defaultPrompt';

const SAMPLE_PROSPECTS = {
  laura: {
    leadInfo: {
      firstName: 'Laura',
      lastName: 'McDurmont',
      companyName: 'Energizer Holdings',
      email: 'laura.mcdurmont@energizer.com',
      jobTitle: 'Director, Network, Voice, Cloud and Datacenter Services'
    },
    raw: `Good morning, how can I help you? Hi, good morning, is this Laura McDurmont? This is. Hi, my name is Jason Smith. I'm calling you from TGS Tech Info. How are you doing today? I am doing well. Great. Thanks for asking. I believe you're the Director, Network, Voice, Cloud and Datacenter Services for Energizer Holdings, correct? Yes, I am. Perfect. Actually, I'm just reaching out quickly to inform you about the structured LMS resource. We help learning and development teams find and implement Learning Management System solutions that make it easier to deliver training, engage learners, and track progress, helping organizations improve employee learning and development. For that, I have your email, that is laura.mcdurmont@energizer.com is this correct? Yeah, correct. Wonderful. I just want to understand, whether your organization is currently evaluating a new Learning Management System solution? I believe so. Perfect. Then, how much time do you know roughly it would take for your company to evaluate or explore an LMS solution? Would it be on immediate basis or it will take time like one to two months, two to three months or three to six months? I would probably be three to six months. Wonderful. Then one of our representatives will follow up with you just to answer any questions you may have around this. And it was a pleasure speaking with you. Have a great day. Bye-bye. Okay, bye.`
  },
  steven: {
    leadInfo: {
      firstName: 'Steven',
      lastName: 'Mann',
      companyName: 'Connecticut Childrens',
      email: 'smann02@connecticutchildrens.org',
      jobTitle: 'IT Infrastructure Technology Director'
    },
    raw: `Hello. this is Steven. Hi Steven, this is Jason Smith. I'm calling you from TGS Tech Info. How are you doing today? I am good. Great to hear that. I believe you're the IT Infrastructure Technology Director for Connecticut Childrens, correct? Yes, I am. Perfect. Actually, I'm just reaching out to inform you about the structured LMS resource. We help learning and development teams find and implement Learning Management System solutions that make it easier to deliver training, engage learners, and track progress, helping organizations improve employee learning and development. For that, I have your email, that is smann02@connecticutchildrens.org, Is this correct? Yeah, correct. Perfect. I just want to understand, whether your organization is currently evaluating a new Learning Management System solution? I think so, yes. Great. Then, how much time do you know roughly it would take for your company to evaluate or explore an LMS solution? Would it be on immediate basis or it will take time like one to two months, two to three months or three to six months? I think two to three months would be the good time. Wonderful. Then one of our representatives will follow up with you just to answer any questions you may have around this. Have a great day. Bye-bye. Okay, bye.`
  }
};

export default function Home() {
  // Lead Information State
  const [leadInfo, setLeadInfo] = useState<LeadInfo>(SAMPLE_PROSPECTS.laura.leadInfo);

  const handleLoadSample = (key: 'laura' | 'steven') => {
    const sample = SAMPLE_PROSPECTS[key];
    setLeadInfo(sample.leadInfo);
    setPastedRawTranscript(sample.raw);
    setRawTranscript(sample.raw);
  };

  // Campaign State
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(DEFAULT_CAMPAIGNS[0].id);
  const [campaignInfo, setCampaignInfo] = useState<CampaignInfo>({
    campaignName: DEFAULT_CAMPAIGNS[0].name,
    assetTitle: DEFAULT_CAMPAIGNS[0].assetTitle,
    valueProposition: DEFAULT_CAMPAIGNS[0].valueProposition
  });

  // API 1 Configuration State (Transcription API)
  const [sttConfig, setSttConfig] = useState<STTConfig>({
    provider: 'GoogleCloud',
    apiKey: '',
    endpoint: 'https://speech.googleapis.com/v1/speech:recognize'
  });

  // API 2 Configuration State (AI Processing API)
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'Google AI Studio',
    apiKey: '',
    model: 'gemini-3.6-flash',
    temperature: 0.2,
    maxTokens: 2048
  });

  // Custom AI Prompt / Instructions State (Trae AI Style Custom Rules)
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);
  const [promptSavedAlert, setPromptSavedAlert] = useState<boolean>(false);

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'stt' | 'ai'>('stt');
  const [sttTestStatus, setSttTestStatus] = useState<{ loading: boolean; message: string; isError?: boolean } | null>(null);
  const [aiTestStatus, setAiTestStatus] = useState<{ loading: boolean; message: string; isError?: boolean } | null>(null);

  // Workflow Pipeline State
  const [file, setFile] = useState<File | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('idle');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [activeResultsTab, setActiveResultsTab] = useState<'modified' | 'qa' | 'raw'>('modified');

  // Stored Data (Never overwrite rawTranscript with modifiedTranscript)
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [pastedRawTranscript, setPastedRawTranscript] = useState<string>('');
  const [modifiedTranscript, setModifiedTranscript] = useState<string>('');
  const [editedModifiedTranscript, setEditedModifiedTranscript] = useState<string>('');

  // QA & Checkpoint Results
  const [qaData, setQaData] = useState<{
    status?: string;
    qualification?: {
      implementation_question_asked?: boolean;
      implementation_response?: string;
      implementation_timeline?: string;
    };
    checkpoints?: Record<string, boolean>;
    missingInformation?: string[];
    processingNotes?: string;
  } | null>(null);

  // Load saved API configs & prompt on mount
  useEffect(() => {
    const savedSttBucket = localStorage.getItem('gcs_bucket_name');
    const savedSttKey = localStorage.getItem('stt_api_key');
    const savedSttProvider = localStorage.getItem('stt_provider');
    const savedAiKey = localStorage.getItem('ai_api_key');
    const savedAiModel = localStorage.getItem('ai_model');
    const savedPrompt = localStorage.getItem('custom_ai_prompt');

    const validModel = (savedAiModel && !savedAiModel.includes('2.0') && !savedAiModel.includes('1.5'))
      ? savedAiModel 
      : 'gemini-3.6-flash';

    if (savedSttKey || savedSttBucket) {
      setSttConfig(prev => ({ ...prev, apiKey: savedSttKey || '', provider: savedSttProvider || 'GoogleCloud', gcsBucket: savedSttBucket || '' }));
    }
    if (savedAiKey || savedAiModel) {
      setAiConfig(prev => ({ ...prev, apiKey: savedAiKey || '', model: validModel }));
    }
    if (savedPrompt !== null && savedPrompt.trim()) {
      setCustomPrompt(savedPrompt);
    } else {
      setCustomPrompt(DEFAULT_AI_PROMPT_TEMPLATE);
    }
  }, []);

  // Update Campaign fields when selection changes
  const handleCampaignChange = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    if (campaignId === 'custom') {
      setCampaignInfo({
        campaignName: 'Custom Campaign',
        assetTitle: '',
        valueProposition: ''
      });
    } else {
      const selected = DEFAULT_CAMPAIGNS.find(c => c.id === campaignId);
      if (selected) {
        setCampaignInfo({
          campaignName: selected.name,
          assetTitle: selected.assetTitle,
          valueProposition: selected.valueProposition
        });
      }
    }
  };

  // Test API 1 Connection (Speech-to-Text)
  const handleTestSttConnection = async () => {
    setSttTestStatus({ loading: true, message: 'Testing Speech-to-Text API connection...' });
    try {
      const res = await fetch('/api/stt/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sttConfig)
      });
      const data = await res.json();
      if (data.success) {
        setSttTestStatus({ loading: false, message: 'Connected Successfully', isError: false });
      } else {
        setSttTestStatus({ loading: false, message: data.error || 'Connection Failed', isError: true });
      }
    } catch (err) {
      setSttTestStatus({
        loading: false,
        message: `Connection Failed: ${err instanceof Error ? err.message : 'Network error'}`,
        isError: true
      });
    }
  };

  // Test API 2 Connection (AI Processing)
  const handleTestAiConnection = async () => {
    setAiTestStatus({ loading: true, message: 'Testing AI Processing API connection...' });
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig)
      });
      const data = await res.json();
      if (data.success) {
        setAiTestStatus({ loading: false, message: 'Connected Successfully', isError: false });
      } else {
        setAiTestStatus({ loading: false, message: data.error || 'Connection Failed', isError: true });
      }
    } catch (err) {
      setAiTestStatus({
        loading: false,
        message: `Connection Failed: ${err instanceof Error ? err.message : 'Network error'}`,
        isError: true
      });
    }
  };

  // Prompt Editor Actions
  const handleSavePrompt = () => {
    localStorage.setItem('custom_ai_prompt', customPrompt);
    setPromptSavedAlert(true);
    setTimeout(() => setPromptSavedAlert(false), 2500);
  };

  const handleResetPromptToDefault = () => {
    if (confirm('Reset prompt instructions to the standard 29-Point Engine Specification?')) {
      setCustomPrompt(DEFAULT_AI_PROMPT_TEMPLATE);
      localStorage.setItem('custom_ai_prompt', DEFAULT_AI_PROMPT_TEMPLATE);
      setPromptSavedAlert(true);
      setTimeout(() => setPromptSavedAlert(false), 2500);
    }
  };

  const handleInsertTag = (tag: string) => {
    setCustomPrompt(prev => prev + ' ' + tag);
  };

  // Save Configurations
  const handleSaveSettings = () => {
    if (sttConfig.apiKey) localStorage.setItem('stt_api_key', sttConfig.apiKey);
    if (sttConfig.gcsBucket) localStorage.setItem('gcs_bucket_name', sttConfig.gcsBucket);
    localStorage.setItem('stt_provider', sttConfig.provider);
    if (aiConfig.apiKey) localStorage.setItem('ai_api_key', aiConfig.apiKey);
    localStorage.setItem('ai_model', aiConfig.model);
    if (customPrompt) localStorage.setItem('custom_ai_prompt', customPrompt);
    setShowSettingsModal(false);
  };

  // STEP 1: API 1 — Transcribe Audio Recording -> raw_transcript ONLY
  const handleRunTranscriptionOnly = async () => {
    if (!file) {
      alert('Please select a call recording file to transcribe.');
      return;
    }

    setIsTranscribing(true);
    setWorkflowStatus('transcription_processing');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sttConfig', JSON.stringify(sttConfig));

    try {
      const res = await fetch('/api/stt/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.details || 'Transcription failed');
      }

      setRawTranscript(data.rawTranscript);
      setWorkflowStatus('transcription_completed');
      setActiveResultsTab('raw');
    } catch (err) {
      setWorkflowStatus('error');
      alert(`API 1 Error: ${err instanceof Error ? err.message : 'Transcription failed'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // STEP 2: API 2 — Process raw_transcript with Gemini AI -> 3-4 Paragraphs + QA Results
  const handleRunAiProcessingOnly = async (overrideRaw?: string) => {
    const targetRaw = overrideRaw || rawTranscript || pastedRawTranscript;
    if (!targetRaw.trim()) {
      alert('No raw transcript available. Please perform Step 1 (Transcribe Audio) or paste a raw transcript first.');
      return;
    }

    setIsAiProcessing(true);
    setWorkflowStatus('ai_processing');

    try {
      const res = await fetch('/api/ai/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTranscript: targetRaw,
          leadInfo,
          campaignInfo,
          aiConfig,
          customPrompt: customPrompt.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || data.details || 'AI Processing failed');
      }

      setModifiedTranscript(data.modifiedTranscript);
      setEditedModifiedTranscript(data.modifiedTranscript);
      setQaData({
        status: data.status,
        qualification: data.qualification,
        checkpoints: data.checkpoints,
        missingInformation: data.missingInformation,
        processingNotes: data.processingNotes
      });

      setWorkflowStatus(data.status === 'success' ? 'ai_processing_completed' : 'review_required');
      setActiveResultsTab('modified');
    } catch (err) {
      setWorkflowStatus('error');
      alert(`API 2 Error: ${err instanceof Error ? err.message : 'AI Processing failed'}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Combined One-Click Full Workflow (Step 1 -> Step 2)
  const handleRunFullWorkflow = async () => {
    if (!file && !pastedRawTranscript.trim()) {
      alert('Please upload an audio file or paste a raw transcript.');
      return;
    }

    let activeRaw = pastedRawTranscript;

    if (file) {
      setIsTranscribing(true);
      setWorkflowStatus('transcription_processing');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sttConfig', JSON.stringify(sttConfig));

      try {
        const res = await fetch('/api/stt/transcribe', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || data.details || 'Transcription failed');
        }

        activeRaw = data.rawTranscript;
        setRawTranscript(data.rawTranscript);
        setWorkflowStatus('transcription_completed');
      } catch (err) {
        setWorkflowStatus('error');
        alert(`API 1 Error: ${err instanceof Error ? err.message : 'Transcription failed'}`);
        setIsTranscribing(false);
        return;
      } finally {
        setIsTranscribing(false);
      }
    }

    // Now run API 2 with the raw transcript
    await handleRunAiProcessingOnly(activeRaw);
  };

  const handleDownloadTranscript = () => {
    const blob = new Blob([editedModifiedTranscript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Edited_Transcript_${leadInfo.firstName}_${leadInfo.lastName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(editedModifiedTranscript);
    alert('Edited transcript copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                Dual-API Call Transcript System
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Two-API Architecture
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Decoupled Speech-to-Text (API 1) & AI Processing Engine (API 2)
            </p>
          </div>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition font-medium"
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            API Configurations
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Pipeline Status Banner */}
        <div className="mb-6 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Pipeline Status:</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${
              workflowStatus === 'ai_processing_completed'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : workflowStatus === 'transcription_completed'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : workflowStatus === 'review_required'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : workflowStatus === 'error'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {workflowStatus.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${rawTranscript ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
              <span className="text-slate-300">API 1 (Raw Transcript)</span>
            </div>
            <span className="text-slate-600">→</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${modifiedTranscript ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
              <span className="text-slate-300">API 2 (AI Edited 4-Paragraph Transcript)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form & Action Steps (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Step A: Lead Reference Data */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">1</span>
                  <h2 className="text-base font-semibold text-slate-200">Lead Reference Information</h2>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLoadSample('laura')}
                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition"
                    title="Load Example 1: Laura McDurmont (Energizer Holdings)"
                  >
                    Ex 1: Laura
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('steven')}
                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition"
                    title="Load Example 2: Steven (Connecticut Childrens)"
                  >
                    Ex 2: Steven
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">First Name</label>
                  <input
                    type="text"
                    value={leadInfo.firstName}
                    onChange={(e) => setLeadInfo({ ...leadInfo, firstName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Last Name</label>
                  <input
                    type="text"
                    value={leadInfo.lastName}
                    onChange={(e) => setLeadInfo({ ...leadInfo, lastName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-400 font-medium mb-1">Company Name</label>
                  <input
                    type="text"
                    value={leadInfo.companyName}
                    onChange={(e) => setLeadInfo({ ...leadInfo, companyName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    value={leadInfo.email}
                    onChange={(e) => setLeadInfo({ ...leadInfo, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Job Title</label>
                  <input
                    type="text"
                    value={leadInfo.jobTitle}
                    onChange={(e) => setLeadInfo({ ...leadInfo, jobTitle: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Step B: Dynamic Campaign Configuration */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold border border-indigo-500/30">2</span>
                <h2 className="text-base font-semibold text-slate-200">Dynamic Campaign Information</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Campaign Name</label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => handleCampaignChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {DEFAULT_CAMPAIGNS.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="custom">+ Custom Campaign</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Asset Title (Auto-Populated)</label>
                  <input
                    type="text"
                    value={campaignInfo.assetTitle}
                    onChange={(e) => setCampaignInfo({ ...campaignInfo, assetTitle: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Value Proposition (Auto-Populated)</label>
                  <textarea
                    rows={3}
                    value={campaignInfo.valueProposition}
                    onChange={(e) => setCampaignInfo({ ...campaignInfo, valueProposition: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Trae AI Style: AI Prompt & Instructions Editor */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-200">AI Prompt &amp; Instructions</h2>
                    <p className="text-[11px] text-slate-400">Trae AI style dynamic rules (no hardcoded logic)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {customPrompt.trim() !== DEFAULT_AI_PROMPT_TEMPLATE.trim() ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Custom Prompt Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      29-Point Engine Active
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPromptEditor(!showPromptEditor)}
                    className="px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-700 transition flex items-center gap-1.5"
                  >
                    {showPromptEditor ? 'Collapse' : 'Expand Editor'}
                    <svg className={`w-3.5 h-3.5 transition-transform ${showPromptEditor ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Collapsed summary preview */}
              {!showPromptEditor && (
                <div 
                  onClick={() => setShowPromptEditor(true)}
                  className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-lg p-3 cursor-pointer text-xs text-slate-400 font-mono line-clamp-2 transition"
                >
                  {customPrompt.slice(0, 180)}...
                  <span className="text-indigo-400 font-sans block mt-1 hover:underline text-[11px]">Click to view/edit instructions &amp; dynamic variables &rarr;</span>
                </div>
              )}

              {/* Full Editor when expanded */}
              {showPromptEditor && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-xs">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                      <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Insert Variable:
                    </span>
                    {[
                      { label: 'Prospect Name', tag: '{{PROSPECT_FULL_NAME}}' },
                      { label: 'Company', tag: '{{PROSPECT_COMPANY}}' },
                      { label: 'Job Title', tag: '{{PROSPECT_JOB_TITLE}}' },
                      { label: 'Email', tag: '{{PROSPECT_EMAIL}}' },
                      { label: 'Asset Title', tag: '{{ASSET_TITLE}}' },
                      { label: 'Value Prop', tag: '{{VALUE_PROPOSITION}}' },
                      { label: 'Raw Transcript', tag: '{{RAW_TRANSCRIPT}}' }
                    ].map(item => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => handleInsertTag(item.tag)}
                        title={`Insert ${item.tag}`}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-indigo-950/80 hover:border-indigo-500/50 border border-slate-700 text-[11px] text-indigo-300 font-mono transition"
                      >
                        +{item.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <textarea
                      rows={14}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Enter custom prompt instructions for the AI editing engine..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed shadow-inner"
                    />
                    <div className="flex justify-between items-center text-[11px] text-slate-500 px-1 mt-1">
                      <span>{customPrompt.length.toLocaleString()} characters ({customPrompt.split(/\s+/).filter(Boolean).length.toLocaleString()} words)</span>
                      <span>Trae AI Dynamic Prompt Engine</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetPromptToDefault}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs font-medium transition"
                      >
                        Reset to 29-Point Engine
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Clear prompt instructions? You can write completely custom rules from scratch.')) {
                            setCustomPrompt('');
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 rounded-lg border border-slate-800 hover:border-rose-800/60 text-xs font-medium transition"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {promptSavedAlert && (
                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 animate-pulse">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Prompt Saved!
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleSavePrompt}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save Prompt
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step C: Decoupled API Execution Controls */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold border border-purple-500/30">3</span>
                  <h2 className="text-base font-semibold text-slate-200">Execution Pipeline</h2>
                </div>
              </div>

              {/* Upload Box */}
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-3 text-center transition cursor-pointer bg-slate-900/50">
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="audio-file-input"
                />
                <label htmlFor="audio-file-input" className="cursor-pointer block">
                  <svg className="w-6 h-6 text-slate-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <p className="text-xs text-slate-300 font-medium">
                    {file ? file.name : 'Upload Audio File for API 1'}
                  </p>
                </label>
              </div>

              {/* Or Paste Raw Text */}
              <textarea
                rows={3}
                value={pastedRawTranscript}
                onChange={(e) => setPastedRawTranscript(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                placeholder="Or paste existing raw_transcript text directly..."
              />

              {/* Decoupled Action Buttons */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleRunTranscriptionOnly}
                    disabled={isTranscribing || !file}
                    className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isTranscribing ? 'API 1 Transcribing...' : '1. Transcribe Audio (API 1)'}
                  </button>

                  <button
                    onClick={() => handleRunAiProcessingOnly()}
                    disabled={isAiProcessing || (!rawTranscript && !pastedRawTranscript.trim())}
                    className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isAiProcessing ? 'API 2 Processing...' : '2. AI Edit & QA (API 2)'}
                  </button>
                </div>

                <button
                  onClick={handleRunFullWorkflow}
                  disabled={isTranscribing || isAiProcessing}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs rounded-lg transition shadow-md disabled:opacity-50"
                >
                  Run Full Pipeline (API 1 → API 2)
                </button>

                {/* Instant Reprocess API 2 Button */}
                {(rawTranscript || pastedRawTranscript) && (
                  <button
                    onClick={() => handleRunAiProcessingOnly()}
                    disabled={isAiProcessing}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-indigo-500/40 text-indigo-300 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1 mt-2"
                  >
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reprocess Raw Transcript with API 2
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: 3-Tab Results Section (7 Cols) */}
          <div className="lg:col-span-7">
            {rawTranscript || modifiedTranscript || pastedRawTranscript ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl shadow-xl flex flex-col h-full min-h-[640px]">
                {/* Results Header Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-900/60 p-2 rounded-t-xl gap-2">
                  <button
                    onClick={() => setActiveResultsTab('modified')}
                    className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                      activeResultsTab === 'modified'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span>Edited Transcript (API 2)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-mono">4 Paragraphs</span>
                  </button>

                  <button
                    onClick={() => setActiveResultsTab('qa')}
                    className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                      activeResultsTab === 'qa'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span>QA Results &amp; Checkpoints</span>
                  </button>

                  <button
                    onClick={() => setActiveResultsTab('raw')}
                    className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                      activeResultsTab === 'raw'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span>Raw Evidence (API 1)</span>
                  </button>
                </div>

                {/* Tab Views */}
                <div className="p-6 flex-1 flex flex-col">
                  {/* TAB 1: MODIFIED TRANSCRIPT */}
                  {activeResultsTab === 'modified' && (
                    <div className="flex-1 flex flex-col space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          Edited Conversational Transcript (4 Continuous Dialogue Paragraphs)
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCopyTranscript}
                            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition"
                          >
                            Copy Text
                          </button>
                          <button
                            onClick={handleDownloadTranscript}
                            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md transition"
                          >
                            Download TXT
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={editedModifiedTranscript}
                        onChange={(e) => setEditedModifiedTranscript(e.target.value)}
                        className="w-full flex-1 min-h-[420px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 text-sm leading-relaxed font-sans focus:outline-none focus:border-indigo-500 resize-y whitespace-pre-wrap"
                        placeholder="Click '2. AI Edit & QA (API 2)' to generate the 4-paragraph edited conversational transcript..."
                      />
                    </div>
                  )}

                  {/* TAB 2: QA & CHECKPOINTS */}
                  {activeResultsTab === 'qa' && (
                    <div className="space-y-6">
                      {qaData ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Checkcard label="Prospect &amp; Agent Identified" status={qaData.checkpoints?.prospect_identified ?? true} />
                            <Checkcard label="TGS Tech Info Introduction" status={qaData.checkpoints?.tgs_tech_info_introduction} />
                            <Checkcard label="Role &amp; Company Confirmed" status={qaData.checkpoints?.role_and_company_confirmed} />
                            <Checkcard label="LMS Value Proposition" status={qaData.checkpoints?.lms_value_proposition} />
                            <Checkcard label="Email Address Verified" status={qaData.checkpoints?.email_verified} />
                            <Checkcard label="Q1: Evaluation Inquired" status={qaData.checkpoints?.evaluation_question_asked} />
                            <Checkcard
                              label="Q1 Response (Yes / Probably / Could be / Might be / I believe so)"
                              textValue={qaData.qualification?.implementation_response || 'Not Captured'}
                              status={Boolean(qaData.qualification?.implementation_response && !qaData.qualification?.implementation_response.includes('Not Captured'))}
                            />
                            <Checkcard label="Q2: Timeline Inquired" status={qaData.checkpoints?.evaluation_timeline_asked} />
                            <Checkcard
                              label="Q2 Timeline (0-3m / 3-6m / 6m / etc.)"
                              textValue={qaData.qualification?.implementation_timeline || '[Not Captured]'}
                              status={Boolean(qaData.qualification?.implementation_timeline && !qaData.qualification?.implementation_timeline.includes('Not Captured'))}
                            />
                            <Checkcard label="Specialist Follow-up Mentioned" status={qaData.checkpoints?.specialist_followup} />
                            <Checkcard label="Zero Send/Share Mentions (No Email Collateral)" status={qaData.checkpoints?.no_send_or_share_mentions ?? true} />
                            <Checkcard label="Professional Call Closing" status={qaData.checkpoints?.call_closing_present} />
                          </div>

                          {qaData.missingInformation && qaData.missingInformation.length > 0 && (
                            <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4">
                              <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-1 mb-1.5">
                                Uncaptured / Missing Checkpoint Flags
                              </h4>
                              <ul className="list-disc list-inside text-xs text-amber-200/90 space-y-1">
                                {qaData.missingInformation.map((info, idx) => (
                                  <li key={idx}>{info}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {qaData.processingNotes && (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
                              <h4 className="font-semibold text-slate-300 mb-1">AI Processing Notes</h4>
                              <p className="text-slate-400 leading-relaxed">{qaData.processingNotes}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-12 text-slate-500 text-xs">
                          Run API 2 (AI Edit & QA) to extract QA checkpoints and validation metrics.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: RAW EVIDENCE (API 1) */}
                  {activeResultsTab === 'raw' && (
                    <div className="flex-1 flex flex-col space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>API 1 Speech-to-Text Verbatim Evidence (raw_transcript)</span>
                        <span className="text-[10px] text-indigo-400 font-mono">* Never overwritten</span>
                      </div>
                      <pre className="w-full flex-1 min-h-[420px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-300 text-xs font-mono leading-relaxed overflow-y-auto whitespace-pre-wrap">
                        {rawTranscript || pastedRawTranscript || 'No raw transcript available yet.'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-12 text-center h-full flex flex-col items-center justify-center min-h-[640px]">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-200 mb-1">Two-API Pipeline Ready</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Upload an audio file for API 1 (Speech-to-Text), then process the resulting raw_transcript using API 2 (AI Processing Engine).
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Dual API Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-slate-100">Settings → API Configuration</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Inner Tabs */}
            <div className="flex border-b border-slate-800 gap-4 text-xs font-semibold">
              <button
                onClick={() => setActiveSettingsTab('stt')}
                className={`pb-2 border-b-2 transition ${
                  activeSettingsTab === 'stt'
                    ? 'border-blue-500 text-blue-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Transcription API (API 1)
              </button>
              <button
                onClick={() => setActiveSettingsTab('ai')}
                className={`pb-2 border-b-2 transition ${
                  activeSettingsTab === 'ai'
                    ? 'border-indigo-500 text-indigo-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                AI Processing API (API 2)
              </button>
            </div>

            {/* TAB 1: TRANSCRIPTION API (API 1) */}
            {activeSettingsTab === 'stt' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">API Provider</label>
                  <select
                    value={sttConfig.provider}
                    onChange={(e) => setSttConfig({ ...sttConfig, provider: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                  >
                    <option value="Gemini">Gemini Multimodal STT (Recommended — 100% Verbatim Accuracy &amp; Diarization)</option>
                    <option value="GoogleCloud">Google Cloud Speech-to-Text (Telephony Enhanced)</option>
                    <option value="AssemblyAI">AssemblyAI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">API Key</label>
                  <input
                    type="password"
                    value={sttConfig.apiKey}
                    onChange={(e) => setSttConfig({ ...sttConfig, apiKey: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                    placeholder={
                      sttConfig.provider === 'Gemini'
                        ? 'Leave blank to use GEMINI_API_KEY from .env.local'
                        : 'Leave blank to use STT_API_KEY from .env.local'
                    }
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {sttConfig.provider === 'Gemini'
                      ? 'Natively transcribes MP3, WAV, M4A, AAC, and FLAC word-for-word with timestamps and speaker tags.'
                      : 'Uses your configured Google Cloud / AssemblyAI credentials.'}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Google Cloud Storage Bucket (for Long Audio)</label>
                  <input
                    type="text"
                    value={sttConfig.gcsBucket || ''}
                    onChange={(e) => setSttConfig({ ...sttConfig, gcsBucket: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs"
                    placeholder="my-gcs-bucket-name (optional for GCS LongRunningRecognize)"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Audio uploaded to gs://bucket/transcriptions/... and cleaned up post-transcription
                  </p>
                </div>

                {sttTestStatus && (
                  <div className={`p-3 rounded-lg border text-xs ${
                    sttTestStatus.isError
                      ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                      : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  }`}>
                    {sttTestStatus.message}
                  </div>
                )}

                <div className="pt-2 flex justify-between">
                  <button
                    onClick={handleTestSttConnection}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-xs font-semibold"
                  >
                    Test Connection (API 1)
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: AI PROCESSING API (API 2) */}
            {activeSettingsTab === 'ai' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">AI Provider</label>
                  <select
                    value={aiConfig.provider}
                    onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                  >
                    <option value="Google AI Studio">Google AI Studio (Gemini API)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Google AI Studio API Key</label>
                  <input
                    type="password"
                    value={aiConfig.apiKey}
                    onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                    placeholder="Leave blank to use GEMINI_API_KEY from .env.local"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Uses GEMINI_API_KEY from .env.local by default if left empty.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">AI Model</label>
                  <select
                    value={aiConfig.model}
                    onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                  >
                    <option value="gemini-3.6-flash">gemini-3.6-flash (Recommended - Fast &amp; Powerful)</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash (High Quality &amp; Fast)</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Fast &amp; Lightweight)</option>
                    <option value="gemini-3-flash-preview">gemini-3-flash-preview (Preview Tier)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Temperature ({aiConfig.temperature})</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={aiConfig.temperature}
                      onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Max Output Tokens</label>
                    <input
                      type="number"
                      value={aiConfig.maxTokens}
                      onChange={(e) => setAiConfig({ ...aiConfig, maxTokens: parseInt(e.target.value) || 2048 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                    />
                  </div>
                </div>

                {aiTestStatus && (
                  <div className={`p-3 rounded-lg border text-xs ${
                    aiTestStatus.isError
                      ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                      : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  }`}>
                    {aiTestStatus.message}
                  </div>
                )}

                <div className="pt-2 flex justify-between">
                  <button
                    onClick={handleTestAiConnection}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-xs font-semibold"
                  >
                    Test Connection (API 2)
                  </button>
                </div>

                {/* Prompt Instructions Editor inside Settings */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-slate-200 font-semibold text-xs">AI Prompt &amp; Editing Instructions (Trae AI style)</label>
                      <p className="text-[11px] text-slate-400">Custom rules for transcript reconstruction. Overrides hardcoded backend logic.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetPromptToDefault}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Reset to 29-Point Engine
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-2 rounded border border-slate-800 text-[10px]">
                    <span className="text-slate-400 mr-1 font-semibold">Variables:</span>
                    {[
                      { label: 'Name', tag: '{{PROSPECT_FULL_NAME}}' },
                      { label: 'Company', tag: '{{PROSPECT_COMPANY}}' },
                      { label: 'Title', tag: '{{PROSPECT_JOB_TITLE}}' },
                      { label: 'Email', tag: '{{PROSPECT_EMAIL}}' },
                      { label: 'Asset', tag: '{{ASSET_TITLE}}' },
                      { label: 'ValueProp', tag: '{{VALUE_PROPOSITION}}' },
                      { label: 'RawText', tag: '{{RAW_TRANSCRIPT}}' }
                    ].map(item => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => handleInsertTag(item.tag)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono"
                      >
                        +{item.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={8}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="Enter prompt instructions..."
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{customPrompt.length} chars</span>
                    <span>Saved automatically with Save Configurations</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md"
              >
                Save Configurations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Checkcard({ label, status, textValue }: { label: string; status?: boolean; textValue?: string }) {
  const isPositive = status === true || (textValue && textValue !== 'NOT_CAPTURED' && textValue !== '[Not Captured]');

  return (
    <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
      isPositive
        ? 'bg-slate-900/90 border-emerald-500/30'
        : 'bg-slate-900/40 border-slate-800'
    }`}>
      <div>
        <p className="text-slate-300 font-medium">{label}</p>
        {textValue && (
          <p className="text-[11px] font-mono text-indigo-300 mt-0.5">{textValue}</p>
        )}
      </div>

      <div>
        {isPositive ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            Captured
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Missing
          </span>
        )}
      </div>
    </div>
  );
}