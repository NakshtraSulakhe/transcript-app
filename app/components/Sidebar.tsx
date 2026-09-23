'use client';

import React from 'react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  activeTab: 'leads' | 'settings' | 'analytics';
  setActiveTab: (tab: 'leads' | 'settings' | 'analytics') => void;
  activeClientCode: string;
  activeCampaignCode: string;
  campaignsCount: number;
}

export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  activeTab,
  setActiveTab,
  activeClientCode,
  activeCampaignCode,
  campaignsCount,
}: SidebarProps) {
  return (
    <aside
      className={`h-screen sticky top-0 z-50 bg-slate-900/95 border-r border-slate-800/90 flex flex-col justify-between transition-all duration-300 ease-in-out backdrop-blur-xl ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Top Branding & Collapse Toggle */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-cyan-500/30 ring-1 ring-white/20">
              DA
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="text-base font-black bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-transparent tracking-tight truncate">
                  DemandFlow Arm
                </h1>
                <p className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">
                  CRM Engine 2.0
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(prev => !prev)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700/60 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Independent Scrollable Navigation Area inside Sidebar */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          <div>
            {!isCollapsed && (
              <span className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                MODULES
              </span>
            )}
            <nav className="space-y-1.5">
              <button
                onClick={() => setActiveTab('leads')}
                title="All Leads Table"
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
                  activeTab === 'leads'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  {!isCollapsed && <span className="truncate">All Leads CRM</span>}
                </div>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                title="Client Settings"
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
                  activeTab === 'settings'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  {!isCollapsed && <span className="truncate">Client Settings</span>}
                </div>
                {!isCollapsed && (
                  <span className="px-2 py-0.5 text-[10px] font-black bg-cyan-950 text-cyan-400 rounded-full border border-cyan-800/60">
                    {campaignsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                title="QA Analytics"
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
                  activeTab === 'analytics'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {!isCollapsed && <span className="truncate">QA Analytics</span>}
                </div>
              </button>
            </nav>
          </div>

          {!isCollapsed && (
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-inner">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                ACTIVE SETTING
              </span>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Client Code:</span>
                  <span className="font-mono font-bold text-cyan-400">{activeClientCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Campaign:</span>
                  <span className="font-semibold text-slate-200 truncate max-w-[110px]" title={activeCampaignCode}>
                    {activeCampaignCode}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Profile */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-cyan-600/30 text-cyan-300 font-black text-xs flex items-center justify-center border border-cyan-500/40 flex-shrink-0">
            DA
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <h4 className="text-xs font-bold text-slate-200 truncate">DemandFlow Arm Admin</h4>
              <p className="text-[10px] text-slate-400 truncate">CRM API System</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
