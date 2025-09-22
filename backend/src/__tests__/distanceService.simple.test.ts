import { DistanceService } from '../services/distanceService';

// Mock fetch for testing
global.fetch = jest.fn();

describe('DistanceService - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDistance', () => {
    const mockOrigin = {
      lat: 32.7767,
      lng: -96.7970,
      address1: '1234 Commerce Street',
      address2: null,
      city: 'Dallas',
      state: 'Texas',
      postalCode: '75201',
      country: 'USA'
    };

    const mockDestination = {
      lat: 40.7128,
      lng: -74.0060,
      address1: '1000 6th Ave',
      address2: null,
      city: 'New York',
      state: 'New York',
      postalCode: '10018',
      country: 'USA'
    };

    it('should return error for invalid coordinates', async () => {
      const invalidOrigin = { ...mockOrigin, lat: null, lng: null };
      const result = await DistanceService.getDistance(invalidOrigin, mockDestination);
      
      expect(result.distance).toBe(0);
      expect(result.error).toBe('Invalid coordinates provided');
    });

    it('should use Haversine formula when APIs fail', async () => {
      // Mock OpenRouteService failure
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await DistanceService.getDistance(mockOrigin, mockDestination);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.distance).toBeCloseTo(2205.7, 0); // Haversine calculation
      expect(result.error).toBe('Using straight-line distance (external services unavailable)');
    });

    it('should handle OpenRouteService success', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          features: [{
            properties: {
              summary: {
                distance: 2205.7,
                duration: 132342 // in seconds
              }
            }
          }]
        })
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await DistanceService.getDistance(mockOrigin, mockDestination);

      expect(result.distance).toBe(2205.7);
      expect(result.duration).toBe(2206); // Converted to minutes
      expect(result.error).toBeUndefined();
    });

    it('should round distance to 1 decimal place', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          features: [{
            properties: {
              summary: {
                distance: 2205.789123, // Should be rounded to 2205.8
                duration: 132342
              }
            }
          }]
        })
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await DistanceService.getDistance(mockOrigin, mockDestination);

      expect(result.distance).toBe(2205.8);
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await DistanceService.getDistance(mockOrigin, mockDestination);

      expect(result.distance).toBeCloseTo(2205.7, 0);
      expect(result.error).toBe('Using straight-line distance (external services unavailable)');
    });
  });
});
