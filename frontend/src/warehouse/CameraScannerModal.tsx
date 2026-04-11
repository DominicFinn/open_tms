import React, { useEffect, useCallback } from 'react';
import { useCameraBarcodeScanner } from './useCameraBarcodeScanner';
import './warehouse.css';

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
    <div className="wh-camera-overlay" onClick={onClose}>
      <div className="wh-camera-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="wh-camera-header">
          <button className="wh-camera-close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
          <span className="wh-camera-title">{title}</span>
          <div style={{ width: '36px' }} /> {/* Spacer for centering */}
        </div>

        {/* Camera Feed */}
        <div className="wh-camera-feed">
          {error ? (
            <div className="wh-camera-error">
              <span className="material-icons">error</span>
              <p>{error}</p>
              {!isSupported && (
                <p style={{ fontSize: '13px', marginTop: '8px' }}>
                  This device does not support camera barcode scanning.
                  Use the built-in hardware scanner or type manually.
                </p>
              )}
              <button className="wh-action-btn wh-action-btn-outline" onClick={onClose}>
                Close
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="wh-camera-video"
                playsInline
                muted
                autoPlay
              />

              {/* Scan target overlay */}
              <div className="wh-camera-target">
                <div className="wh-camera-target-box">
                  <div className="wh-camera-corner tl" />
                  <div className="wh-camera-corner tr" />
                  <div className="wh-camera-corner bl" />
                  <div className="wh-camera-corner br" />
                </div>
              </div>

              {/* Scanning indicator */}
              {isActive && (
                <div className="wh-camera-scanning">
                  <div className="wh-camera-scan-line" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="wh-camera-footer">
          <span className="material-icons" style={{ fontSize: '18px' }}>info</span>
          {hint}
        </div>
      </div>
    </div>
  );
}
