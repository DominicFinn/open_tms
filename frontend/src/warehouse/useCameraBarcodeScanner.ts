import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Camera-based barcode scanner using the native BarcodeDetector API.
 *
 * - Chrome on Android 83+ (March 2020) supports BarcodeDetector natively
 * - Zero dependencies — pure browser API
 * - Uses the back camera (facingMode: 'environment') for barcode scanning
 * - Deduplicates rapid detections (same barcode within 1.5s window)
 * - Graceful fallback: if not supported, isSupported = false
 *
 * Supported formats: Code 128, Code 39, EAN-13, EAN-8, QR Code, UPC-A, etc.
 */

// BarcodeDetector type declarations for TypeScript
// (BarcodeDetector is not yet in lib.dom.d.ts)
interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: { x: number; y: number }[];
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement | HTMLImageElement | ImageBitmap): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const SUPPORTED_FORMATS = [
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'qr_code',
  'upc_a',
  'upc_e',
  'itf',
  'data_matrix',
];

const DEDUPE_WINDOW_MS = 1500;

export function useCameraBarcodeScanner(
  onScan: (barcode: string) => void,
) {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const rafRef = useRef<number>(0);
  const lastDetectedRef = useRef<{ value: string; time: number }>({ value: '', time: 0 });
  const callbackRef = useRef(onScan);
  callbackRef.current = onScan;

  // Check support on mount
  useEffect(() => {
    const supported = 'BarcodeDetector' in window;
    setIsSupported(supported);
  }, []);

  const startScan = useCallback(async () => {
    setError(null);

    if (!window.BarcodeDetector) {
      setError('Camera scanning not supported on this device. Use the built-in scanner instead.');
      return;
    }

    try {
      // Create detector
      const formats = await window.BarcodeDetector.getSupportedFormats();
      const useFormats = SUPPORTED_FORMATS.filter(f => formats.includes(f));
      if (useFormats.length === 0) {
        setError('No barcode formats supported on this device.');
        return;
      }
      detectorRef.current = new window.BarcodeDetector({ formats: useFormats });

      // Request camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);

      // Start detection loop
      detectLoop();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError(`Camera error: ${err.message}`);
      }
    }
  }, []);

  const detectLoop = useCallback(() => {
    if (!detectorRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const detector = detectorRef.current;

    async function tick() {
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const barcode = barcodes[0];
          const now = Date.now();

          // Deduplicate
          if (
            barcode.rawValue !== lastDetectedRef.current.value ||
            now - lastDetectedRef.current.time > DEDUPE_WINDOW_MS
          ) {
            lastDetectedRef.current = { value: barcode.rawValue, time: now };
            callbackRef.current(barcode.rawValue);
          }
        }
      } catch {
        // Detection can fail on individual frames — ignore and retry
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopScan = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    detectorRef.current = null;
    setIsActive(false);
    lastDetectedRef.current = { value: '', time: 0 };
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isSupported,
    isActive,
    error,
    startScan,
    stopScan,
    videoRef,
  };
}
