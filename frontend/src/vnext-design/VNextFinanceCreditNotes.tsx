import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  noteType: string;
  invoiceId: string | null;
  customerId: string | null;
  carrierId: string | null;
  amountCents: number;
  currency: string;
  reason: string;
  description: string;
  queryId: string | null;
  status: string;
  createdAt: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusChip(status: string): string {
  switch (status) {
    case 'draft': return 'secondary';
    case 'approved': return 'info';
    case 'applied': return 'success';
    default: return 'secondary';
  }
}

export default function VNextFinanceCreditNotes() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/credit-notes`)
      .then(r => r.json())
      .then(j => setNotes(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: notes.length,
    credits: notes.filter(n => n.noteType === 'credit').length,
    debits: notes.filter(n => n.noteType === 'debit').length,
    totalAmount: notes.reduce((s, n) => s + n.amountCents, 0),
  };

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Credit & Debit Notes</h1>
          <p>{notes.length} notes</p>
        </div>
      </div>

      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">note</span></div>
          <div><div className="vn-stat-value">{stats.total}</div><div className="vn-stat-label">Total</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">remove_circle_outline</span></div>
          <div><div className="vn-stat-value">{stats.credits}</div><div className="vn-stat-label">Credits</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">add_circle_outline</span></div>
          <div><div className="vn-stat-value">{stats.debits}</div><div className="vn-stat-label">Debits</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">attach_money</span></div>
          <div><div className="vn-stat-value">{formatMoney(stats.totalAmount)}</div><div className="vn-stat-label">Total Value</div></div>
        </div>
      </div>

      <div className="vn-card">
        {notes.length === 0 ? (
          <div className="vn-empty"><span className="material-icons">note</span><h3>No credit or debit notes yet</h3><p>Notes are generated when financial queries are resolved with adjustments</p></div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Note #</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Description</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {notes.map(n => (
                  <tr key={n.id}>
                    <td><span className="vn-table-id">{n.creditNoteNumber}</span></td>
                    <td><span className={`vn-chip vn-chip-${n.noteType === 'credit' ? 'success' : 'warning'}`}>{n.noteType}</span></td>
                    <td><span className={`vn-chip vn-chip-${statusChip(n.status)}`}>{n.status}</span></td>
                    <td>{n.reason}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatMoney(n.amountCents)}</td>
                    <td className="vn-table-secondary" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.description}</td>
                    <td className="vn-table-secondary">{new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
