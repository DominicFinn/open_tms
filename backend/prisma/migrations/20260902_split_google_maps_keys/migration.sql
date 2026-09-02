-- Split Organization.googleMapsApiKey into a browser key and a server key (#176)
--
-- One key cannot serve both roles. The browser key is handed to the client for the Maps JS API,
-- so it is public and needs HTTP referrer restrictions. Google refuses referrer-restricted keys
-- on the server-side web service APIs outright — "API keys with referer restrictions cannot be
-- used with this API" — so Directions, Distance Matrix and Geocoding calls made from the backend
-- need their own key, restricted by IP or by API and never sent to a browser.
--
-- Table role: Organization is an authoritative mutable row. No index changes; these are
-- credential columns read by primary key alongside the rest of the org record.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "googleMapsBrowserKey" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "googleMapsServerKey" TEXT;

-- Existing installs configured a single key and used it for both. Copy it into both columns so
-- behaviour is unchanged on upgrade; an operator can then restrict the browser key and issue a
-- separate server key at their own pace.
UPDATE "Organization"
SET "googleMapsBrowserKey" = "googleMapsApiKey",
    "googleMapsServerKey"  = "googleMapsApiKey"
WHERE "googleMapsApiKey" IS NOT NULL;

ALTER TABLE "Organization" DROP COLUMN IF EXISTS "googleMapsApiKey";
