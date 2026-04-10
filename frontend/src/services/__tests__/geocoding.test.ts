import { nominatimSearch, nominatimReverse } from '../geocoding';

// These tests cover the Nominatim (OSM) implementation which doesn't require
// Google Maps globals.

describe('geocoding - Nominatim', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('nominatimSearch', () => {
    it('returns search results from Nominatim', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () =>
          Promise.resolve([
            {
              lat: '32.7767',
              lon: '-96.7970',
              display_name: 'Dallas, Texas, United States',
              address: { city: 'Dallas', state: 'Texas', country: 'United States' },
            },
          ]),
      });

      const results = await nominatimSearch('Dallas TX');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('nominatim.openstreetmap.org/search'),
        expect.objectContaining({ headers: { 'User-Agent': 'OpenTMS/1.0' } })
      );
      expect(results).toHaveLength(1);
      expect(results[0].description).toBe('Dallas, Texas, United States');
      expect(results[0].lat).toBeCloseTo(32.7767, 3);
      expect(results[0].lng).toBeCloseTo(-96.797, 3);
    });

    it('returns empty array on empty response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve([]),
      });

      const results = await nominatimSearch('nonexistent place');
      expect(results).toHaveLength(0);
    });
  });

  describe('nominatimReverse', () => {
    it('returns geocoded address from coordinates', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            lat: '32.7767',
            lon: '-96.7970',
            display_name: '123 Commerce St, Dallas, TX, US',
            address: {
              house_number: '123',
              road: 'Commerce St',
              city: 'Dallas',
              state: 'Texas',
              postcode: '75201',
              country: 'United States',
            },
          }),
      });

      const result = await nominatimReverse(32.7767, -96.797);

      expect(result).not.toBeNull();
      expect(result!.formattedAddress).toBe('123 Commerce St, Dallas, TX, US');
      expect(result!.address1).toBe('123 Commerce St');
      expect(result!.city).toBe('Dallas');
      expect(result!.state).toBe('Texas');
      expect(result!.postalCode).toBe('75201');
    });

    it('returns fallback when Nominatim returns no lat', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ display_name: '' }),
      });

      const result = await nominatimReverse(40.7128, -74.006);

      expect(result).not.toBeNull();
      expect(result!.lat).toBe(40.7128);
      expect(result!.lng).toBe(-74.006);
      expect(result!.formattedAddress).toContain('40.712800');
    });
  });
});
