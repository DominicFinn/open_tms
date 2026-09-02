# ADR 0003: Two Map Modes, Google When A Key Is Configured And OSM When Not

- **Status:** Accepted
- **Date:** 2026-09-02
- **Relates to:** #176, #158

## Context

The product has always intended two map tiers: a richer experience for organisations that supply a
Google Maps API key, and a free tier for everyone else. `MapProvider.tsx` encoded that intent from
early on, resolving to `'google'` or `'osm'`.

An audit for #158 found the intent had drifted badly in three separate ways, none of them decided.

**The basemap was never a decision.** Four Leaflet surfaces each hardcoded a CartoDB tile URL. They
got there in commit `b7de976`, which added a dark-themed UI prototype, and became the only tile
source in `060dddf`, the shadcn migration that deleted the older pages along with every
OpenStreetMap URL they contained. Carto later began requiring an account, so maps started rendering
an "API KEY REQUIRED" watermark. Nobody chose Carto over OSM; OSM was deleted out from under it.

**Google mode could never be entered.** `GET /api/v1/maps/api-key` declared its response schema as
`data: { type: 'object' }` with no properties. Fastify serialises responses against the schema and
drops anything undeclared, so the endpoint returned `{}` for every request regardless of what was
stored. `MapProvider` read `result.data?.apiKey`, always got `undefined`, and always fell back to
OSM. `GET /api/v1/maps/settings` had the same defect, so the settings screen could not report that
a key was configured either. An organisation could configure a valid key and see no change
anywhere in the product.

**The free tier was half-built and disconnected.** `services/geocoding.ts` contained working
`nominatimSearch` and `nominatimReverse` implementations that nothing imported. `AddressFields`
hid its address search entirely without a Google key rather than using them. `GoogleMapsRouteEditor`
had no non-Google path at all and rendered an "API key required" banner, so lane route planning was
unavailable to anyone without a key.

The common thread is that each surface decided for itself which provider it was talking to, so
there was no single place where the tier was expressed, and three separate regressions could hide.

## Decision

**Map behaviour is expressed as a capability set, resolved once, and consumed everywhere.**

`maps/capabilities.ts` maps a `MapMode` onto a `MapCapabilities` record. Screens gate on a named
capability (`capabilities.routePlanning`), never on the mode itself. A capability moving between
modes, or a third mode arriving, touches that one file.

**OSM mode is the default and is fully functional, not a degraded stub.** It draws OpenStreetMap
standard tiles, geocodes through Nominatim, and plans lane routes by letting the planner place
waypoints on the map. Routes drawn this way are stored in the same encoded polyline format as
Google's, so deviation monitoring and every other consumer are unaffected, and are marked
`provider: 'manual'` so a straight-line distance is never mistaken for a road-network one.

**Google mode adds capability, not appearance.** Google's terms require their tiles be rendered
through the Google Maps JS API, so they cannot be used as a Leaflet tile layer. The Leaflet
surfaces therefore draw OSM tiles in both modes. Google mode unlocks Places autocomplete, road
routing with a draggable line, and Google geocoding and distance.

**One place decides the basemap.** `addBaseTileLayer` in `lib/leafletMap.ts` is the only tile
source in the frontend.

### Alternatives considered and rejected

1. **Render the four operational maps through `google.maps.Map` in Google mode.** This is what
   "Google mode" intuitively suggests, and it would bring Google's own controls and traffic layer.
   Rejected for now on cost: it means two implementations of every surface, including rebuilding
   the supercluster clustering, the operations toolbar, the layer toggles and every popup against
   Google's API. The capability seam is designed so this can be added later as a second adapter
   behind `googleCanvas`, without touching the surfaces again.

2. **Keep Carto and configure a key for it.** Rejected because it puts a paid dependency in the
   free tier's path. The free tier must work with no accounts at all.

3. **A dark basemap for OSM mode.** Rejected. There is no free, keyless, dark raster basemap whose
   terms are worth depending on. Darkening OSM tiles with a CSS filter looks muddy and greys out
   the labels. OpenFreeMap's vector tiles would work but require MapLibre alongside Leaflet, which
   is a second map library and a rewrite of four surfaces to solve an aesthetic problem.

## Consequences

Map panels render light even in dark theme. That is a deliberate, accepted trade for a basemap
that needs no account, and it also signals honestly which tier the organisation is on.

Address search now works for everyone, which it did not before.

Lane routes have two provenances. A `manual` route measures the line the planner drew, not the
roads beneath it, and carries no duration. Anything comparing route distances must read `provider`
rather than assuming a road-network figure.

Nominatim's usage policy allows roughly one request a second, so OSM mode debounces address search
harder than Google mode does. Browsers will not let us set a `User-Agent`, so Nominatim identifies
us by `Referer`. A deployment doing heavy geocoding should run its own Nominatim instance rather
than leaning on the public one.

Fixing the response schemas means an organisation with a configured key enters Google mode for the
first time. Anyone who set a key previously and concluded it did nothing will see behaviour change.
