/**
 * ArrivalCriteriaEvaluationService
 *
 * Evaluates incoming IoT device data against a location's arrival criteria.
 * Supports three criteria types:
 *   - Geofence: GPS coordinates within radius
 *   - WiFi: device detects a known WiFi SSID/BSSID
 *   - BLE: device detects a known Bluetooth beacon (UUID/major/minor)
 *
 * Called from the inbound webhook worker after device events are processed.
 * When criteria are met, updates shipment stop and order delivery status.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { IOrderDeliveryService } from './OrderDeliveryService.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { RECORD_GEOFENCE_ARRIVAL } from '../commands/tracking/RecordGeofenceArrivalCommand.js';
import { RECORD_GEOFENCE_DEPARTURE } from '../commands/tracking/RecordGeofenceDepartureCommand.js';
import { RECORD_JOURNEY_CHECKPOINT } from '../commands/tracking/RecordJourneyCheckpointCommand.js';
import { locateOnRoute, checkpointIndexForFraction, passedCheckpoints, fractionOfSpan } from './routing/RouteProgressService.js';
import { JourneyStop, actionableStops, findDestinationStop, findOriginStop } from './tracking/journeyStops.js';

export interface DeviceEventContext {
  orgId: string;
  shipmentId: string;
  deviceId?: string;
  lat?: number;
  lng?: number;
  /** Device timestamp (ISO) of the ping. Stamps arrivals, departures and checkpoints. */
  eventTime?: string;
  rawPayload: any;
}

export interface ArrivalCriteriaMatch {
  criteriaId: string;
  criteriaType: string;
  locationId: string;
  stopId: string;
  matchDetail: string;
}

export interface IArrivalCriteriaEvaluationService {
  evaluateAndUpdateOrders(ctx: DeviceEventContext): Promise<ArrivalCriteriaMatch[]>;
}

/** Haversine distance in meters between two lat/lng points */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Extract WiFi networks from a System Loco payload */
function extractWifiNetworks(payload: any): Array<{ ssid?: string; bssid?: string }> {
  const networks: Array<{ ssid?: string; bssid?: string }> = [];

  // System Loco may include wifi data in various payload shapes
  const wifi = payload?.wifi || payload?.payload?.wifi || payload?.networks || payload?.payload?.networks;
  if (Array.isArray(wifi)) {
    for (const net of wifi) {
      networks.push({
        ssid: net.ssid || net.name,
        bssid: net.bssid || net.mac,
      });
    }
  }

  // Single wifi object
  if (wifi && !Array.isArray(wifi)) {
    networks.push({
      ssid: wifi.ssid || wifi.name,
      bssid: wifi.bssid || wifi.mac,
    });
  }

  // Also check location.wifi for System Loco format
  const locWifi = payload?.location?.wifi;
  if (Array.isArray(locWifi)) {
    for (const net of locWifi) {
      networks.push({ ssid: net.ssid, bssid: net.bssid || net.mac });
    }
  }

  return networks;
}

/** Extract BLE beacons/anchors from a System Loco payload */
function extractBleBeacons(payload: any): Array<{
  uuid?: string; major?: number; minor?: number; rssi?: number;
  anchorId?: string; readerId?: string;
}> {
  const beacons: Array<{
    uuid?: string; major?: number; minor?: number; rssi?: number;
    anchorId?: string; readerId?: string;
  }> = [];

  const ble = payload?.ble || payload?.payload?.ble || payload?.beacons || payload?.payload?.beacons;
  if (Array.isArray(ble)) {
    for (const b of ble) {
      beacons.push({
        uuid: b.uuid || b.id,
        major: b.major,
        minor: b.minor,
        rssi: b.rssi,
        anchorId: b.anchorId || b.anchor_id || b.readerId || b.reader_id,
        readerId: b.readerId || b.reader_id || b.anchorId || b.anchor_id,
      });
    }
  }

  if (ble && !Array.isArray(ble)) {
    beacons.push({
      uuid: ble.uuid || ble.id,
      major: ble.major,
      minor: ble.minor,
      rssi: ble.rssi,
      anchorId: ble.anchorId || ble.anchor_id || ble.readerId || ble.reader_id,
      readerId: ble.readerId || ble.reader_id || ble.anchorId || ble.anchor_id,
    });
  }

  // System Loco location.ble format
  const locBle = payload?.location?.ble;
  if (Array.isArray(locBle)) {
    for (const b of locBle) {
      beacons.push({
        uuid: b.uuid, major: b.major, minor: b.minor, rssi: b.rssi,
        anchorId: b.anchorId || b.anchor_id,
        readerId: b.readerId || b.reader_id,
      });
    }
  }

  // Also check for anchor/reader reports directly in payload
  const anchors = payload?.anchors || payload?.payload?.anchors || payload?.readers || payload?.payload?.readers;
  if (Array.isArray(anchors)) {
    for (const a of anchors) {
      beacons.push({
        anchorId: a.id || a.anchorId || a.anchor_id,
        readerId: a.id || a.readerId || a.reader_id,
        rssi: a.rssi,
        uuid: a.uuid,
      });
    }
  }

  return beacons;
}

export class ArrivalCriteriaEvaluationService implements IArrivalCriteriaEvaluationService {
  constructor(
    private prisma: PrismaClient,
    private deliveryService: IOrderDeliveryService,
    private commandBus: ICommandBus,
  ) {}

  async evaluateAndUpdateOrders(ctx: DeviceEventContext): Promise<ArrivalCriteriaMatch[]> {
    const shipment = await this.loadShipment(ctx);
    if (!shipment) return [];

    const originStop = findOriginStop(shipment.stops, shipment.originId);
    const eventTime = ctx.eventTime ?? new Date().toISOString();
    const wifiNetworks = extractWifiNetworks(ctx.rawPayload);
    const bleBeacons = extractBleBeacons(ctx.rawPayload);
    const matches: ArrivalCriteriaMatch[] = [];
    let arrivedThisPing = false;

    for (const stop of actionableStops(shipment.stops)) {
      const criteria = stop.location.arrivalCriteria;
      if (criteria.length === 0) continue;
      const entry = { locationLat: stop.location.lat ?? undefined, locationLng: stop.location.lng ?? undefined };
      // Pickups (the origin and any further pickup, #329) arrive on entry and complete on departure.
      const isPickup = stop.stopType === 'pickup' || stop.id === originStop?.id;
      const match = this.firstMatch(criteria, ctx, entry, wifiNetworks, bleBeacons);

      if (match) {
        matches.push({ criteriaId: match.criteria.id, criteriaType: match.criteria.criteriaType, locationId: stop.locationId, stopId: stop.id, matchDetail: match.detail });
        if (stop.status === 'pending') {
          const method = match.criteria.criteriaType === 'geofence' ? 'geofence' : 'geofence_iot';
          const unfinishedPickups = isPickup ? [] : shipment.stops.filter((st) =>
            (st.stopType === 'pickup' || st.id === originStop?.id) && st.sequenceNumber < stop.sequenceNumber && st.status !== 'completed');
          arrivedThisPing = await this.arriveAtStop(shipment.orgId, ctx, stop, isPickup, unfinishedPickups, eventTime, method) || arrivedThisPing;
        }
      } else if (isPickup && stop.status === 'arrived') {
        await this.departPickupIfOutside(shipment.orgId, ctx, stop, criteria, eventTime);
      }
    }

    // Shipments with no stop at the destination still report a match there, with no stop to move.
    if (!shipment.stops.some((s) => s.locationId === shipment.destinationId)) {
      const destinationMatch = this.matchDestinationWithoutStop(shipment, ctx, wifiNetworks, bleBeacons);
      if (destinationMatch) matches.push(destinationMatch);
    }

    // In-transit checkpoint: only when this same ping didn't just record an
    // arrival (arrival always wins over a same-ping checkpoint).
    if (!arrivedThisPing && ctx.lat != null && ctx.lng != null) {
      await this.recordCheckpointIfDue(shipment, originStop, ctx, eventTime);
    }

    return matches;
  }

  private async loadShipment(ctx: DeviceEventContext) {
    return this.prisma.shipment.findUnique({
      where: { id: ctx.shipmentId, orgId: ctx.orgId },
      select: {
        orgId: true,
        originId: true,
        destinationId: true,
        destination: {
          include: { arrivalCriteria: { where: { active: true }, orderBy: { priority: 'desc' } } },
        },
        stops: {
          orderBy: { sequenceNumber: 'asc' },
          select: {
            id: true, locationId: true, sequenceNumber: true, status: true, stopType: true, actualArrival: true, actualDeparture: true,
            location: {
              select: {
                lat: true,
                lng: true,
                arrivalCriteria: { where: { active: true }, orderBy: { priority: 'desc' } },
              },
            },
          },
        },
        route: { select: { encodedPolyline: true } },
        lane: { select: { route: { select: { encodedPolyline: true } } } },
      },
    });
  }

  private firstMatch(
    criteria: any[], ctx: DeviceEventContext, entry: { locationLat?: number; locationLng?: number },
    wifiNetworks: Array<{ ssid?: string; bssid?: string }>,
    bleBeacons: Array<{ uuid?: string; major?: number; minor?: number; rssi?: number }>,
  ): { criteria: any; detail: string } | null {
    for (const c of criteria) {
      const detail = this.evaluateSingleCriteria(c, ctx, entry, wifiNetworks, bleBeacons);
      if (detail) return { criteria: c, detail };
    }
    return null;
  }

  /**
   * Arrival at a pending stop. A pickup only arrives; a drop completes on entry (#324). Reaching a
   * drop proves the vehicle left the pickups before it, so a departure no ping ever showed is
   * recorded first, as inferred, for each of them (#329).
   */
  private async arriveAtStop(
    orgId: string, ctx: DeviceEventContext, stop: { id: string; locationId: string }, isPickup: boolean,
    unfinishedPickups: Array<{ id: string; locationId: string }>, eventTime: string, method: string,
  ): Promise<boolean> {
    for (const pickup of unfinishedPickups) {
      const departed = await this.recordDeparture(orgId, ctx, pickup.id, pickup.locationId, eventTime, true);
      if (departed) {
        await this.deliveryService.updateOrdersForStop(orgId, pickup.id, 'completed', method, new Date(eventTime));
      }
    }

    const arrived = await this.recordArrival(orgId, ctx, stop.id, stop.locationId, eventTime, !isPickup);
    if (arrived) {
      await this.deliveryService.updateOrdersForStop(orgId, stop.id, isPickup ? 'arrived' : 'completed', method, new Date(eventTime));
    }
    return arrived;
  }

  /** Departure needs a geofence (WiFi/BLE presence has no "outside") and a GPS position. */
  private async departPickupIfOutside(
    orgId: string, ctx: DeviceEventContext, stop: { id: string; locationId: string }, criteria: any[], eventTime: string,
  ): Promise<void> {
    if (ctx.lat == null || ctx.lng == null) return;
    if (!criteria.some((c: any) => c.criteriaType === 'geofence')) return;
    const departed = await this.recordDeparture(orgId, ctx, stop.id, stop.locationId, eventTime, false);
    if (departed) {
      await this.deliveryService.updateOrdersForStop(orgId, stop.id, 'completed', 'geofence', new Date(eventTime));
    }
  }

  private matchDestinationWithoutStop(
    shipment: { destinationId: string | null; destination: { lat: number | null; lng: number | null; arrivalCriteria: any[] } | null },
    ctx: DeviceEventContext,
    wifiNetworks: Array<{ ssid?: string; bssid?: string }>,
    bleBeacons: Array<{ uuid?: string; major?: number; minor?: number; rssi?: number }>,
  ): ArrivalCriteriaMatch | null {
    const destination = shipment.destination;
    if (!shipment.destinationId || !destination?.arrivalCriteria.length) return null;
    const entry = { locationLat: destination.lat ?? undefined, locationLng: destination.lng ?? undefined };
    const match = this.firstMatch(destination.arrivalCriteria, ctx, entry, wifiNetworks, bleBeacons);
    if (!match) return null;
    return { criteriaId: match.criteria.id, criteriaType: match.criteria.criteriaType, locationId: shipment.destinationId, stopId: '', matchDetail: match.detail };
  }

  private async recordArrival(
    orgId: string, ctx: DeviceEventContext, stopId: string, locationId: string, eventTime: string, completesStop: boolean,
  ): Promise<boolean> {
    const result = await this.commandBus.dispatch<any, { arrived: boolean }>({
      type: RECORD_GEOFENCE_ARRIVAL,
      orgId,
      actorId: null,
      payload: {
        shipmentId: ctx.shipmentId, stopId, locationId, lat: ctx.lat, lng: ctx.lng, eventTime, completesStop, deviceId: ctx.deviceId,
      },
      metadata: { correlationId: randomUUID(), source: 'geofence_evaluation' },
    });
    return !!result.success && !!result.data?.arrived;
  }

  private async recordDeparture(
    orgId: string, ctx: DeviceEventContext, stopId: string, locationId: string, eventTime: string, inferred: boolean,
  ): Promise<boolean> {
    const result = await this.commandBus.dispatch<any, { departed: boolean }>({
      type: RECORD_GEOFENCE_DEPARTURE,
      orgId,
      actorId: null,
      payload: {
        shipmentId: ctx.shipmentId, stopId, locationId, eventTime, deviceId: ctx.deviceId,
        ...(inferred ? { inferred: true } : { lat: ctx.lat, lng: ctx.lng }),
      },
      metadata: { correlationId: randomUUID(), source: 'geofence_evaluation' },
    });
    return !!result.success && !!result.data?.departed;
  }

  private async recordCheckpointIfDue(
    shipment: {
      orgId: string;
      destinationId: string | null;
      stops: Array<JourneyStop & { location: { arrivalCriteria: any[] } }>;
      route: { encodedPolyline: string } | null;
      lane: { route: { encodedPolyline: string } | null } | null;
    },
    originStop: (JourneyStop & { location: { arrivalCriteria: any[] } }) | null,
    ctx: DeviceEventContext,
    eventTime: string,
  ): Promise<void> {
    // A custom-route shipment's own route, otherwise its lane's (#328).
    const routePolyline = shipment.route?.encodedPolyline ?? shipment.lane?.route?.encodedPolyline;
    const destinationStop = findDestinationStop(shipment.stops, shipment.destinationId);
    if (!routePolyline || !originStop || !destinationStop) return;
    if (originStop.status !== 'completed') return; // hasn't departed origin yet
    if (destinationStop.status === 'arrived' || destinationStop.status === 'completed') return; // already arrived

    const progress = locateOnRoute({ lat: ctx.lat!, lng: ctx.lng! }, routePolyline);
    if (!progress) return;

    const span = {
      startOffsetMeters: geofenceRadius(originStop.location.arrivalCriteria),
      endOffsetMeters: geofenceRadius(destinationStop.location.arrivalCriteria),
    };
    const fraction = fractionOfSpan(progress, span);
    const checkpointIndex = checkpointIndexForFraction(fraction);

    await this.commandBus.dispatch({
      type: RECORD_JOURNEY_CHECKPOINT,
      orgId: shipment.orgId,
      actorId: null,
      payload: {
        shipmentId: ctx.shipmentId,
        stopId: destinationStop.id,
        locationId: destinationStop.locationId,
        lat: ctx.lat!, lng: ctx.lng!, eventTime,
        checkpointIndex,
        distanceAlongRouteMeters: progress.distanceAlongRouteMeters,
        fractionComplete: fraction,
        passed: passedCheckpoints(routePolyline, checkpointIndex, span),
        deviceId: ctx.deviceId,
      },
      metadata: { correlationId: randomUUID(), source: 'geofence_evaluation' },
    });
  }

  private evaluateSingleCriteria(
    criteria: any,
    ctx: DeviceEventContext,
    entry: { locationLat?: number; locationLng?: number },
    wifiNetworks: Array<{ ssid?: string; bssid?: string }>,
    bleBeacons: Array<{ uuid?: string; major?: number; minor?: number; rssi?: number }>,
  ): string | null {
    switch (criteria.criteriaType) {
      case 'geofence':
        return this.evaluateGeofence(criteria, ctx, entry);
      case 'wifi':
        return this.evaluateWifi(criteria, wifiNetworks);
      case 'ble':
        return this.evaluateBle(criteria, bleBeacons);
      default:
        return null;
    }
  }

  private evaluateGeofence(
    criteria: any,
    ctx: DeviceEventContext,
    entry: { locationLat?: number; locationLng?: number },
  ): string | null {
    if (!ctx.lat || !ctx.lng) return null;
    const radius = criteria.radiusMeters;
    if (!radius) return null;

    // Use criteria-specific coordinates, or fall back to location coordinates
    const centerLat = criteria.lat ?? entry.locationLat;
    const centerLng = criteria.lng ?? entry.locationLng;
    if (!centerLat || !centerLng) return null;

    const distance = haversineMeters(ctx.lat, ctx.lng, centerLat, centerLng);
    if (distance <= radius) {
      return `Geofence: ${Math.round(distance)}m within ${radius}m radius`;
    }
    return null;
  }

  private evaluateWifi(
    criteria: any,
    wifiNetworks: Array<{ ssid?: string; bssid?: string }>,
  ): string | null {
    if (wifiNetworks.length === 0) return null;

    for (const network of wifiNetworks) {
      // BSSID match is most precise (MAC address of access point)
      if (criteria.wifiBssid && network.bssid) {
        if (criteria.wifiBssid.toLowerCase() === network.bssid.toLowerCase()) {
          return `WiFi BSSID match: ${network.bssid}`;
        }
      }
      // SSID match (network name — less precise but useful)
      if (criteria.wifiSsid && network.ssid) {
        if (criteria.wifiSsid.toLowerCase() === network.ssid.toLowerCase()) {
          return `WiFi SSID match: ${network.ssid}`;
        }
      }
    }
    return null;
  }

  /**
   * BLE arrival works in two scenarios:
   *
   * 1. Fixed reader at location sees a mobile tag on shipment:
   *    - Location has a bleAnchorId (the fixed reader/anchor ID at the dock)
   *    - IoT report contains that anchor/reader ID in the BLE scan results
   *    - Match: the reader at this location saw the shipment's tag
   *
   * 2. Mobile reader (on shipment) sees a known BLE tag at end location:
   *    - Location has bleUuid/bleMajor/bleMinor (the fixed beacon at the dock)
   *    - IoT device report includes this beacon in its BLE scan
   *    - Match: the shipment's device detected the beacon at this location
   */
  private evaluateBle(
    criteria: any,
    bleBeacons: Array<{ uuid?: string; major?: number; minor?: number; rssi?: number; anchorId?: string; readerId?: string }>,
  ): string | null {
    if (bleBeacons.length === 0) return null;

    for (const beacon of bleBeacons) {
      // Scenario 1: Fixed reader at location — match by anchor/reader ID
      if (criteria.bleAnchorId) {
        const reportedId = beacon.anchorId || beacon.readerId;
        if (reportedId && criteria.bleAnchorId.toLowerCase() === reportedId.toLowerCase()) {
          // RSSI threshold check if configured
          if (criteria.bleRssiThreshold != null && beacon.rssi != null) {
            if (beacon.rssi < criteria.bleRssiThreshold) continue;
          }
          return `BLE reader match: anchor=${reportedId} at location (fixed reader saw shipment tag)`;
        }
      }

      // Scenario 2: Mobile reader sees known beacon — match by UUID/major/minor
      if (criteria.bleUuid && beacon.uuid) {
        if (criteria.bleUuid.toLowerCase() !== beacon.uuid.toLowerCase()) continue;

        if (criteria.bleMajor != null && beacon.major !== criteria.bleMajor) continue;
        if (criteria.bleMinor != null && beacon.minor !== criteria.bleMinor) continue;

        // RSSI threshold check
        if (criteria.bleRssiThreshold != null && beacon.rssi != null) {
          if (beacon.rssi < criteria.bleRssiThreshold) continue;
        }

        return `BLE beacon match: UUID=${beacon.uuid} major=${beacon.major} minor=${beacon.minor} (mobile reader saw fixed beacon)`;
      }
    }
    return null;
  }
}

/** The largest active geofence radius among a location's criteria, or 0 when it has none. */
function geofenceRadius(criteria: any[]): number {
  return criteria
    .filter((c) => c.criteriaType === 'geofence' && typeof c.radiusMeters === 'number')
    .reduce((max, c) => Math.max(max, c.radiusMeters), 0);
}
