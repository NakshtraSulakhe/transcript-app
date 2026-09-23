'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Navbar from '@/app/components/Navbar';
import LeadsView from '@/app/components/LeadsView';
import SettingsView from '@/app/components/SettingsView';
import AnalyticsView from '@/app/components/AnalyticsView';
import { StoredSettings } from '@/lib/db';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'leads' | 'settings' | 'analytics'>('leads');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [settings, setSettings] = useState<StoredSettings | null>(null);

  const loadBackendSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to load settings in main page:', err);
    }
  };

  useEffect(() => {
    loadBackendSettings();
  }, []);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950 overflow-hidden">
      {/* Collapsible SaaS Dashboard Sidebar with Independent Scroll */}
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeClientCode={settings?.activeClientCode || '1010'}
        activeCampaignCode={settings?.activeCampaignCode || 'HRIS CS - 1010'}
        campaignsCount={settings?.campaigns?.length || 3}
      />

      {/* Independent Main Content Area with Independent Scroll Container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar
          activeTab={activeTab === 'analytics' ? 'leads' : activeTab}
          setActiveTab={(tab) => setActiveTab(tab)}
          activeClientCode={settings?.activeClientCode || '1010'}
          activeCampaignCode={settings?.activeCampaignCode || 'HRIS CS - 1010'}
          campaignName={settings?.activeCampaignCode || 'Structured HRIS Solution'}
          campaignsCount={settings?.campaigns?.length || 3}
        />

        {/* Independent Main Canvas Scroll Container */}
        <main className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'leads' && (
            <LeadsView
              activeClientCode={settings?.activeClientCode}
              activeCampaignCode={settings?.activeCampaignCode}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              onSettingsSaved={() => {
                loadBackendSettings();
              }}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsView />}
        </main>
      </div>
    </div>
  );
}