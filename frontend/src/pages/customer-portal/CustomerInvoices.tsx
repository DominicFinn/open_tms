import React, { useEffect, useState } from 'react';
import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';

interface Invoice {
  id: string; invoiceNumber: string; customerName: string;
  totalCents: number; paidCents: number; balanceCents: number;
  status: string; daysPastDue: number; dueDate: string;
  issueDate: string; createdAt: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusChip(s: string): string {
  const m: Record<string, string> = { draft: 'secondary', sent: 'info', partial_paid: 'warning', overdue: 'error', paid: 'success', voided: 'secondary' };
  return m[s] || 'secondary';
}

export default function CustomerInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputeModal, setDisputeModal] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);

  const load = () => {
    setLoading(true);
    customerFetch(`${API_URL}/api/v1/customer-portal/invoices`)
      .then(r => r.json())
      .then(json => setInvoices(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDispute = async () => {
    if (!disputeModal || !disputeReason.trim()) return;
    setDisputing(true);
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/invoices/${disputeModal}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason: disputeReason }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      alert(`Dispute submitted: ${json.data.queryNumber}`);
      setDisputeModal(null);
      setDisputeReason('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDisputing(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Invoices</h1>
      <div className="vn-card">
        <div className="vn-table-wrap">
          {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" /></div> : (
            <table className="vn-table">
              <thead><tr><th>Invoice</th><th>Issue Date</th><th>Due Date</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Paid</th><th style={{ textAlign: 'right' }}>Balance</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><span className="vn-table-id">{inv.invoiceNumber}</span></td>
                    <td style={{ fontSize: 13 }}>{new Date(inv.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={{ fontSize: 13, color: inv.daysPastDue > 0 ? 'var(--color-error)' : undefined }}>{new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{inv.daysPastDue > 0 ? ` (${inv.daysPastDue}d overdue)` : ''}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>{formatCents(inv.totalCents)}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>{formatCents(inv.paidCents)}</td>
                    <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{formatCents(inv.balanceCents)}</td>
                    <td><span className={`vn-chip vn-chip-${statusChip(inv.status)}`}>{inv.status}</span></td>
                    <td>
                      {['sent', 'overdue'].includes(inv.status) && (
                        <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => { setDisputeModal(inv.id); setDisputeReason(''); }}>
                          Dispute
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>No invoices</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {disputeModal && (
        <div className="vn-modal-backdrop" onClick={() => setDisputeModal(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="vn-modal-header">
              <h3>Dispute Invoice</h3>
              <button className="vn-btn-icon" onClick={() => setDisputeModal(null)}><span className="material-icons">close</span></button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-field">
                <label className="vn-field-label">Reason for dispute</label>
                <textarea className="vn-input" rows={4} value={disputeReason} onChange={e => setDisputeReason(e.target.value)} placeholder="Describe the issue with this invoice..." />
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setDisputeModal(null)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={handleDispute} disabled={disputing || !disputeReason.trim()}>
                {disputing ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
