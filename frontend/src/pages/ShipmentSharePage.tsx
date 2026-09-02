/**
 * The page a share-link recipient lands on. Not part of the operations app: there is no sidebar,
 * no login, and no way through to anything but this one shipment.
 *
 * The recipient gives an email address and the access code, which buys a short-lived viewer
 * session. Only the sections the sender ticked come back, and the server decides that, so nothing
 * here can widen what is shown.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  FileText,
  Loader2,
  Lock,
  MapPin,
  Package,
  Thermometer,
  Truck,
} from 'lucide-react';
import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface ShareView {
  sections: string[];
  overview?: any;
  events?: any[];
  orders?: any[];
  cargo?: any;
  documents?: any[];
  telemetry?: any[];
  carrier?: any;
}

type GateState = 'checking' | 'open' | 'closed' | 'unknown';

export default function ShipmentSharePage() {
  const { token } = useParams<{ token: string }>();

  const [gate, setGate] = useState<GateState>('checking');
  const [gateMessage, setGateMessage] = useState('');
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [view, setView] = useState<ShareView | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/share/${token}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setGate('unknown');
          setGateMessage(json.error || 'This link is not valid');
          return;
        }
        if (json.data.state === 'open') {
          setGate('open');
        } else {
          setGate('closed');
          setGateMessage(closedMessage(json.data.state));
        }
      } catch {
        if (!cancelled) {
          setGate('unknown');
          setGateMessage('We could not reach the shipment right now');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const loadView = useCallback(
    async (sessionToken: string) => {
      try {
        const res = await fetch(`${API_URL}/api/v1/share/session/shipment`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          setViewError(json.error || 'This shipment is no longer available');
          return;
        }
        setView(json.data);
      } catch {
        setViewError('We could not load the shipment right now');
      }
    },
    []
  );

  useEffect(() => {
    if (session) loadView(session);
  }, [session, loadView]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/share/${token}/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), accessCode: accessCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setAuthError(json.error || 'That access code is not correct');
        return;
      }
      setSession(json.data.sessionToken);
    } catch {
      setAuthError('We could not check that code right now');
    } finally {
      setSubmitting(false);
    }
  };

  if (gate === 'checking') {
    return (
      <ShareShell>
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking this link
        </div>
      </ShareShell>
    );
  }

  if (gate === 'closed' || gate === 'unknown') {
    return (
      <ShareShell>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">{gateMessage}</p>
            <p className="text-sm text-muted-foreground">
              Ask whoever sent it for a new link.
            </p>
          </CardContent>
        </Card>
      </ShareShell>
    );
  }

  if (!session) {
    return (
      <ShareShell>
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Enter your access code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="share-email">Your email address</Label>
                <Input
                  id="share-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Recorded so the sender knows who opened the shipment.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="share-code">Access code</Label>
                <Input
                  id="share-code"
                  required
                  autoComplete="one-time-code"
                  className="font-mono tracking-widest"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                />
              </div>
              {authError && (
                <p className="text-sm text-destructive" role="alert">
                  {authError}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                View shipment
              </Button>
            </form>
          </CardContent>
        </Card>
      </ShareShell>
    );
  }

  if (viewError) {
    return (
      <ShareShell>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">{viewError}</p>
          </CardContent>
        </Card>
      </ShareShell>
    );
  }

  if (!view) {
    return (
      <ShareShell>
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading shipment
        </div>
      </ShareShell>
    );
  }

  return (
    <ShareShell reference={view.overview?.reference}>
      <div className="space-y-6">
        {view.overview && <OverviewCard overview={view.overview} />}
        {view.carrier && <CarrierCard carrier={view.carrier} />}
        {view.events && <EventsCard events={view.events} />}
        {view.cargo && <CargoCard cargo={view.cargo} />}
        {view.orders && <OrdersCard orders={view.orders} />}
        {view.telemetry && <TelemetryCard readings={view.telemetry} />}
        {view.documents && <DocumentsCard documents={view.documents} />}
      </div>
    </ShareShell>
  );
}

function ShareShell({ children, reference }: { children: React.ReactNode; reference?: string }) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Shipment</p>
          <h1 className="text-2xl font-bold tracking-tight">{reference || 'Shared shipment'}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function OverviewCard({ overview }: { overview: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{overview.status}</Badge>
          {overview.hasException && <Badge variant="destructive">Exception</Badge>}
          {overview.serviceLevel && <Badge variant="muted">{overview.serviceLevel}</Badge>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" value={placeLabel(overview.origin)} />
          <Field label="To" value={placeLabel(overview.destination)} />
          <Field label="Pickup" value={dateLabel(overview.pickupDate)} />
          <Field label="Delivery" value={dateLabel(overview.deliveryDate)} />
          {overview.proNumber && <Field label="PRO number" value={overview.proNumber} />}
        </div>
        {overview.stops?.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              {overview.stops.map((stop: any) => (
                <div key={stop.sequenceNumber} className="flex items-center gap-3 text-sm">
                  <Badge variant="muted">{stop.sequenceNumber}</Badge>
                  <span className="flex-1">{placeLabel(stop.location)}</span>
                  <span className="text-muted-foreground">{stop.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CarrierCard({ carrier }: { carrier: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Carrier
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-medium">{carrier.name}</p>
        {carrier.scacCode && (
          <p className="text-sm text-muted-foreground">SCAC {carrier.scacCode}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EventsCard({ events }: { events: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracking events</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracking events yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event, index) => (
              <div key={index} className="flex gap-3 text-sm">
                <span className="w-40 shrink-0 text-muted-foreground">
                  {dateLabel(event.eventTime)}
                </span>
                <span>{event.description}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CargoCard({ cargo }: { cargo: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          Cargo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Lines" value={String(cargo.lineCount)} />
          <Field label="Pieces" value={String(cargo.totalPieces)} />
          <Field label="Weight" value={`${cargo.totalWeightKg} kg`} />
        </div>
        {cargo.lines?.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              {cargo.lines.map((line: any, index: number) => (
                <div key={index} className="flex gap-3 text-sm">
                  <span className="w-24 shrink-0 font-mono">{line.sku}</span>
                  <span className="flex-1">{line.description}</span>
                  <span className="tabular-nums text-muted-foreground">×{line.quantity}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OrdersCard({ orders }: { orders: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders on this shipment.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span className="font-medium">{order.orderNumber}</span>
                {order.poNumber && (
                  <span className="text-muted-foreground">PO {order.poNumber}</span>
                )}
                <Badge variant="muted" className="ml-auto">
                  {order.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TelemetryCard({ readings }: { readings: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Thermometer className="h-4 w-4" />
          Telemetry
        </CardTitle>
      </CardHeader>
      <CardContent>
        {readings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No readings recorded.</p>
        ) : (
          <div className="space-y-2">
            {readings.slice(0, 25).map((reading, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-muted-foreground">
                  {dateLabel(reading.eventTime)}
                </span>
                <span className="tabular-nums">
                  {reading.temperature === null ? '—' : `${reading.temperature} °C`}
                </span>
                {reading.isAlert && <Badge variant="destructive">Alert</Badge>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsCard({ documents }: { documents: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 text-sm">
                <Badge variant="muted">{doc.documentType.toUpperCase()}</Badge>
                <span className="flex-1 truncate">{doc.fileName}</span>
                <span className="text-muted-foreground">{dateLabel(doc.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function placeLabel(place: any): string {
  if (!place) return '—';
  return [place.name, place.city, place.country].filter(Boolean).join(', ');
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function closedMessage(state: string): string {
  if (state === 'revoked') return 'This link has been withdrawn by the sender';
  if (state === 'expired') return 'This link has expired';
  if (state === 'locked') return 'This link is temporarily locked. Try again in 15 minutes';
  return 'This link is not valid';
}
