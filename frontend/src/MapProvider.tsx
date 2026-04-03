import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { API_URL } from './api';

type MapProviderType = 'google' | 'osm';

interface MapProviderContextValue {
  provider: MapProviderType;
  isLoaded: boolean;
  apiKey: string | null;
}

const MapProviderContext = createContext<MapProviderContextValue>({
  provider: 'osm',
  isLoaded: false,
  apiKey: null,
});

export const useMapProvider = () => useContext(MapProviderContext);

let googleMapsLoadPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).google?.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error('Failed to load Google Maps API'));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

export function MapProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<MapProviderType>('osm');
  const [isLoaded, setIsLoaded] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch(`${API_URL}/api/v1/maps/api-key`);
        const result = await res.json();
        const key = result.data?.apiKey;

        if (cancelled) return;

        if (key) {
          setApiKey(key);
          try {
            await loadGoogleMapsScript(key);
            if (!cancelled) {
              setProvider('google');
              setIsLoaded(true);
            }
          } catch {
            // Google Maps failed to load — fallback to OSM
            if (!cancelled) {
              setProvider('osm');
              setIsLoaded(true);
            }
          }
        } else {
          setProvider('osm');
          setIsLoaded(true);
        }
      } catch {
        // API call failed — fallback to OSM
        if (!cancelled) {
          setProvider('osm');
          setIsLoaded(true);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return (
    <MapProviderContext.Provider value={{ provider, isLoaded, apiKey }}>
      {children}
    </MapProviderContext.Provider>
  );
}
