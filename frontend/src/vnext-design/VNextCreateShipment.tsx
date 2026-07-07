import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Info,
  Loader2,
  MapPin,
  PencilLine,
  Plus,
  Radio,
  Save,
  ShieldAlert,
  StickyNote,
  Trash2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const NOTE_TAGS: {
  key: string;
  label: string;
  variant?: 'destructive' | 'info';
  dotClass: string;
  activeClass: string;
}[] = [
  { key: '', label: 'None', dotClass: 'bg-muted-foreground', activeClass: 'border-primary/40 bg-card' },
  { key: 'issue', label: 'Issue', variant: 'destructive', dotClass: 'bg-destructive', activeClass: 'border-destructive bg-destructive/10' },
  { key: 'requirement', label: 'Additional requirement', variant: 'info', dotClass: 'bg-info', activeClass: 'border-info bg-info/10' },
];

interface ShipmentNote {
  tag: string;
  body: string;
}

// Fields a shipment-type preset's `defaults` may target. Types outside this
// set (e.g. a mode-oriented "LTL" type) aren't shown as restriction presets.
const RESTRICTION_KEYS = [
  'tempControlled', 'tempMinC', 'tempMaxC',
  'hazmat', 'unNumber', 'hazmatClass', 'packingGroup', 'properShippingName',
  'humidityControlled', 'humidityMinPct', 'humidityMaxPct',
  'requiredEquipmentType',
];

const EQUIPMENT_TYPES = [
  { key: 'dryVan', label: 'Dry van' },
  { key: 'reefer', label: 'Reefer' },
  { key: 'flatbed', label: 'Flatbed' },
  { key: 'tanker', label: 'Tanker' },
  { key: 'intermodal', label: 'Intermodal' },
];

// Informational only — doesn't change alerting/compliance logic, just labels
// why a device is on the shipment when there's more than one attached.
const DEVICE_PURPOSES = [
  { key: 'general', label: 'General' },
  { key: 'cargo_condition', label: 'Cargo condition' },
  { key: 'security', label: 'Security & tamper' },
  { key: 'location', label: 'Location tracking' },
];

interface RestrictionPreset {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  defaults: Record<string, any>;
}

export default function VNextCreateShipment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [customer, setCustomer] = useState('');
  const [reference, setReference] = useState('');
  const [mode, setMode] = useState('');
  const [proNumber, setProNumber] = useState('');

  const [originLocation, setOriginLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [hasPickupWindow, setHasPickupWindow] = useState(false);
  const [pickupWindowStart, setPickupWindowStart] = useState('');
  const [pickupWindowEnd, setPickupWindowEnd] = useState('');

  const [destLocation, setDestLocation] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [hasDeliveryWindow, setHasDeliveryWindow] = useState(false);
  const [deliveryWindowStart, setDeliveryWindowStart] = useState('');
  const [deliveryWindowEnd, setDeliveryWindowEnd] = useState('');

  const [useCustomRoute, setUseCustomRoute] = useState(false);
  const [laneId, setLaneId] = useState('');
  const [laneDetail, setLaneDetail] = useState<any | null>(null);
  const [carrierId, setCarrierId] = useState('');
  const [setAsLaneDefault, setSetAsLaneDefault] = useState(false);
  const [confirmReassign, setConfirmReassign] = useState(false);

  const [restrictionTypeId, setRestrictionTypeId] = useState('');
  const [restrictionTypes, setRestrictionTypes] = useState<RestrictionPreset[]>([]);

  const [tempControlled, setTempControlled] = useState(false);
  const [tempMinC, setTempMinC] = useState('');
  const [tempMaxC, setTempMaxC] = useState('');

  const [hazmat, setHazmat] = useState(false);
  const [unNumber, setUnNumber] = useState('');
  const [hazmatClass, setHazmatClass] = useState('');
  const [packingGroup, setPackingGroup] = useState('');
  const [properShippingName, setProperShippingName] = useState('');

  const [humidityControlled, setHumidityControlled] = useState(false);
  const [humidityMinPct, setHumidityMinPct] = useState('');
  const [humidityMaxPct, setHumidityMaxPct] = useState('');

  const [equipmentType, setEquipmentType] = useState('');

  const [notes, setNotes] = useState<ShipmentNote[]>([]);
  const [addingNote, setAddingNote] = useState(false);
  const [noteTag, setNoteTag] = useState(NOTE_TAGS[0].key);
  const [noteDraft, setNoteDraft] = useState('');

  const [devicesList, setDevicesList] = useState<any[]>([]);
  const [pendingDevices, setPendingDevices] = useState<Array<{ deviceId: string; name: string; purpose: string }>>([]);
  const [originalDeviceIds, setOriginalDeviceIds] = useState<Set<string>>(new Set());
  const [originalDevicePurpose, setOriginalDevicePurpose] = useState<Map<string, string>>(new Map());
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [confirmStealDevice, setConfirmStealDevice] = useState<{ deviceId: string; name: string; label: string } | null>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [lanes, setLanes] = useState<any[]>([]);
  const [laneSearch, setLaneSearch] = useState('');
  const [laneOpen, setLaneOpen] = useState(false);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const assignedLaneCarrier = useMemo(
    () => laneDetail?.laneCarriers?.find((lc: any) => lc.assigned) || null,
    [laneDetail],
  );

  // "Set as default" is only meaningful once you've actually moved away from
  // the lane's existing default — if the lane has no default yet, or you're
  // still on the same carrier it's already assigned to, there's nothing to change.
  const carrierDiffersFromDefault = Boolean(assignedLaneCarrier && assignedLaneCarrier.carrierId !== carrierId);

  const filteredLanes = useMemo(() => {
    const q = laneSearch.trim().toLowerCase();
    if (!q) return lanes;
    return lanes.filter((l: any) =>
      `${l.name} ${l.originCity} ${l.destinationCity}`.toLowerCase().includes(q));
  }, [lanes, laneSearch]);

  const selectedLane = useMemo(() => lanes.find((l: any) => l.id === laneId) || null, [lanes, laneId]);

  const loadLaneDetail = async (targetLaneId: string): Promise<any | null> => {
    if (!targetLaneId) {
      setLaneDetail(null);
      return null;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/lanes/${targetLaneId}`);
      const json = await res.json();
      setLaneDetail(json.data || null);
      return json.data || null;
    } catch {
      setLaneDetail(null);
      return null;
    }
  };

  // Selecting a lane suggests its currently-assigned carrier (or clears the
  // field if the lane has none) — but only on direct selection. Loading an
  // existing shipment for edit uses the shipment's own saved carrierId instead
  // (see the edit-load effect), so this never overwrites a real saved value.
  const handleLaneSelect = async (newLaneId: string) => {
    setLaneId(newLaneId);
    setSetAsLaneDefault(false);
    setLaneOpen(false);
    setLaneSearch('');
    const detail = await loadLaneDetail(newLaneId);
    const assigned = detail?.laneCarriers?.find((lc: any) => lc.assigned);
    setCarrierId(assigned ? assigned.carrierId : '');
  };

  const handleToggleCustomRoute = (checked: boolean) => {
    setUseCustomRoute(checked);
    if (checked) {
      setLaneId('');
      setLaneDetail(null);
      setSetAsLaneDefault(false);
    } else {
      setOriginLocation('');
      setDestLocation('');
    }
  };

  // Changing the lane's default carrier is a shared change (every future
  // shipment on this lane defaults to it too), so confirm before overwriting
  // an existing assignment. No confirmation needed if the lane has no
  // assigned carrier yet, or the selected carrier already is the default.
  const handleSetAsDefaultChange = (checked: boolean) => {
    if (checked && assignedLaneCarrier && assignedLaneCarrier.carrierId !== carrierId) {
      setConfirmReassign(true);
      return;
    }
    setSetAsLaneDefault(checked);
  };

  // Shipment types split into two groups: the "exclusive" group (Standard,
  // Refrigerated, Frozen, ...) is mutually exclusive — a shipment has exactly
  // one. Hazmat is orthogonal — it can combine with any exclusive type (a
  // shipment can be both Refrigerated and Hazmat), so it's rendered as an
  // independent toggle rather than part of the single-select group. A type
  // counts as "the hazmat toggle" if its defaults declare hazmat: true.
  const exclusiveTypes = useMemo(
    () =>
      restrictionTypes
        .filter(t => !t.defaults?.hazmat)
        .sort((a, b) => (a.name === 'Standard' ? -1 : b.name === 'Standard' ? 1 : 0)),
    [restrictionTypes],
  );
  const hazmatType = useMemo(
    () => restrictionTypes.find(t => t.defaults?.hazmat),
    [restrictionTypes],
  );

  // Overwrites the temp/humidity/equipment fields with an exclusive type's
  // defaults. Anything the preset doesn't mention is reset to off/empty, so
  // switching types never leaves stale values behind. Hazmat fields are
  // untouched — hazmat is independent of the exclusive type now. Fields stay
  // freely editable afterward.
  const applyExclusiveTypeDefaults = (defaults: Record<string, any>) => {
    setTempControlled(Boolean(defaults.tempControlled));
    setTempMinC(defaults.tempMinC != null ? String(defaults.tempMinC) : '');
    setTempMaxC(defaults.tempMaxC != null ? String(defaults.tempMaxC) : '');
    setHumidityControlled(false);
    setHumidityMinPct('');
    setHumidityMaxPct('');
    setEquipmentType(defaults.requiredEquipmentType ?? '');
  };

  const commitExclusiveType = (typeId: string) => {
    setRestrictionTypeId(typeId);
    const type = exclusiveTypes.find(t => t.id === typeId);
    applyExclusiveTypeDefaults(type?.defaults ?? {});
  };

  const applyPreset = (typeId: string) => {
    if (typeId === restrictionTypeId) return;
    commitExclusiveType(typeId);
  };

  // Hazmat is a simple independent toggle — no confirmation needed either
  // way: turning it off is a deliberate "not hazmat" action (nothing
  // surprising to lose), and turning it on just fills in the hazmat type's
  // own defaults (usually just the flag itself).
  const handleToggleHazmat = () => {
    if (hazmat) {
      setHazmat(false);
      setUnNumber('');
      setHazmatClass('');
      setPackingGroup('');
      setProperShippingName('');
      return;
    }
    setHazmat(true);
    const defaults = hazmatType?.defaults ?? {};
    setUnNumber(defaults.unNumber ?? '');
    setHazmatClass(defaults.hazmatClass ?? '');
    setPackingGroup(defaults.packingGroup ?? '');
    setProperShippingName(defaults.properShippingName ?? '');
  };

  const handleAddNote = () => {
    if (!noteDraft.trim()) return;
    setNotes(prev => [...prev, { tag: noteTag, body: noteDraft.trim() }]);
    setNoteDraft('');
    setNoteTag(NOTE_TAGS[0].key);
    setAddingNote(false);
  };

  const handleRemoveNote = (index: number) => {
    setNotes(prev => prev.filter((_, i) => i !== index));
  };

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    const pendingIds = new Set(pendingDevices.map(d => d.deviceId));
    return devicesList.filter((d: any) => {
      if (pendingIds.has(d.id)) return false;
      if (!q) return true;
      return `${d.name} ${d.displayId || ''} ${d.model || ''}`.toLowerCase().includes(q);
    });
  }, [devicesList, deviceSearch, pendingDevices]);

  // A device's active assignment counts as "elsewhere" unless it's already
  // on the shipment currently being edited (that's not stealing, it's already correct).
  const activeAssignmentElsewhere = (device: any) => {
    const a = (device.assignments || [])[0];
    if (!a) return null;
    if (a.shipmentId && a.shipmentId === id) return null;
    return a;
  };

  const addDeviceToPending = (device: any) => {
    setPendingDevices(prev => [...prev, { deviceId: device.id, name: device.name, purpose: 'general' }]);
    setDeviceOpen(false);
    setDeviceSearch('');
  };

  const handleAddDevice = (device: any) => {
    const elsewhere = activeAssignmentElsewhere(device);
    if (elsewhere) {
      const label = elsewhere.shipment
        ? `shipment ${elsewhere.shipment.reference}`
        : elsewhere.order
          ? `order ${elsewhere.order.orderNumber}`
          : 'another record';
      setConfirmStealDevice({ deviceId: device.id, name: device.name, label });
      return;
    }
    addDeviceToPending(device);
  };

  const handleRemoveDevice = (deviceId: string) => {
    setPendingDevices(prev => prev.filter(d => d.deviceId !== deviceId));
  };

  const handleDevicePurposeChange = (deviceId: string, purpose: string) => {
    setPendingDevices(prev => prev.map(d => (d.deviceId === deviceId ? { ...d, purpose } : d)));
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/customers`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/locations`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/lanes`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/shipment-types`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/carriers`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/devices`).then(r => r.json()),
    ]).then(([cRes, lRes, laRes, stRes, carRes, devRes]) => {
      setCustomers(cRes.data || []);
      setLocations(lRes.data || []);
      setLanes(laRes.data || []);
      setCarriers(carRes.data || []);
      setDevicesList(devRes.data || []);
      const presets: RestrictionPreset[] = (stRes.data || []).filter((t: RestrictionPreset) => {
        const keys = Object.keys(t.defaults || {});
        return keys.length === 0 || keys.some(k => RESTRICTION_KEYS.includes(k));
      });
      setRestrictionTypes(presets);
      // Default to "Standard" (or the first preset) so a shipment is never
      // left with an ambiguously-blank restriction template, without forcing
      // the user to pick one. Skipped in edit mode — the load effect below
      // populates restriction fields from the shipment's own saved values.
      if (!isEdit) {
        const exclusivePresets = presets.filter(t => !t.defaults?.hazmat);
        const standard = exclusivePresets.find(t => t.name === 'Standard') || exclusivePresets[0];
        if (standard) {
          setRestrictionTypeId(standard.id);
          applyExclusiveTypeDefaults(standard.defaults);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/shipments/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(json => {
        const s = json.data;
        if (!s) return;
        setCustomer(s.customerId || '');
        setReference(s.reference || '');
        setProNumber(s.proNumber || '');
        setMode(s.serviceLevel || '');
        setOriginLocation(s.originId || '');
        setDestLocation(s.destinationId || '');
        setPickupDate(s.pickupDate ? s.pickupDate.slice(0, 10) : '');
        setDeliveryDate(s.deliveryDate ? s.deliveryDate.slice(0, 10) : '');
        if (s.pickupWindowStart || s.pickupWindowEnd) {
          setHasPickupWindow(true);
          setPickupWindowStart(s.pickupWindowStart ? s.pickupWindowStart.slice(0, 16) : '');
          setPickupWindowEnd(s.pickupWindowEnd ? s.pickupWindowEnd.slice(0, 16) : '');
        }
        if (s.deliveryWindowStart || s.deliveryWindowEnd) {
          setHasDeliveryWindow(true);
          setDeliveryWindowStart(s.deliveryWindowStart ? s.deliveryWindowStart.slice(0, 16) : '');
          setDeliveryWindowEnd(s.deliveryWindowEnd ? s.deliveryWindowEnd.slice(0, 16) : '');
        }
        setLaneId(s.laneId || '');
        setCarrierId(s.carrierId || '');
        setUseCustomRoute(!s.laneId && Boolean(s.originId || s.destinationId));
        if (s.laneId) loadLaneDetail(s.laneId);
        setRestrictionTypeId(s.shipmentTypeId || '');
        setTempControlled(Boolean(s.tempControlled));
        setTempMinC(s.tempMinC != null ? String(s.tempMinC) : '');
        setTempMaxC(s.tempMaxC != null ? String(s.tempMaxC) : '');
        setHazmat(Boolean(s.hazmat));
        setUnNumber(s.unNumber || '');
        setHazmatClass(s.hazmatClass || '');
        setPackingGroup(s.packingGroup || '');
        setProperShippingName(s.properShippingName || '');
        setHumidityControlled(Boolean(s.humidityControlled));
        setHumidityMinPct(s.humidityMinPct != null ? String(s.humidityMinPct) : '');
        setHumidityMaxPct(s.humidityMaxPct != null ? String(s.humidityMaxPct) : '');
        setEquipmentType(s.requiredEquipmentType || '');
        if (Array.isArray(s.deviceAssignments)) {
          const initial = s.deviceAssignments.map((a: any) => ({
            deviceId: a.deviceId,
            name: a.device?.name || 'Device',
            purpose: a.purpose || 'general',
          }));
          setPendingDevices(initial);
          setOriginalDeviceIds(new Set(initial.map((d: any) => d.deviceId)));
          setOriginalDevicePurpose(new Map(initial.map((d: any) => [d.deviceId, d.purpose])));
        }
      })
      .catch(err => setSubmitError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const dateError = useMemo(() => {
    if (pickupDate && deliveryDate && deliveryDate < pickupDate) {
      return 'Delivery date cannot be before pickup date.';
    }
    if (hasPickupWindow && pickupWindowStart && pickupWindowEnd && pickupWindowEnd < pickupWindowStart) {
      return 'Pickup window end cannot be before window start.';
    }
    if (hasDeliveryWindow && deliveryWindowStart && deliveryWindowEnd && deliveryWindowEnd < deliveryWindowStart) {
      return 'Delivery window end cannot be before window start.';
    }
    return '';
  }, [
    pickupDate, deliveryDate,
    hasPickupWindow, pickupWindowStart, pickupWindowEnd,
    hasDeliveryWindow, deliveryWindowStart, deliveryWindowEnd,
  ]);

  const restrictionError = useMemo(() => {
    if (!restrictionTypeId) {
      return 'Please select a shipment type.';
    }
    if (tempControlled && tempMinC !== '' && tempMaxC !== '' && Number(tempMinC) > Number(tempMaxC)) {
      return 'Temperature min cannot be greater than max.';
    }
    if (humidityControlled && humidityMinPct !== '' && humidityMaxPct !== '' && Number(humidityMinPct) > Number(humidityMaxPct)) {
      return 'Humidity min cannot be greater than max.';
    }
    return '';
  }, [restrictionTypeId, tempControlled, tempMinC, tempMaxC, humidityControlled, humidityMinPct, humidityMaxPct]);

  const handleSubmit = async () => {
    if (dateError || restrictionError) {
      setSubmitError(dateError || restrictionError);
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      const body: any = {
        reference: reference || undefined,
        proNumber: proNumber || undefined,
        serviceLevel: mode || undefined,
        customerId: customer || undefined,
        originId: useCustomRoute ? (originLocation || undefined) : undefined,
        destinationId: useCustomRoute ? (destLocation || undefined) : undefined,
        laneId: !useCustomRoute ? (laneId || undefined) : undefined,
        carrierId: carrierId || undefined,
        shipmentTypeId: restrictionTypeId || undefined,
        pickupDate: pickupDate || undefined,
        deliveryDate: deliveryDate || undefined,
        pickupWindowStart: hasPickupWindow && pickupWindowStart ? pickupWindowStart : undefined,
        pickupWindowEnd: hasPickupWindow && pickupWindowEnd ? pickupWindowEnd : undefined,
        deliveryWindowStart: hasDeliveryWindow && deliveryWindowStart ? deliveryWindowStart : undefined,
        deliveryWindowEnd: hasDeliveryWindow && deliveryWindowEnd ? deliveryWindowEnd : undefined,
        tempControlled,
        tempMinC: tempControlled && tempMinC !== '' ? Number(tempMinC) : null,
        tempMaxC: tempControlled && tempMaxC !== '' ? Number(tempMaxC) : null,
        humidityControlled,
        humidityMinPct: humidityControlled && humidityMinPct !== '' ? Number(humidityMinPct) : null,
        humidityMaxPct: humidityControlled && humidityMaxPct !== '' ? Number(humidityMaxPct) : null,
        hazmat,
        unNumber: hazmat && unNumber ? unNumber : null,
        hazmatClass: hazmat && hazmatClass ? hazmatClass : null,
        packingGroup: hazmat && packingGroup ? packingGroup : null,
        properShippingName: hazmat && properShippingName ? properShippingName : null,
        requiredEquipmentType: equipmentType || null,
      };
      if (!isEdit) body.status = 'draft';
      const url = isEdit ? `${API_URL}/api/v1/shipments/${id}` : `${API_URL}/api/v1/shipments`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to save shipment');
      const newId = json.data?.id ?? id;
      const ref = json.data?.reference || newId?.slice(0, 8);

      if (notes.length > 0 && newId) {
        const results = await Promise.allSettled(notes.map(async n => {
          const noteRes = await fetch(`${API_URL}/api/v1/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entityType: 'shipment', entityId: newId, body: n.body, tag: n.tag || undefined }),
          });
          if (!noteRes.ok) throw new Error(`HTTP ${noteRes.status}`);
        }));
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
          toast.error(`Shipment saved, but ${failed} note${failed > 1 ? 's' : ''} failed to save.`);
        }
      }

      if (newId) {
        // Only touch devices whose desired state actually changed — re-running
        // assign for an unchanged device would needlessly churn its assignment history.
        const toAssign = pendingDevices.filter(d =>
          !originalDeviceIds.has(d.deviceId) || originalDevicePurpose.get(d.deviceId) !== d.purpose);
        const toUnassign = [...originalDeviceIds].filter(devId => !pendingDevices.some(d => d.deviceId === devId));
        const results = await Promise.allSettled([
          ...toAssign.map(d => fetch(`${API_URL}/api/v1/devices/${d.deviceId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shipmentId: newId, purpose: d.purpose }),
          }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })),
          ...toUnassign.map(devId => fetch(`${API_URL}/api/v1/devices/${devId}/assign`, { method: 'DELETE' })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })),
        ]);
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
          toast.error(`Shipment saved, but ${failed} device change${failed > 1 ? 's' : ''} failed.`);
        }
      }

      if (!useCustomRoute && setAsLaneDefault && laneId && carrierId) {
        try {
          const alreadyLinked = laneDetail?.laneCarriers?.some((lc: any) => lc.carrierId === carrierId);
          if (!alreadyLinked) {
            await fetch(`${API_URL}/api/v1/lanes/${laneId}/carriers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ carrierId }),
            });
          }
          const assignRes = await fetch(`${API_URL}/api/v1/lanes/${laneId}/carriers/${carrierId}/assign`, { method: 'POST' });
          const assignJson = await assignRes.json().catch(() => ({}));
          if (!assignRes.ok || assignJson.error) throw new Error(assignJson.error || 'Failed to set lane default carrier');
        } catch (err: any) {
          toast.error(`Shipment saved, but couldn't set the lane's default carrier: ${err.message}`);
        }
      }

      if (isEdit) {
        toast.success(`Shipment ${ref} updated`);
        navigate(`/shipments/${id}`);
      } else {
        toast.success(`Shipment ${ref} created`, {
          action: { label: 'View', onClick: () => navigate(`/shipments/${newId}`) },
        });
        navigate('/shipments');
      }
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/shipments" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Shipments
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{isEdit ? 'Edit shipment' : 'New shipment'}</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isEdit ? 'Edit shipment' : 'New shipment'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Basic information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input
              type="text"
              placeholder="Auto-generated if left blank"
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FTL">FTL</SelectItem>
                <SelectItem value="LTL">LTL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>PRO number</Label>
            <Input
              type="text"
              placeholder="Enter PRO number"
              value={proNumber}
              onChange={e => setProNumber(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Lane
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={useCustomRoute}
              onChange={e => handleToggleCustomRoute(e.target.checked)}
              className="h-4 w-4 rounded border border-input bg-background accent-primary"
            />
            Use a custom route instead of a lane
          </label>

          {useCustomRoute ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Origin</Label>
                <Select value={originLocation} onValueChange={setOriginLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select origin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name} - {l.city}, {l.state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Destination</Label>
                <Select value={destLocation} onValueChange={setDestLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name} - {l.city}, {l.state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Carrier</Label>
                <Select value={carrierId} onValueChange={setCarrierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select carrier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Lane</Label>
                <Popover open={laneOpen} onOpenChange={setLaneOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <span className={cn('line-clamp-1', !selectedLane && 'text-muted-foreground')}>
                        {selectedLane
                          ? `${selectedLane.name} (${selectedLane.originCity} → ${selectedLane.destinationCity})`
                          : 'Select lane...'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-1" align="start">
                    <Input
                      autoFocus
                      placeholder="Search lanes by name or city..."
                      value={laneSearch}
                      onChange={e => setLaneSearch(e.target.value)}
                      className="mb-1"
                    />
                    <div className="max-h-64 overflow-y-auto">
                      {filteredLanes.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No lanes match "{laneSearch}"
                        </div>
                      ) : (
                        filteredLanes.map((l: any) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleLaneSelect(l.id)}
                            className={cn(
                              'flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent/15',
                              laneId === l.id && 'bg-accent/10 font-medium',
                            )}
                          >
                            {l.name} ({l.originCity} → {l.destinationCity})
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {laneId && (
                <div className="space-y-3 rounded-md border border-border p-4">
                  {assignedLaneCarrier && (
                    <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
                      <Info className="h-4 w-4 shrink-0" />
                      This lane's assigned carrier is {assignedLaneCarrier.carrier?.name}.
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Carrier</Label>
                    <Select
                      value={carrierId}
                      onValueChange={v => { setCarrierId(v); setSetAsLaneDefault(false); }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select carrier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {carriers.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {carrierDiffersFromDefault && (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={setAsLaneDefault}
                        onChange={e => handleSetAsDefaultChange(e.target.checked)}
                        className="h-4 w-4 rounded border border-input bg-background accent-primary"
                      />
                      Set as this lane's default carrier
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Pickup date</Label>
              <DatePicker type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Delivery date</Label>
              <DatePicker
                type="date"
                value={deliveryDate}
                min={pickupDate || undefined}
                onChange={e => setDeliveryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={hasPickupWindow}
                  onChange={e => {
                    setHasPickupWindow(e.target.checked);
                    if (!e.target.checked) {
                      setPickupWindowStart('');
                      setPickupWindowEnd('');
                    }
                  }}
                  className="h-4 w-4 rounded border border-input bg-background accent-primary"
                />
                Specify pickup window
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={hasDeliveryWindow}
                  onChange={e => {
                    setHasDeliveryWindow(e.target.checked);
                    if (!e.target.checked) {
                      setDeliveryWindowStart('');
                      setDeliveryWindowEnd('');
                    }
                  }}
                  className="h-4 w-4 rounded border border-input bg-background accent-primary"
                />
                Specify delivery window
              </label>
            </div>
            {hasPickupWindow && (
              <>
                <div className="space-y-2">
                  <Label>Pickup window start</Label>
                  <DatePicker
                    type="datetime-local"
                    value={pickupWindowStart}
                    onChange={e => setPickupWindowStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pickup window end</Label>
                  <DatePicker
                    type="datetime-local"
                    value={pickupWindowEnd}
                    min={pickupWindowStart || undefined}
                    onChange={e => setPickupWindowEnd(e.target.value)}
                  />
                </div>
              </>
            )}
            {hasDeliveryWindow && (
              <>
                <div className="space-y-2">
                  <Label>Delivery window start</Label>
                  <DatePicker
                    type="datetime-local"
                    value={deliveryWindowStart}
                    onChange={e => setDeliveryWindowStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delivery window end</Label>
                  <DatePicker
                    type="datetime-local"
                    value={deliveryWindowEnd}
                    min={deliveryWindowStart || undefined}
                    onChange={e => setDeliveryWindowEnd(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Restrictions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Shipment type <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pick exactly one base type. Hazmat is independent and can be combined with any of them.
                </p>
                <div className="flex flex-wrap gap-2">
                  {exclusiveTypes.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyPreset(t.id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors',
                        restrictionTypeId === t.id ? 'bg-card' : 'border-border hover:border-primary/40 bg-transparent',
                      )}
                      style={restrictionTypeId === t.id ? { borderColor: t.color, background: `${t.color}15` } : undefined}
                      title={t.description || undefined}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                      {t.name}
                    </button>
                  ))}
                </div>
                {hazmatType && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleHazmat}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors',
                        hazmat ? 'bg-card' : 'border-border hover:border-primary/40 bg-transparent',
                      )}
                      style={hazmat ? { borderColor: hazmatType.color, background: `${hazmatType.color}15` } : undefined}
                      title={hazmatType.description || undefined}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: hazmatType.color }} />
                      {hazmatType.name}
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Equipment type</Label>
                <Select value={equipmentType} onValueChange={setEquipmentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="No preference" />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_TYPES.map(eq => (
                      <SelectItem key={eq.key} value={eq.key}>{eq.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 rounded-md border border-border p-4">
              {!tempControlled && !hazmat && (
                <p className="text-sm text-muted-foreground">
                  No restrictions for this shipment type. Pick a different type above to add details.
                </p>
              )}
              {tempControlled && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Min temp (°C)</Label>
                      <Input type="number" value={tempMinC} onChange={e => setTempMinC(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Max temp (°C)</Label>
                      <Input type="number" value={tempMaxC} onChange={e => setTempMaxC(e.target.value)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={humidityControlled}
                      onChange={e => {
                        setHumidityControlled(e.target.checked);
                        if (!e.target.checked) {
                          setHumidityMinPct('');
                          setHumidityMaxPct('');
                        }
                      }}
                      className="h-4 w-4 rounded border border-input bg-background accent-primary"
                    />
                    Humidity control
                  </label>
                  {humidityControlled && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Min humidity (%)</Label>
                        <Input type="number" min={0} max={100} value={humidityMinPct} onChange={e => setHumidityMinPct(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Max humidity (%)</Label>
                        <Input type="number" min={0} max={100} value={humidityMaxPct} onChange={e => setHumidityMaxPct(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {hazmat && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>UN number</Label>
                    <Input placeholder="e.g. UN1203" value={unNumber} onChange={e => setUnNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hazmat class</Label>
                    <Input placeholder="e.g. 3" value={hazmatClass} onChange={e => setHazmatClass(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Packing group</Label>
                    <Select value={packingGroup} onValueChange={setPackingGroup}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="I">I</SelectItem>
                        <SelectItem value="II">II</SelectItem>
                        <SelectItem value="III">III</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Proper shipping name</Label>
                    <Input value={properShippingName} onChange={e => setProperShippingName(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Devices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingDevices.length === 0 && (
            <p className="text-sm text-muted-foreground">No tracking devices attached yet.</p>
          )}
          {pendingDevices.length > 0 && (
            <div className="space-y-2">
              {pendingDevices.map(d => (
                <div key={d.deviceId} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <p className="min-w-0 truncate text-sm font-medium">{d.name}</p>
                  <div className="flex items-center gap-2">
                    <Select value={d.purpose} onValueChange={v => handleDevicePurposeChange(d.deviceId, v)}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_PURPOSES.map(p => (
                          <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => handleRemoveDevice(d.deviceId)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remove device"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Popover open={deviceOpen} onOpenChange={setDeviceOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline">
                <Plus className="h-4 w-4" />
                Add device
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-1" align="start">
              <Input
                autoFocus
                placeholder="Search devices by name or model..."
                value={deviceSearch}
                onChange={e => setDeviceSearch(e.target.value)}
                className="mb-1"
              />
              <div className="max-h-64 overflow-y-auto">
                {filteredDevices.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {devicesList.length === 0 ? 'No devices registered.' : 'No devices match.'}
                  </div>
                ) : (
                  filteredDevices.map((d: any) => {
                    const elsewhere = activeAssignmentElsewhere(d);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleAddDevice(d)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent/15"
                      >
                        <span className="font-medium">{d.name}{d.displayId ? ` (${d.displayId})` : ''}</span>
                        <span className="text-xs text-muted-foreground">
                          {[d.model, d.status, d.batteryLevel != null ? `${d.batteryLevel}% battery` : null]
                            .filter(Boolean).join(' · ')}
                          {elsewhere && (
                            <span className="text-warning">
                              {' '}· Currently on {elsewhere.shipment ? elsewhere.shipment.reference : elsewhere.order?.orderNumber}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-primary" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notes.length === 0 && !addingNote && (
            <p className="text-sm text-muted-foreground">
              No notes added yet.
            </p>
          )}
          {notes.length > 0 && (
            <div className="space-y-2">
              {notes.map((n, i) => {
                const tagDef = NOTE_TAGS.find(t => t.key === n.tag);
                return (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                    <div className="space-y-1">
                      {tagDef?.key && <Badge variant={tagDef.variant}>{tagDef.label}</Badge>}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveNote(i)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remove note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {addingNote ? (
            <div className="space-y-3 rounded-md border border-border p-4">
              <div className="space-y-2">
                <Label>Tag</Label>
                <div className="flex flex-wrap gap-2">
                  {NOTE_TAGS.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setNoteTag(t.key)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors',
                        noteTag === t.key ? t.activeClass : 'border-border hover:border-primary/40 bg-transparent',
                      )}
                    >
                      <span className={cn('h-2 w-2 rounded-full', t.dotClass)} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={3}
                  autoFocus
                  placeholder="Enter note details..."
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setAddingNote(false); setNoteDraft(''); setNoteTag(NOTE_TAGS[0].key); }}>
                  Cancel
                </Button>
                <Button variant="gradient" onClick={handleAddNote} disabled={!noteDraft.trim()}>
                  Add note
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setAddingNote(true)}>
              <Plus className="h-4 w-4" />
              Add note
            </Button>
          )}
        </CardContent>
      </Card>

      {(submitError || dateError || restrictionError) && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {submitError || dateError || restrictionError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to={isEdit && id ? `/shipments/${id}` : '/shipments'}>Cancel</Link>
        </Button>
        <Button variant="gradient" onClick={handleSubmit} disabled={submitting || !!dateError || !!restrictionError}>
          {isEdit ? <Save className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
          {submitting
            ? 'Saving...'
            : isEdit
              ? 'Update shipment'
              : 'Create shipment'}
        </Button>
      </div>

      <Dialog open={confirmReassign} onOpenChange={setConfirmReassign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change this lane's default carrier?</DialogTitle>
            <DialogDescription>
              This lane is currently assigned to {assignedLaneCarrier?.carrier?.name || 'another carrier'}.
              Setting {carriers.find(c => c.id === carrierId)?.name || 'this carrier'} as the default will apply
              to every future shipment on this lane, not just this one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReassign(false)}>Cancel</Button>
            <Button
              variant="default"
              onClick={() => { setSetAsLaneDefault(true); setConfirmReassign(false); }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmStealDevice} onOpenChange={open => !open && setConfirmStealDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign this device?</DialogTitle>
            <DialogDescription>
              {confirmStealDevice?.name} is currently active on {confirmStealDevice?.label}. Attaching it here will
              automatically remove it from there — a device can only track one thing at a time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStealDevice(null)}>Cancel</Button>
            <Button
              variant="default"
              onClick={() => {
                const device = devicesList.find((d: any) => d.id === confirmStealDevice?.deviceId);
                if (device) addDeviceToPending(device);
                setConfirmStealDevice(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
