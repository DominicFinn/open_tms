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
import { IOrderDeliveryService } from './OrderDeliveryService.js';

export interface DeviceEventContext {
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
  ) {}

  async evaluateAndUpdateOrders(ctx: DeviceEventContext): Promise<ArrivalCriteriaMatch[]> {
    const matches: ArrivalCriteriaMatch[] = [];

    // Get all stops for this shipment that haven't been completed
    const stops = await this.prisma.shipmentStop.findMany({
      where: {
        shipmentId: ctx.shipmentId,
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

    // Also check origin/destination directly (shipments without explicit stops)
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: ctx.shipmentId },
      select: {
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
      },
    });

    // Build set of locations to evaluate (from stops + origin/destination)
    const locationCriteriaMap = new Map<string, {
      criteria: any[];
      stopId?: string;
      locationLat?: number;
      locationLng?: number;
    }>();

    for (const stop of stops) {
      if (stop.location.arrivalCriteria.length > 0) {
        locationCriteriaMap.set(stop.locationId, {
          criteria: stop.location.arrivalCriteria,
          stopId: stop.id,
          locationLat: stop.location.lat ?? undefined,
          locationLng: stop.location.lng ?? undefined,
        });
      }
    }

    // Add destination criteria if no stop exists for it
    if (shipment?.destination?.arrivalCriteria?.length && !locationCriteriaMap.has(shipment.destinationId)) {
      locationCriteriaMap.set(shipment.destinationId, {
        criteria: shipment.destination.arrivalCriteria,
        locationLat: shipment.destination.lat ?? undefined,
        locationLng: shipment.destination.lng ?? undefined,
      });
    }

    // Extract available device data from payload
    const wifiNetworks = extractWifiNetworks(ctx.rawPayload);
    const bleBeacons = extractBleBeacons(ctx.rawPayload);

    // Evaluate each location's criteria
    for (const [locationId, entry] of locationCriteriaMap) {
      for (const criteria of entry.criteria) {
        const matched = this.evaluateSingleCriteria(criteria, ctx, entry, wifiNetworks, bleBeacons);
        if (matched) {
          matches.push({
            criteriaId: criteria.id,
            criteriaType: criteria.criteriaType,
            locationId,
            stopId: entry.stopId || '',
            matchDetail: matched,
          });

          // Update stop status if we have a stop
          if (entry.stopId) {
            await this.markStopArrived(entry.stopId, criteria.criteriaType);
          }

          // One criteria match per location is enough
          break;
        }
      }
    }

    return matches;
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

  private async markStopArrived(stopId: string, criteriaType: string): Promise<void> {
    const stop = await this.prisma.shipmentStop.findUnique({ where: { id: stopId } });
    if (!stop || stop.status !== 'pending') return;

    await this.prisma.shipmentStop.update({
      where: { id: stopId },
      data: {
        status: 'arrived',
        actualArrival: new Date(),
      },
    });

    // Update orders at this stop
    const method = criteriaType === 'geofence' ? 'geofence' : 'geofence_iot';
    await this.deliveryService.updateOrdersForStop(stopId, 'arrived', method);
  }
}
