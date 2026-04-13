import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../api';

interface EdiLog {
  id: string;
  transactionType: string;
  direction: string;
  status: string;
  fileName?: string;
  fileContent?: string;
  fileSize?: number;
  source?: string;
  transport?: string;
  shipmentReference?: string;
  shipmentId?: string;
  orderId?: string;
  tenderId?: string;
  invoiceNumber?: string;
  invoiceId?: string;
  errorMessage?: string;
  entitiesCreated?: number;
  entityIds?: string[];
  ack997Sent?: boolean;
  ack997Received?: boolean;
  retryCount?: number;
  parsedData?: any;
  partner?: { id: string; name: string } | null;
  createdAt: string;
  processedAt?: string;
}

const STATUS_CHIP: Record<string, string> = {
  success: 'vn-chip vn-chip-success',
  error: 'vn-chip vn-chip-error',
  pending: 'vn-chip vn-chip-warning',
  processing: 'vn-chip vn-chip-info',
  duplicate: 'vn-chip vn-chip-secondary',
};

const DIRECTION_LABEL: Record<string, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
};

export default function VNextEdiTransactionLog() {
  const [logs, setLogs] = useState<EdiLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<EdiLog | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('transactionType', typeFilter);
      if (directionFilter) params.set('direction', directionFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));

      const res = await fetch(`${API_URL}/api/v1/edi-logs?${params}`);
      const json = await res.json();
      setLogs(json.data || []);
      setTotal(json.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, directionFilter, statusFilter, search, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const fetchLogDetail = async (id: string) => {
    const res = await fetch(`${API_URL}/api/v1/edi-logs/${id}`);
    const json = await res.json();
    setSelectedLog(json.data);
  };

  const retryLog = async (id: string) => {
    await fetch(`${API_URL}/api/v1/edi-logs/${id}/retry`, { method: 'POST' });
    fetchLogs();
    setSelectedLog(null);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ padding: '1.5rem' }}>
      <div className="vn-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>EDI Transaction Log</h1>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {total} transactions
        </span>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Filters */}
      <div className="vn-filters" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select className="vn-filter-select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}>
          <option value="">All Types</option>
          <option value="850">850 - Purchase Order</option>
          <option value="856">856 - Ship Notice</option>
          <option value="204">204 - Load Tender</option>
          <option value="990">990 - Tender Response</option>
          <option value="997">997 - Func. Ack</option>
          <option value="214">214 - Status</option>
          <option value="210">210 - Freight Invoice</option>
          <option value="810">810 - Invoice</option>
          <option value="820">820 - Payment</option>
        </select>
        <select className="vn-filter-select" value={directionFilter} onChange={e => { setDirectionFilter(e.target.value); setPage(0); }}>
          <option value="">All Directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select className="vn-filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="duplicate">Duplicate</option>
        </select>
        <input
          className="vn-filter-input"
          placeholder="Search by reference, filename..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={{ minWidth: '200px' }}
        />
      </div>

      {/* Table */}
      <div className="vn-table-wrap">
        <table className="vn-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Partner</th>
              <th>Type</th>
              <th>Direction</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No transactions found</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} onClick={() => fetchLogDetail(log.id)} style={{ cursor: 'pointer' }}>
                <td className="vn-table-secondary">{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.partner?.name || '-'}</td>
                <td><strong>{log.transactionType}</strong></td>
                <td>{DIRECTION_LABEL[log.direction] || log.direction}</td>
                <td><span className={STATUS_CHIP[log.status] || 'vn-chip'}>{log.status}</span></td>
                <td className="vn-table-secondary">{log.shipmentReference || log.invoiceNumber || log.fileName || '-'}</td>
                <td className="vn-table-secondary">{log.source || '-'}</td>
                <td>
                  {log.status === 'error' && (
                    <button className="vn-btn" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={e => { e.stopPropagation(); retryLog(log.id); }}>
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="vn-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button className="vn-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="vn-modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="vn-modal-header">
              <h2>EDI {selectedLog.transactionType} - {DIRECTION_LABEL[selectedLog.direction]}</h2>
              <button className="vn-btn" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
            <div className="vn-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div><strong>Status:</strong> <span className={STATUS_CHIP[selectedLog.status] || 'vn-chip'}>{selectedLog.status}</span></div>
                <div><strong>Partner:</strong> {selectedLog.partner?.name || 'None'}</div>
                <div><strong>File:</strong> {selectedLog.fileName || '-'}</div>
                <div><strong>Size:</strong> {selectedLog.fileSize ? `${selectedLog.fileSize} bytes` : '-'}</div>
                <div><strong>Transport:</strong> {selectedLog.transport || '-'}</div>
                <div><strong>Source:</strong> {selectedLog.source || '-'}</div>
                <div><strong>Created:</strong> {new Date(selectedLog.createdAt).toLocaleString()}</div>
                <div><strong>Processed:</strong> {selectedLog.processedAt ? new Date(selectedLog.processedAt).toLocaleString() : '-'}</div>
                {selectedLog.shipmentReference && <div><strong>Shipment:</strong> {selectedLog.shipmentReference}</div>}
                {selectedLog.invoiceNumber && <div><strong>Invoice:</strong> {selectedLog.invoiceNumber}</div>}
                {selectedLog.entitiesCreated !== undefined && selectedLog.entitiesCreated > 0 && (
                  <div><strong>Entities Created:</strong> {selectedLog.entitiesCreated}</div>
                )}
                <div><strong>997 Ack:</strong> {selectedLog.ack997Sent ? 'Sent' : selectedLog.ack997Received ? 'Received' : 'None'}</div>
                {selectedLog.retryCount !== undefined && selectedLog.retryCount > 0 && (
                  <div><strong>Retries:</strong> {selectedLog.retryCount}</div>
                )}
              </div>

              {selectedLog.errorMessage && (
                <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>
                  {selectedLog.errorMessage}
                </div>
              )}

              {selectedLog.fileContent && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Raw EDI Content:</strong>
                  <pre style={{
                    background: 'var(--surface-secondary)',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    marginTop: '0.5rem',
                  }}>
                    {selectedLog.fileContent}
                  </pre>
                </div>
              )}

              {selectedLog.status === 'error' && (
                <div className="vn-modal-footer">
                  <button className="vn-btn vn-btn-primary" onClick={() => retryLog(selectedLog.id)}>
                    Retry Transaction
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
