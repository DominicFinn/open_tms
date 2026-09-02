import { encodePolyline, decodePolyline, pathLengthMetres } from '../maps/polyline';

describe('encoded polyline codec', () => {
  // The reference example from the published format specification.
  const REFERENCE_POINTS = [
    { lat: 38.5, lng: -120.2 },
    { lat: 40.7, lng: -120.95 },
    { lat: 43.252, lng: -126.453 },
  ];
  const REFERENCE_ENCODED = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

  it('encodes the reference path to the published string', () => {
    expect(encodePolyline(REFERENCE_POINTS)).toBe(REFERENCE_ENCODED);
  });

  it('decodes the published string back to the reference path', () => {
    const decoded = decodePolyline(REFERENCE_ENCODED);
    expect(decoded).toHaveLength(3);
    decoded.forEach((point, i) => {
      expect(point.lat).toBeCloseTo(REFERENCE_POINTS[i].lat, 5);
      expect(point.lng).toBeCloseTo(REFERENCE_POINTS[i].lng, 5);
    });
  });

  it('round-trips an arbitrary path within the format precision', () => {
    const points = [
      { lat: 53.79648, lng: -1.54785 },
      { lat: 52.48624, lng: -1.89043 },
      { lat: 51.50735, lng: -0.12776 },
      { lat: -33.86882, lng: 151.20929 },
    ];
    decodePolyline(encodePolyline(points)).forEach((point, i) => {
      expect(point.lat).toBeCloseTo(points[i].lat, 5);
      expect(point.lng).toBeCloseTo(points[i].lng, 5);
    });
  });

  it('handles the empty and single-point cases', () => {
    expect(encodePolyline([])).toBe('');
    expect(decodePolyline('')).toEqual([]);
    const single = [{ lat: 53.79648, lng: -1.54785 }];
    expect(decodePolyline(encodePolyline(single))[0].lat).toBeCloseTo(53.79648, 5);
  });
});

describe('pathLengthMetres', () => {
  it('measures a known great-circle distance', () => {
    // Leeds to London, about 273 km as the crow flies.
    const metres = pathLengthMetres([
      { lat: 53.79648, lng: -1.54785 },
      { lat: 51.50735, lng: -0.12776 },
    ]);
    expect(metres).toBeGreaterThan(270_000);
    expect(metres).toBeLessThan(276_000);
  });

  it('sums every leg rather than measuring end to end', () => {
    const viaBirmingham = pathLengthMetres([
      { lat: 53.79648, lng: -1.54785 },
      { lat: 52.48624, lng: -1.89043 },
      { lat: 51.50735, lng: -0.12776 },
    ]);
    const direct = pathLengthMetres([
      { lat: 53.79648, lng: -1.54785 },
      { lat: 51.50735, lng: -0.12776 },
    ]);
    expect(viaBirmingham).toBeGreaterThan(direct);
  });

  it('is zero for a path that cannot have length', () => {
    expect(pathLengthMetres([])).toBe(0);
    expect(pathLengthMetres([{ lat: 1, lng: 1 }])).toBe(0);
  });
});
