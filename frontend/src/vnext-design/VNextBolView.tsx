import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  Truck,
  Warehouse,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Online Bill of Lading view.
 *
 * Renders the immutable BOL document in the browser. The data comes from the
 * metadata snapshot captured at generation time, so the document never
 * changes after creation.
 *
 * Print: window.print() produces a clean printout. Tailwind print:
 * utilities hide non-printable controls.
 */
export default function VNextBolView() {
  const { id } = useParams();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/documents/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setDoc(json.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="m-6 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <XCircle className="h-5 w-5" />
        {error || 'Document not found'}
      </div>
    );
  }

  const meta = doc.metadata || {};
  const branding = meta.branding || {};
  const shipment = meta.shipment || {};
  const origin = shipment.origin || {};
  const destination = shipment.destination || {};
  const carrier = meta.carrier || {};
  const customer = meta.customer || {};
  const vehicle = meta.vehicle;
  const driver = meta.driver;
  const stops = meta.stops || [];
  const orders = meta.orders || [];
  const totals = meta.totals || {};
  const specialInstructions = meta.specialInstructions || '';

  return (
    <div className="space-y-6">
      {/* Action bar - hidden when printing */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to={doc.shipmentId ? `/shipments/${doc.shipmentId}` : '/documents'}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-xl font-bold tracking-tight">Bill of Lading</h1>
          <Badge variant="info">Immutable Document</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button asChild variant="gradient" size="sm">
            <a
              href={`${API_URL}/api/v1/documents/${id}/download`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </Button>
        </div>
      </div>

      {/* BOL Document */}
      <div className="mx-auto max-w-4xl rounded-lg border border-border bg-card p-8 print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <div className="border-b-2 border-foreground pb-4 text-center">
          {branding.orgName && (
            <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{branding.orgName}</div>
          )}
          <h1 className="mt-1 text-3xl font-bold tracking-tight">BILL OF LADING</h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-xs uppercase text-muted-foreground">BOL Number</span>
              <span className="ml-2 font-mono font-semibold">{meta.bolNumber}</span>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Date</span>
              <span className="ml-2 font-semibold">{meta.date}</span>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Shipment Ref</span>
              <span className="ml-2 font-semibold">{shipment.reference}</span>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Status</span>
              <span className="ml-2 font-semibold">{shipment.status}</span>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-border p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <Warehouse className="h-4 w-4 print:hidden" />
              Shipper (Origin)
            </h2>
            <div className="text-sm leading-6">
              <strong>{origin.name}</strong>
              <br />
              {origin.address1}
              <br />
              {origin.address2 && <>{origin.address2}<br /></>}
              {origin.city}, {origin.state} {origin.postalCode}
              <br />
              {origin.country}
            </div>
          </div>
          <div className="rounded-md border border-border p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <Truck className="h-4 w-4 print:hidden" />
              Consignee (Destination)
            </h2>
            <div className="text-sm leading-6">
              <strong>{destination.name}</strong>
              <br />
              {destination.address1}
              <br />
              {destination.address2 && <>{destination.address2}<br /></>}
              {destination.city}, {destination.state} {destination.postalCode}
              <br />
              {destination.country}
            </div>
          </div>
        </div>

        {/* Carrier info */}
        <Section title="Carrier" icon={<Truck className="h-4 w-4 print:hidden" />}>
          <InfoGrid
            items={[
              ['Carrier', carrier.name],
              ['MC #', carrier.mcNumber],
              ['DOT #', carrier.dotNumber],
              ['Contact', carrier.contactName],
              ['Phone', carrier.contactPhone],
              ['Email', carrier.contactEmail],
            ]}
          />
        </Section>

        {/* Vehicle & Driver */}
        {vehicle && (
          <Section title="Vehicle & Driver">
            <InfoGrid
              items={[
                ['Vehicle', `${vehicle.plate} (${vehicle.type})`],
                ['Driver', driver?.name],
                ['Driver Phone', driver?.phone],
              ]}
            />
          </Section>
        )}

        {/* Customer & Dates */}
        <Section title="Shipment Details">
          <InfoGrid
            items={[
              ['Customer', customer.name],
              ['Pickup Date', shipment.pickupDate],
              ['Delivery Date', shipment.deliveryDate],
            ]}
          />
        </Section>

        {/* Stops */}
        {stops.length > 0 && (
          <Section title="Stops">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="px-2 py-1 text-left">#</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Location</th>
                  <th className="px-2 py-1 text-left">City / State</th>
                  <th className="px-2 py-1 text-left">Est. Arrival</th>
                  <th className="px-2 py-1 text-left">Instructions</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((s: any, i: number) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-2 py-1">{s.sequenceNumber}</td>
                    <td className="px-2 py-1">{s.stopType}</td>
                    <td className="px-2 py-1">{s.location?.name}</td>
                    <td className="px-2 py-1">{s.location?.city}, {s.location?.state}</td>
                    <td className="px-2 py-1">{s.estimatedArrival || '-'}</td>
                    <td className="px-2 py-1">{s.instructions || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Orders & Items */}
        {orders.length > 0 && (
          <Section title="Orders & Items">
            {orders.map((order: any, oi: number) => (
              <div key={oi} className="mb-4 rounded-md border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <strong>Order: {order.orderNumber}</strong>
                  {order.poNumber && <span className="text-muted-foreground">(PO: {order.poNumber})</span>}
                  <div className="ml-auto flex flex-wrap gap-1">
                    {order.serviceLevel && <Badge variant="muted">{order.serviceLevel}</Badge>}
                    {order.temperatureControl && <Badge variant="muted">Temp: {order.temperatureControl}</Badge>}
                    {order.requiresHazmat && <Badge variant="destructive">HAZMAT</Badge>}
                  </div>
                </div>

                {order.trackableUnits?.length > 0 && (
                  <table className="mb-2 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-2 py-1 text-left">Unit ID</th>
                        <th className="px-2 py-1 text-left">Type</th>
                        <th className="px-2 py-1 text-left">Barcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.trackableUnits.map((u: any, ui: number) => (
                        <tr key={ui} className="border-b border-border">
                          <td className="px-2 py-1">{u.identifier}</td>
                          <td className="px-2 py-1">{u.unitType}</td>
                          <td className="px-2 py-1 font-mono">{u.barcode || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {order.lineItems?.length > 0 && (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-2 py-1 text-left">SKU</th>
                        <th className="px-2 py-1 text-left">Description</th>
                        <th className="px-2 py-1 text-left">Qty</th>
                        <th className="px-2 py-1 text-left">Weight</th>
                        <th className="px-2 py-1 text-left">Dimensions</th>
                        <th className="px-2 py-1 text-left">Hazmat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lineItems.map((li: any, li_i: number) => (
                        <tr key={li_i} className="border-b border-border">
                          <td className="px-2 py-1 font-mono font-medium">{li.sku}</td>
                          <td className="px-2 py-1">{li.description}</td>
                          <td className="px-2 py-1">{li.quantity}</td>
                          <td className="px-2 py-1">{li.weight} {li.weightUnit}</td>
                          <td className="px-2 py-1">{li.length}x{li.width}x{li.height} {li.dimUnit}</td>
                          <td className="px-2 py-1">{li.hazmat ? <span className="font-bold text-destructive">YES</span> : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Totals */}
        <div className="mt-6 grid grid-cols-4 gap-3 rounded-md border-2 border-border bg-muted/30 p-4">
          <Total label="Orders" value={totals.orderCount ?? 0} />
          <Total label="Units" value={totals.unitCount ?? 0} />
          <Total label="Items" value={totals.itemCount ?? 0} />
          <Total label="Total Weight" value={`${totals.totalWeight ?? 0} kg`} />
        </div>

        {/* Special Instructions */}
        {specialInstructions && (
          <Section
            title="Special Instructions"
            icon={<AlertTriangle className="h-4 w-4 print:hidden" />}
          >
            <p className="rounded-md bg-warning/10 p-3 text-sm">{specialInstructions}</p>
          </Section>
        )}

        {/* Signatures */}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {['Shipper', 'Carrier', 'Consignee'].map(role => (
            <div key={role}>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider">{role}</div>
              <div className="mb-1 h-12 border-b-2 border-foreground" />
              <div className="text-xs text-muted-foreground">Signature / Date</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <div>Generated by {branding.orgName || 'Open TMS'}</div>
          <div>Document ID: {doc.id}</div>
          <div>Created: {new Date(doc.createdAt).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function InfoGrid({ items }: { items: Array<[string, any]> }) {
  return (
    <div className="grid gap-x-4 gap-y-2 md:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="font-medium">{value || '-'}</span>
        </div>
      ))}
    </div>
  );
}

function Total({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
