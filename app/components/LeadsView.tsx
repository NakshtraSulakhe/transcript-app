'use client';

import React, { useState, useEffect } from 'react';
import { StoredLead } from '@/lib/db';
import { ClientRecord } from '@/lib/types';

interface LeadsViewProps {
  activeClientCode?: string;
  activeCampaignCode?: string;
}

export default function LeadsView({ activeClientCode, activeCampaignCode }: LeadsViewProps) {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [availableClients, setAvailableClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingLeadId, setProcessingLeadId] = useState<string | null>(null);
  const [copiedLeadId, setCopiedLeadId] = useState<{ id: string; type: 'raw' | 'edited' } | null>(null);

  // Filters State
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('All Campaigns');
  const [selectedClientFilter, setSelectedClientFilter] = useState(activeClientCode || 'All Client Codes');
  const [selectedQaFilter, setSelectedQaFilter] = useState('All Status');
  const [selectedDeliveryFilter, setSelectedDeliveryFilter] = useState('All Status');

  // Modal / Drawer State
  const [activeLeadModal, setActiveLeadModal] = useState<{
    lead: StoredLead;
    type: 'raw' | 'edited' | 'details';
  } | null>(null);

  // Audio Playback State
  const [currentlyPlayingLeadId, setCurrentlyPlayingLeadId] = useState<string | null>(null);

  const fetchClientsAndCampaigns = async () => {
    try {
      // Fetch Clients and their associated Campaigns
      const clientsRes = await fetch('/api/clients');
      if (clientsRes.ok) {
        const cData = await clientsRes.json();
        if (cData.clients) setAvailableClients(cData.clients);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  const fetchLeads = async (overrideClient?: string) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (quickSearch) queryParams.set('search', quickSearch);
      if (selectedCampaignFilter !== 'All Campaigns') queryParams.set('campaignCode', selectedCampaignFilter);
      
      const targetClient = overrideClient !== undefined ? overrideClient : selectedClientFilter;
      if (targetClient && targetClient !== 'All Client Codes') {
        queryParams.set('client_code', targetClient);
      }
      
      if (selectedQaFilter !== 'All Status') queryParams.set('qa_status', selectedQaFilter);
      if (selectedDeliveryFilter !== 'All Status') queryParams.set('client_delivery_status', selectedDeliveryFilter);

      const res = await fetch(`/api/leads?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndCampaigns();
  }, []);

  useEffect(() => {
    if (activeClientCode) {
      setSelectedClientFilter(activeClientCode);
      fetchLeads(activeClientCode);
    } else {
      fetchLeads();
    }
  }, [activeClientCode]);

  const handleApplyFilters = () => {
    fetchLeads();
  };

  const handleClearFilters = () => {
    setQuickSearch('');
    setSelectedCampaignFilter('All Campaigns');
    setSelectedClientFilter('All Client Codes');
    setSelectedQaFilter('All Status');
    setSelectedDeliveryFilter('All Status');
    fetchLeads('All Client Codes');
  };

  const handleProcessTranscript = async (lead: StoredLead) => {
    try {
      setProcessingLeadId(lead.id);
      const res = await fetch('/api/leads/process-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lead) {
          setLeads(prev => prev.map(l => (l.id === data.lead.id ? data.lead : l)));
          if (activeLeadModal?.lead.id === data.lead.id) {
            setActiveLeadModal(prev => prev ? { ...prev, lead: data.lead } : null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to process transcript:', err);
    } finally {
      setProcessingLeadId(null);
    }
  };

  const handleQuickCopy = (text: string, id: string, type: 'raw' | 'edited') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLeadId({ id, type });
    setTimeout(() => setCopiedLeadId(null), 2500);
  };

  // Dynamic Status Metrics calculated directly from real records
  const qaCounts = {
    pendingQA: leads.filter(l => l.qaStatus === 'Pending QA').length,
    inProgress: leads.filter(l => l.qaStatus === 'In Progress').length,
    qualified: leads.filter(l => l.qaStatus === 'Qualified').length,
    disqualified: leads.filter(l => l.qaStatus === 'Disqualified').length,
  };

  const deliveryCounts = {
    pending: leads.filter(l => l.clientDeliveryStatus === 'Pending').length,
    delivered: leads.filter(l => l.clientDeliveryStatus === 'Delivered').length,
    accepted: leads.filter(l => l.clientDeliveryStatus === 'Approved' || l.clientDeliveryStatus === 'Accepted').length,
    rejected: leads.filter(l => l.clientDeliveryStatus === 'Rejected').length,
  };

  return (
    <div className="max-w-[1650px] mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* 1. Dynamic Metric Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* QA STATUS COUNTS */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 space-y-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <span>🎯 QA STATUS VERIFICATION ({leads.length} LEADS)</span>
            </h3>
            <span className="text-[10px] font-mono text-cyan-400">DemandFlow Arm Database</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 bg-amber-950/70 border border-amber-700/60 text-amber-300 rounded-xl font-bold shadow-sm">
              Pending QA: {qaCounts.pendingQA}
            </span>
            <span className="px-3 py-1.5 bg-blue-950/70 border border-blue-700/60 text-blue-300 rounded-xl font-bold shadow-sm">
              In Progress: {qaCounts.inProgress}
            </span>
            <span className="px-3 py-1.5 bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 rounded-xl font-bold shadow-sm">
              Qualified: {qaCounts.qualified}
            </span>
            <span className="px-3 py-1.5 bg-rose-950/70 border border-rose-700/60 text-rose-300 rounded-xl font-bold shadow-sm">
              Disqualified: {qaCounts.disqualified}
            </span>
          </div>
        </div>

        {/* CLIENT DELIVERY COUNTS */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 space-y-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <span>📦 CLIENT DELIVERY COUNTS</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald-400">DemandFlow Bridge API</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl font-bold">
              Pending: {deliveryCounts.pending}
            </span>
            <span className="px-3 py-1.5 bg-cyan-950/70 border border-cyan-700/60 text-cyan-300 rounded-xl font-bold shadow-sm">
              Delivered: {deliveryCounts.delivered}
            </span>
            <span className="px-3 py-1.5 bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 rounded-xl font-bold shadow-sm">
              Approved: {deliveryCounts.accepted}
            </span>
            <span className="px-3 py-1.5 bg-rose-950/70 border border-rose-700/60 text-rose-300 rounded-xl font-bold shadow-sm">
              Rejected: {deliveryCounts.rejected}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4.5 shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Quick Search */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              SEARCH LEADS
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Name, email, company..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-200 outline-none transition-colors"
              />
              <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* DYNAMIC CLIENT CODE FILTER */}
          <div>
            <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-wider mb-1">
              SELECT CLIENT CODE
            </label>
            <select
              value={selectedClientFilter}
              onChange={(e) => {
                const newClient = e.target.value;
                setSelectedClientFilter(newClient);
                setSelectedCampaignFilter('All Campaigns');
                fetchLeads(newClient);
              }}
              className="w-full bg-slate-950 border border-cyan-800/80 focus:border-cyan-500 rounded-2xl px-3 py-2 text-xs text-cyan-300 font-bold outline-none"
            >
              {(() => {
                const uniqueClients = Array.from(
                  new Map(availableClients.map(c => [c.clientCode, c])).values()
                );
                return (
                  <>
                    <option value="All Client Codes">All Client Codes ({uniqueClients.length})</option>
                    {uniqueClients.map((c) => (
                      <option key={`client-opt-${c.clientCode}`} value={c.clientCode}>
                        {c.clientCode} — {c.name}
                      </option>
                    ))}
                  </>
                );
              })()}
            </select>
          </div>

          {/* CASCADING CAMPAIGN FILTER */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              CAMPAIGN CODE
            </label>
            <select
              value={selectedCampaignFilter}
              onChange={(e) => setSelectedCampaignFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-2xl px-3 py-2 text-xs text-slate-200 outline-none"
            >
              {(() => {
                const matchedClient = availableClients.find(c => c.clientCode === selectedClientFilter);
                const campaignsToDisplay = matchedClient && matchedClient.campaigns
                  ? matchedClient.campaigns
                  : availableClients.flatMap(c => c.campaigns || []);
                
                const uniqueCampaigns = Array.from(
                  new Map(campaignsToDisplay.map(c => [c.campaignCode, c])).values()
                );

                return (
                  <>
                    <option value="All Campaigns">All Campaigns ({uniqueCampaigns.length})</option>
                    {uniqueCampaigns.map((c) => (
                      <option key={`camp-opt-${c.campaignCode}`} value={c.campaignCode}>
                        {c.campaignCode} - {c.campaignName}
                      </option>
                    ))}
                  </>
                );
              })()}
            </select>
          </div>

          {/* Apply & Clear Buttons */}
          <div className="col-span-1 flex items-end space-x-2 pt-1">
            <button
              onClick={handleApplyFilters}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold px-4 py-2 rounded-2xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-cyan-500/20 transition-all active:scale-95"
            >
              <span>Filter Leads</span>
            </button>
            <button
              onClick={handleClearFilters}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 🌟 CAMPAIGNS LIST UNDER SELECTED CLIENT CODE */}
        {(() => {
          const selectedClient = availableClients.find(c => c.clientCode === selectedClientFilter);
          const activeCampaigns = selectedClient?.campaigns || [];
          if (activeCampaigns.length === 0) return null;

          return (
            <div className="pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <span>🎯 Active Campaigns Under Client Code: {selectedClientFilter}</span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 text-[9px] font-mono border border-cyan-800">
                    {activeCampaigns.length} Configured
                  </span>
                </span>
                <span className="text-[10px] text-slate-400">Click a campaign to filter leads</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {activeCampaigns.map((camp) => {
                  const isSelected = selectedCampaignFilter === camp.campaignCode;
                  return (
                    <div
                      key={`active-camp-${camp.campaignCode}`}
                      onClick={() => {
                        setSelectedCampaignFilter(isSelected ? 'All Campaigns' : camp.campaignCode);
                      }}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-950 border-cyan-500 text-white shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500/50'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-cyan-300">{camp.campaignCode}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400 font-bold">
                          {camp.status || 'Active'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-100 mt-1 truncate">{camp.campaignName}</div>
                      {camp.assetTitle && (
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          📄 {camp.assetTitle}
                        </div>
                      )}
                      {Array.isArray(camp.valuePropositions) && camp.valuePropositions.length > 0 && (
                        <div className="text-[10px] text-slate-500 mt-1 line-clamp-1 italic">
                          💡 {camp.valuePropositions[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. CRM Leads Table displaying Raw and Generated Transcripts */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Counter Bar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="font-black text-white">Showing {leads.length} leads</span>
            {selectedClientFilter !== 'All Client Codes' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                Filtered by Client Code: {selectedClientFilter}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            📄 Raw Transcript & ✨ Generated Transcript Viewers Enabled
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-4">SR NO.</th>
                <th className="py-4 px-4">CREATED DATE</th>
                <th className="py-4 px-4">PROSPECT INFO</th>
                <th className="py-4 px-4">COMPANY & JOB</th>
                <th className="py-4 px-4">CLIENT CODE / CAMPAIGN</th>
                <th className="py-4 px-4">QA STATUS</th>
                <th className="py-4 px-4">DELIVERY</th>
                <th className="py-4 px-4 text-center">RAW & GENERATED TRANSCRIPT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-cyan-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Fetching leads for Client Code: {selectedClientFilter}...</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No leads found in database for Client Code <strong>"{selectedClientFilter}"</strong>.
                  </td>
                </tr>
              ) : (
                leads.map((lead, index) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* SR NO. */}
                    <td className="py-4 px-4 text-slate-400 font-mono font-black">
                      {lead.srNo || index + 1}
                    </td>

                    {/* CREATED DATE */}
                    <td className="py-4 px-4 text-slate-300 font-medium">
                      <div>{lead.createdAt}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{lead.id}</div>
                    </td>

                    {/* LEAD INFO */}
                    <td className="py-4 px-4">
                      <div className="font-black text-slate-100">{lead.firstName} {lead.lastName}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{lead.email}</div>
                      <div className="text-slate-500 font-mono text-[10px]">Phone • {lead.contactNumber}</div>
                    </td>

                    {/* COMPANY */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-200">{lead.companyName}</div>
                      <div className="text-slate-400 text-[11px]">{lead.jobTitle}</div>
                      <div className="text-slate-500 text-[10px]">Country • {lead.country}</div>
                    </td>

                    {/* CLIENT / CAMPAIGN */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-black bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                          {lead.clientCode}
                        </span>
                      </div>
                      <div className="text-slate-300 font-semibold text-[11px] mt-1">{lead.campaignCode}</div>
                      <div className="text-slate-500 text-[10px]">Agent: {lead.agentName}</div>
                    </td>

                    {/* QA STATUS */}
                    <td className="py-4 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          lead.qaStatus === 'Qualified'
                            ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300'
                            : lead.qaStatus === 'Disqualified'
                            ? 'bg-rose-950/80 border border-rose-700/60 text-rose-300'
                            : 'bg-amber-950/80 border border-amber-700/60 text-amber-300'
                        }`}
                      >
                        {lead.qaStatus || 'Pending QA'}
                      </span>
                    </td>

                    {/* DELIVERY STATUS */}
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-950 border border-slate-800 text-slate-300">
                        {lead.clientDeliveryStatus || 'Pending'}
                      </span>
                    </td>

                    {/* ACTIONS: RAW & GENERATED TRANSCRIPT BUTTONS */}
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* Play Recording */}
                        {lead.recordingUrl && (
                          <button
                            onClick={() => setCurrentlyPlayingLeadId(currentlyPlayingLeadId === lead.id ? null : lead.id)}
                            title="Play Audio Recording"
                            className="w-7 h-7 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 transition-all hover:scale-105"
                          >
                            {currentlyPlayingLeadId === lead.id ? '🔊' : '▶'}
                          </button>
                        )}

                        {/* RAW TRANSCRIPT BUTTON & COPY */}
                        <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-0.5">
                          <button
                            onClick={() => {
                              if (!lead.rawTranscript) handleProcessTranscript(lead);
                              setActiveLeadModal({ lead, type: 'raw' });
                            }}
                            title="View Raw Transcript"
                            className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 font-bold rounded-lg text-[10px] flex items-center space-x-1 border border-cyan-800/50 transition-all"
                          >
                            <span>📄</span>
                            <span>Raw</span>
                          </button>

                          <button
                            onClick={() => handleQuickCopy(lead.rawTranscript || '', lead.id, 'raw')}
                            title="Copy Raw Transcript"
                            className="px-1.5 py-1 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 rounded-lg text-[10px] transition-colors"
                          >
                            {copiedLeadId?.id === lead.id && copiedLeadId?.type === 'raw' ? '✓' : '📋'}
                          </button>
                        </div>

                        {/* GENERATED TRANSCRIPT BUTTON & COPY */}
                        <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-0.5">
                          <button
                            onClick={() => {
                              if (!lead.modifiedTranscript) handleProcessTranscript(lead);
                              setActiveLeadModal({ lead, type: 'edited' });
                            }}
                            title="View Generated AI Transcript"
                            className="px-2 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 font-bold rounded-lg text-[10px] flex items-center space-x-1 border border-amber-800/50 transition-all"
                          >
                            <span>✨</span>
                            <span>Generated</span>
                          </button>

                          <button
                            onClick={() => handleQuickCopy(lead.modifiedTranscript || lead.rawTranscript || '', lead.id, 'edited')}
                            title="Copy Generated Transcript"
                            className="px-1.5 py-1 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded-lg text-[10px] transition-colors"
                          >
                            {copiedLeadId?.id === lead.id && copiedLeadId?.type === 'edited' ? '✓' : '📋'}
                          </button>
                        </div>

                        {/* Full Lead Details */}
                        <button
                          onClick={() => setActiveLeadModal({ lead, type: 'details' })}
                          title="View Lead Metadata"
                          className="w-7 h-7 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 transition-all hover:scale-105"
                        >
                          👁️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TRANSCRIPT DRAWER / MODAL */}
      {activeLeadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <span>
                    {activeLeadModal.type === 'raw'
                      ? '📄 Raw STT Audio Transcript'
                      : activeLeadModal.type === 'edited'
                      ? '✨ Generated AI Transcript & Evaluation'
                      : '👤 Complete Lead Record'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Client Code: <strong className="text-cyan-400 font-bold">{activeLeadModal.lead.clientCode}</strong> • Prospect: <strong className="text-slate-100 font-bold">{activeLeadModal.lead.firstName} {activeLeadModal.lead.lastName}</strong> ({activeLeadModal.lead.companyName})
                </p>
              </div>

              <button
                onClick={() => setActiveLeadModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center space-x-3">
                  <span className="text-slate-400">Campaign Tag:</span>
                  <span className="font-bold text-cyan-400">{activeLeadModal.lead.campaignCode}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Agent:</span>
                  <span className="text-slate-200 font-semibold">{activeLeadModal.lead.agentName}</span>
                </div>

                <button
                  onClick={() => handleProcessTranscript(activeLeadModal.lead)}
                  disabled={processingLeadId === activeLeadModal.lead.id}
                  className="px-3 py-1.5 bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 rounded-xl font-bold transition-colors"
                >
                  {processingLeadId === activeLeadModal.lead.id ? 'Processing AI...' : '⚡ Re-generate Transcript'}
                </button>
              </div>

              {/* RAW TRANSCRIPT */}
              {activeLeadModal.type === 'raw' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                      Raw Audio STT Transcript (Unedited)
                    </h4>
                    <button
                      onClick={() => handleQuickCopy(activeLeadModal.lead.rawTranscript || '', activeLeadModal.lead.id, 'raw')}
                      className="text-cyan-400 font-bold hover:underline text-[11px] flex items-center space-x-1"
                    >
                      <span>📋</span>
                      <span>Copy Raw Transcript</span>
                    </button>
                  </div>
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                    {activeLeadModal.lead.rawTranscript || 'No raw transcript available for this lead.'}
                  </div>
                </div>
              )}

              {/* GENERATED TRANSCRIPT */}
              {activeLeadModal.type === 'edited' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                        Generated AI Modified & Structured Transcript
                      </h4>
                      <button
                        onClick={() => handleQuickCopy(activeLeadModal.lead.modifiedTranscript || activeLeadModal.lead.rawTranscript || '', activeLeadModal.lead.id, 'edited')}
                        className="text-amber-400 font-bold hover:underline text-[11px] flex items-center space-x-1"
                      >
                        <span>📋</span>
                        <span>Copy Generated Transcript</span>
                      </button>
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto font-sans">
                      {activeLeadModal.lead.modifiedTranscript || activeLeadModal.lead.rawTranscript || 'No generated transcript available.'}
                    </div>
                  </div>

                  {/* BOTH TRANSCRIPTS COMPARISON OPTION */}
                  <div className="border-t border-slate-800/80 pt-4 space-y-2">
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                      📄 Raw STT Audio Reference
                    </h4>
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl font-mono text-slate-400 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto text-[11px]">
                      {activeLeadModal.lead.rawTranscript || 'No raw transcript recorded.'}
                    </div>
                  </div>

                  {activeLeadModal.lead.qualification && (
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                      <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                        🎯 Qualification Evaluation
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <span className="text-slate-400 block mb-1">Confirmed Evaluation Interest:</span>
                          <span className="font-bold text-emerald-400">
                            {activeLeadModal.lead.qualification.implementation_response || 'Yes'}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <span className="text-slate-400 block mb-1">Implementation Timeline:</span>
                          <span className="font-bold text-cyan-400">
                            {activeLeadModal.lead.qualification.implementation_timeline || '2 to 3 months'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DETAILS TAB */}
              {activeLeadModal.type === 'details' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <h5 className="font-bold text-cyan-400 uppercase tracking-wider text-[10px]">Lead Information</h5>
                    <div><span className="text-slate-400">Full Name:</span> {activeLeadModal.lead.firstName} {activeLeadModal.lead.lastName}</div>
                    <div><span className="text-slate-400">Email:</span> {activeLeadModal.lead.email}</div>
                    <div><span className="text-slate-400">Contact:</span> {activeLeadModal.lead.contactNumber}</div>
                    <div><span className="text-slate-400">Job Title:</span> {activeLeadModal.lead.jobTitle}</div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <h5 className="font-bold text-cyan-400 uppercase tracking-wider text-[10px]">Company & Client Account</h5>
                    <div><span className="text-slate-400">Company Name:</span> {activeLeadModal.lead.companyName}</div>
                    <div><span className="text-slate-400">Country:</span> {activeLeadModal.lead.country}</div>
                    <div><span className="text-slate-400">Client Code:</span> <span className="font-bold text-cyan-300">{activeLeadModal.lead.clientCode}</span></div>
                    <div><span className="text-slate-400">Campaign Code:</span> {activeLeadModal.lead.campaignCode}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveLeadModal(null)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
