import { createHmac } from 'crypto';
import { AfterShipTrackingProvider } from '../../services/carrierTracking/providers/AfterShipTrackingProvider';

const SECRET = 'as_secret';

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body).digest('base64');
}

describe('AfterShipTrackingProvider', () => {
  const provider = new AfterShipTrackingProvider();

  it('verifies a valid webhook signature (base64) and rejects a bad one', () => {
    const body = JSON.stringify({ msg: { tracking_number: '1Z999' } });
    expect(provider.verifyWebhookSignature(body, { 'aftership-hmac-sha256': sign(body) }, SECRET)).toBe(true);
    expect(provider.verifyWebhookSignature(body, { 'aftership-hmac-sha256': 'AAAA' }, SECRET)).toBe(false);
    expect(provider.verifyWebhookSignature(body, {}, SECRET)).toBe(false);
  });

  it('parses a webhook (msg) into normalized events, newest-first', async () => {
    const webhook = {
      event: 'tracking_update',
      msg: {
        tracking_number: '1Z100',
        tag: 'Delivered',
        signed_by: 'A. SMITH',
        expected_delivery: '2026-07-02',
        checkpoints: [
          { tag: 'InTransit', message: 'In transit', checkpoint_time: '2026-07-01T08:00:00Z', city: 'Chicago', state: 'IL', country_iso3: 'USA', coordinates: [-87.6, 41.9] },
          { tag: 'Delivered', message: 'Delivered', checkpoint_time: '2026-07-02T10:00:00Z', city: 'Denver' },
        ],
      },
    };
    const results = await provider.parseWebhook(webhook, {});
    expect(results).toHaveLength(1);
    expect(results[0].trackingNumber).toBe('1Z100');
    expect(results[0].events[0].status).toBe('delivered');
    expect(results[0].events[0].signedBy).toBe('A. SMITH');
    expect(results[0].events[1].status).toBe('in_transit');
    expect(results[0].events[1].lat).toBe(41.9);
    expect(results[0].events[1].lng).toBe(-87.6);
  });

  it('polls via the trackings API and maps the tag', async () => {
    await provider.authenticate({ apiKey: 'as-key' });
    const tracking = {
      tracking_number: '1Z200',
      tag: 'InTransit',
      checkpoints: [{ tag: 'InTransit', message: 'Moving', checkpoint_time: '2026-07-01T09:00:00Z', city: 'Reno' }],
    };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { trackings: [tracking] } }) });
    (global as any).fetch = fetchMock;

    const [res] = await provider.pollTracking({ trackingNumbers: ['1Z200'] });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/trackings?keyword=1Z200'), expect.objectContaining({ method: 'GET' }));
    expect(res.success).toBe(true);
    expect(res.latestStatus?.status).toBe('in_transit');
    expect(res.events[0].city).toBe('Reno');
  });
});
