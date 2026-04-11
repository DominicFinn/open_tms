import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { useBarcodeScanner } from './useBarcodeScanner';
import { CameraScannerModal } from './CameraScannerModal';
import './warehouse.css';

type WizardStep = 'detail' | 'trackers' | 'accessories' | 'units' | 'review';

const ACCESSORY_TYPES = [
  { value: 'temp_sensor_front', label: 'Temp Sensor (Front)', icon: 'thermostat', isIoT: true },
  { value: 'temp_sensor_middle', label: 'Temp Sensor (Middle)', icon: 'thermostat', isIoT: true },
  { value: 'temp_sensor_back', label: 'Temp Sensor (Back)', icon: 'thermostat', isIoT: true },
  { value: 'door_sensor', label: 'Door Sensor', icon: 'sensor_door', isIoT: true },
  { value: 'door_seal', label: 'Door Seal (Non-IoT)', icon: 'lock', isIoT: false },
  { value: 'ble_tracker', label: 'BLE Tracker', icon: 'bluetooth', isIoT: true },
];

export default function WarehouseShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>('detail');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Scanner state
  const [scanMode, setScanMode] = useState<'tracker' | 'accessory' | 'unit' | null>(null);
  const [scannedDevice, setScannedDevice] = useState<any>(null);
  const [scanError, setScanError] = useState('');

  // Accessory form
  const [selectedAccessoryType, setSelectedAccessoryType] = useState('');
  const [accessoryIdentifier, setAccessoryIdentifier] = useState('');

  // Unit pairing
  const [scannedUnit, setScannedUnit] = useState<any>(null);
  const [unitDevicePairs, setUnitDevicePairs] = useState<{ unitId: string; unitName: string; deviceId: string; deviceName: string }[]>([]);

  // Flag form
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  // Camera scanner
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraScanContext, setCameraScanContext] = useState<'tracker' | 'accessory' | 'unit' | 'unit-device'>('tracker');

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('warehouse_user') || '{}'); }
    catch { return {}; }
  })();

  const loadShipment = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setShipment(json.data);
      }
    } catch {
      setError('Failed to load shipment');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadShipment(); }, [loadShipment]);

  // Barcode scanner — context-aware
  const handleScan = useCallback(async (barcode: string) => {
    setScanError('');
    if (step === 'trackers' || scanMode === 'tracker') {
      // Look up device by barcode
      try {
        const res = await fetch(`${API_URL}/api/v1/warehouse/devices/lookup?barcode=${encodeURIComponent(barcode)}`);
        const json = await res.json();
        if (json.error) {
          setScanError(json.error);
        } else {
          setScannedDevice(json.data);
        }
      } catch {
        setScanError('Network error looking up device');
      }
    } else if (step === 'accessories' && scanMode === 'accessory') {
      setAccessoryIdentifier(barcode);
    } else if (step === 'units') {
      if (scanMode === 'unit') {
        // Look up trackable unit
        try {
          const res = await fetch(`${API_URL}/api/v1/warehouse/trackable-units/lookup?barcode=${encodeURIComponent(barcode)}`);
          const json = await res.json();
          if (json.error) {
            setScanError(json.error);
          } else {
            setScannedUnit(json.data);
            setScanMode(null); // Next scan should be device
          }
        } catch {
          setScanError('Network error looking up unit');
        }
      } else {
        // Scan mode null — this is a device scan for the current unit
        if (scannedUnit) {
          try {
            const res = await fetch(`${API_URL}/api/v1/warehouse/devices/lookup?barcode=${encodeURIComponent(barcode)}`);
            const json = await res.json();
            if (json.error) {
              setScanError(json.error);
            } else {
              setUnitDevicePairs(prev => [...prev, {
                unitId: scannedUnit.id,
                unitName: scannedUnit.identifier,
                deviceId: json.data.id,
                deviceName: json.data.displayId || json.data.name,
              }]);
              setScannedUnit(null);
              setScanMode('unit'); // Ready for next unit
            }
          } catch {
            setScanError('Network error looking up device');
          }
        }
      }
    }
  }, [step, scanMode, scannedUnit]);

  useBarcodeScanner(handleScan, { enabled: step !== 'detail' && step !== 'review' });

  // Camera scan handler — routes scanned barcode same as HID scanner
  const handleCameraScan = useCallback((barcode: string) => {
    handleScan(barcode);
    setCameraOpen(false);
  }, [handleScan]);

  function openCameraScanner(context: 'tracker' | 'accessory' | 'unit' | 'unit-device') {
    setCameraScanContext(context);
    setCameraOpen(true);
  }

  // ─── Actions ────────────────────────────────────────────────────────────

  async function assignTracker() {
    if (!scannedDevice || !id) return;
    try {
      await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/assign-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: scannedDevice.id }),
      });
      setScannedDevice(null);
      setScanError('');
      await loadShipment();
      setSuccess('Tracker assigned');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setScanError('Failed to assign tracker');
    }
  }

  async function removeDevice(deviceId: string) {
    if (!id) return;
    await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/devices/${deviceId}`, { method: 'DELETE' });
    await loadShipment();
  }

  async function addAccessory() {
    if (!selectedAccessoryType || !id) return;
    const accType = ACCESSORY_TYPES.find(a => a.value === selectedAccessoryType);
    try {
      await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/accessories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessoryType: selectedAccessoryType,
          alias: accType?.label,
          identifier: accessoryIdentifier || null,
          isIoT: accType?.isIoT || false,
          deviceId: scannedDevice?.id || null,
        }),
      });
      setSelectedAccessoryType('');
      setAccessoryIdentifier('');
      setScannedDevice(null);
      await loadShipment();
      setSuccess('Accessory added');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setScanError('Failed to add accessory');
    }
  }

  async function removeAccessory(accId: string) {
    if (!id) return;
    await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/accessories/${accId}`, { method: 'DELETE' });
    await loadShipment();
  }

  async function saveUnitPairings() {
    if (!id) return;
    for (const pair of unitDevicePairs) {
      await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/assign-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: pair.deviceId, trackableUnitId: pair.unitId }),
      });
    }
    setUnitDevicePairs([]);
    await loadShipment();
    setSuccess('Unit trackers saved');
    setTimeout(() => setSuccess(''), 2000);
  }

  async function flagShipment() {
    if (!id || !flagReason.trim()) return;
    await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: flagReason,
        flaggedBy: user.id,
        flaggedByName: `${user.firstName} ${user.lastName}`,
      }),
    });
    setShowFlagForm(false);
    setFlagReason('');
    await loadShipment();
  }

  async function launchShipment() {
    if (!id) return;
    const res = await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launchedBy: user.id }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setSuccess('Shipment launched!');
    setTimeout(() => navigate('/warehouse'), 1500);
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="wh-loading"><div className="wh-spinner" /></div>;
  }

  if (!shipment) {
    return (
      <div className="wh-empty">
        <span className="material-icons">error</span>
        <p className="wh-empty-title">Shipment not found</p>
        <button className="wh-action-btn wh-action-btn-outline" onClick={() => navigate('/warehouse')}>
          Back to list
        </button>
      </div>
    );
  }

  const steps: WizardStep[] = ['detail', 'trackers', 'accessories', 'units', 'review'];
  const stepIndex = steps.indexOf(step);
  const hasUnits = shipment.orderShipments?.some((os: any) => os.order?.trackableUnits?.length > 0);

  return (
    <>
      {/* Success banner */}
      {success && (
        <div className="wh-banner wh-banner-success">
          <span className="material-icons">check_circle</span>
          {success}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="wh-banner wh-banner-error">
          <span className="material-icons">error</span>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>
      )}

      {/* Wizard progress bar */}
      {step !== 'detail' && (
        <div className="wh-wizard-steps">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`wh-wizard-step ${i <= stepIndex ? (i < stepIndex ? 'completed' : 'active') : ''}`}
            />
          ))}
        </div>
      )}

      {/* ─── STEP: Detail ──────────────────────────────────────────────── */}
      {step === 'detail' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button className="wh-action-btn wh-action-btn-outline" style={{ flex: 'none', padding: '8px 12px' }} onClick={() => navigate('/warehouse')}>
              <span className="material-icons">arrow_back</span>
            </button>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{shipment.reference}</h2>
            <button
              className="wh-action-btn wh-action-btn-danger"
              style={{ flex: 'none', padding: '8px 12px' }}
              onClick={() => setShowFlagForm(true)}
            >
              <span className="material-icons">flag</span>
            </button>
          </div>

          {/* Flags */}
          {shipment.flags?.filter((f: any) => !f.resolved).length > 0 && (
            <div className="wh-banner wh-banner-error">
              <span className="material-icons">warning</span>
              {shipment.flags.filter((f: any) => !f.resolved).length} unresolved flag(s):
              {shipment.flags.filter((f: any) => !f.resolved).map((f: any) => ` "${f.reason}"`).join(', ')}
            </div>
          )}

          {/* Route */}
          <div className="wh-detail-section">
            <h3 className="wh-detail-section-title">Route</h3>
            <div className="wh-detail-row">
              <span className="wh-detail-label">From</span>
              <span className="wh-detail-value">{shipment.origin?.name} — {shipment.origin?.city}</span>
            </div>
            <div className="wh-detail-row">
              <span className="wh-detail-label">To</span>
              <span className="wh-detail-value">{shipment.destination?.name} — {shipment.destination?.city}</span>
            </div>
            {shipment.stops?.length > 0 && (
              <div className="wh-detail-row">
                <span className="wh-detail-label">Stops</span>
                <span className="wh-detail-value">{shipment.stops.length} stop{shipment.stops.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Customer & Dates */}
          <div className="wh-detail-section">
            <h3 className="wh-detail-section-title">Details</h3>
            <div className="wh-detail-row">
              <span className="wh-detail-label">Customer</span>
              <span className="wh-detail-value">{shipment.customer?.name}</span>
            </div>
            <div className="wh-detail-row">
              <span className="wh-detail-label">Pickup</span>
              <span className="wh-detail-value">{shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : '—'}</span>
            </div>
            <div className="wh-detail-row">
              <span className="wh-detail-label">Delivery</span>
              <span className="wh-detail-value">{shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '—'}</span>
            </div>
            {shipment.proNumber && (
              <div className="wh-detail-row">
                <span className="wh-detail-label">PRO #</span>
                <span className="wh-detail-value">{shipment.proNumber}</span>
              </div>
            )}
          </div>

          {/* Carrier & Vehicle */}
          <div className="wh-detail-section">
            <h3 className="wh-detail-section-title">Transport</h3>
            <div className="wh-detail-row">
              <span className="wh-detail-label">Carrier</span>
              <span className="wh-detail-value">{shipment.carrier?.name || '—'}</span>
            </div>
            {shipment.loads?.[0] && (
              <>
                {shipment.loads[0].driver && (
                  <div className="wh-detail-row">
                    <span className="wh-detail-label">Driver</span>
                    <span className="wh-detail-value">{shipment.loads[0].driver.name}</span>
                  </div>
                )}
                {shipment.loads[0].vehicle && (
                  <>
                    <div className="wh-detail-row">
                      <span className="wh-detail-label">Vehicle</span>
                      <span className="wh-detail-value">{shipment.loads[0].vehicle.plate}</span>
                    </div>
                    <div className="wh-detail-row">
                      <span className="wh-detail-label">Type</span>
                      <span className="wh-detail-value">{shipment.loads[0].vehicle.type}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Orders & Units */}
          {shipment.orderShipments?.length > 0 && (
            <div className="wh-detail-section">
              <h3 className="wh-detail-section-title">Orders & Units</h3>
              {shipment.orderShipments.map((os: any) => (
                <div key={os.order.id} style={{ marginBottom: '8px' }}>
                  <div className="wh-detail-row">
                    <span className="wh-detail-label">Order</span>
                    <span className="wh-detail-value" style={{ fontWeight: 700 }}>{os.order.orderNumber}</span>
                  </div>
                  {os.order.trackableUnits?.map((u: any) => (
                    <div key={u.id} className="wh-scan-result" style={{ marginTop: '4px' }}>
                      <span className="material-icons">inventory_2</span>
                      <div className="wh-scan-result-info">
                        <div className="wh-scan-result-name">{u.identifier}</div>
                        <div className="wh-scan-result-detail">{u.unitType} {u.barcode ? `· ${u.barcode}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Existing trackers */}
          {shipment.deviceAssignments?.length > 0 && (
            <div className="wh-detail-section">
              <h3 className="wh-detail-section-title">Assigned Trackers</h3>
              {shipment.deviceAssignments.map((da: any) => (
                <div key={da.id} className="wh-scan-result">
                  <span className="material-icons">sensors</span>
                  <div className="wh-scan-result-info">
                    <div className="wh-scan-result-name">{da.device?.displayId || da.device?.name}</div>
                    <div className="wh-scan-result-detail">Battery: {da.device?.batteryLevel ?? '—'}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="wh-action-bar" style={{ position: 'relative' }}>
            {shipment.launchedAt ? (
              <div className="wh-banner wh-banner-success" style={{ margin: 0, flex: 1 }}>
                <span className="material-icons">check_circle</span>
                Launched
              </div>
            ) : (
              <button className="wh-action-btn wh-action-btn-primary" onClick={() => setStep('trackers')}>
                <span className="material-icons">play_arrow</span>
                Start Launch Wizard
              </button>
            )}
          </div>

          {/* Flag dialog */}
          {showFlagForm && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '60px',
            }} onClick={() => setShowFlagForm(false)}>
              <div style={{
                background: 'var(--surface)', borderRadius: '16px', padding: '20px',
                width: '90%', maxWidth: '360px',
              }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Flag an Issue</h3>
                <textarea
                  value={flagReason}
                  onChange={e => setFlagReason(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--outline-variant)',
                    fontSize: '14px', resize: 'none', boxSizing: 'border-box',
                    background: 'var(--surface-container)', color: 'var(--on-surface)',
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="wh-action-btn wh-action-btn-outline" onClick={() => setShowFlagForm(false)}>Cancel</button>
                  <button className="wh-action-btn wh-action-btn-danger" onClick={flagShipment} disabled={!flagReason.trim()}>
                    <span className="material-icons">flag</span>
                    Flag
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── STEP: Trackers ────────────────────────────────────────────── */}
      {step === 'trackers' && (
        <>
          <h2 className="wh-wizard-title">Assign Trackers</h2>
          <p className="wh-wizard-subtitle">Scan the barcode on each IoT tracker to assign it to this shipment.</p>

          {scanError && (
            <div className="wh-banner wh-banner-error">
              <span className="material-icons">error</span>
              {scanError}
            </div>
          )}

          {/* Scan area */}
          <div className="wh-scan-area">
            <span className="material-icons">qr_code_scanner</span>
            <p className="wh-scan-area-title">Scan Tracker Barcode</p>
            <p className="wh-scan-area-hint">Use built-in scanner or tap camera button</p>
            <button className="wh-scan-camera-btn" onClick={() => openCameraScanner('tracker')}>
              <span className="material-icons">photo_camera</span>
              Scan with Camera
            </button>
          </div>

          {/* Scanned device preview */}
          {scannedDevice && (
            <div className="wh-scan-result" style={{ border: '2px solid var(--primary)' }}>
              <span className="material-icons">sensors</span>
              <div className="wh-scan-result-info">
                <div className="wh-scan-result-name">{scannedDevice.displayId || scannedDevice.name}</div>
                <div className="wh-scan-result-detail">
                  {scannedDevice.model || scannedDevice.provider}
                  {scannedDevice.alreadyAssigned && (
                    <span style={{ color: 'var(--color-warning, orange)' }}> · Currently on {scannedDevice.currentShipmentRef}</span>
                  )}
                </div>
              </div>
              <button className="wh-action-btn wh-action-btn-primary" style={{ flex: 'none', padding: '8px 16px' }} onClick={assignTracker}>
                Assign
              </button>
            </div>
          )}

          {/* Already assigned trackers */}
          {shipment.deviceAssignments?.length > 0 && (
            <div className="wh-detail-section" style={{ marginTop: '16px' }}>
              <h3 className="wh-detail-section-title">Assigned ({shipment.deviceAssignments.length})</h3>
              {shipment.deviceAssignments.map((da: any) => (
                <div key={da.id} className="wh-scan-result">
                  <span className="material-icons">sensors</span>
                  <div className="wh-scan-result-info">
                    <div className="wh-scan-result-name">{da.device?.displayId || da.device?.name}</div>
                    <div className="wh-scan-result-detail">{da.device?.model || 'Tracker'}</div>
                  </div>
                  <button className="wh-scan-result-action" onClick={() => removeDevice(da.device?.id)}>
                    <span className="material-icons">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="wh-action-bar" style={{ position: 'relative' }}>
            <button className="wh-action-btn wh-action-btn-outline" onClick={() => setStep('detail')}>Back</button>
            <button className="wh-action-btn wh-action-btn-primary" onClick={() => { setStep('accessories'); setScanMode('accessory'); setScannedDevice(null); }}>
              Next
            </button>
          </div>
        </>
      )}

      {/* ─── STEP: Accessories ─────────────────────────────────────────── */}
      {step === 'accessories' && (
        <>
          <h2 className="wh-wizard-title">Add Accessories</h2>
          <p className="wh-wizard-subtitle">Add door seals, temperature sensors, or BLE devices.</p>

          {scanError && (
            <div className="wh-banner wh-banner-error">
              <span className="material-icons">error</span>
              {scanError}
            </div>
          )}

          {/* Accessory type grid */}
          <div className="wh-accessory-grid">
            {ACCESSORY_TYPES.map(acc => (
              <div
                key={acc.value}
                className={`wh-accessory-option ${selectedAccessoryType === acc.value ? 'selected' : ''}`}
                onClick={() => setSelectedAccessoryType(acc.value)}
              >
                <span className="material-icons">{acc.icon}</span>
                {acc.label}
              </div>
            ))}
          </div>

          {selectedAccessoryType && (
            <>
              {ACCESSORY_TYPES.find(a => a.value === selectedAccessoryType)?.isIoT ? (
                <div className="wh-scan-area" style={{ padding: '16px' }}>
                  <span className="material-icons">qr_code_scanner</span>
                  <p className="wh-scan-area-title">Scan Device ID</p>
                  <p className="wh-scan-area-hint">Scan the barcode on the BLE device</p>
                  <button className="wh-scan-camera-btn" onClick={() => openCameraScanner('accessory')}>
                    <span className="material-icons">photo_camera</span>
                    Scan with Camera
                  </button>
                  {scannedDevice && (
                    <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
                      Found: {scannedDevice.displayId || scannedDevice.name}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: '12px' }}>
                  <div className="wh-scan-area" style={{ padding: '16px' }}>
                    <span className="material-icons">qr_code_scanner</span>
                    <p className="wh-scan-area-title">Scan Seal ID</p>
                    <p className="wh-scan-area-hint">Scan or type the door seal identifier</p>
                    <button className="wh-scan-camera-btn" onClick={() => openCameraScanner('accessory')}>
                      <span className="material-icons">photo_camera</span>
                      Scan with Camera
                    </button>
                    {accessoryIdentifier && (
                      <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
                        ID: {accessoryIdentifier}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <button
                className="wh-action-btn wh-action-btn-primary"
                style={{ width: '100%', marginBottom: '12px' }}
                onClick={addAccessory}
              >
                <span className="material-icons">add</span>
                Add {ACCESSORY_TYPES.find(a => a.value === selectedAccessoryType)?.label}
              </button>
            </>
          )}

          {/* Existing accessories */}
          {shipment.accessories?.length > 0 && (
            <div className="wh-detail-section">
              <h3 className="wh-detail-section-title">Added ({shipment.accessories.length})</h3>
              {shipment.accessories.map((acc: any) => (
                <div key={acc.id} className="wh-scan-result">
                  <span className="material-icons">
                    {acc.isIoT ? 'bluetooth' : 'lock'}
                  </span>
                  <div className="wh-scan-result-info">
                    <div className="wh-scan-result-name">{acc.alias || acc.accessoryType}</div>
                    <div className="wh-scan-result-detail">{acc.identifier || 'No ID'}</div>
                  </div>
                  <button className="wh-scan-result-action" onClick={() => removeAccessory(acc.id)}>
                    <span className="material-icons">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="wh-action-bar" style={{ position: 'relative' }}>
            <button className="wh-action-btn wh-action-btn-outline" onClick={() => { setStep('trackers'); setScanMode('tracker'); }}>Back</button>
            <button className="wh-action-btn wh-action-btn-primary" onClick={() => {
              if (hasUnits) {
                setStep('units');
                setScanMode('unit');
              } else {
                setStep('review');
                setScanMode(null);
              }
            }}>
              {hasUnits ? 'Next' : 'Review'}
            </button>
          </div>
        </>
      )}

      {/* ─── STEP: Unit Pairing ────────────────────────────────────────── */}
      {step === 'units' && (
        <>
          <h2 className="wh-wizard-title">Track Units</h2>
          <p className="wh-wizard-subtitle">Scan a pallet/tote barcode, then scan the IoT device to pair them.</p>

          {scanError && (
            <div className="wh-banner wh-banner-error">
              <span className="material-icons">error</span>
              {scanError}
            </div>
          )}

          <div className="wh-split">
            <div className="wh-split-panel">
              <div className="wh-split-panel-title">
                <span className="material-icons">inventory_2</span>
                Step 1: Scan Unit
              </div>
              {scannedUnit ? (
                <div className="wh-scan-result" style={{ margin: 0 }}>
                  <span className="material-icons">inventory_2</span>
                  <div className="wh-scan-result-info">
                    <div className="wh-scan-result-name">{scannedUnit.identifier}</div>
                    <div className="wh-scan-result-detail">{scannedUnit.unitType}</div>
                  </div>
                </div>
              ) : (
                <div className="wh-scan-area" style={{ border: scanMode === 'unit' ? '2px dashed var(--primary)' : undefined, padding: '12px' }}>
                  <span className="material-icons" style={{ fontSize: '32px' }}>qr_code_scanner</span>
                  <p className="wh-scan-area-hint" style={{ margin: 0 }}>Scan unit barcode</p>
                  <button className="wh-scan-camera-btn" onClick={() => { setScanMode('unit'); openCameraScanner('unit'); }}>
                    <span className="material-icons">photo_camera</span>
                    Camera
                  </button>
                </div>
              )}
            </div>

            <div className="wh-split-panel">
              <div className="wh-split-panel-title">
                <span className="material-icons">sensors</span>
                Step 2: Scan Tracker
              </div>
              {scannedUnit ? (
                <div className="wh-scan-area" style={{ border: '2px dashed var(--primary)', padding: '12px' }}>
                  <span className="material-icons" style={{ fontSize: '32px' }}>qr_code_scanner</span>
                  <p className="wh-scan-area-hint" style={{ margin: 0 }}>Now scan the tracker</p>
                  <button className="wh-scan-camera-btn" onClick={() => openCameraScanner('unit-device')}>
                    <span className="material-icons">photo_camera</span>
                    Camera
                  </button>
                </div>
              ) : (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
                  Scan a unit first
                </div>
              )}
            </div>
          </div>

          {/* Paired items */}
          {unitDevicePairs.length > 0 && (
            <div className="wh-detail-section" style={{ marginTop: '16px' }}>
              <h3 className="wh-detail-section-title">Paired ({unitDevicePairs.length})</h3>
              {unitDevicePairs.map((pair, i) => (
                <div key={i} className="wh-scan-result">
                  <span className="material-icons">link</span>
                  <div className="wh-scan-result-info">
                    <div className="wh-scan-result-name">{pair.unitName}</div>
                    <div className="wh-scan-result-detail">Tracker: {pair.deviceName}</div>
                  </div>
                  <button className="wh-scan-result-action" onClick={() => setUnitDevicePairs(prev => prev.filter((_, j) => j !== i))}>
                    <span className="material-icons">delete</span>
                  </button>
                </div>
              ))}
              <button className="wh-action-btn wh-action-btn-primary" style={{ width: '100%', marginTop: '8px' }} onClick={saveUnitPairings}>
                <span className="material-icons">save</span>
                Save Pairings
              </button>
            </div>
          )}

          <div className="wh-action-bar" style={{ position: 'relative' }}>
            <button className="wh-action-btn wh-action-btn-outline" onClick={() => { setStep('accessories'); setScanMode('accessory'); }}>Back</button>
            <button className="wh-action-btn wh-action-btn-primary" onClick={() => { setStep('review'); setScanMode(null); }}>Review</button>
          </div>
        </>
      )}

      {/* ─── STEP: Review & Launch ─────────────────────────────────────── */}
      {step === 'review' && (
        <>
          <h2 className="wh-wizard-title">Review & Launch</h2>
          <p className="wh-wizard-subtitle">Confirm everything looks good before launching.</p>

          <div className="wh-review-item ok">
            <span className="material-icons">check_circle</span>
            <div className="wh-review-item-text">
              <div className="wh-review-item-label">Shipment</div>
              <div className="wh-review-item-detail">{shipment.reference} — {shipment.customer?.name}</div>
            </div>
          </div>

          <div className="wh-review-item ok">
            <span className="material-icons">check_circle</span>
            <div className="wh-review-item-text">
              <div className="wh-review-item-label">Route</div>
              <div className="wh-review-item-detail">{shipment.origin?.name} → {shipment.destination?.name}</div>
            </div>
          </div>

          <div className={`wh-review-item ${shipment.deviceAssignments?.length > 0 ? 'ok' : 'warning'}`}>
            <span className="material-icons">{shipment.deviceAssignments?.length > 0 ? 'check_circle' : 'warning'}</span>
            <div className="wh-review-item-text">
              <div className="wh-review-item-label">Trackers</div>
              <div className="wh-review-item-detail">
                {shipment.deviceAssignments?.length || 0} tracker{shipment.deviceAssignments?.length !== 1 ? 's' : ''} assigned
              </div>
            </div>
          </div>

          <div className={`wh-review-item ${shipment.accessories?.length > 0 ? 'ok' : 'ok'}`}>
            <span className="material-icons">check_circle</span>
            <div className="wh-review-item-text">
              <div className="wh-review-item-label">Accessories</div>
              <div className="wh-review-item-detail">
                {shipment.accessories?.length || 0} accessory item{shipment.accessories?.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {shipment.carrier && (
            <div className="wh-review-item ok">
              <span className="material-icons">check_circle</span>
              <div className="wh-review-item-text">
                <div className="wh-review-item-label">Carrier</div>
                <div className="wh-review-item-detail">{shipment.carrier.name}</div>
              </div>
            </div>
          )}

          {shipment.flags?.filter((f: any) => !f.resolved).length > 0 && (
            <div className="wh-review-item error">
              <span className="material-icons">error</span>
              <div className="wh-review-item-text">
                <div className="wh-review-item-label">Unresolved Flags</div>
                <div className="wh-review-item-detail">
                  {shipment.flags.filter((f: any) => !f.resolved).length} flag(s) must be resolved before launch
                </div>
              </div>
            </div>
          )}

          <div className="wh-action-bar" style={{ position: 'relative' }}>
            <button className="wh-action-btn wh-action-btn-outline" onClick={() => setStep(hasUnits ? 'units' : 'accessories')}>
              Back
            </button>
            <button
              className="wh-action-btn wh-action-btn-success"
              onClick={launchShipment}
              disabled={shipment.flags?.filter((f: any) => !f.resolved).length > 0}
            >
              <span className="material-icons">rocket_launch</span>
              Launch Shipment
            </button>
          </div>
        </>
      )}

      {/* Camera scanner modal — shared across all wizard steps */}
      <CameraScannerModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleCameraScan}
        title={
          cameraScanContext === 'tracker' ? 'Scan Tracker' :
          cameraScanContext === 'accessory' ? 'Scan Accessory' :
          cameraScanContext === 'unit' ? 'Scan Unit' :
          'Scan Device'
        }
        hint={
          cameraScanContext === 'tracker' ? 'Point camera at the tracker barcode' :
          cameraScanContext === 'accessory' ? 'Point camera at the accessory barcode' :
          cameraScanContext === 'unit' ? 'Point camera at the pallet/tote barcode' :
          'Point camera at the IoT device barcode'
        }
      />
    </>
  );
}
