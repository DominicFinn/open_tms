import { createHmac } from 'crypto';
import { EasyPostTrackingProvider } from '../../services/carrierTracking/providers/EasyPostTrackingProvider';

const SECRET = 'whsec_test';

function sign(body: string): string {
  return 'hmac-sha256-hex=' + createHmac('sha256', SECRET).update(body).digest('hex');
}

describe('EasyPostTrackingProvider', () => {
  const provider = new EasyPostTrackingProvider();

  it('verifies a valid webhook signature and rejects a bad one', () => {
    const body = JSON.stringify({ result: { tracking_code: 'EZ1000' } });
    expect(provider.verifyWebhookSignature(body, { 'x-hmac-signature': sign(body) }, SECRET)).toBe(true);
    expect(provider.verifyWebhookSignature(body, { 'x-hmac-signature': 'hmac-sha256-hex=deadbeef' }, SECRET)).toBe(false);
    expect(provider.verifyWebhookSignature(body, {}, SECRET)).toBe(false);
  });

  it('parses a webhook Event into normalized delivered status', async () => {
    const event = {
      description: 'tracker.updated',
      result: {
        tracking_code: 'EZ2000',
        status: 'delivered',
        signed_by: 'J. DOE',
        est_delivery_date: '2026-07-02T00:00:00Z',
        tracking_details: [
          { status: 'in_transit', message: 'Departed', datetime: '2026-07-01T08:00:00Z', tracking_location: { city: 'Chicago', state: 'IL', country: 'US', zip: '60601' } },
          { status: 'delivered', message: 'Delivered', datetime: '2026-07-02T10:00:00Z', tracking_location: { city: 'Denver', state: 'CO', country: 'US' } },
        ],
      },
    };
    const results = await provider.parseWebhook(event, {});
    expect(results).toHaveLength(1);
    expect(results[0].trackingNumber).toBe('EZ2000');
    // Newest-first: delivered comes first.
    expect(results[0].events[0].status).toBe('delivered');
    expect(results[0].events[0].signedBy).toBe('J. DOE');
    expect(results[0].events[1].status).toBe('in_transit');
    expect(results[0].events[1].city).toBe('Chicago');
  });

  it('polls a tracking number via the Tracker API and maps status', async () => {
    await provider.authenticate({ apiKey: 'EZTKtest' });
    const tracker = {
      tracking_code: 'EZ3000',
      status: 'out_for_delivery',
      tracking_details: [{ status: 'out_for_delivery', message: 'OFD', datetime: '2026-07-01T09:00:00Z', tracking_location: { city: 'Reno', state: 'NV', country: 'US' } }],
    };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ trackers: [tracker] }) });
    (global as any).fetch = fetchMock;

    const [res] = await provider.pollTracking({ trackingNumbers: ['EZ3000'] });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/trackers?tracking_code=EZ3000'), expect.objectContaining({ method: 'GET' }));
    expect(res.success).toBe(true);
    expect(res.latestStatus?.status).toBe('out_for_delivery');
    expect(res.events[0].city).toBe('Reno');
  });

  it('surfaces auth failure as a non-retryable error result', async () => {
    await provider.authenticate({ apiKey: 'bad' });
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const [res] = await provider.pollTracking({ trackingNumbers: ['EZ4000'] });
    expect(res.success).toBe(false);
    expect(res.errorMessage).toMatch(/authentication/i);
  });
});
