# Planning & Optimization

## What's Built

- ETA monitoring with traffic-aware routing (TomTom, HERE, Valhalla providers)
- Truck-specific routing support (TomTom provider: vehicle dimensions, weight, hazmat)
- LTL consolidation billing (combine multiple orders, pro-rate by weight)

## What's Partially Built

- **Consolidation**: LTL billing consolidation exists but there's no optimization engine that recommends which orders to consolidate

## What's Planned (On Roadmap)

| Feature | Phase | Notes |
|---------|-------|-------|
| Multi-stop route optimization (TSP solver) | Phase 9 | Not started |
| What-if scenario modeling | Phase 9 (implied) | Not started |

## What's Missing

This is a major gap. Route optimization and load planning are primary ROI drivers for TMS adoption.

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Multi-stop route optimization** | VRP/TSP solver with time windows, vehicle capacity, and HOS constraints. Open source options: Google OR-Tools, VROOM, OptaPlanner. | Critical - core TMS value prop |
| **Load building / cube optimization** | 3D load configuration with weight/cube/floor constraints | High |
| **LTL consolidation optimizer** | Auto-recommend which orders to combine based on origin/dest proximity, weight, class compatibility | High |
| **Mode selection engine** | Auto-recommend TL vs LTL vs intermodal vs parcel based on cost/service/lead time | High |
| **Continuous move / relay planning** | Optimize driver/trailer swap points for multi-leg shipments | Medium |
| **Backhaul optimization** | Match outbound and inbound loads to reduce empty miles | Medium |
| **HOS-aware planning** | Factor driver hours-of-service into route feasibility | Medium |
| **Network design analysis** | Lane-level volume heat map, identify over/underserved corridors | Medium |
| **Inbound freight program** | Vendor-managed routing guides: tell suppliers which carrier to use for inbound freight | Medium |
| **Continuous optimization** | Re-plan as new orders arrive instead of batch-only planning | Low |
| **Fuel cost estimation per route** | Calculate fuel cost based on distance, vehicle MPG, regional fuel prices | Low |

## Implementation Approach

For an open-source TMS, the most practical path:

1. **VROOM or Google OR-Tools** for multi-stop optimization (both open source, VROOM is purpose-built for vehicle routing)
2. **OSRM** for road distance/duration matrices (self-hosted, free)
3. **Simple bin-packing** for load building (weight + cube constraints)
4. **Rule-based mode selection** before investing in a full optimization engine

These would cover 80% of the optimization use cases without requiring commercial solver licenses.
