import React, { useMemo } from 'react';

import MapView from '../maps/Map';
import type { MapMarker, MapPolyline } from '../maps/types';

// Hex colors used inside map HTML strings (cannot use Tailwind/var(--*)); same palette as the
// shipment detail map.
const COLOR_PICKUP = '#3b82f6';
const COLOR_DROP = '#22c55e';
const COLOR_DONE = '#94a3b8';
const COLOR_LINE = '#a855f7';
const COLOR_POSITION = '#6366f1';

interface RunStop {
  id: string;
  sequenceNumber: number;
  stopType: string;
  status: string;
  location: { name: string; lat: number | null; lng: number | null };
}

interface Props {
  reference: string;
  stops: RunStop[];
  position: { lat: number; lng: number; at: string | null } | null;
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function numberedPin(colour: string, label: number): string {
  return `<div style="width:24px;height:24px;border-radius:50%;background:${colour};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);color:white;font:600 11px/20px system-ui,sans-serif;text-align:center;">${label}</div>`;
}

/** The run's stops in visiting order, and where the truck was last seen (#329). */
export default function ConsolidationRunMap({ reference, stops, position }: Props) {
  const located = useMemo(
    () => stops.filter((s) => s.location.lat != null && s.location.lng != null)
      .map((s) => ({ ...s, point: { lat: s.location.lat as number, lng: s.location.lng as number } })),
    [stops],
  );

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = located.map((s) => ({
      id: `stop-${s.id}`,
      position: s.point,
      html: numberedPin(s.status === 'completed' ? COLOR_DONE : s.stopType === 'pickup' ? COLOR_PICKUP : COLOR_DROP, s.sequenceNumber),
      size: { width: 24, height: 24 },
      popupHtml: `<strong>${s.sequenceNumber}. ${escape(s.location.name)}</strong><br/>${s.stopType === 'pickup' ? 'Pickup' : 'Drop'} · ${escape(s.status)}`,
      zIndex: 10,
    }));
    if (position) {
      out.push({
        id: 'position',
        position: { lat: position.lat, lng: position.lng },
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${COLOR_POSITION};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
        size: { width: 18, height: 18 },
        popupHtml: `<strong>Last position</strong>${position.at ? `<br/>${new Date(position.at).toLocaleString()}` : ''}`,
        zIndex: 20,
      });
    }
    return out;
  }, [located, position]);

  const polylines = useMemo<MapPolyline[]>(
    () => (located.length > 1 ? [{ id: 'run', points: located.map((s) => s.point), color: COLOR_LINE, weight: 3, dashed: true }] : []),
    [located],
  );

  const fitTo = useMemo(
    () => [...located.map((s) => s.point), ...(position ? [{ lat: position.lat, lng: position.lng }] : [])],
    [located, position],
  );

  if (located.length === 0) {
    return <p className="text-sm text-muted-foreground">None of the stops have coordinates to map.</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <MapView markers={markers} polylines={polylines} fitTo={fitTo} height={320} ariaLabel={`Stops for consolidation ${reference}`} />
    </div>
  );
}
