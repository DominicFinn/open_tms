import React, { useState } from 'react';
import {
  VnButton, VnCard, VnChip, VnStatCard, VnDataTable, VnFilterBar, VnTabs, VnTimeline,
  VnKanban, VnDetailLayout, VnProgressBar, VnModal, VnAlert, VnPageHeader, VnInfoGrid,
  VnField, VnInput, VnSelect, VnTextarea, VnFormGrid, VnFormSection, VnFormActions,
} from './components';

/* ── Code Block helper ───────────────────────────────────── */
function Code({ children }: { children: string }) {
  return (
    <pre style={{
      background: 'var(--surface-container)',
      padding: '16px',
      borderRadius: '8px',
      fontSize: '13px',
      overflow: 'auto',
      margin: '12px 0 0',
      border: '1px solid var(--outline-variant)',
      whiteSpace: 'pre-wrap',
    }}>
      {children.trim()}
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: '48px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--outline-variant)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

/* ── Table of Contents ───────────────────────────────────── */
const sections = [
  { id: 'typography', label: 'Typography' },
  { id: 'colors', label: 'Colors' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'cards', label: 'Cards' },
  { id: 'chips', label: 'Chips' },
  { id: 'stats', label: 'Stat Cards' },
  { id: 'tables', label: 'Data Tables' },
  { id: 'filters', label: 'Filter Bar' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'forms', label: 'Forms' },
  { id: 'modals', label: 'Modals' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'progress', label: 'Progress Bars' },
  { id: 'routes', label: 'Route Indicators' },
  { id: 'info-grid', label: 'Info Grid' },
  { id: 'detail-layout', label: 'Detail Layout' },
  { id: 'empty', label: 'Empty States' },
  { id: 'page-header', label: 'Page Header' },
];

export default function VNextStyleGuide() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState<'sm' | 'default' | 'lg'>('default');
  const [activeTab, setActiveTab] = useState('events');
  const [search, setSearch] = useState('');
  const [alertDismissed, setAlertDismissed] = useState<Record<string, boolean>>({});
  const [checkboxVal, setCheckboxVal] = useState(true);
  const [radioVal, setRadioVal] = useState('ltl');
  const [switchVal, setSwitchVal] = useState(false);
  const [formError, setFormError] = useState(true);

  return (
    <div style={{ display: 'flex', gap: '32px' }}>
      {/* Sidebar TOC */}
      <nav style={{
        position: 'sticky', top: '80px', alignSelf: 'flex-start',
        minWidth: '180px', maxHeight: 'calc(100vh - 100px)', overflow: 'auto',
        fontSize: '13px', lineHeight: '2',
      }}>
        {sections.map(s => (
          <a key={s.id} href={`#${s.id}`} style={{ display: 'block', color: 'var(--on-surface-variant)', textDecoration: 'none' }}>
            {s.label}
          </a>
        ))}
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, maxWidth: '960px' }}>
        <VnPageHeader title="VNext Style Guide" subtitle="Complete component reference for the VNext design system" />

        {/* ── Typography ─────────────────────────────────── */}
        <Section id="typography" title="Typography">
          <div className="vn-card"><div className="vn-card-body">
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', margin: '0 0 8px' }}>Page Heading (28px/700)</h1>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>Card Heading (16px/600)</h2>
            <p style={{ fontSize: '14px', margin: '0 0 8px' }}>Body text (14px/400) — The quick brown fox jumps over the lazy dog.</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--on-surface-variant)', margin: '0 0 8px' }}>Small label (13px/500)</p>
            <p style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--on-surface-variant)', margin: 0 }}>TINY LABEL (12px/600/uppercase)</p>
          </div></div>
        </Section>

        {/* ── Colors ─────────────────────────────────────── */}
        <Section id="colors" title="Colors">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {[
              { name: '--primary', label: 'Primary' },
              { name: '--success', label: 'Success' },
              { name: '--warning', label: 'Warning' },
              { name: '--error', label: 'Error' },
              { name: '--info', label: 'Info' },
              { name: '--secondary', label: 'Secondary' },
              { name: '--on-surface', label: 'On Surface' },
              { name: '--on-surface-variant', label: 'On Surface Variant' },
              { name: '--outline-variant', label: 'Outline' },
              { name: '--surface-container-lowest', label: 'Surface Lowest' },
              { name: '--surface-container', label: 'Surface' },
              { name: '--surface-container-high', label: 'Surface High' },
            ].map(c => (
              <div key={c.name} style={{ textAlign: 'center' }}>
                <div style={{ width: '100%', height: '48px', borderRadius: '8px', background: `var(${c.name})`, border: '1px solid var(--outline-variant)' }} />
                <div style={{ fontSize: '11px', marginTop: '6px', color: 'var(--on-surface-variant)' }}>{c.label}</div>
                <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--on-surface-variant)' }}>{c.name}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Buttons ────────────────────────────────────── */}
        <Section id="buttons" title="Buttons">
          <div className="vn-card"><div className="vn-card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <VnButton variant="primary">Primary</VnButton>
            <VnButton variant="outline">Outline</VnButton>
            <VnButton variant="ghost">Ghost</VnButton>
            <VnButton variant="success">Success</VnButton>
            <VnButton variant="danger">Danger</VnButton>
            <VnButton variant="outline" size="sm">Small</VnButton>
            <VnButton variant="primary" icon="add">With Icon</VnButton>
            <VnButton iconOnly icon="edit" />
            <VnButton variant="primary" disabled>Disabled</VnButton>
          </div></div>
          <Code>{`<VnButton variant="primary">Primary</VnButton>
<VnButton variant="outline" size="sm">Small</VnButton>
<VnButton variant="primary" icon="add">With Icon</VnButton>
<VnButton iconOnly icon="edit" />`}</Code>
        </Section>

        {/* ── Cards ──────────────────────────────────────── */}
        <Section id="cards" title="Cards">
          <div style={{ display: 'grid', gap: '16px' }}>
            <VnCard title="Card with Header" headerAction={<VnButton variant="outline" size="sm">Action</VnButton>}>
              Card body content with 20px padding.
            </VnCard>
            <VnCard>Simple card with no header.</VnCard>
            <VnCard title="Flush Card (no body padding)" flush>
              <div style={{ padding: '20px', background: 'var(--surface-container)' }}>Flush content fills edge to edge — useful for tables.</div>
            </VnCard>
          </div>
          <Code>{`<VnCard title="Title" headerAction={<VnButton variant="outline" size="sm">Action</VnButton>}>
  Content
</VnCard>`}</Code>
        </Section>

        {/* ── Chips ──────────────────────────────────────── */}
        <Section id="chips" title="Chips">
          <div className="vn-card"><div className="vn-card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <VnChip variant="success">Delivered</VnChip>
            <VnChip variant="warning">In Transit</VnChip>
            <VnChip variant="error">Exception</VnChip>
            <VnChip variant="info">Pending</VnChip>
            <VnChip variant="primary">Active</VnChip>
            <VnChip variant="secondary">FTL</VnChip>
            <VnChip variant="success" icon="check">With Icon</VnChip>
          </div></div>
          <Code>{`<VnChip variant="success">Delivered</VnChip>
<VnChip variant="error" icon="warning">With Icon</VnChip>`}</Code>
        </Section>

        {/* ── Stat Cards ────────────────────────────────── */}
        <Section id="stats" title="Stat Cards">
          <div className="vn-stats">
            <VnStatCard icon="local_shipping" iconVariant="primary" value="1,247" label="Total Shipments" change={{ direction: 'up', text: '12%' }} />
            <VnStatCard icon="check_circle" iconVariant="success" value="89.2%" label="On Time" />
            <VnStatCard icon="warning" iconVariant="warning" value="23" label="Issues" change={{ direction: 'down', text: '5%' }} />
            <VnStatCard icon="error" iconVariant="error" value="4" label="Exceptions" />
            <VnStatCard icon="schedule" iconVariant="info" value="156" label="In Transit" />
          </div>
          <Code>{`<VnStatCard icon="local_shipping" iconVariant="primary" value="1,247" label="Total Shipments" change={{ direction: 'up', text: '12%' }} />`}</Code>
        </Section>

        {/* ── Data Tables ───────────────────────────────── */}
        <Section id="tables" title="Data Tables">
          <VnCard title="Shipments" flush>
            <VnDataTable
              columns={[
                { key: 'id', label: 'ID', render: (r) => <span className="vn-table-id">{r.id as string}</span> },
                { key: 'origin', label: 'Origin' },
                { key: 'status', label: 'Status', render: (r) => <VnChip variant={r.chipVariant as 'success'}>{r.status as string}</VnChip> },
              ]}
              data={[
                { id: 'SHP-001', origin: 'Chicago, IL', status: 'Delivered', chipVariant: 'success' },
                { id: 'SHP-002', origin: 'Dallas, TX', status: 'In Transit', chipVariant: 'warning' },
                { id: 'SHP-003', origin: 'New York, NY', status: 'Exception', chipVariant: 'error' },
              ]}
            />
          </VnCard>
          <h3 style={{ margin: '16px 0 8px', fontSize: '14px', fontWeight: 600 }}>Empty State</h3>
          <VnCard flush>
            <VnDataTable columns={[]} data={[]} emptyIcon="search_off" emptyTitle="No results" emptyMessage="Try adjusting your filters" />
          </VnCard>
        </Section>

        {/* ── Filter Bar ────────────────────────────────── */}
        <Section id="filters" title="Filter Bar">
          <VnCard flush>
            <VnFilterBar searchPlaceholder="Search shipments..." searchValue={search} onSearchChange={setSearch}>
              <select className="vn-filter-select">
                <option>All Status</option><option>Active</option><option>Archived</option>
              </select>
              <select className="vn-filter-select">
                <option>All Modes</option><option>FTL</option><option>LTL</option>
              </select>
              <div style={{ marginLeft: 'auto' }}>
                <VnButton iconOnly icon="view_list" />
                <VnButton iconOnly icon="map" />
              </div>
            </VnFilterBar>
          </VnCard>
          <Code>{`<VnFilterBar searchValue={search} onSearchChange={setSearch}>
  <select className="vn-filter-select">...</select>
</VnFilterBar>`}</Code>
        </Section>

        {/* ── Tabs ───────────────────────────────────────── */}
        <Section id="tabs" title="Tabs">
          <VnCard flush>
            <VnTabs
              tabs={[
                { key: 'events', label: 'Events', icon: 'timeline' },
                { key: 'docs', label: 'Documents', icon: 'folder', count: 3 },
                { key: 'financials', label: 'Financials', icon: 'payments' },
                { key: 'notes', label: 'Notes', icon: 'sticky_note_2' },
              ]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <div style={{ padding: '20px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
              Active tab: <strong>{activeTab}</strong>
            </div>
          </VnCard>
        </Section>

        {/* ── Forms ──────────────────────────────────────── */}
        <Section id="forms" title="Forms">
          <VnCard title="Form Example">
            <VnFormSection title="Company Information" icon="business">
              <VnFormGrid>
                <VnField label="Company Name" required>
                  <VnInput placeholder="Enter company name" />
                </VnField>
                <VnField label="Email" error={formError ? 'Please enter a valid email' : undefined}>
                  <VnInput type="email" placeholder="contact@example.com" value="invalid" onChange={() => {}} />
                </VnField>
                <VnField label="Address" className="vn-col-span-2">
                  <VnInput placeholder="Street address" />
                </VnField>
                <VnField label="Country">
                  <VnSelect>
                    <option value="">Select...</option>
                    <option>United States</option>
                    <option>United Kingdom</option>
                    <option>Canada</option>
                  </VnSelect>
                </VnField>
                <VnField label="Notes">
                  <VnTextarea rows={3} placeholder="Additional notes..." />
                </VnField>
              </VnFormGrid>
            </VnFormSection>

            <VnFormSection title="Preferences" icon="tune">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className="vn-checkbox">
                  <input type="checkbox" checked={checkboxVal} onChange={e => setCheckboxVal(e.target.checked)} />
                  Requires hazmat certification
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label className="vn-radio">
                    <input type="radio" name="sg-mode" value="ftl" checked={radioVal === 'ftl'} onChange={() => setRadioVal('ftl')} /> FTL
                  </label>
                  <label className="vn-radio">
                    <input type="radio" name="sg-mode" value="ltl" checked={radioVal === 'ltl'} onChange={() => setRadioVal('ltl')} /> LTL
                  </label>
                </div>
                <label className="vn-switch">
                  <input type="checkbox" checked={switchVal} onChange={e => setSwitchVal(e.target.checked)} />
                  <span className="vn-switch-track" />
                  Enable notifications
                </label>
              </div>
            </VnFormSection>

            <VnFormActions>
              <VnButton variant="outline">Cancel</VnButton>
              <VnButton variant="primary" icon="save">Save</VnButton>
            </VnFormActions>
          </VnCard>
          <div style={{ marginTop: '8px' }}>
            <VnButton variant="ghost" size="sm" onClick={() => setFormError(!formError)}>
              Toggle error state
            </VnButton>
          </div>
        </Section>

        {/* ── Modals ─────────────────────────────────────── */}
        <Section id="modals" title="Modals">
          <div className="vn-card"><div className="vn-card-body" style={{ display: 'flex', gap: '12px' }}>
            {(['sm', 'default', 'lg'] as const).map(size => (
              <VnButton key={size} variant="outline" onClick={() => { setModalSize(size); setModalOpen(true); }}>
                Open {size} modal
              </VnButton>
            ))}
          </div></div>
          <VnModal open={modalOpen} onClose={() => setModalOpen(false)} title={`Modal (${modalSize})`} size={modalSize}
            footer={<>
              <VnButton variant="outline" onClick={() => setModalOpen(false)}>Cancel</VnButton>
              <VnButton variant="primary" onClick={() => setModalOpen(false)}>Confirm</VnButton>
            </>}>
            <p>This is a {modalSize} modal. Click backdrop or press Escape to close.</p>
            <VnField label="Example Field">
              <VnInput placeholder="You can put forms in modals" />
            </VnField>
          </VnModal>
        </Section>

        {/* ── Alerts ─────────────────────────────────────── */}
        <Section id="alerts" title="Alerts">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!alertDismissed.success && <VnAlert variant="success" onClose={() => setAlertDismissed(p => ({ ...p, success: true }))}>Shipment created successfully.</VnAlert>}
            {!alertDismissed.error && <VnAlert variant="error" onClose={() => setAlertDismissed(p => ({ ...p, error: true }))}>Failed to save changes. Please try again.</VnAlert>}
            {!alertDismissed.warning && <VnAlert variant="warning" onClose={() => setAlertDismissed(p => ({ ...p, warning: true }))}>This carrier's insurance expires in 7 days.</VnAlert>}
            {!alertDismissed.info && <VnAlert variant="info" onClose={() => setAlertDismissed(p => ({ ...p, info: true }))}>New version available. Refresh to update.</VnAlert>}
          </div>
          {Object.keys(alertDismissed).length > 0 && (
            <VnButton variant="ghost" size="sm" onClick={() => setAlertDismissed({})} style={{ marginTop: '8px' }}>
              Reset alerts
            </VnButton>
          )}
        </Section>

        {/* ── Timeline ───────────────────────────────────── */}
        <Section id="timeline" title="Timeline">
          <VnCard title="Shipment Events">
            <VnTimeline events={[
              { time: '10:30 AM', title: 'Delivered', desc: 'Signed by J. Smith', location: 'Chicago, IL', dot: 'success' },
              { time: '08:15 AM', title: 'Out for Delivery', dot: 'info' },
              { time: '06:00 AM', title: 'Arrived at Hub', location: 'Chicago Distribution Center', dot: 'primary' },
              { time: 'Yesterday', title: 'Weather Delay', desc: 'Heavy snow on I-90', dot: 'warning' },
              { time: '2 days ago', title: 'Departed Origin', location: 'Dallas, TX', dot: 'primary' },
            ]} />
          </VnCard>
        </Section>

        {/* ── Kanban ─────────────────────────────────────── */}
        <Section id="kanban" title="Kanban">
          <VnKanban
            columns={[
              { key: 'new', label: 'New', cssClass: 'col-new', items: [
                { title: 'Late pickup SHP-042', severity: 'error', time: '2h ago', assignee: 'JS' },
                { title: 'Missing docs SHP-055', severity: 'warning', time: '4h ago', assignee: 'MK' },
              ]},
              { key: 'investigating', label: 'Investigating', cssClass: 'col-investigating', items: [
                { title: 'Wrong address SHP-038', severity: 'error', time: '1d ago', assignee: 'TL' },
              ]},
              { key: 'escalated', label: 'Escalated', cssClass: 'col-escalated', items: [] },
              { key: 'resolved', label: 'Resolved', cssClass: 'col-resolved', items: [
                { title: 'Rate dispute SHP-021', severity: 'info', time: '3d ago', assignee: 'JS' },
              ]},
            ]}
            renderCard={(item: { title: string; severity: string; time: string; assignee: string }) => (
              <div className="vn-kanban-card">
                <div className="vn-kanban-card-title">{item.title}</div>
                <div className="vn-kanban-card-meta">
                  <VnChip variant={item.severity as 'error'}>{item.severity}</VnChip>
                </div>
                <div className="vn-kanban-card-footer">
                  <span>{item.time}</span>
                  <div className="vn-kanban-card-assignee">{item.assignee}</div>
                </div>
              </div>
            )}
          />
        </Section>

        {/* ── Progress ───────────────────────────────────── */}
        <Section id="progress" title="Progress Bars">
          <VnCard>
            <div style={{ display: 'grid', gap: '16px' }}>
              {(['success', 'warning', 'error', 'info', 'primary'] as const).map(v => (
                <div key={v}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span>{v}</span>
                    <span>{v === 'success' ? '92%' : v === 'warning' ? '65%' : v === 'error' ? '23%' : v === 'info' ? '78%' : '50%'}</span>
                  </div>
                  <VnProgressBar variant={v} value={v === 'success' ? 92 : v === 'warning' ? 65 : v === 'error' ? 23 : v === 'info' ? 78 : 50} />
                </div>
              ))}
            </div>
          </VnCard>
        </Section>

        {/* ── Route Indicators ───────────────────────────── */}
        <Section id="routes" title="Route Indicators">
          <VnCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
              <span className="vn-route-dot origin" />
              <span style={{ fontSize: '13px' }}>Chicago, IL</span>
              <span className="vn-route-line active" style={{ flex: 1 }} />
              <span className="vn-route-dot stop" />
              <span style={{ fontSize: '13px' }}>St Louis, MO</span>
              <span className="vn-route-line" style={{ flex: 1 }} />
              <span className="vn-route-dot destination" />
              <span style={{ fontSize: '13px' }}>Dallas, TX</span>
            </div>
          </VnCard>
          <Code>{`<span class="vn-route-dot origin" />
<span class="vn-route-line active" />
<span class="vn-route-dot stop" />
<span class="vn-route-line" />
<span class="vn-route-dot destination" />`}</Code>
        </Section>

        {/* ── Info Grid ──────────────────────────────────── */}
        <Section id="info-grid" title="Info Grid">
          <VnCard title="Shipment Details">
            <VnInfoGrid items={[
              { label: 'Reference', value: 'SHP-2024-0042' },
              { label: 'Customer', value: 'Acme Corp' },
              { label: 'Weight', value: '2,400 kg' },
              { label: 'Mode', value: <VnChip variant="secondary">FTL</VnChip> },
              { label: 'Pickup', value: 'Mar 15, 2024' },
              { label: 'Delivery', value: 'Mar 18, 2024' },
            ]} />
          </VnCard>
        </Section>

        {/* ── Detail Layout ──────────────────────────────── */}
        <Section id="detail-layout" title="Detail Layout">
          <VnDetailLayout
            main={
              <VnCard title="Main Content Area">
                <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}>
                  This is the main content column (flexible width). Used for events, tables, charts, etc.
                </p>
              </VnCard>
            }
            sidebar={
              <VnCard title="Sidebar">
                <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}>
                  Sticky sidebar (380px). Used for key details, origin/destination, quick actions.
                </p>
              </VnCard>
            }
          />
        </Section>

        {/* ── Empty States ───────────────────────────────── */}
        <Section id="empty" title="Empty States">
          <VnCard flush>
            <div className="vn-empty">
              <span className="material-icons">inbox</span>
              <h3>No shipments found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          </VnCard>
        </Section>

        {/* ── Page Header ────────────────────────────────── */}
        <Section id="page-header" title="Page Header">
          <div className="vn-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px', background: 'var(--surface-container)' }}>
              <VnPageHeader title="Shipments" subtitle="Manage all shipments">
                <VnButton variant="outline" icon="download">Export</VnButton>
                <VnButton variant="primary" icon="add">New Shipment</VnButton>
              </VnPageHeader>
            </div>
          </div>
          <Code>{`<VnPageHeader title="Shipments" subtitle="Manage all shipments">
  <VnButton variant="outline" icon="download">Export</VnButton>
  <VnButton variant="primary" icon="add">New Shipment</VnButton>
</VnPageHeader>`}</Code>
        </Section>
      </div>
    </div>
  );
}
