import { useEffect, useState } from 'react';
import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';

interface EdiLog {
  id: string;
  transactionType: string;
  direction: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  controlNumber: string | null;
  partner: { name: string } | null;
}

export default function CustomerIntegrationLogs() {
  const [logs, setLogs] = useState<EdiLog[]>([]);
  const [total, setTotal] = useState(0);
  const [direction, setDirection] = useState('');
  const [txType, setTxType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (direction) params.set('direction', direction);
    if (txType) params.set('transactionType', txType);
    params.set('limit', '100');
    customerFetch(`${API_URL}/api/v1/customer-portal/developer/edi-logs?${params}`)
      .then(r => r.json())
      .then(json => {
        setLogs(json.data?.logs || []);
        setTotal(json.data?.total || 0);
      })
      .finally(() => setLoading(false));
  }, [direction, txType]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Integration Logs</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        Every EDI transaction exchanged with your trading partners. {total} in total.
      </p>

      <div className="vn-card">
        <div className="vn-filters" style={{ padding: '8px 16px' }}>
          <select className="vn-filter-select" value={direction} onChange={e => setDirection(e.target.value)}>
            <option value="">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <select className="vn-filter-select" value={txType} onChange={e => setTxType(e.target.value)}>
            <option value="">All transaction types</option>
            <option value="850">850 - Purchase Order</option>
            <option value="855">855 - PO Ack</option>
            <option value="856">856 - ASN</option>
            <option value="810">810 - Invoice</option>
            <option value="820">820 - Payment</option>
            <option value="210">210 - Freight Invoice</option>
            <option value="204">204 - Load Tender</option>
            <option value="990">990 - Tender Response</option>
            <option value="214">214 - Shipment Status</option>
            <option value="180">180 - RMA</option>
            <option value="997">997 - Functional Ack</option>
          </select>
        </div>

        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Type</th>
                <th>Direction</th>
                <th>Status</th>
                <th>Control #</th>
                <th>Received</th>
                <th>Processed</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }}><div className="vn-loading-spinner" /></td></tr>}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No EDI transactions yet for your account.
                </td></tr>
              )}
              {logs.map(l => (
                <tr key={l.id}>
                  <td>{l.partner?.name ?? '-'}</td>
                  <td><strong>{l.transactionType}</strong></td>
                  <td>{l.direction}</td>
                  <td>
                    <span className={`vn-chip ${
                      l.status === 'processed' || l.status === 'delivered' ? 'vn-chip-success'
                      : l.status === 'failed' ? 'vn-chip-error'
                      : 'vn-chip-warning'
                    }`}>{l.status}</span>
                  </td>
                  <td><code>{l.controlNumber ?? '-'}</code></td>
                  <td><span className="vn-table-secondary">{new Date(l.createdAt).toLocaleString()}</span></td>
                  <td><span className="vn-table-secondary">{l.processedAt ? new Date(l.processedAt).toLocaleString() : '-'}</span></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>{l.errorMessage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
