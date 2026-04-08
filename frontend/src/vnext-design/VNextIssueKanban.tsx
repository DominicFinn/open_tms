import React, { useState } from 'react';

interface Issue {
  id: string;
  title: string;
  shipment: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  assignee: string;
  initials: string;
  created: string;
  column: 'new' | 'investigating' | 'escalated' | 'resolved';
}

const ISSUES: Issue[] = [
  { id: 'ISS-301', title: 'Delayed pickup — warehouse closed early', shipment: 'SHP-4821', severity: 'high', category: 'Pickup Delay', assignee: 'Jane S.', initials: 'JS', created: '2h ago', column: 'new' },
  { id: 'ISS-300', title: 'Missing BOL for Dallas delivery', shipment: 'SHP-4815', severity: 'medium', category: 'Documentation', assignee: 'Tom K.', initials: 'TK', created: '4h ago', column: 'new' },
  { id: 'ISS-299', title: 'Temperature excursion — reefer unit alarm', shipment: 'SHP-4808', severity: 'high', category: 'Equipment', assignee: 'Sarah L.', initials: 'SL', created: '6h ago', column: 'investigating' },
  { id: 'ISS-298', title: 'Carrier unresponsive — no ETA update in 8 hrs', shipment: 'SHP-4812', severity: 'high', category: 'Communication', assignee: 'Jane S.', initials: 'JS', created: '8h ago', column: 'investigating' },
  { id: 'ISS-297', title: 'Overweight load — scale ticket shows 44,200 lbs', shipment: 'SHP-4810', severity: 'medium', category: 'Compliance', assignee: 'Tom K.', initials: 'TK', created: '1d ago', column: 'escalated' },
  { id: 'ISS-296', title: 'Customer refused delivery — wrong product', shipment: 'SHP-4805', severity: 'high', category: 'Delivery', assignee: 'Sarah L.', initials: 'SL', created: '1d ago', column: 'escalated' },
  { id: 'ISS-295', title: 'Detention charges — waited 4 hrs at dock', shipment: 'SHP-4801', severity: 'low', category: 'Billing', assignee: 'Jane S.', initials: 'JS', created: '2d ago', column: 'resolved' },
  { id: 'ISS-294', title: 'Late delivery — traffic delay on I-35', shipment: 'SHP-4798', severity: 'low', category: 'Delivery Delay', assignee: 'Tom K.', initials: 'TK', created: '2d ago', column: 'resolved' },
  { id: 'ISS-293', title: 'Damaged freight — 2 pallets compromised', shipment: 'SHP-4795', severity: 'medium', category: 'Freight Damage', assignee: 'Sarah L.', initials: 'SL', created: '3d ago', column: 'resolved' },
];

const COLUMNS: { key: Issue['column']; label: string; cssClass: string }[] = [
  { key: 'new', label: 'New', cssClass: 'col-new' },
  { key: 'investigating', label: 'Investigating', cssClass: 'col-investigating' },
  { key: 'escalated', label: 'Escalated', cssClass: 'col-escalated' },
  { key: 'resolved', label: 'Resolved', cssClass: 'col-resolved' },
];

function SeverityChip({ severity }: { severity: Issue['severity'] }) {
  const map = { high: 'error', medium: 'warning', low: 'secondary' } as const;
  return <span className={`vn-chip vn-chip-${map[severity]}`} style={{ textTransform: 'capitalize' }}>{severity}</span>;
}

export default function VNextIssueKanban() {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const filtered = ISSUES.filter(issue => {
    if (filterSeverity === 'all') return true;
    return issue.severity === filterSeverity;
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Issues</h1>
          <p>{ISSUES.filter(i => i.column !== 'resolved').length} open issues across {new Set(ISSUES.map(i => i.shipment)).size} shipments</p>
        </div>
        <div className="vn-page-actions">
          <div style={{ display: 'flex', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'kanban' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('kanban')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>view_kanban</span>
            </button>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'list' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('list')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
          </div>
          <select className="vn-filter-select" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            Report Issue
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">fiber_new</span></div>
          <div>
            <div className="vn-stat-value">{ISSUES.filter(i => i.column === 'new').length}</div>
            <div className="vn-stat-label">New</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">search</span></div>
          <div>
            <div className="vn-stat-value">{ISSUES.filter(i => i.column === 'investigating').length}</div>
            <div className="vn-stat-label">Investigating</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">priority_high</span></div>
          <div>
            <div className="vn-stat-value">{ISSUES.filter(i => i.column === 'escalated').length}</div>
            <div className="vn-stat-label">Escalated</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{ISSUES.filter(i => i.column === 'resolved').length}</div>
            <div className="vn-stat-label">Resolved</div>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="vn-kanban">
          {COLUMNS.map(col => {
            const colIssues = filtered.filter(i => i.column === col.key);
            return (
              <div key={col.key} className={`vn-kanban-col ${col.cssClass}`}>
                <div className="vn-kanban-col-header">
                  <span>{col.label}</span>
                  <span className="vn-count">{colIssues.length}</span>
                </div>
                <div className="vn-kanban-cards">
                  {colIssues.map(issue => (
                    <div className="vn-kanban-card" key={issue.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)' }}>{issue.id}</span>
                        <SeverityChip severity={issue.severity} />
                      </div>
                      <div className="vn-kanban-card-title">{issue.title}</div>
                      <div className="vn-kanban-card-meta">
                        <span className="material-icons">local_shipping</span>
                        {issue.shipment}
                      </div>
                      <div className="vn-kanban-card-meta">
                        <span className="material-icons">category</span>
                        {issue.category}
                      </div>
                      <div className="vn-kanban-card-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="vn-kanban-card-assignee">{issue.initials}</div>
                          <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{issue.assignee}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{issue.created}</span>
                      </div>
                    </div>
                  ))}
                  {colIssues.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--on-surface-variant)', fontSize: 13 }}>
                      No issues
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="vn-card">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Issue</th>
                  <th>Shipment</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(issue => (
                  <tr key={issue.id}>
                    <td><span className="vn-table-id">{issue.id}</span></td>
                    <td style={{ maxWidth: 280 }}>{issue.title}</td>
                    <td><span className="vn-table-id">{issue.shipment}</span></td>
                    <td>{issue.category}</td>
                    <td><SeverityChip severity={issue.severity} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="vn-kanban-card-assignee">{issue.initials}</div>
                        {issue.assignee}
                      </div>
                    </td>
                    <td>
                      <span className={`vn-chip vn-chip-${issue.column === 'new' ? 'info' : issue.column === 'investigating' ? 'warning' : issue.column === 'escalated' ? 'error' : 'success'}`} style={{ textTransform: 'capitalize' }}>
                        {issue.column}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{issue.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
