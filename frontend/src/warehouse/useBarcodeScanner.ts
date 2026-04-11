import { useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../api';

/**
 * Barcode scanner hook for Zebra/Android HID scanners.
 *
 * How it works:
 * - Built-in barcode scanners (Zebra, Honeywell, etc.) operate in HID mode,
 *   which means they send rapid keystrokes ending with Enter.
 * - We detect this pattern: characters arriving within 50ms of each other,
 *   finished by an Enter key, with minimum 4 chars total.
 * - This distinguishes scanner input from manual typing.
 *
 * For devices without a built-in scanner, the camera fallback should be
 * triggered explicitly by a button press (not this hook).
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  options?: { minLength?: number; maxDelay?: number; enabled?: boolean }
) {
  const { minLength = 4, maxDelay = 50, enabled = true } = options || {};
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const callbackRef = useRef(onScan);

  // Keep callback ref current
  callbackRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is in an input that should receive normal typing
      const target = e.target as HTMLElement;
      const isEditableField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isSearchField = target.getAttribute('inputMode') === 'text' ||
        target.getAttribute('data-manual-input') === 'true';

      // If user is in a manual-input field, let them type normally
      if (isEditableField && isSearchField) return;

      const now = Date.now();
      const timeDelta = now - lastKeyTimeRef.current;

      if (e.key === 'Enter') {
        // Check if buffer looks like a scan (fast input, minimum length)
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          callbackRef.current(bufferRef.current);
        }
        bufferRef.current = '';
        lastKeyTimeRef.current = 0;
        return;
      }

      // Single printable character
      if (e.key.length === 1) {
        if (timeDelta > maxDelay && bufferRef.current.length > 0) {
          // Too slow — clear buffer (user typing manually)
          bufferRef.current = '';
        }
        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;

        // Prevent character from appearing in focused input if it looks like a scan
        if (bufferRef.current.length > 2 && timeDelta <= maxDelay && isEditableField && !isSearchField) {
          e.preventDefault();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, minLength, maxDelay]);
}

/**
 * Connectivity monitor hook.
 * Logs WiFi connectivity events to the backend for diagnostics.
 */
export function useConnectivityMonitor(userId?: string, locationId?: string) {
  const offlineSinceRef = useRef<number | null>(null);

  useEffect(() => {
    function handleOffline() {
      offlineSinceRef.current = Date.now();
      logConnectivity('wifi_lost', userId, locationId);
    }

    function handleOnline() {
      const duration = offlineSinceRef.current
        ? Math.round((Date.now() - offlineSinceRef.current) / 1000)
        : undefined;
      offlineSinceRef.current = null;
      logConnectivity('wifi_restored', userId, locationId, duration);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [userId, locationId]);
}

function logConnectivity(
  eventType: string,
  userId?: string,
  locationId?: string,
  duration?: number,
) {
  // Fire and forget — don't block the UI
  try {
    fetch(`${API_URL}/api/v1/warehouse/connectivity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        deviceInfo: navigator.userAgent,
        eventType,
        locationId,
        duration,
        metadata: { online: navigator.onLine },
      }),
    }).catch(() => {});
  } catch {
    // Can't log if offline — that's expected
  }
}
