import { useEffect, useState } from 'react';
import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';

interface PartnerTransaction {
  id: string;
  transactionType: string;
  direction: string;
  enabled: boolean;
  autoProcess: boolean;
  ack997Required: boolean;
}

interface TradingPartner {
  id: string;
  name: string;
  active: boolean;
  entityType: string;
  senderId: string | null;
  receiverId: string | null;
  ediVersion: string;
  sftpHost: string | null;
  sftpPort: number;
  sftpUsername: string | null;
  sftpPassword: string | null;
  sftpPrivateKey: string | null;
  httpUrl: string | null;
  httpAuthType: string | null;
  httpAuthHeader: string | null;
  httpAuthValue: string | null;
  inboundEnabled: boolean;
  inboundDir: string;
  outboundEnabled: boolean;
  outboundDir: string | null;
  outboundTransport: string;
  transactions: PartnerTransaction[];
}

export default function CustomerEdiSetup() {
  const [partners, setPartners] = useState<TradingPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/developer/trading-partners`)
      .then(r => r.json())
      .then(json => setPartners(json.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>EDI Setup</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        Your trading partner configuration for EDI file exchange. This view is read-only - contact support to change connection settings.
      </p>

      {loading ? <div className="vn-loading-spinner" /> : partners.length === 0 ? (
        <div className="vn-card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
          No trading partner is configured for your account. If you exchange EDI documents with us, reach out to have a partner provisioned.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {partners.map(p => (
            <div key={p.id} className="vn-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <span className={`vn-chip ${p.active ? 'vn-chip-success' : 'vn-chip-secondary'}`}>{p.active ? 'Active' : 'Inactive'}</span>
              </div>

              <div className="vn-form-grid" style={{ gap: 8, fontSize: 13 }}>
                <div><strong>Entity type:</strong> {p.entityType}</div>
                <div><strong>EDI version:</strong> {p.ediVersion}</div>
                <div><strong>Sender ID (ISA06):</strong> <code>{p.senderId ?? '-'}</code></div>
                <div><strong>Receiver ID (ISA08):</strong> <code>{p.receiverId ?? '-'}</code></div>
              </div>

              {(p.sftpHost || p.sftpUsername) && (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--surface-secondary)', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>SFTP</div>
                  <div className="vn-form-grid" style={{ gap: 6, fontSize: 13 }}>
                    <div><strong>Host:</strong> {p.sftpHost ?? '-'}</div>
                    <div><strong>Port:</strong> {p.sftpPort}</div>
                    <div><strong>Username:</strong> {p.sftpUsername ?? '-'}</div>
                    <div><strong>Credential:</strong> {p.sftpPassword || p.sftpPrivateKey ? 'Configured' : 'None'}</div>
                  </div>
                </div>
              )}

              {p.httpUrl && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-secondary)', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>HTTP</div>
                  <div className="vn-form-grid" style={{ gap: 6, fontSize: 13 }}>
                    <div style={{ gridColumn: '1 / -1' }}><strong>URL:</strong> <code>{p.httpUrl}</code></div>
                    <div><strong>Auth type:</strong> {p.httpAuthType ?? 'none'}</div>
                    <div><strong>Auth header:</strong> {p.httpAuthHeader ?? '-'}</div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-secondary)', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>File exchange</div>
                <div className="vn-form-grid" style={{ gap: 6, fontSize: 13 }}>
                  <div><strong>Inbound:</strong> {p.inboundEnabled ? 'Enabled' : 'Disabled'}</div>
                  <div><strong>Inbound dir:</strong> <code>{p.inboundDir}</code></div>
                  <div><strong>Outbound:</strong> {p.outboundEnabled ? 'Enabled' : 'Disabled'}</div>
                  <div><strong>Outbound transport:</strong> {p.outboundTransport}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong>Outbound dir:</strong> <code>{p.outboundDir ?? '-'}</code></div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Supported transactions</div>
                {p.transactions.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>None configured</div>
                ) : (
                  <div className="vn-table-wrap">
                    <table className="vn-table">
                      <thead><tr><th>Type</th><th>Direction</th><th>Enabled</th><th>Auto-process</th><th>Requires 997</th></tr></thead>
                      <tbody>
                        {p.transactions.map(t => (
                          <tr key={t.id}>
                            <td><strong>{t.transactionType}</strong></td>
                            <td>{t.direction}</td>
                            <td>{t.enabled ? 'Yes' : 'No'}</td>
                            <td>{t.autoProcess ? 'Yes' : 'No'}</td>
                            <td>{t.ack997Required ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
