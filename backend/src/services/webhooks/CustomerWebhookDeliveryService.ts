import { PrismaClient, CustomerWebhook } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';

export interface DeliverInput {
  webhook: CustomerWebhook;
  eventType: string;
  eventId?: string;
  payload: Record<string, unknown>;
}

/**
 * Customer webhook HMAC signature header format:
 *   X-OpenTms-Signature: t=<unix-seconds>,v1=<hex-hmac>
 *
 * v1 = HMAC_SHA256(secret, `${timestamp}.${body}`) hex-encoded.
 * Customers should verify with constant-time comparison and tolerate a clock
 * skew of at most 5 minutes.
 */
export function signPayload(secret: string, body: string, timestamp: number): string {
  const signed = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(signed).digest('hex');
}

export function verifySignature(secret: string, header: string, body: string, toleranceSeconds = 300): boolean {
  const parts = header.split(',').reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > toleranceSeconds) return false;
  const expected = signPayload(secret, body, t);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export class CustomerWebhookDeliveryService {
  constructor(private prisma: PrismaClient) {}

  async deliver(input: DeliverInput): Promise<{
    id: string;
    status: string;
    statusCode: number | null;
    errorMessage: string | null;
    deliveredAt: Date | null;
  }> {
    const { webhook, eventType, eventId, payload } = input;

    const body = JSON.stringify({
      id: eventId ?? null,
      event: eventType,
      sentAt: new Date().toISOString(),
      data: payload,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(webhook.secret, body, timestamp);

    const delivery = await this.prisma.customerWebhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType,
        eventId: eventId ?? null,
        payload: JSON.parse(body),
        status: 'pending',
        attemptCount: 1,
      },
    });

    let status = 'failed';
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let deliveredAt: Date | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenTms-Event': eventType,
          'X-OpenTms-Delivery': delivery.id,
          'X-OpenTms-Signature': `t=${timestamp},v1=${signature}`,
          'User-Agent': 'OpenTMS-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      statusCode = res.status;
      try {
        const text = await res.text();
        responseBody = text.slice(0, 4000);
      } catch { /* ignore */ }
      if (res.ok) {
        status = 'delivered';
        deliveredAt = new Date();
      } else {
        errorMessage = `Endpoint responded with HTTP ${res.status}`;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const [updatedDelivery] = await this.prisma.$transaction([
      this.prisma.customerWebhookDelivery.update({
        where: { id: delivery.id },
        data: { status, statusCode, responseBody, errorMessage, deliveredAt },
      }),
      this.prisma.customerWebhook.update({
        where: { id: webhook.id },
        data: {
          lastDeliveryAt: new Date(),
          lastStatusCode: statusCode,
          deliveryCount: { increment: 1 },
          failureCount: status === 'delivered' ? undefined : { increment: 1 },
        },
      }),
    ]);

    return {
      id: updatedDelivery.id,
      status: updatedDelivery.status,
      statusCode: updatedDelivery.statusCode,
      errorMessage: updatedDelivery.errorMessage,
      deliveredAt: updatedDelivery.deliveredAt,
    };
  }

  /**
   * Retry a previously-failed delivery. Re-sends with the same payload and a
   * fresh signature (new timestamp). Increments attemptCount. Updates the
   * webhook's failureCount if this retry also fails.
   */
  async retry(deliveryId: string): Promise<{ status: string; statusCode: number | null }> {
    const delivery = await this.prisma.customerWebhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });
    if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);
    if (delivery.status === 'delivered') {
      return { status: 'delivered', statusCode: delivery.statusCode };
    }

    const webhook = delivery.webhook;
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(webhook.secret, body, timestamp);

    let status = 'failed';
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let deliveredAt: Date | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenTms-Event': delivery.eventType,
          'X-OpenTms-Delivery': delivery.id,
          'X-OpenTms-Signature': `t=${timestamp},v1=${signature}`,
          'X-OpenTms-Retry': String(delivery.attemptCount),
          'User-Agent': 'OpenTMS-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      statusCode = res.status;
      try {
        const text = await res.text();
        responseBody = text.slice(0, 4000);
      } catch { /* ignore */ }
      if (res.ok) {
        status = 'delivered';
        deliveredAt = new Date();
      } else {
        errorMessage = `Endpoint responded with HTTP ${res.status}`;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await this.prisma.$transaction([
      this.prisma.customerWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status,
          statusCode,
          responseBody,
          errorMessage,
          deliveredAt,
          attemptCount: { increment: 1 },
        },
      }),
      this.prisma.customerWebhook.update({
        where: { id: webhook.id },
        data: {
          lastDeliveryAt: new Date(),
          lastStatusCode: statusCode,
          failureCount: status === 'delivered' ? undefined : { increment: 1 },
        },
      }),
    ]);

    return { status, statusCode };
  }

  /**
   * Return deliveries that are eligible for retry right now.
   * Eligibility:
   *   - status = 'failed'
   *   - attemptCount <= maxAttempts
   *   - age-since-creation has cleared the exponential backoff window for the current attempt
   *
   * Backoff: 2^attemptCount minutes, capped at 30 minutes.
   * Example: attempt 1 → wait 2min before retry, attempt 2 → 4min, attempt 3 → 8min, attempt 4 → 16min, attempt 5+ → 30min.
   */
  async findEligibleForRetry(maxAttempts = 5, now: Date = new Date()): Promise<Array<{ id: string; attemptCount: number }>> {
    const rows = await this.prisma.customerWebhookDelivery.findMany({
      where: {
        status: 'failed',
        attemptCount: { lt: maxAttempts },
      },
      select: { id: true, attemptCount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return rows.filter(r => {
      const backoffMinutes = Math.min(30, Math.pow(2, r.attemptCount));
      const earliestRetryAt = r.createdAt.getTime() + backoffMinutes * 60_000;
      return now.getTime() >= earliestRetryAt;
    }).map(r => ({ id: r.id, attemptCount: r.attemptCount }));
  }

  /**
   * Event pattern match: supports "*", "rma.*", and exact matches like "rma.authorized"
   */
  static matches(subscribed: string[], eventType: string): boolean {
    return subscribed.some(pattern => {
      if (pattern === '*') return true;
      if (pattern === eventType) return true;
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -1); // "rma."
        return eventType.startsWith(prefix);
      }
      return false;
    });
  }
}
