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
import { locateOnRoute, checkpointIndexForFraction } from './routing/RouteProgressService.js';

export interface DeviceEventContext {
  orgId: string;
  shipmentId: string;
  deviceId?: string;
  lat?: number;
  lng?: number;
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
    const matches: ArrivalCriteriaMatch[] = [];

    // Get all stops for this shipment that haven't been completed
    const stops = await this.prisma.shipmentStop.findMany({
      where: {
        shipmentId: ctx.shipmentId,
        shipment: { orgId: ctx.orgId },
        status: { in: ['pending', 'arrived'] },
      },
      include: {
        location: {
          include: {
            arrivalCriteria: {
              where: { active: true },
              orderBy: { priority: 'desc' },
            },
          },
        },
      },
    });

    // Also check origin/destination directly (shipments without explicit stops),
    // and load everything needed for departure/checkpoint detection below.
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: ctx.shipmentId, orgId: ctx.orgId },
      select: {
        orgId: true,
        originId: true,
        destinationId: true,
        origin: {
          include: {
            arrivalCriteria: { where: { active: true }, orderBy: { priority: 'desc' } },
          },
        },
        destination: {
          include: {
            arrivalCriteria: { where: { active: true }, orderBy: { priority: 'desc' } },
          },
        },
        stops: { select: { id: true, locationId: true, status: true } },
        lane: { select: { route: { select: { encodedPolyline: true } } } },
      },
    });

    if (!shipment) return matches;

    // Build set of locations to evaluate (from stops + origin/destination)
    const locationCriteriaMap = new Map<string, {
      criteria: any[];
      stopId?: string;
      locationLat?: number;
      locationLng?: number;
      isOrigin: boolean;
      isDestination: boolean;
    }>();

    for (const stop of stops) {
      if (stop.location.arrivalCriteria.length > 0) {
        locationCriteriaMap.set(stop.locationId, {
          criteria: stop.location.arrivalCriteria,
          stopId: stop.id,
          locationLat: stop.location.lat ?? undefined,
          locationLng: stop.location.lng ?? undefined,
          isOrigin: stop.locationId === shipment.originId,
          isDestination: stop.locationId === shipment.destinationId,
        });
      }
    }

    // Add destination criteria if no stop exists for it
    const destinationId = shipment.destinationId ?? null;
    if (destinationId && shipment.destination?.arrivalCriteria?.length && !locationCriteriaMap.has(destinationId)) {
      locationCriteriaMap.set(destinationId, {
        criteria: shipment.destination.arrivalCriteria,
        locationLat: shipment.destination.lat ?? undefined,
        locationLng: shipment.destination.lng ?? undefined,
        isOrigin: false,
        isDestination: true,
      });
    }

    // Extract available device data from payload
    const wifiNetworks = extractWifiNetworks(ctx.rawPayload);
    const bleBeacons = extractBleBeacons(ctx.rawPayload);
    const eventTime = new Date().toISOString();
    let arrivedThisPing = false;

    // Evaluate each location's criteria
    for (const [locationId, entry] of locationCriteriaMap) {
      let matchedThisLocation = false;

      for (const criteria of entry.criteria) {
        const matched = this.evaluateSingleCriteria(criteria, ctx, entry, wifiNetworks, bleBeacons);
        if (matched) {
          matchedThisLocation = true;
          matches.push({
            criteriaId: criteria.id,
            criteriaType: criteria.criteriaType,
            locationId,
            stopId: entry.stopId || '',
            matchDetail: matched,
          });

          if (entry.stopId) {
            const arrived = await this.recordArrival(
              shipment.orgId, ctx.shipmentId, entry.stopId, locationId,
              ctx.lat, ctx.lng, eventTime, entry.isDestination,
            );
            if (arrived) {
              arrivedThisPing = true;
              const method = criteria.criteriaType === 'geofence' ? 'geofence' : 'geofence_iot';
              // Destination arrival is the only signal this pipeline has that a
              // delivery happened — 'completed' is what makes updateOrdersForStop
              // mark the orders at this stop delivered, not just in_transit.
              // ShipmentCompletionHandler completes the *shipment* on the same
              // event; without this, the order's own status never follows it.
              await this.deliveryService.updateOrdersForStop(
                shipment.orgId, entry.stopId, entry.isDestination ? 'completed' : 'arrived', method,
              );
            }
          }

          // One criteria match per location is enough
          break;
        }
      }

      // Departure: only the origin stop, only where a geofence criteria is
      // configured (wifi/ble presence has no "outside" notion), only with GPS.
      if (!matchedThisLocation && entry.stopId && entry.isOrigin && ctx.lat != null && ctx.lng != null) {
        const geofenceCriteria = entry.criteria.find((c: any) => c.criteriaType === 'geofence');
        if (geofenceCriteria) {
          const departed = await this.recordDeparture(
            shipment.orgId, ctx.shipmentId, entry.stopId, locationId, ctx.lat, ctx.lng, eventTime,
          );
          if (departed) {
            await this.deliveryService.updateOrdersForStop(shipment.orgId, entry.stopId, 'completed', 'geofence');
          }
        }
      }
    }

    // In-transit checkpoint: only when this same ping didn't just record an
    // arrival (arrival always wins over a same-ping checkpoint).
    if (!arrivedThisPing && ctx.lat != null && ctx.lng != null) {
      await this.recordCheckpointIfDue(shipment, ctx.shipmentId, ctx.lat, ctx.lng, eventTime);
    }

    return matches;
  }

  private async recordArrival(
    orgId: string, shipmentId: string, stopId: string, locationId: string,
    lat: number | undefined, lng: number | undefined, eventTime: string, isDestination: boolean,
  ): Promise<boolean> {
    const result = await this.commandBus.dispatch<any, { arrived: boolean }>({
      type: RECORD_GEOFENCE_ARRIVAL,
      orgId,
      actorId: null,
      payload: { shipmentId, stopId, locationId, lat, lng, eventTime, isDestination },
      metadata: { correlationId: randomUUID(), source: 'geofence_evaluation' },
    });
    return !!result.success && !!result.data?.arrived;
  }

  private async recordDeparture(
    orgId: string, shipmentId: string, stopId: string, locationId: string,
    lat: number, lng: number, eventTime: string,
  ): Promise<boolean> {
    const result = await this.commandBus.dispatch<any, { departed: boolean }>({
      type: RECORD_GEOFENCE_DEPARTURE,
      orgId,
      actorId: null,
      payload: { shipmentId, stopId, locationId, lat, lng, eventTime },
      metadata: { correlationId: randomUUID(), source: 'geofence_evaluation' },
    });
    return !!result.success && !!result.data?.departed;
  }

  private async recordCheckpointIfDue(
    shipment: {
      orgId: string;
      originId: string | null;
      destinationId: string | null;
      stops: { id: string; locationId: string; status: string }[];
      lane: { route: { encodedPolyline: string } | null } | null;
    },
    shipmentId: string, lat: number, lng: number, eventTime: string,
  ): Promise<void> {
    const routePolyline = shipment.lane?.route?.encodedPolyline;
    if (!routePolyline || !shipment.originId || !shipment.destinationId) return;

    const originStop = shipment.stops.find((s) => s.locationId === shipment.originId);
    const destinationStop = shipment.stops.find((s) => s.locationId === shipment.destinationId);
    if (!originStop || !destinationStop) return;
    if (originStop.status !== 'completed') return; // hasn't departed origin yet
    if (destinationStop.status === 'arrived' || destinationStop.status === 'completed') return; // already arrived

    const progress = locateOnRoute({ lat, lng }, routePolyline);
    if (!progress) return;

    const checkpointIndex = checkpointIndexForFraction(progress.fraction);

    await this.commandBus.dispatch({
      type: RECORD_JOURNEY_CHECKPOINT,
      orgId: shipment.orgId,
      actorId: null,
      payload: {
        shipmentId,
        stopId: destinationStop.id,
        locationId: shipment.destinationId,
        lat, lng, eventTime,
        checkpointIndex,
        distanceAlongRouteMeters: progress.distanceAlongRouteMeters,
        fractionComplete: progress.fraction,
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
