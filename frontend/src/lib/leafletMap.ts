import L, { type Map as LeafletMap, type MapOptions } from 'leaflet';

/** Valid Web Mercator lat range, +/- the whole longitude span. */
const WORLD_BOUNDS = L.latLngBounds([-85.05112878, -180], [85.05112878, 180]);

/**
 * Map constructor options that keep panning within the world instead of
 * dragging into the empty gray space past the poles/antimeridian. Spread
 * into the options passed to `L.map(...)`.
 */
export const worldBoundsMapOptions: Partial<MapOptions> = {
  maxBounds: WORLD_BOUNDS.pad(0.15),
  maxBoundsViscosity: 1.0,
};

/** Tile layer options that stop the world tiles repeating when zoomed out. */
export const noWrapTileOptions = { noWrap: true } as const;

/**
 * Caps zoom-out at the point where the whole world just fits the container,
 * so scrolling/clicking "-" can't go past the map's edge into empty gray
 * space. Recomputed on resize since the right cap depends on container size.
 */
export function capWorldZoomOut(map: LeafletMap): void {
  const capMinZoom = () => map.setMinZoom(map.getBoundsZoom(WORLD_BOUNDS, true));
  map.whenReady(capMinZoom);
  map.on('resize', capMinZoom);
}

/**
 * Robustly keep a Leaflet map sized to its container.
 *
 * Fixes the recurring empty / half-rendered map: Leaflet computes tile layout
 * from the container size, but on first paint (and after tab switches, sidebar
 * animations, or async data arriving) the container often isn't at its final
 * size yet, so a single `invalidateSize()` on a fixed timeout misses. This:
 *  - invalidates on the next frame + a few settle passes,
 *  - invalidates again whenever the container actually resizes (ResizeObserver),
 *  - invalidates once the map is ready.
 *
 * Returns a cleanup function — call it alongside `map.remove()`.
 */
export function keepMapSized(map: LeafletMap, container: HTMLElement): () => void {
  const invalidate = () => { try { map.invalidateSize(); } catch { /* map may be torn down */ } };

  const raf = requestAnimationFrame(invalidate);
  const timers = [60, 200, 500, 1000].map((ms) => setTimeout(invalidate, ms));

  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => invalidate());
    ro.observe(container);
  }

  try { map.whenReady(invalidate); } catch { /* noop */ }

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    ro?.disconnect();
  };
}

/**
 * The basemap every Leaflet surface draws.
 *
 * One place decides the tile source, so a change lands everywhere at once. That is the lesson
 * from #158: four surfaces each hardcoded a CartoDB URL, the migration that deleted the old
 * pages took the OpenStreetMap URLs with them, and Carto later started demanding an account.
 * Nobody chose Carto; it won by elimination, on four separate lines.
 *
 * OpenStreetMap's standard tiles need no key and no account, which is what makes them the right
 * default. They are light-only, so map panels read light even in dark theme. That is accepted:
 * there is no free, keyless, dark raster basemap whose terms are worth depending on, and a
 * washed-out CSS filter looks worse than an honest light map.
 *
 * Attribution is required by the OSM licence. Do not remove it.
 */
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function createBaseTileLayer(): L.TileLayer {
  return L.tileLayer(OSM_TILE_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    ...noWrapTileOptions,
  });
}

/** Convenience for the common case where the layer is added immediately and never toggled. */
export function addBaseTileLayer(map: LeafletMap): L.TileLayer {
  return createBaseTileLayer().addTo(map);
}
