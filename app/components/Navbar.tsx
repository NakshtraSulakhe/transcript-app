'use client';

import React from 'react';

interface NavbarProps {
  activeTab: 'leads' | 'settings' | 'analytics';
  setActiveTab: (tab: 'leads' | 'settings' | 'analytics') => void;
  activeClientCode: string;
  activeCampaignCode: string;
  campaignName: string;
  campaignsCount?: number;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  activeClientCode,
  activeCampaignCode,
  campaignName,
  campaignsCount = 3,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-cyan-500/30 ring-1 ring-white/20">
              DA
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-black bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                  DemandFlow Arm
                </span>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-cyan-950 text-cyan-400 border border-cyan-800/60 rounded-full tracking-wider uppercase">
                  CRM API 2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Client Code Filtering & AI Transcript Engine
              </p>
            </div>
          </div>

          {/* Center: Active Configuration Badges */}
          <div className="hidden lg:flex items-center space-x-3 bg-slate-950/80 border border-slate-800 px-3.5 py-1.5 rounded-2xl text-xs shadow-inner">
            <div className="flex items-center space-x-1.5 text-slate-300">
              <span className="text-slate-500 font-semibold">Client Code:</span>
              <span className="font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-lg border border-cyan-800/40">
                {activeClientCode || '1010'}
              </span>
            </div>
            <span className="text-slate-800">|</span>
            <div className="flex items-center space-x-1.5 text-slate-300">
              <span className="text-slate-500 font-semibold">Campaign:</span>
              <span className="font-semibold text-slate-100 truncate max-w-[180px]" title={activeCampaignCode}>
                {campaignName || activeCampaignCode}
              </span>
            </div>
            <span className="text-slate-800">|</span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800 rounded-lg">
              {campaignsCount} Client Codes Configured
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 shadow-inner">
            <button
              onClick={() => setActiveTab('leads')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'leads'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>📊 All Leads</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>⚙️ Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
