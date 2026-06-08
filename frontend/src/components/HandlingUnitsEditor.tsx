/**
 * HandlingUnitsEditor (Phase 2) — drag-and-drop allocation of OrderLineItems
 * onto TrackableUnits, with per-unit dim/weight override fields and a live
 * cartonization summary.
 *
 * Shared between the customer portal and the admin VNext detail page. The
 * caller passes:
 *   - apiBase: '/api/v1' (admin) or '/api/v1/customer-portal' (portal).
 *     Customer-portal endpoints have a different URL shape from admin ones,
 *     so we pass URL builders directly to keep this component agnostic.
 *   - fetcher: customerFetch (portal) or plain fetch (admin).
 *
 * The component fetches a live cartonization preview from the unit-aware
 * preview endpoint so the totals/class/positions update as the user moves
 * lines around or edits per-unit overrides.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Plus, X, Wand2, Split, Combine } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export interface HUEditorLineItem {
  id: string;
  sku: string;
  description?: string | null;
  quantity: number;
  weight?: number | null;
  weightUnit?: string;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimUnit?: string;
  freightClass?: string | null;
  trackableUnitId?: string | null;
}

export interface HUEditorUnit {
  id: string;
  identifier: string;
  unitType: string;
  sequenceNumber: number;
  packagingType?: {
    id: string;
    code: string;
    name: string;
    kind: string;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
  } | null;
  packagingTypeId?: string | null;
  weight?: number | null;
  weightUnit?: string;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimUnit?: string;
  stackable?: boolean;
}

export interface HUEditorPackagingType {
  id: string;
  code: string;
  name: string;
  kind: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export interface HUEditorEndpoints {
  cartonizationPreview: string;                                 // POST .../cartonization/preview-units
  packagingTypes: string;                                       // GET  .../packaging-types
  createUnit: (orderId: string) => string;                      // POST
  updateUnit: (unitId: string) => string;                       // PUT
  deleteUnit: (unitId: string) => string;                       // DELETE
  moveLineItem: (lineItemId: string) => string;                 // PUT  body { targetUnitId }
  generateBarcode: (unitId: string) => string;                  // POST
  mergeUnits: (orderId: string) => string;                      // POST { sourceUnitId, targetUnitId }
  splitUnit: (unitId: string) => string;                        // POST { itemIdsToMove, newIdentifier }
}

export interface HandlingUnitsEditorProps {
  orderId: string;
  units: HUEditorUnit[];
  lineItems: HUEditorLineItem[];     // ALL line items on the order (assigned + unassigned)
  endpoints: HUEditorEndpoints;
  fetcher?: typeof fetch;
  onChange: () => void | Promise<void>;
  readOnly?: boolean;
}

const UNASSIGNED_ZONE_ID = '__unassigned__';

interface UnitFormDraft {
  packagingTypeId: string;
  identifier: string;
  unitType: string;
  stackable: boolean;
  weight: string;
  weightUnit: string;
  length: string;
  width: string;
  height: string;
  dimUnit: string;
}

function defaultFetcher(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  return fetch(...args);
}

function patchOptions(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}

function emptyDraft(): UnitFormDraft {
  return {
    packagingTypeId: '',
    identifier: '',
    unitType: 'pallet',
    stackable: true,
    weight: '', weightUnit: 'kg',
    length: '', width: '', height: '', dimUnit: 'cm',
  };
}

function DraggableLineItem({ line, disabled }: { line: HUEditorLineItem; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: line.id, disabled });
  const style: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md border border-border bg-card p-2 text-xs ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono font-semibold">{line.sku}</div>
          {line.description && <div className="text-muted-foreground line-clamp-1">{line.description}</div>}
        </div>
        <div className="text-right text-muted-foreground">
          <div>{line.quantity}×</div>
          {line.weight != null && <div>{line.weight} {line.weightUnit || 'kg'}</div>}
        </div>
      </div>
      {line.freightClass && <Badge variant="secondary" className="mt-1 text-xs">cls {line.freightClass}</Badge>}
    </div>
  );
}

function UnitDropZone({
  id, children, label,
}: { id: string; children: React.ReactNode; label?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-md border-2 border-dashed p-2 transition-colors ${isOver ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}
    >
      {label && <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>}
      {children}
    </div>
  );
}

export default function HandlingUnitsEditor({
  orderId, units, lineItems, endpoints, fetcher, onChange, readOnly = false,
}: HandlingUnitsEditorProps) {
  const f = fetcher ?? defaultFetcher;
  const [packagingTypes, setPackagingTypes] = useState<HUEditorPackagingType[]>([]);
  const [showNewUnit, setShowNewUnit] = useState(false);
  const [newDraft, setNewDraft] = useState<UnitFormDraft>(emptyDraft());
  const [unitEdits, setUnitEdits] = useState<Record<string, Partial<HUEditorUnit>>>({});
  const [dragging, setDragging] = useState<HUEditorLineItem | null>(null);
  const [carton, setCarton] = useState<any>(null);
  const [error, setError] = useState('');
  const [splitDialog, setSplitDialog] = useState<{ unitId: string; selected: Set<string> } | null>(null);
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);

  // Load packaging type catalogue once.
  useEffect(() => {
    f(endpoints.packagingTypes)
      .then(r => r.json())
      .then(json => setPackagingTypes(json.data ?? []))
      .catch(() => setPackagingTypes([]));
  }, [endpoints.packagingTypes, f]);

  // Group line items by unit (or 'unassigned').
  const linesByUnit = useMemo(() => {
    const m: Record<string, HUEditorLineItem[]> = { [UNASSIGNED_ZONE_ID]: [] };
    for (const u of units) m[u.id] = [];
    for (const li of lineItems) {
      const key = li.trackableUnitId && m[li.trackableUnitId] !== undefined ? li.trackableUnitId : UNASSIGNED_ZONE_ID;
      m[key].push(li);
    }
    return m;
  }, [units, lineItems]);

  // Live cartonization preview from the unit-aware endpoint.
  useEffect(() => {
    const t = setTimeout(() => {
      const payload = {
        units: units.map(u => {
          const edit = unitEdits[u.id] ?? {};
          const effective = { ...u, ...edit };
          const pt = packagingTypes.find(p => p.id === (effective.packagingTypeId ?? u.packagingType?.id));
          return {
            id: u.id,
            packagingTypeLengthMm: pt?.lengthMm ?? u.packagingType?.lengthMm ?? null,
            packagingTypeWidthMm:  pt?.widthMm  ?? u.packagingType?.widthMm  ?? null,
            packagingTypeHeightMm: pt?.heightMm ?? u.packagingType?.heightMm ?? null,
            weight: effective.weight ?? null,
            weightUnit: effective.weightUnit ?? 'kg',
            length: effective.length ?? null,
            width: effective.width ?? null,
            height: effective.height ?? null,
            dimUnit: effective.dimUnit ?? 'cm',
            stackable: effective.stackable ?? true,
            lines: (linesByUnit[u.id] ?? []).map(li => ({
              quantity: li.quantity,
              weight: li.weight ?? null,
              weightUnit: li.weightUnit ?? 'kg',
              length: li.length ?? null,
              width: li.width ?? null,
              height: li.height ?? null,
              dimUnit: li.dimUnit ?? 'cm',
              freightClass: li.freightClass ?? null,
            })),
          };
        }),
      };
      f(endpoints.cartonizationPreview, patchOptions('POST', payload))
        .then(r => r.json())
        .then(json => setCarton(json.data))
        .catch(() => setCarton(null));
    }, 200);
    return () => clearTimeout(t);
  }, [units, lineItems, unitEdits, packagingTypes, linesByUnit, endpoints.cartonizationPreview, f]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setDragging(lineItems.find(li => li.id === id) ?? null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    if (readOnly) return;
    const lineItemId = String(e.active.id);
    if (!e.over) return;
    const targetId = String(e.over.id);
    const targetUnitId = targetId === UNASSIGNED_ZONE_ID ? null : targetId;

    const current = lineItems.find(li => li.id === lineItemId);
    if (current && (current.trackableUnitId ?? null) === targetUnitId) return;

    try {
      const res = await f(endpoints.moveLineItem(lineItemId), patchOptions('PUT', { targetUnitId }));
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await onChange();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const setUnitField = (unitId: string, field: keyof HUEditorUnit, value: any) => {
    setUnitEdits(prev => ({ ...prev, [unitId]: { ...prev[unitId], [field]: value } }));
  };

  const saveUnit = async (unitId: string) => {
    const edit = unitEdits[unitId];
    if (!edit) return;
    try {
      const res = await f(endpoints.updateUnit(unitId), patchOptions('PUT', edit));
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setUnitEdits(prev => { const n = { ...prev }; delete n[unitId]; return n; });
      await onChange();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cancelUnitEdit = (unitId: string) =>
    setUnitEdits(prev => { const n = { ...prev }; delete n[unitId]; return n; });

  const createUnit = async () => {
    if (!newDraft.identifier.trim()) { setError('Identifier is required'); return; }
    const payload: any = {
      identifier: newDraft.identifier.trim(),
      unitType: newDraft.unitType,
      packagingTypeId: newDraft.packagingTypeId || null,
      stackable: newDraft.stackable,
    };
    if (newDraft.weight) { payload.weight = parseFloat(newDraft.weight); payload.weightUnit = newDraft.weightUnit; }
    if (newDraft.length) { payload.length = parseFloat(newDraft.length); payload.dimUnit = newDraft.dimUnit; }
    if (newDraft.width)  payload.width  = parseFloat(newDraft.width);
    if (newDraft.height) payload.height = parseFloat(newDraft.height);

    try {
      const res = await f(endpoints.createUnit(orderId), patchOptions('POST', payload));
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShowNewUnit(false);
      setNewDraft(emptyDraft());
      await onChange();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteUnit = async (unitId: string) => {
    if (!window.confirm('Delete this handling unit? Its line items will be cascade-deleted.')) return;
    try {
      const res = await f(endpoints.deleteUnit(unitId), patchOptions('DELETE'));
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await onChange();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const generateBarcode = async (unitId: string) => {
    try {
      const res = await f(endpoints.generateBarcode(unitId), patchOptions('POST'));
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await onChange();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const beginMerge = (unitId: string) => setMergeFrom(unitId);
  const cancelMerge = () => setMergeFrom(null);
  const finishMerge = async (targetUnitId: string) => {
    if (!mergeFrom || mergeFrom === targetUnitId) { setMergeFrom(null); return; }
    try {
      const res = await f(endpoints.mergeUnits(orderId), patchOptions('POST', {
        sourceUnitId: mergeFrom, targetUnitId,
      }));
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMergeFrom(null);
      await onChange();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openSplit = (unitId: string) => setSplitDialog({ unitId, selected: new Set() });
  const toggleSplitLine = (lineId: string) => {
    if (!splitDialog) return;
    const next = new Set(splitDialog.selected);
    if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
    setSplitDialog({ ...splitDialog, selected: next });
  };
  const doSplit = async () => {
    if (!splitDialog) return;
    if (splitDialog.selected.size === 0) { setError('Select at least one line item to peel off'); return; }
    const newIdentifier = window.prompt('Identifier for the new unit?', '');
    if (!newIdentifier) return;
    try {
      const res = await f(endpoints.splitUnit(splitDialog.unitId), patchOptions('POST', {
        itemIdsToMove: Array.from(splitDialog.selected),
        newIdentifier,
      }));
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSplitDialog(null);
      await onChange();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          <button className="ml-2 underline" onClick={() => setError('')}>dismiss</button>
        </div>
      )}

      {carton && (
        <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
          <div><div className="text-xs text-muted-foreground">Units</div><div className="font-semibold">{carton.unitCount ?? 0}</div></div>
          <div><div className="text-xs text-muted-foreground">Total weight</div><div className="font-semibold">{(carton.totalWeightLbs ?? 0).toFixed(1)} lb</div></div>
          <div><div className="text-xs text-muted-foreground">Total cube</div><div className="font-semibold">{(carton.totalCubeFt ?? 0).toFixed(2)} ft³</div></div>
          <div><div className="text-xs text-muted-foreground">Rolled-up class</div><div className="font-semibold">{carton.rolledUpFreightClass ?? '-'}</div></div>
          <div><div className="text-xs text-muted-foreground">Pallet positions</div><div className="font-semibold">{carton.palletPositions ?? '-'}</div></div>
          <div><div className="text-xs text-muted-foreground">Linear feet</div><div className="font-semibold">{(carton.linearFeet ?? 0).toFixed(1)}</div></div>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewUnit(s => !s)}>
            <Plus className="h-4 w-4" /> New handling unit
          </Button>
          {mergeFrom && (
            <Badge variant="warning">
              Merge mode: select a target unit. <button className="ml-2 underline" onClick={cancelMerge}>cancel</button>
            </Badge>
          )}
        </div>
      )}

      {showNewUnit && !readOnly && (
        <Card>
          <CardHeader><CardTitle>New handling unit</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Identifier *</Label>
                <Input value={newDraft.identifier} onChange={e => setNewDraft(d => ({ ...d, identifier: e.target.value }))} placeholder="PALLET-001" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit type</Label>
                <Input value={newDraft.unitType} onChange={e => setNewDraft(d => ({ ...d, unitType: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Packaging type</Label>
                <Select value={newDraft.packagingTypeId || 'none'} onValueChange={v => setNewDraft(d => ({ ...d, packagingTypeId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">- none -</SelectItem>
                    {packagingTypes.map(p => <SelectItem key={p.id} value={p.id}>{p.kind}: {p.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stackable</Label>
                <Select value={String(newDraft.stackable)} onValueChange={v => setNewDraft(d => ({ ...d, stackable: v === 'true' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Weight override</Label>
                <div className="flex gap-1">
                  <Input type="number" step="0.1" value={newDraft.weight} onChange={e => setNewDraft(d => ({ ...d, weight: e.target.value }))} />
                  <Select value={newDraft.weightUnit} onValueChange={v => setNewDraft(d => ({ ...d, weightUnit: v }))}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem><SelectItem value="lb">lb</SelectItem><SelectItem value="g">g</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">L × W × H override</Label>
                <div className="flex gap-1">
                  <Input type="number" placeholder="L" value={newDraft.length} onChange={e => setNewDraft(d => ({ ...d, length: e.target.value }))} />
                  <Input type="number" placeholder="W" value={newDraft.width} onChange={e => setNewDraft(d => ({ ...d, width: e.target.value }))} />
                  <Input type="number" placeholder="H" value={newDraft.height} onChange={e => setNewDraft(d => ({ ...d, height: e.target.value }))} />
                  <Select value={newDraft.dimUnit} onValueChange={v => setNewDraft(d => ({ ...d, dimUnit: v }))}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm">cm</SelectItem><SelectItem value="in">in</SelectItem><SelectItem value="mm">mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={createUnit}>Create unit</Button>
              <Button size="sm" variant="outline" onClick={() => { setShowNewUnit(false); setNewDraft(emptyDraft()); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Unassigned lines column */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unassigned line items</CardTitle>
              <p className="text-xs text-muted-foreground">Drag these onto a handling unit to allocate them.</p>
            </CardHeader>
            <CardContent>
              <UnitDropZone id={UNASSIGNED_ZONE_ID}>
                <div className="space-y-1">
                  {(linesByUnit[UNASSIGNED_ZONE_ID] ?? []).length === 0 && (
                    <div className="text-xs text-muted-foreground">All lines are allocated.</div>
                  )}
                  {(linesByUnit[UNASSIGNED_ZONE_ID] ?? []).map(li => (
                    <DraggableLineItem key={li.id} line={li} disabled={readOnly} />
                  ))}
                </div>
              </UnitDropZone>
            </CardContent>
          </Card>

          {units.map(u => {
            const isEditing = !!unitEdits[u.id];
            const e = unitEdits[u.id] ?? {};
            const isMergeTarget = mergeFrom != null && mergeFrom !== u.id;
            const carUnit = carton?.units?.find((cu: any) => cu.id === u.id);
            return (
              <Card key={u.id} className={isMergeTarget ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {u.identifier}
                      <span className="ml-2 text-xs text-muted-foreground">#{u.sequenceNumber}</span>
                    </CardTitle>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {u.unitType}{u.packagingType ? ` · ${u.packagingType.kind}: ${u.packagingType.code}` : ''}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex flex-wrap items-center gap-1">
                      {isMergeTarget ? (
                        <Button size="sm" variant="default" onClick={() => finishMerge(u.id)}>
                          <Combine className="h-3 w-3" /> Merge into this
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => generateBarcode(u.id)} title="Generate barcode">
                            <Wand2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openSplit(u.id)} title="Split unit">
                            <Split className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => beginMerge(u.id)} title="Merge into another">
                            <Combine className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteUnit(u.id)} title="Delete">
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {carUnit && (
                    <div className="rounded border border-dashed border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                      {carUnit.totalWeightLbs > 0 && <span>{carUnit.totalWeightLbs.toFixed(1)} lb ({carUnit.weightSource}) · </span>}
                      {carUnit.totalCubeFt > 0 && <span>{carUnit.totalCubeFt.toFixed(2)} ft³ ({carUnit.dimsSource}) · </span>}
                      {carUnit.densityLbsPerCubeFt != null && <span>density {carUnit.densityLbsPerCubeFt.toFixed(1)} · </span>}
                      {carUnit.rolledUpFreightClass && <span>class {carUnit.rolledUpFreightClass}</span>}
                    </div>
                  )}

                  {!readOnly && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Weight (override)</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={(isEditing ? e.weight : u.weight) ?? ''}
                            onChange={ev => setUnitField(u.id, 'weight', ev.target.value === '' ? null : parseFloat(ev.target.value))}
                          />
                          <Select value={(isEditing ? e.weightUnit : u.weightUnit) ?? 'kg'} onValueChange={v => setUnitField(u.id, 'weightUnit', v)}>
                            <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="lb">lb</SelectItem><SelectItem value="g">g</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">L × W × H</Label>
                        <div className="flex gap-1">
                          <Input type="number" placeholder="L" value={(isEditing ? e.length : u.length) ?? ''} onChange={ev => setUnitField(u.id, 'length', ev.target.value === '' ? null : parseFloat(ev.target.value))} />
                          <Input type="number" placeholder="W" value={(isEditing ? e.width  : u.width)  ?? ''} onChange={ev => setUnitField(u.id, 'width',  ev.target.value === '' ? null : parseFloat(ev.target.value))} />
                          <Input type="number" placeholder="H" value={(isEditing ? e.height : u.height) ?? ''} onChange={ev => setUnitField(u.id, 'height', ev.target.value === '' ? null : parseFloat(ev.target.value))} />
                          <Select value={(isEditing ? e.dimUnit : u.dimUnit) ?? 'cm'} onValueChange={v => setUnitField(u.id, 'dimUnit', v)}>
                            <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="cm">cm</SelectItem><SelectItem value="in">in</SelectItem><SelectItem value="mm">mm</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Stackable</Label>
                        <Select value={String((isEditing ? e.stackable : u.stackable) ?? true)} onValueChange={v => setUnitField(u.id, 'stackable', v === 'true')}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {isEditing && (
                        <div className="sm:col-span-3 flex gap-2">
                          <Button size="sm" onClick={() => saveUnit(u.id)}>Save unit</Button>
                          <Button size="sm" variant="outline" onClick={() => cancelUnitEdit(u.id)}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  )}

                  <UnitDropZone id={u.id} label="Line items">
                    <div className="space-y-1">
                      {(linesByUnit[u.id] ?? []).length === 0 && (
                        <div className="text-xs text-muted-foreground">No lines yet — drag here from another unit or the unassigned list.</div>
                      )}
                      {(linesByUnit[u.id] ?? []).map(li => (
                        <DraggableLineItem key={li.id} line={li} disabled={readOnly} />
                      ))}
                    </div>
                  </UnitDropZone>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DragOverlay>
          {dragging ? <DraggableLineItem line={dragging} disabled /> : null}
        </DragOverlay>
      </DndContext>

      {splitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-md border border-border bg-background p-4 shadow-lg">
            <h3 className="text-lg font-semibold">Split handling unit</h3>
            <p className="mt-1 text-sm text-muted-foreground">Pick the line items to peel off onto a new unit.</p>
            <div className="my-4 max-h-80 space-y-1 overflow-auto">
              {(linesByUnit[splitDialog.unitId] ?? []).map(li => (
                <label key={li.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={splitDialog.selected.has(li.id)}
                    onChange={() => toggleSplitLine(li.id)}
                  />
                  <div className="flex-1">
                    <div className="font-mono font-semibold">{li.sku}</div>
                    {li.description && <div className="text-muted-foreground">{li.description}</div>}
                  </div>
                  <div className="text-muted-foreground">{li.quantity}×</div>
                </label>
              ))}
              {(linesByUnit[splitDialog.unitId] ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground">This unit has no line items yet.</div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSplitDialog(null)}>Cancel</Button>
              <Button onClick={doSplit}>Split</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
