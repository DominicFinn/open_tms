import { createCarrierTrackingPollWorker } from '../../workers/carrierTrackingPollWorker';

function buildIntegration(id: string, overrides: any = {}) {
  return {
    id,
    carrier: { name: `carrier-${id}` },
    pollingIntervalSeconds: 60,
    lastPolledAt: new Date(0), // long ago — always due
    ...overrides,
  };
}

function buildPrisma() {
  return {
    webhookLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

describe('carrierTrackingPollWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.CARRIER_TRACKING_POLL_CONCURRENCY = '5';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CARRIER_TRACKING_POLL_CONCURRENCY;
  });

  it('does not let a hanging integration block the rest', async () => {
    const integrations = [
      buildIntegration('slow'),
      buildIntegration('a'),
      buildIntegration('b'),
      buildIntegration('c'),
    ];

    let resolveSlow!: (v: any) => void;
    const slowPromise = new Promise((res) => { resolveSlow = res; });

    const trackingService: any = {
      pollForUpdates: jest.fn(async (id: string) => {
        if (id === 'slow') {
          await slowPromise;
          return { polled: 1, eventsCreated: 0 };
        }
        return { polled: 1, eventsCreated: 0 };
      }),
    };
    const integrationRepo: any = {
      findActivePollingIntegrations: jest.fn().mockResolvedValue(integrations),
    };

    const worker = createCarrierTrackingPollWorker(buildPrisma(), trackingService, integrationRepo);
    const runPromise = worker();

    // Yield enough microtasks for the parallel lanes to invoke pollForUpdates
    // for every integration before the slow one resolves.
    await new Promise((r) => setTimeout(r, 20));

    // Without parallelism the for-loop would only have called pollForUpdates
    // once (the slow one). With parallelism every integration is in flight.
    expect(trackingService.pollForUpdates).toHaveBeenCalledWith('slow');
    expect(trackingService.pollForUpdates).toHaveBeenCalledWith('a');
    expect(trackingService.pollForUpdates).toHaveBeenCalledWith('b');
    expect(trackingService.pollForUpdates).toHaveBeenCalledWith('c');

    resolveSlow({ polled: 1, eventsCreated: 0 });
    await runPromise;

    expect(trackingService.pollForUpdates).toHaveBeenCalledTimes(4);
  });

  it('absorbs a single integration failure without stopping siblings', async () => {
    const integrations = [
      buildIntegration('ok-1'),
      buildIntegration('boom'),
      buildIntegration('ok-2'),
    ];

    const trackingService: any = {
      pollForUpdates: jest.fn(async (id: string) => {
        if (id === 'boom') throw new Error('upstream 503');
        return { polled: 1, eventsCreated: 1 };
      }),
    };
    const integrationRepo: any = {
      findActivePollingIntegrations: jest.fn().mockResolvedValue(integrations),
    };

    const worker = createCarrierTrackingPollWorker(buildPrisma(), trackingService, integrationRepo);
    await expect(worker()).resolves.not.toThrow();

    // Every integration was attempted
    expect(trackingService.pollForUpdates).toHaveBeenCalledTimes(3);
  });

  it('skips integrations that have not waited their polling interval', async () => {
    const integrations = [
      buildIntegration('ready', { lastPolledAt: new Date(0) }),
      buildIntegration('too-soon', { lastPolledAt: new Date(), pollingIntervalSeconds: 9999 }),
    ];

    const trackingService: any = {
      pollForUpdates: jest.fn().mockResolvedValue({ polled: 1, eventsCreated: 0 }),
    };
    const integrationRepo: any = {
      findActivePollingIntegrations: jest.fn().mockResolvedValue(integrations),
    };

    const worker = createCarrierTrackingPollWorker(buildPrisma(), trackingService, integrationRepo);
    await worker();

    expect(trackingService.pollForUpdates).toHaveBeenCalledTimes(1);
    expect(trackingService.pollForUpdates).toHaveBeenCalledWith('ready');
  });

  it('respects the CARRIER_TRACKING_POLL_CONCURRENCY env cap', async () => {
    process.env.CARRIER_TRACKING_POLL_CONCURRENCY = '2';

    const integrations = Array.from({ length: 6 }, (_, i) => buildIntegration(`i-${i}`));

    let inFlight = 0;
    let maxInFlight = 0;
    const trackingService: any = {
      pollForUpdates: jest.fn(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return { polled: 1, eventsCreated: 0 };
      }),
    };
    const integrationRepo: any = {
      findActivePollingIntegrations: jest.fn().mockResolvedValue(integrations),
    };

    const worker = createCarrierTrackingPollWorker(buildPrisma(), trackingService, integrationRepo);
    await worker();

    expect(trackingService.pollForUpdates).toHaveBeenCalledTimes(6);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThan(1); // sanity: actually parallel
  });

  it('returns early without erroring when there are no active integrations', async () => {
    const trackingService: any = { pollForUpdates: jest.fn() };
    const integrationRepo: any = {
      findActivePollingIntegrations: jest.fn().mockResolvedValue([]),
    };

    const worker = createCarrierTrackingPollWorker(buildPrisma(), trackingService, integrationRepo);
    await expect(worker()).resolves.not.toThrow();
    expect(trackingService.pollForUpdates).not.toHaveBeenCalled();
  });
});
