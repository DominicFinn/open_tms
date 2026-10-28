/**
 * The full-journey report for a shipment (#283), covering every stop of a multi-stop journey (#348).
 */

import { ShipmentJourneyRecord, JourneyRecordStop, JourneyCheckpointRecord } from '../../repositories/ShipmentRouteRepository.js';
import { findDestinationStop, findOriginStop } from './journeyStops.js';

export interface JourneyReportStop extends JourneyRecordStop {
  isOrigin: boolean;
  isDestination: boolean;
  /** The vehicle was never seen leaving: the departure was implied by it reaching a later stop. */
  departureInferred: boolean;
}

export interface JourneyReport {
  stops: JourneyReportStop[];
  checkpoints: JourneyCheckpointRecord[];
  origin: { status: string; actualArrival: Date | null; actualDeparture: Date | null } | null;
  destination: { status: string; actualArrival: Date | null } | null;
}

export function buildJourneyReport(journey: ShipmentJourneyRecord): JourneyReport {
  const originStop = findOriginStop(journey.stops, journey.originId);
  const destinationStop = findDestinationStop(journey.stops, journey.destinationId);

  const stops = journey.stops.map((stop) => {
    const isOrigin = stop.id === originStop?.id;
    // BUSINESS RULE: pickups and other stops complete when the vehicle leaves; an inferred departure
    // completes them with no departure time (RecordGeofenceDepartureCommand). Drops complete on
    // entry, so a drop with no departure time is normal, not inferred.
    const departsOnExit = isOrigin || stop.stopType === 'pickup' || stop.stopType === 'other';
    return {
      ...stop,
      isOrigin,
      isDestination: stop.id === destinationStop?.id,
      departureInferred: departsOnExit && stop.status === 'completed' && stop.actualDeparture === null,
    };
  });

  return {
    stops,
    checkpoints: journey.checkpoints,
    origin: originStop
      ? { status: originStop.status, actualArrival: originStop.actualArrival, actualDeparture: originStop.actualDeparture }
      : null,
    destination: destinationStop ? { status: destinationStop.status, actualArrival: destinationStop.actualArrival } : null,
  };
}
