import type { Map as LeafletMap } from 'leaflet';

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
