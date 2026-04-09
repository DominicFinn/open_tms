import React from 'react';

interface Tab {
  key: string;
  label: string;
  count?: number;
  icon?: string;
}

interface VnTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function VnTabs({ tabs, activeTab, onTabChange }: VnTabsProps) {
  return (
    <div className="vn-tabs">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`vn-tab ${activeTab === tab.key ? 'active' : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.icon && <span className="material-icons" style={{ fontSize: '18px' }}>{tab.icon}</span>}
          {tab.label}
          {tab.count != null && <span className="vn-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
