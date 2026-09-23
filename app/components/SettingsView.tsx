'use client';

import React, { useState, useEffect } from 'react';
import { STTConfig, AIConfig, CRMConfig, ClientRecord, CampaignRecord } from '@/lib/types';

interface SettingsViewProps {
  onSettingsSaved?: () => void;
}

export default function SettingsView({ onSettingsSaved }: SettingsViewProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState<'global_credentials' | 'client_hierarchy'>('client_hierarchy');

  // 1. Global Credentials State
  const [sttConfig, setSttConfig] = useState<STTConfig>({
    provider: 'GoogleCloud',
    apiKey: '',
    gcsBucket: '',
    endpoint: 'https://speech.googleapis.com/v1/speech:recognize'
  });

  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'Google AI Studio',
    apiKey: '',
    model: 'gemini-3.6-flash',
    temperature: 0.2,
    maxTokens: 2048
  });

  const [crmConfig, setCrmConfig] = useState<CRMConfig>({
    crmApiUrl: 'http://localhost/demandflowbridge/api/get_lead.php',
    crmApiKey: ''
  });

  // 2. Client & Campaign Hierarchy State
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');

  // Selected Client Form
  const [clientCodeInput, setClientCodeInput] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [mainPromptInput, setMainPromptInput] = useState('');
  const [clientRulesInput, setClientRulesInput] = useState('');

  // Selected Campaign Form
  const [campaignsList, setCampaignsList] = useState<CampaignRecord[]>([]);
  const [editingCampaignCode, setEditingCampaignCode] = useState<string | null>(null);
  const [campaignCodeInput, setCampaignCodeInput] = useState('');
  const [campaignNameInput, setCampaignNameInput] = useState('');
  const [assetTitleInput, setAssetTitleInput] = useState('');
  const [campaignRulesInput, setCampaignRulesInput] = useState('');
  const [valuePropositionsInput, setValuePropositionsInput] = useState<string[]>(['']);

  // Load Settings and Clients on Mount
  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Load Global Settings
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) {
          if (data.settings.sttConfig) setSttConfig(data.settings.sttConfig);
          if (data.settings.aiConfig) setAiConfig(data.settings.aiConfig);
          if (data.settings.crmConfig) setCrmConfig(data.settings.crmConfig);
        }
      }

      // Load Clients & Campaigns
      const clientsRes = await fetch('/api/clients');
      if (clientsRes.ok) {
        const cData = await clientsRes.json();
        if (Array.isArray(cData.clients)) {
          setClients(cData.clients);
          if (cData.clients.length > 0) {
            selectClient(cData.clients[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error loading initial settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const selectClient = (client: ClientRecord) => {
    setSelectedClientCode(client.clientCode);
    setClientCodeInput(client.clientCode);
    setClientNameInput(client.name);
    setMainPromptInput(client.mainPrompt || '');
    setClientRulesInput(client.clientRules || '');
    const clientCamps = client.campaigns || [];
    setCampaignsList(clientCamps);

    if (clientCamps.length > 0) {
      selectCampaign(clientCamps[0]);
    } else {
      resetCampaignForm();
    }
  };

  const selectCampaign = (camp: CampaignRecord) => {
    setEditingCampaignCode(camp.campaignCode);
    setCampaignCodeInput(camp.campaignCode);
    setCampaignNameInput(camp.campaignName);
    setAssetTitleInput(camp.assetTitle || '');
    setCampaignRulesInput(camp.campaignRules || '');
    setValuePropositionsInput(
      Array.isArray(camp.valuePropositions) && camp.valuePropositions.length > 0
        ? camp.valuePropositions
        : ['']
    );
  };

  const resetCampaignForm = () => {
    setEditingCampaignCode(null);
    setCampaignCodeInput('');
    setCampaignNameInput('');
    setAssetTitleInput('Structured B2B Solution');
    setCampaignRulesInput('');
    setValuePropositionsInput(['']);
  };

  const handleAddNewClient = () => {
    const newCode = `CL-${Math.floor(1000 + Math.random() * 9000)}`;
    const newClient: ClientRecord = {
      clientCode: newCode,
      name: `New Client ${newCode}`,
      mainPrompt: '',
      clientRules: '',
      status: 'active',
      campaigns: []
    };
    setSelectedClientCode(newCode);
    setClientCodeInput(newCode);
    setClientNameInput(newClient.name);
    setMainPromptInput('');
    setClientRulesInput('');
    setCampaignsList([]);
    resetCampaignForm();
  };

  const handleAddVP = () => {
    setValuePropositionsInput(prev => [...prev, '']);
  };

  const handleRemoveVP = (index: number) => {
    setValuePropositionsInput(prev => prev.filter((_, i) => i !== index));
  };

  const handleVPChange = (index: number, text: string) => {
    setValuePropositionsInput(prev => {
      const copy = [...prev];
      copy[index] = text;
      return copy;
    });
  };

  // Save Global Settings Handler
  const handleSaveGlobalCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess('');
    setErrorMessage('');

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sttConfig, aiConfig, crmConfig })
      });

      if (res.ok) {
        setSaveSuccess('🔐 Global credentials & API configurations updated successfully!');
        if (onSettingsSaved) onSettingsSaved();
        setTimeout(() => setSaveSuccess(''), 4000);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Failed to save global credentials');
      }
    } catch (err) {
      setErrorMessage('Network error while saving global settings');
    } finally {
      setSaving(false);
    }
  };

  // Save Client & Campaigns Handler
  const handleSaveClientAndCampaigns = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess('');
    setErrorMessage('');

    if (!clientCodeInput.trim() || !clientNameInput.trim()) {
      setErrorMessage('Client Code and Client Name are required.');
      setSaving(false);
      return;
    }

    try {
      // 1. Save Client Record
      const clientRes = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: clientCodeInput.trim(),
          name: clientNameInput.trim(),
          mainPrompt: mainPromptInput,
          clientRules: clientRulesInput
        })
      });

      if (!clientRes.ok) {
        throw new Error('Failed to save Client record');
      }

      // 2. If Campaign form is filled, save Campaign Record
      if (campaignCodeInput.trim() && campaignNameInput.trim()) {
        const validVPs = valuePropositionsInput.map(v => v.trim()).filter(Boolean);
        const campaignRes = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientCode: clientCodeInput.trim(),
            campaignCode: campaignCodeInput.trim(),
            campaignName: campaignNameInput.trim(),
            assetTitle: assetTitleInput.trim(),
            campaignRules: campaignRulesInput.trim(),
            valuePropositions: validVPs.length > 0 ? validVPs : ['Default Value Proposition']
          })
        });

        if (!campaignRes.ok) {
          throw new Error('Failed to save Campaign record');
        }
      }

      setSaveSuccess(`🏢 Client "${clientCodeInput}" & Campaign settings saved successfully!`);
      await loadInitialData();
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving client & campaign details');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (code: string) => {
    if (!confirm(`Are you sure you want to delete Client Code ${code}?`)) return;
    try {
      const res = await fetch(`/api/clients?clientCode=${encodeURIComponent(code)}`, { method: 'DELETE' });
      if (res.ok) {
        setSaveSuccess(`Client Code ${code} deleted.`);
        await loadInitialData();
      }
    } catch (err) {
      setErrorMessage('Failed to delete client');
    }
  };

  const handleDeleteCampaign = async (code: string) => {
    if (!confirm(`Are you sure you want to delete Campaign Code ${code}?`)) return;
    try {
      const res = await fetch(`/api/campaigns?campaignCode=${encodeURIComponent(code)}`, { method: 'DELETE' });
      if (res.ok) {
        setSaveSuccess(`Campaign Code ${code} deleted.`);
        await loadInitialData();
      }
    } catch (err) {
      setErrorMessage('Failed to delete campaign');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-3 text-cyan-400 font-medium">
          <svg className="animate-spin h-6 w-6 text-cyan-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading DemandFlow Arm Settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1450px] mx-auto py-6 px-4 space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-cyan-500/30">
            DA
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">DemandFlow Arm Architecture Settings</h2>
            <p className="text-xs text-slate-400">Database-Driven Client → Campaign → Multiple Value Propositions Setup</p>
          </div>
        </div>

        {/* Global Nav Tabs */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('client_hierarchy')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'client_hierarchy'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏢 Client & Campaign Hierarchy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('global_credentials')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'global_credentials'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔐 Global Credentials
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-950/90 border border-emerald-500/60 rounded-2xl text-emerald-300 text-xs font-bold shadow-lg flex items-center justify-between">
          <span>{saveSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-950/90 border border-rose-500/60 rounded-2xl text-rose-300 text-xs font-bold shadow-lg">
          <span>⚠ {errorMessage}</span>
        </div>
      )}

      {/* TAB 1: CLIENT & CAMPAIGN HIERARCHY MANAGER */}
      {activeTab === 'client_hierarchy' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Client List Sidebar */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                Configured Clients ({clients.length})
              </h3>
              <button
                onClick={handleAddNewClient}
                className="bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all"
              >
                + New Client
              </button>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {clients.length === 0 ? (
                <p className="text-xs text-slate-500 p-2 text-center">No clients saved. Click + New Client above.</p>
              ) : (
                clients.map((c) => (
                  <div
                    key={c.clientCode}
                    onClick={() => selectClient(c)}
                    className={`p-3 rounded-2xl cursor-pointer border transition-all flex items-center justify-between ${
                      selectedClientCode === c.clientCode
                        ? 'bg-slate-950 border-cyan-500 text-white shadow-md'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-mono text-xs font-black text-cyan-300">{c.clientCode}</div>
                      <div className="text-xs font-semibold truncate max-w-[150px]">{c.name}</div>
                      <div className="text-[10px] text-slate-500">{c.campaigns?.length || 0} Campaigns</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(c.clientCode);
                      }}
                      className="text-slate-600 hover:text-rose-400 p-1 text-xs font-bold"
                      title="Delete Client"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Client & Campaign Editor Form */}
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <form onSubmit={handleSaveClientAndCampaigns} className="space-y-6">
              {/* SECTION A: CLIENT CODE DETAILS */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                    🏢 Client Information & Global Rules
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">Client Code: {clientCodeInput}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Client Code *</label>
                    <input
                      type="text"
                      required
                      value={clientCodeInput}
                      onChange={(e) => setClientCodeInput(e.target.value)}
                      placeholder="e.g. CL-1002"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-2.5 text-xs font-mono text-cyan-300 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Client Name *</label>
                    <input
                      type="text"
                      required
                      value={clientNameInput}
                      onChange={(e) => setClientNameInput(e.target.value)}
                      placeholder="e.g. Enterprise Tech Corp"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-2.5 text-xs text-slate-200 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Client Main Prompt</label>
                  <textarea
                    rows={3}
                    value={mainPromptInput}
                    onChange={(e) => setMainPromptInput(e.target.value)}
                    placeholder="Global prompt instructions for this Client Code..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-2.5 text-xs font-mono text-slate-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Client Rules / Guidelines</label>
                  <textarea
                    rows={2}
                    value={clientRulesInput}
                    onChange={(e) => setClientRulesInput(e.target.value)}
                    placeholder="Specific rules for call transcript processing (e.g. strict email verification required)..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-2.5 text-xs text-slate-200 outline-none"
                  />
                </div>
              </div>

              {/* SECTION B: CAMPAIGN CONFIGURATION UNDER CLIENT CODE */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h3 className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                      🎯 Campaign Details & Multiple Value Propositions
                    </h3>
                    <p className="text-[10px] text-slate-500">Configure campaign codes associated with Client Code {clientCodeInput}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {campaignsList.length > 0 && (
                      <select
                        value={editingCampaignCode || ''}
                        onChange={(e) => {
                          const matched = campaignsList.find(c => c.campaignCode === e.target.value);
                          if (matched) selectCampaign(matched);
                        }}
                        className="bg-slate-900 border border-cyan-800 text-cyan-300 text-xs font-bold rounded-xl px-3 py-1.5 outline-none"
                      >
                        {campaignsList.map(c => (
                          <option key={c.campaignCode} value={c.campaignCode}>
                            Campaign: {c.campaignCode}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={resetCampaignForm}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold"
                    >
                      + Add Campaign
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Campaign Code *</label>
                    <input
                      type="text"
                      value={campaignCodeInput}
                      onChange={(e) => setCampaignCodeInput(e.target.value)}
                      placeholder="e.g. CAMP-2001"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-2 text-xs font-mono text-cyan-300 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Campaign Name *</label>
                    <input
                      type="text"
                      value={campaignNameInput}
                      onChange={(e) => setCampaignNameInput(e.target.value)}
                      placeholder="e.g. Q3 HRIS Outreach"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-2 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Asset Title</label>
                    <input
                      type="text"
                      value={assetTitleInput}
                      onChange={(e) => setAssetTitleInput(e.target.value)}
                      placeholder="e.g. Enterprise HRIS Solution Guide"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-2 text-xs text-slate-200 outline-none"
                    />
                  </div>
                </div>

                {/* MULTIPLE VALUE PROPOSITIONS MANAGER */}
                <div className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider">
                      💡 Value Propositions ({valuePropositionsInput.length})
                    </label>
                    <button
                      type="button"
                      onClick={handleAddVP}
                      className="bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[10px] font-bold px-3 py-1 rounded-xl transition-all"
                    >
                      + Add Value Proposition
                    </button>
                  </div>

                  <div className="space-y-2">
                    {valuePropositionsInput.map((vpText, idx) => (
                      <div key={`vp-${idx}`} className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-cyan-400 font-bold w-6">{idx + 1}.</span>
                        <input
                          type="text"
                          value={vpText}
                          onChange={(e) => handleVPChange(idx, e.target.value)}
                          placeholder={`Value Proposition #${idx + 1}...`}
                          className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                        />
                        {valuePropositionsInput.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVP(idx)}
                            className="text-rose-400 hover:text-rose-300 px-2 py-1 text-xs font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Campaign Rules & Custom Instructions</label>
                  <textarea
                    rows={2}
                    value={campaignRulesInput}
                    onChange={(e) => setCampaignRulesInput(e.target.value)}
                    placeholder="Specific campaign rules or disqualification parameters..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-2.5 text-xs text-slate-200 outline-none"
                  />
                </div>

                {editingCampaignCode && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteCampaign(editingCampaignCode)}
                      className="text-rose-400 hover:text-rose-300 text-xs font-bold"
                    >
                      Delete Campaign ({editingCampaignCode})
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black px-6 py-3 rounded-2xl text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Saving Client & Campaign Settings...' : 'Save Client Code & Campaign Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: GLOBAL CREDENTIALS SETTINGS */}
      {activeTab === 'global_credentials' && (
        <form onSubmit={handleSaveGlobalCredentials} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              🔐 Global API Credentials & System Specifications
            </h3>
            <p className="text-xs text-slate-400">Configure credentials once globally for STT, Gemini AI Model, and CRM API Connection.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. STT Provider */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-4">
              <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">🎙️ Speech-to-Text (STT) Settings</h4>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">STT Provider</label>
                <select
                  value={sttConfig.provider}
                  onChange={(e) => setSttConfig(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                >
                  <option value="GoogleCloud">Google Cloud Speech-to-Text</option>
                  <option value="AssemblyAI">AssemblyAI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">STT API Key</label>
                <input
                  type="password"
                  value={sttConfig.apiKey}
                  onChange={(e) => setSttConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="STT API Key..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Google Cloud Storage Bucket (Optional)</label>
                <input
                  type="text"
                  value={sttConfig.gcsBucket || ''}
                  onChange={(e) => setSttConfig(prev => ({ ...prev, gcsBucket: e.target.value }))}
                  placeholder="my-transcript-bucket"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                />
              </div>
            </div>

            {/* 2. AI Engine */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-4">
              <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">🤖 AI Processing Engine & Gemini API</h4>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Gemini AI Model</label>
                <select
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none font-medium"
                >
                  <option value="gemini-3.6-flash">Gemini 3.6 Flash (Recommended)</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Google AI Studio API Key</label>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={aiConfig.temperature}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0.2 }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={aiConfig.maxTokens}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 2048 }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 3. CRM API Endpoint */}
            <div className="md:col-span-2 bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-4">
              <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">🔌 CRM / DemandFlow Bridge API URL</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">CRM API Endpoint URL</label>
                  <input
                    type="text"
                    value={crmConfig.crmApiUrl}
                    onChange={(e) => setCrmConfig(prev => ({ ...prev, crmApiUrl: e.target.value }))}
                    placeholder="http://localhost/demandflowbridge/api/get_lead.php"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-cyan-300 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">CRM API Secret Key (Optional)</label>
                  <input
                    type="password"
                    value={crmConfig.crmApiKey || ''}
                    onChange={(e) => setCrmConfig(prev => ({ ...prev, crmApiKey: e.target.value }))}
                    placeholder="Secret Key"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black px-6 py-3 rounded-2xl text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Saving Global Credentials...' : 'Save Global Credentials'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
