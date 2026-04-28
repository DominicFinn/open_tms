import React, { useEffect, useCallback } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCameraBarcodeScanner } from './useCameraBarcodeScanner';

interface CameraScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  hint?: string;
}

/**
 * Full-screen camera scanner modal.
 * Uses the native BarcodeDetector API (Chrome 83+ on Android).
 * Shows the camera feed with a scan target overlay.
 * Auto-closes after a successful scan.
 */
export function CameraScannerModal({
  open,
  onClose,
  onScan,
  title = 'Scan Barcode',
  hint = 'Point the camera at a barcode',
}: CameraScannerModalProps) {
  const handleScan = useCallback((barcode: string) => {
    onScan(barcode);
    onClose();
  }, [onScan, onClose]);

  const { isSupported, isActive, error, startScan, stopScan, videoRef } =
    useCameraBarcodeScanner(handleScan);

  // Start camera when modal opens, stop when it closes
  useEffect(() => {
    if (open) {
      startScan();
    } else {
      stopScan();
    }
    return () => stopScan();
  }, [open, startScan, stopScan]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 text-white">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-12 w-12 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Close scanner"
          >
            <X className="h-6 w-6" />
          </Button>
          <span className="text-base font-semibold">{title}</span>
          <div className="h-12 w-12" aria-hidden />
        </div>

        {/* Camera Feed */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          {error ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center text-white">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <p className="text-base">{error}</p>
              {!isSupported && (
                <p className="text-sm text-white/70">
                  This device does not support camera barcode scanning.
                  Use the built-in hardware scanner or type manually.
                </p>
              )}
              <Button
                variant="outline"
                size="lg"
                className="mt-2 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />

              {/* Scan target overlay - rounded rectangle reticle */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-64 w-72 max-w-[80%]">
                  <div className="absolute left-0 top-0 h-10 w-10 border-l-4 border-t-4 border-primary" />
                  <div className="absolute right-0 top-0 h-10 w-10 border-r-4 border-t-4 border-primary" />
                  <div className="absolute bottom-0 left-0 h-10 w-10 border-b-4 border-l-4 border-primary" />
                  <div className="absolute bottom-0 right-0 h-10 w-10 border-b-4 border-r-4 border-primary" />
                </div>
              </div>

              {/* Scanning indicator - animated line */}
              {isActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-64 w-72 max-w-[80%] overflow-hidden">
                    <div className="h-0.5 w-full animate-pulse bg-primary shadow-[0_0_8px_var(--tw-shadow-color)] shadow-primary" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-2 border-t border-white/10 bg-black/80 px-4 py-4 text-sm text-white/80">
          <Info className="h-5 w-5 shrink-0" />
          <span>{hint}</span>
        </div>
      </div>
    </div>
  );
}
