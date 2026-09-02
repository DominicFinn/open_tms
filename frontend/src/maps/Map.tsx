/**
 * The map every screen uses. Picks the adapter the current mode can back.
 *
 * A screen passes markers and polylines and never learns which library drew them. That is the
 * whole point of the seam: adding, changing or removing a canvas implementation touches this file
 * and the adapters, not the five surfaces (#176).
 *
 * Both adapters are imported eagerly and on purpose. Lazy-loading the Google one meant Suspense
 * mounted a full Leaflet map as its fallback, then tore it down a frame later when the chunk
 * resolved, and the Google map was constructed against a container that was already being
 * replaced. The saving was not worth a map that flickers and sometimes does not draw.
 */

import { useMapProvider } from '../MapProvider';
import type { MapProps } from './types';
import LeafletMapAdapter from './adapters/LeafletMapAdapter';
import GoogleMapAdapter from './adapters/GoogleMapAdapter';

export default function Map(props: MapProps) {
  const { capabilities, isLoaded } = useMapProvider();

  // Mounting Leaflet and then swapping to Google would tear down and rebuild the map in front of
  // the user. Waiting for the mode costs one frame and avoids that.
  if (!isLoaded) {
    return (
      <div
        className={props.className}
        style={{ height: typeof props.height === 'number' ? `${props.height}px` : props.height }}
        aria-busy="true"
      />
    );
  }

  return capabilities.googleCanvas ? <GoogleMapAdapter {...props} /> : <LeafletMapAdapter {...props} />;
}

export type { MapProps, MapMarker, MapPolyline, MapBounds, LatLng, MapViewport } from './types';
