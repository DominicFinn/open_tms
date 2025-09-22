interface Location {
  lat: number | null;
  lng: number | null;
  address1: string;
  address2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
}

interface DistanceResult {
  distance: number; // in kilometers
  duration?: number; // in minutes
  error?: string;
}

export class DistanceService {
  private static readonly OPENROUTE_API_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';
  private static readonly GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
  
  // Fallback to Haversine formula if external services fail
  private static calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Try OpenRouteService first (free, no API key required for basic usage)
  private static async getDistanceFromOpenRoute(origin: Location, destination: Location): Promise<DistanceResult | null> {
    try {
      const response = await fetch(this.OPENROUTE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat]
          ],
          units: 'km',
          options: {
            avoid_features: ['highways'], // Avoid highways for more realistic truck routes
            avoid_borders: 'all'
          }
        })
      });

      if (!response.ok) {
        console.warn('OpenRouteService request failed:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const distance = feature.properties.summary.distance;
        const duration = feature.properties.summary.duration / 60; // Convert to minutes
        
        return {
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
          duration: Math.round(duration)
        };
      }
    } catch (error) {
      console.warn('OpenRouteService error:', error);
    }
    
    return null;
  }

  // Fallback to Google Maps if API key is available
  private static async getDistanceFromGoogleMaps(origin: Location, destination: Location): Promise<DistanceResult | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return null;
    }

    try {
      const originStr = `${origin.lat},${origin.lng}`;
      const destinationStr = `${destination.lat},${destination.lng}`;
      
      const response = await fetch(
        `${this.GOOGLE_MAPS_API_URL}?origins=${originStr}&destinations=${destinationStr}&units=metric&key=${apiKey}`
      );

      if (!response.ok) {
        console.warn('Google Maps API request failed:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.rows && data.rows.length > 0 && data.rows[0].elements.length > 0) {
        const element = data.rows[0].elements[0];
        
        if (element.status === 'OK') {
          return {
            distance: element.distance.value / 1000, // Convert meters to kilometers
            duration: element.duration.value / 60 // Convert seconds to minutes
          };
        }
      }
    } catch (error) {
      console.warn('Google Maps API error:', error);
    }
    
    return null;
  }

  // Main method to get accurate distance
  static async getDistance(origin: Location, destination: Location): Promise<DistanceResult> {
    // Validate coordinates
    if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return {
        distance: 0,
        error: 'Invalid coordinates provided'
      };
    }

    // Try OpenRouteService first (free)
    let result = await this.getDistanceFromOpenRoute(origin, destination);
    if (result) {
      return result;
    }

    // Fallback to Google Maps if API key is available
    result = await this.getDistanceFromGoogleMaps(origin, destination);
    if (result) {
      return result;
    }

    // Final fallback to Haversine formula
    const haversineDistance = this.calculateHaversineDistance(
      origin.lat, 
      origin.lng, 
      destination.lat, 
      destination.lng
    );

    return {
      distance: Math.round(haversineDistance * 10) / 10,
      error: 'Using straight-line distance (external services unavailable)'
    };
  }

  // Get distance with address geocoding (if coordinates are missing)
  static async getDistanceWithGeocoding(origin: Location, destination: Location): Promise<DistanceResult> {
    // If we have coordinates, use them directly
    if (origin.lat && origin.lng && destination.lat && destination.lng) {
      return this.getDistance(origin, destination);
    }

    // TODO: Implement geocoding service to get coordinates from addresses
    // For now, return error if coordinates are missing
    return {
      distance: 0,
      error: 'Coordinates required for distance calculation'
    };
  }
}
