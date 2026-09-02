/**
 * Lane route editor. Picks the implementation the current map mode can actually back.
 *
 * Callers use this rather than either implementation directly, so a screen never has to know
 * which mode it is in. Both implementations emit the same route shape and store the same encoded
 * polyline format, so the lane API and deviation monitoring are unaffected by the choice.
 */

import { useMapProvider } from '../MapProvider';
import GoogleMapsRouteEditor from './GoogleMapsRouteEditor';
import OsmRouteEditor from './OsmRouteEditor';
import type { LatLng } from '../maps/polyline';
import { Loader2 } from 'lucide-react';

export interface RouteEditorProps {
  origin: LatLng | null;
  destination: LatLng | null;
  stops?: LatLng[];
  existingPolyline?: string;
  corridorMeters?: number;
  onRouteChange?: (route: {
    encodedPolyline: string;
    distanceMeters: number;
    durationSeconds: number;
    summary: string;
    waypoints: LatLng[];
    /** Which mode drew it. Google routes follow roads; manual ones follow the drawn line. */
    provider: 'google' | 'manual';
  }) => void;
  height?: number | string;
  editable?: boolean;
}

export default function RouteEditor({ onRouteChange, ...props }: RouteEditorProps) {
  const { capabilities, isLoaded } = useMapProvider();

  // Rendering an editor before the mode is known would flash the wrong one and, worse, could
  // report a manual route for a lane that was about to get a road route.
  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm text-muted-foreground"
        style={{ height: typeof props.height === 'number' ? props.height : undefined, minHeight: 200 }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading map
      </div>
    );
  }

  if (capabilities.routePlanning) {
    return (
      <GoogleMapsRouteEditor
        {...props}
        onRouteChange={(route) => onRouteChange?.({ ...route, provider: 'google' })}
      />
    );
  }

  return (
    <OsmRouteEditor
      {...props}
      onRouteChange={(route) => onRouteChange?.({ ...route, provider: 'manual' })}
    />
  );
}
