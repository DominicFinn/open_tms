-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "billingEmail" TEXT,
    "billingAddress1" TEXT,
    "billingAddress2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "creditLimitCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "invoiceConsolidation" TEXT NOT NULL DEFAULT 'per_shipment',
    "autoInvoice" BOOLEAN NOT NULL DEFAULT false,
    "taxId" TEXT,
    "customFieldVersionId" TEXT,
    "customFieldValues" JSONB,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "locationType" TEXT,
    "facilityCapabilities" JSONB,
    "operatingHours" JSONB,
    "appointmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "dockCount" INTEGER,
    "maxTrailerLengthFt" INTEGER,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "customFieldVersionId" TEXT,
    "customFieldValues" JSONB,
    "preferredLocationId" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "proNumber" TEXT,
    "items" JSONB,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "laneId" TEXT,
    "carrierId" TEXT,
    "coldChainProfileId" TEXT,
    "effectiveMinTemp" DOUBLE PRECISION,
    "effectiveMaxTemp" DOUBLE PRECISION,
    "effectiveAlertMinTemp" DOUBLE PRECISION,
    "effectiveAlertMaxTemp" DOUBLE PRECISION,
    "coldChainDisposition" TEXT NOT NULL DEFAULT 'not_applicable',
    "dispositionSetBy" TEXT,
    "dispositionSetAt" TIMESTAMP(3),
    "dispositionNotes" TEXT,
    "customFieldVersionId" TEXT,
    "customFieldValues" JSONB,
    "launchedAt" TIMESTAMP(3),
    "launchedBy" TEXT,
    "trackingNumber" TEXT,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentStop" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "stopType" TEXT NOT NULL DEFAULT 'delivery',
    "estimatedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "estimatedDeparture" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "geofenceRadius" DOUBLE PRECISION,
    "geofenceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "instructions" TEXT,
    "signatureUrl" TEXT,
    "photoUrls" JSONB,
    "proofOfDelivery" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrivalCriteria" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "criteriaType" TEXT NOT NULL,
    "radiusMeters" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "wifiSsid" TEXT,
    "wifiBssid" TEXT,
    "bleUuid" TEXT,
    "bleMajor" INTEGER,
    "bleMinor" INTEGER,
    "bleRssiThreshold" INTEGER,
    "bleAnchorId" TEXT,
    "bleReaderLocation" TEXT,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArrivalCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "locationSummary" TEXT,
    "rawPayload" JSONB,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mcNumber" TEXT,
    "dotNumber" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "validationTier" TEXT,
    "registrationChecked" BOOLEAN NOT NULL DEFAULT false,
    "insuranceDocReceived" BOOLEAN NOT NULL DEFAULT false,
    "insuranceVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "complianceChecked" BOOLEAN NOT NULL DEFAULT false,
    "validationNotes" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "scacCode" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "remitToName" TEXT,
    "remitToAddress1" TEXT,
    "remitToCity" TEXT,
    "remitToState" TEXT,
    "remitToPostalCode" TEXT,
    "remitToCountry" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "customFieldVersionId" TEXT,
    "customFieldValues" JSONB,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacityKg" INTEGER,
    "capacityM3" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Load" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Load_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lane" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "distance" DOUBLE PRECISION,
    "notes" TEXT,
    "serviceLevel" TEXT NOT NULL DEFAULT 'LTL',
    "supportsTemperatureControl" BOOLEAN NOT NULL DEFAULT false,
    "supportsHazmat" BOOLEAN NOT NULL DEFAULT false,
    "maxWeight" DOUBLE PRECISION,
    "maxVolume" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lane_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLane" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerLane_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaneCarrier" (
    "id" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "serviceLevel" TEXT,
    "notes" TEXT,
    "assigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rateType" TEXT,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "fuelSurchargePercent" DOUBLE PRECISION,
    "accessorialRates" JSONB,
    "isContractRate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LaneCarrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaneStop" (
    "id" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaneStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "poNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "importSource" TEXT NOT NULL DEFAULT 'manual',
    "ediData" JSONB,
    "customerId" TEXT NOT NULL,
    "originId" TEXT,
    "originData" JSONB,
    "originValidated" BOOLEAN NOT NULL DEFAULT false,
    "destinationId" TEXT,
    "destinationData" JSONB,
    "destinationValidated" BOOLEAN NOT NULL DEFAULT false,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedPickupDate" TIMESTAMP(3),
    "requestedDeliveryDate" TIMESTAMP(3),
    "serviceLevel" TEXT NOT NULL DEFAULT 'LTL',
    "temperatureControl" TEXT NOT NULL DEFAULT 'ambient',
    "requiresHazmat" BOOLEAN NOT NULL DEFAULT false,
    "specialRequirements" JSONB,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'unassigned',
    "deliveredAt" TIMESTAMP(3),
    "deliveryConfirmedBy" TEXT,
    "deliveryMethod" TEXT,
    "deliveryNotes" TEXT,
    "exceptionType" TEXT,
    "exceptionNotes" TEXT,
    "exceptionResolvedAt" TIMESTAMP(3),
    "deliveryStopId" TEXT,
    "specialInstructions" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customFieldVersionId" TEXT,
    "customFieldValues" JSONB,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackableUnitId" TEXT,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "weightUnit" TEXT NOT NULL DEFAULT 'kg',
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "dimUnit" TEXT NOT NULL DEFAULT 'cm',
    "hazmat" BOOLEAN NOT NULL DEFAULT false,
    "temperature" TEXT,
    "unitPriceCents" INTEGER,
    "totalPriceCents" INTEGER,
    "priceCurrency" TEXT NOT NULL DEFAULT 'USD',
    "freightClass" TEXT,
    "nmfcCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderShipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Organization',
    "trackingMode" TEXT NOT NULL DEFAULT 'item',
    "trackableUnitType" TEXT NOT NULL DEFAULT 'box',
    "customUnitName" TEXT,
    "weightUnit" TEXT NOT NULL DEFAULT 'kg',
    "dimUnit" TEXT NOT NULL DEFAULT 'cm',
    "temperatureUnit" TEXT NOT NULL DEFAULT 'C',
    "distanceUnit" TEXT NOT NULL DEFAULT 'km',
    "bolSequenceNumber" INTEGER NOT NULL DEFAULT 0,
    "logoStorageKey" TEXT,
    "logoMimeType" TEXT,
    "themeConfig" JSONB,
    "themeUpdatedAt" TIMESTAMP(3),
    "autoTenderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultGeofenceRadiusMeters" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "autoDeliverShipmentDocs" BOOLEAN NOT NULL DEFAULT false,
    "magicLinksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warehouseScanMode" TEXT NOT NULL DEFAULT 'hid',
    "googleMapsApiKey" TEXT,
    "emailHeaderHtml" TEXT,
    "emailFooterHtml" TEXT,
    "emailProvider" TEXT NOT NULL DEFAULT 'console',
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "emailFromAddress" TEXT,
    "emailFromName" TEXT,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "llmProvider" TEXT,
    "llmApiKey" TEXT,
    "llmModel" TEXT,
    "llmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackableUnit" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "customTypeName" TEXT,
    "sequenceNumber" INTEGER NOT NULL,
    "barcode" TEXT,
    "notes" TEXT,
    "currentStopId" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'good',
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackableUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "orderId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "changes" JSONB,
    "userId" TEXT,
    "userName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingLaneRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "serviceLevel" TEXT NOT NULL,
    "requiresTemperatureControl" BOOLEAN NOT NULL DEFAULT false,
    "requiresHazmat" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdLaneId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingLaneRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "customerId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "headers" JSONB,
    "deviceName" TEXT,
    "deviceId" TEXT,
    "eventType" TEXT,
    "hasLocation" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "rawPayload" JSONB,
    "status" TEXT NOT NULL,
    "shipmentFound" BOOLEAN NOT NULL DEFAULT false,
    "shipmentUpdated" BOOLEAN NOT NULL DEFAULT false,
    "shipmentId" TEXT,
    "shipmentReference" TEXT,
    "shipmentEventId" TEXT,
    "errorMessage" TEXT,
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "authProvider" TEXT,
    "authProviderId" TEXT,
    "organizationId" TEXT,
    "customerId" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "weightUnit" TEXT,
    "dimUnit" TEXT,
    "temperatureUnit" TEXT,
    "distanceUnit" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "preferredLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthProvider" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "tenantId" TEXT,
    "allowedDomains" JSONB,
    "autoCreateUsers" BOOLEAN NOT NULL DEFAULT true,
    "defaultRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinaryStore" (
    "key" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinaryStore_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageBackend" TEXT NOT NULL DEFAULT 's3',
    "uploadedBy" TEXT,
    "description" TEXT,
    "retentionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "description" TEXT,
    "htmlTemplate" TEXT NOT NULL,
    "config" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileSize" INTEGER,
    "fileContent" BYTEA,
    "storageKey" TEXT,
    "storageBackend" TEXT NOT NULL DEFAULT 'database',
    "templateId" TEXT,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "carrierId" TEXT,
    "customerId" TEXT,
    "generatedBy" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "retentionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldVersion" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "description" TEXT,
    "createdBy" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "fieldType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "config" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldAudit" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "versionId" TEXT,
    "previousVersionId" TEXT,
    "changes" JSONB,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEventLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "entityType" TEXT,
    "entityId" TEXT,
    "actionUrl" TEXT,
    "eventId" TEXT,
    "eventType" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSubscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "eventPattern" TEXT NOT NULL,
    "handlerType" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "entityFilter" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "poNumber" TEXT,
    "status" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "originName" TEXT,
    "originCity" TEXT,
    "originState" TEXT,
    "destinationName" TEXT,
    "destinationCity" TEXT,
    "destinationState" TEXT,
    "shipmentId" TEXT,
    "shipmentReference" TEXT,
    "carrierName" TEXT,
    "serviceLevel" TEXT,
    "temperatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "hazmat" BOOLEAN NOT NULL DEFAULT false,
    "trackableUnitCount" INTEGER NOT NULL DEFAULT 0,
    "lineItemCount" INTEGER NOT NULL DEFAULT 0,
    "totalWeight" DOUBLE PRECISION,
    "requestedDeliveryDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "exceptionType" TEXT,
    "importSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "originName" TEXT,
    "originCity" TEXT,
    "originState" TEXT,
    "destinationName" TEXT,
    "destinationCity" TEXT,
    "destinationState" TEXT,
    "carrierId" TEXT,
    "carrierName" TEXT,
    "laneId" TEXT,
    "laneName" TEXT,
    "proNumber" TEXT,
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "stopCount" INTEGER NOT NULL DEFAULT 0,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mcNumber" TEXT,
    "dotNumber" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL,
    "validationTier" TEXT,
    "vehicleCount" INTEGER NOT NULL DEFAULT 0,
    "driverCount" INTEGER NOT NULL DEFAULT 0,
    "activeLaneCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "activeOrderCount" INTEGER NOT NULL DEFAULT 0,
    "totalOrderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaneReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originName" TEXT,
    "originCity" TEXT,
    "destinationName" TEXT,
    "destinationCity" TEXT,
    "serviceLevel" TEXT NOT NULL,
    "distance" DOUBLE PRECISION,
    "carrierCount" INTEGER NOT NULL DEFAULT 0,
    "activeShipmentCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaneReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "sourceEventId" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "escalatedTo" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "snoozedBy" TEXT,
    "snoozedReason" TEXT,
    "needsCapa" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectionCheckpoint" (
    "projectionName" TEXT NOT NULL,
    "lastEventId" TEXT NOT NULL,
    "lastEventTime" TIMESTAMP(3) NOT NULL,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectionCheckpoint_pkey" PRIMARY KEY ("projectionName")
);

-- CreateTable
CREATE TABLE "IssueReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "sourceEventId" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "escalatedTo" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "snoozedBy" TEXT,
    "needsCapa" BOOLEAN NOT NULL DEFAULT false,
    "labels" JSONB,
    "closedAt" TIMESTAMP(3),
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "customerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "warningThresholdMinutes" INTEGER,
    "breachThresholdMinutes" INTEGER,
    "criticalThresholdMinutes" INTEGER,
    "issuePriority" TEXT,
    "issueCategory" TEXT,
    "maxDeliveryMinutes" INTEGER,
    "maxDwellMinutes" INTEGER,
    "dwellLocationType" TEXT,
    "locationType" TEXT,
    "maxOccurrences" INTEGER,
    "maxExcursionMinutes" INTEGER,
    "autoCreateIssue" BOOLEAN NOT NULL DEFAULT true,
    "issuePriorityOnBreach" TEXT NOT NULL DEFAULT 'high',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaEvaluation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityReference" TEXT,
    "policyId" TEXT NOT NULL,
    "customerId" TEXT,
    "slaStartedAt" TIMESTAMP(3) NOT NULL,
    "slaDueAt" TIMESTAMP(3),
    "warningAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "remainingMinutes" INTEGER,
    "breachedAt" TIMESTAMP(3),
    "breachDurationMinutes" INTEGER,
    "metAt" TIMESTAMP(3),
    "issueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "entityType" TEXT NOT NULL,
    "customerId" TEXT,
    "carrierId" TEXT,
    "sftpHost" TEXT,
    "sftpPort" INTEGER NOT NULL DEFAULT 22,
    "sftpUsername" TEXT,
    "sftpPassword" TEXT,
    "sftpPrivateKey" TEXT,
    "httpUrl" TEXT,
    "httpAuthType" TEXT,
    "httpAuthHeader" TEXT,
    "httpAuthValue" TEXT,
    "senderId" TEXT,
    "receiverId" TEXT,
    "ediVersion" TEXT NOT NULL DEFAULT '005010',
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inboundDir" TEXT NOT NULL DEFAULT '/',
    "inboundFilePattern" TEXT NOT NULL DEFAULT '*.edi,*.x12',
    "pollingInterval" INTEGER NOT NULL DEFAULT 900,
    "pollingCron" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "outboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outboundDir" TEXT,
    "outboundTransport" TEXT NOT NULL DEFAULT 'sftp',
    "outboundFileNaming" TEXT NOT NULL DEFAULT 'reference',
    "migratedFromEdiPartnerId" TEXT,
    "migratedFromOutboundIntegrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingPartnerTransaction" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fieldMapping" JSONB,
    "autoProcess" BOOLEAN NOT NULL DEFAULT true,
    "ack997Required" BOOLEAN NOT NULL DEFAULT true,
    "filePattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingPartnerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdiTransactionLog" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "transactionType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileContent" TEXT,
    "fileHash" TEXT,
    "transport" TEXT NOT NULL DEFAULT 'api',
    "url" TEXT,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "parsedData" JSONB,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "entitiesCreated" INTEGER NOT NULL DEFAULT 0,
    "entityIds" JSONB,
    "source" TEXT NOT NULL DEFAULT 'api',
    "shipmentId" TEXT,
    "shipmentReference" TEXT,
    "orderId" TEXT,
    "tenderId" TEXT,
    "invoiceId" TEXT,
    "invoiceNumber" TEXT,
    "ack997Sent" BOOLEAN NOT NULL DEFAULT false,
    "ack997Received" BOOLEAN NOT NULL DEFAULT false,
    "ack997LogId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdiTransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierUser" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'dispatcher',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'broadcast',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "tenderDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "targetRate" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "equipmentType" TEXT,
    "notes" TEXT,
    "specialInstructions" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderOffer" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "ediSent" BOOLEAN NOT NULL DEFAULT false,
    "edi204Content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderBid" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "tenderOfferId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "transitDays" INTEGER,
    "equipmentType" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'portal',
    "edi990Content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayId" TEXT,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'system_loco',
    "model" TEXT,
    "manufacturer" TEXT,
    "firmware" TEXT,
    "labels" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "batteryLevel" INTEGER,
    "lastSeenAt" TIMESTAMP(3),
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAssignment" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "trackableUnitId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "trackableUnitId" TEXT,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "lightLevel" INTEGER,
    "batteryLevel" INTEGER,
    "batteryVoltage" DOUBLE PRECISION,
    "impactG" DOUBLE PRECISION,
    "tiltAngle" DOUBLE PRECISION,
    "movement" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "tempMin" DOUBLE PRECISION,
    "tempMax" DOUBLE PRECISION,
    "lightMin" INTEGER,
    "lightMax" INTEGER,
    "isAlert" BOOLEAN NOT NULL DEFAULT false,
    "alertType" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "trackableUnitId" TEXT,
    "externalEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "zoneName" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoScan" (
    "id" TEXT NOT NULL,
    "trackableUnitId" TEXT NOT NULL,
    "shipmentStopId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "scanMethod" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedBy" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "expected" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoDiscrepancy" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "trackableUnitId" TEXT NOT NULL,
    "discrepancyType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'high',
    "expectedStopId" TEXT,
    "actualStopId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedBy" TEXT NOT NULL DEFAULT 'system',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdChainProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minTemperature" DOUBLE PRECISION NOT NULL,
    "maxTemperature" DOUBLE PRECISION NOT NULL,
    "alertMinTemperature" DOUBLE PRECISION NOT NULL,
    "alertMaxTemperature" DOUBLE PRECISION NOT NULL,
    "minHumidity" DOUBLE PRECISION,
    "maxHumidity" DOUBLE PRECISION,
    "alertMinHumidity" DOUBLE PRECISION,
    "alertMaxHumidity" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ColdChainProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCalibration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "calibratedAt" TIMESTAMP(3) NOT NULL,
    "calibratedBy" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "calibrationMethod" TEXT,
    "accuracy" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'valid',
    "notes" TEXT,
    "documentStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "DeviceCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImmutableTemperatureLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "deviceId" TEXT,
    "orderId" TEXT,
    "trackableUnitId" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileMinTemp" DOUBLE PRECISION,
    "profileMaxTemp" DOUBLE PRECISION,
    "profileAlertMinTemp" DOUBLE PRECISION,
    "profileAlertMaxTemp" DOUBLE PRECISION,
    "profileName" TEXT,
    "isWithinRange" BOOLEAN NOT NULL,
    "isWithinAlertRange" BOOLEAN NOT NULL,
    "isExcursion" BOOLEAN NOT NULL DEFAULT false,
    "isAlert" BOOLEAN NOT NULL DEFAULT false,
    "integrityHash" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImmutableTemperatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdChainExcursion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "deviceId" TEXT,
    "excursionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "peakValue" DOUBLE PRECISION NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "readingCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "dispositionDecision" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdChainExcursion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAPAReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "reportNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT NOT NULL,
    "immediateAction" TEXT,
    "containmentAction" TEXT,
    "investigationDetails" TEXT,
    "rootCause" TEXT,
    "rootCauseCategory" TEXT,
    "correctiveAction" TEXT,
    "correctiveActionDueDate" TIMESTAMP(3),
    "correctiveActionCompletedDate" TIMESTAMP(3),
    "preventiveAction" TEXT,
    "preventiveActionDueDate" TIMESTAMP(3),
    "preventiveActionCompletedDate" TIMESTAMP(3),
    "investigatorId" TEXT,
    "investigatorName" TEXT,
    "approverId" TEXT,
    "approverName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "affectedProducts" JSONB,
    "affectedShipmentIds" JSONB,
    "affectedLocationIds" JSONB,
    "eventTimeline" JSONB,
    "temperatureData" JSONB,
    "verificationMethod" TEXT,
    "verifiedById" TEXT,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "effectivenessCheck" TEXT,
    "lessonsLearned" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "CAPAReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentAccessory" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "accessoryType" TEXT NOT NULL,
    "alias" TEXT,
    "identifier" TEXT,
    "isIoT" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentFlag" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "flaggedBy" TEXT NOT NULL,
    "flaggedByName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "deviceInfo" TEXT,
    "eventType" TEXT NOT NULL,
    "locationId" TEXT,
    "duration" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "modelProvider" TEXT,
    "modelId" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerEventType" TEXT,
    "triggerEventId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "conversationLog" JSONB,
    "confidence" DOUBLE PRECISION,
    "actionType" TEXT NOT NULL,
    "actionPayload" JSONB,
    "actionEntityType" TEXT,
    "actionEntityId" TEXT,
    "outcomeStatus" TEXT NOT NULL DEFAULT 'pending',
    "outcomeNotes" TEXT,
    "outcomeRecordedAt" TIMESTAMP(3),
    "outcomeRecordedBy" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "durationMs" INTEGER,
    "agentConfigId" TEXT,
    "promptVersionId" TEXT,
    "matchedConditions" JSONB,
    "promotedToAutomation" BOOLEAN NOT NULL DEFAULT false,
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDecisionReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "modelProvider" TEXT,
    "modelId" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerEventType" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "actionType" TEXT NOT NULL,
    "actionEntityType" TEXT,
    "actionEntityId" TEXT,
    "outcomeStatus" TEXT NOT NULL DEFAULT 'pending',
    "promotedToAutomation" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDecisionReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subscribedEvents" JSONB,
    "activeVersionId" TEXT,
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "confidenceThreshold" DOUBLE PRECISION,
    "deduplicationWindowMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConfigVersion" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "AgentConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "eventPattern" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "sourceDecisionId" TEXT,
    "skillChainId" TEXT,
    "inlineSteps" JSONB,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecutionLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionResult" JSONB,
    "conditionsMatched" BOOLEAN NOT NULL,
    "evaluationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "skillType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillChain" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentQuoteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "customerId" TEXT NOT NULL,
    "originId" TEXT,
    "destinationId" TEXT,
    "serviceLevel" TEXT NOT NULL DEFAULT 'FTL',
    "equipmentType" TEXT,
    "totalRevenueCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    "marginCents" INTEGER NOT NULL,
    "marginPercent" DECIMAL(5,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "accessorialCode" TEXT,
    "freightClass" TEXT,
    "weight" DECIMAL(10,2),
    "ratePerCwt" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT,
    "shipmentId" TEXT,
    "chargeType" TEXT NOT NULL,
    "chargeCategory" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "accessorialCode" TEXT,
    "freightClass" TEXT,
    "nmfcCode" TEXT,
    "ratedWeight" DECIMAL(10,2),
    "ratePerCwt" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentFinancialSummary" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "expectedRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "expectedCostCents" INTEGER NOT NULL DEFAULT 0,
    "expectedMarginCents" INTEGER NOT NULL DEFAULT 0,
    "actualRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "actualCostCents" INTEGER NOT NULL DEFAULT 0,
    "actualMarginCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingStatus" TEXT NOT NULL DEFAULT 'not_ready',
    "podReceived" BOOLEAN NOT NULL DEFAULT false,
    "carrierPaymentStatus" TEXT NOT NULL DEFAULT 'not_ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentFinancialSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subtotalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "balanceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "lastReminderSentAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "chargeId" TEXT,
    "chargeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "freightClass" TEXT,
    "weight" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierInvoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "totalCents" INTEGER NOT NULL,
    "approvedCents" INTEGER,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "matchStatus" TEXT NOT NULL DEFAULT 'pending',
    "varianceCents" INTEGER,
    "variancePercent" DECIMAL(5,2),
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "edi210Content" TEXT,
    "ediTransactionLogId" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scheduledPayDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierInvoiceLineItem" (
    "id" TEXT NOT NULL,
    "carrierInvoiceId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "chargeId" TEXT,
    "chargeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "expectedAmountCents" INTEGER,
    "varianceCents" INTEGER,
    "matchStatus" TEXT NOT NULL DEFAULT 'pending',
    "freightClass" TEXT,
    "billedWeight" DECIMAL(10,2),
    "actualWeight" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarrierInvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialQuery" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "queryNumber" TEXT NOT NULL,
    "queryType" TEXT NOT NULL,
    "invoiceId" TEXT,
    "carrierInvoiceId" TEXT,
    "shipmentId" TEXT,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "disputedAmountCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'raised',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "adjustmentCents" INTEGER,
    "creditNoteId" TEXT,
    "cargoDiscrepancyId" TEXT,
    "coldChainExcursionId" TEXT,
    "assigneeId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "invoiceId" TEXT,
    "customerId" TEXT,
    "carrierId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "queryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceReadModel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "daysPastDue" INTEGER NOT NULL DEFAULT 0,
    "shipmentCount" INTEGER NOT NULL DEFAULT 0,
    "lineItemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceReadModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'user',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueLabel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueLabelAssignment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "IssueLabelAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanView" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "groupBy" TEXT NOT NULL DEFAULT 'status',
    "sortBy" TEXT NOT NULL DEFAULT 'createdAt',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierTrackingIntegration" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_setup',
    "credentials" JSONB,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookSecret" TEXT,
    "webhookEndpointId" TEXT,
    "pollingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pollingIntervalSeconds" INTEGER NOT NULL DEFAULT 900,
    "lastPolledAt" TIMESTAMP(3),
    "rateLimitDailyMax" INTEGER,
    "rateLimitCallsToday" INTEGER NOT NULL DEFAULT 0,
    "rateLimitResetAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierTrackingIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierTrackingEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "statusCode" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "estimatedDelivery" TIMESTAMP(3),
    "signedBy" TEXT,
    "rawPayload" JSONB,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarrierTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaneRoute" (
    "id" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "encodedPolyline" TEXT NOT NULL,
    "waypoints" JSONB NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "summary" TEXT,
    "corridorMeters" INTEGER NOT NULL DEFAULT 5000,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaneRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityIssueSummary" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dimensionType" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "dimensionName" TEXT NOT NULL,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "delayCount" INTEGER NOT NULL DEFAULT 0,
    "damageCount" INTEGER NOT NULL DEFAULT 0,
    "complianceCount" INTEGER NOT NULL DEFAULT 0,
    "otherCount" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "inProgressCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "closedCount" INTEGER NOT NULL DEFAULT 0,
    "capaCount" INTEGER NOT NULL DEFAULT 0,
    "avgResolutionHours" DOUBLE PRECISION,
    "lastIssueAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityIssueSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAPAFollowUp" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "capaReportId" TEXT NOT NULL,
    "followUpType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "outcome" TEXT,
    "actionItems" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "completedById" TEXT,
    "completedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "CAPAFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOPChecklist" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sopReference" TEXT,
    "category" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'annual',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "nextDueDate" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),
    "lastCompletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "SOPChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOPChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "section" TEXT,
    "question" TEXT NOT NULL,
    "guidance" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOPChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOPAudit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "auditorId" TEXT,
    "auditorName" TEXT,
    "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    "passCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "naCount" INTEGER NOT NULL DEFAULT 0,
    "findings" TEXT,
    "correctiveActions" TEXT,
    "completedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOPAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOPAuditResponse" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "notes" TEXT,
    "evidenceRef" TEXT,
    "correctiveAction" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedById" TEXT,
    "respondedByName" TEXT,

    CONSTRAINT "SOPAuditResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentStop_shipmentId_idx" ON "ShipmentStop"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentStop_locationId_idx" ON "ShipmentStop"("locationId");

-- CreateIndex
CREATE INDEX "ShipmentStop_status_idx" ON "ShipmentStop"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentStop_shipmentId_sequenceNumber_key" ON "ShipmentStop"("shipmentId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "ArrivalCriteria_locationId_idx" ON "ArrivalCriteria"("locationId");

-- CreateIndex
CREATE INDEX "ArrivalCriteria_criteriaType_idx" ON "ArrivalCriteria"("criteriaType");

-- CreateIndex
CREATE INDEX "ArrivalCriteria_locationId_active_idx" ON "ArrivalCriteria"("locationId", "active");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_eventTime_idx" ON "ShipmentEvent"("eventTime");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLane_customerId_laneId_key" ON "CustomerLane"("customerId", "laneId");

-- CreateIndex
CREATE UNIQUE INDEX "LaneCarrier_laneId_carrierId_key" ON "LaneCarrier"("laneId", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "LaneStop_laneId_order_key" ON "LaneStop"("laneId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LaneStop_laneId_locationId_key" ON "LaneStop"("laneId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OrderShipment_orderId_shipmentId_key" ON "OrderShipment"("orderId", "shipmentId");

-- CreateIndex
CREATE INDEX "TrackableUnit_orderId_idx" ON "TrackableUnit"("orderId");

-- CreateIndex
CREATE INDEX "TrackableUnit_currentStopId_idx" ON "TrackableUnit"("currentStopId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackableUnit_orderId_sequenceNumber_key" ON "TrackableUnit"("orderId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "AuditLog_orderId_idx" ON "AuditLog"("orderId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PendingLaneRequest_orderId_idx" ON "PendingLaneRequest"("orderId");

-- CreateIndex
CREATE INDEX "PendingLaneRequest_status_idx" ON "PendingLaneRequest"("status");

-- CreateIndex
CREATE INDEX "PendingLaneRequest_originId_destinationId_idx" ON "PendingLaneRequest"("originId", "destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_active_idx" ON "ApiKey"("active");

-- CreateIndex
CREATE INDEX "ApiKey_createdAt_idx" ON "ApiKey"("createdAt");

-- CreateIndex
CREATE INDEX "ApiKey_customerId_idx" ON "ApiKey"("customerId");

-- CreateIndex
CREATE INDEX "WebhookLog_apiKeyId_idx" ON "WebhookLog"("apiKeyId");

-- CreateIndex
CREATE INDEX "WebhookLog_status_idx" ON "WebhookLog"("status");

-- CreateIndex
CREATE INDEX "WebhookLog_shipmentId_idx" ON "WebhookLog"("shipmentId");

-- CreateIndex
CREATE INDEX "WebhookLog_receivedAt_idx" ON "WebhookLog"("receivedAt");

-- CreateIndex
CREATE INDEX "WebhookLog_deviceName_idx" ON "WebhookLog"("deviceName");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_customerId_idx" ON "User"("customerId");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_authProviderId_key" ON "User"("authProvider", "authProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthProvider_provider_key" ON "AuthProvider"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_createdAt_idx" ON "Attachment"("createdAt");

-- CreateIndex
CREATE INDEX "Attachment_retentionExpiresAt_idx" ON "Attachment"("retentionExpiresAt");

-- CreateIndex
CREATE INDEX "DocumentTemplate_documentType_idx" ON "DocumentTemplate"("documentType");

-- CreateIndex
CREATE INDEX "DocumentTemplate_active_idx" ON "DocumentTemplate"("active");

-- CreateIndex
CREATE INDEX "GeneratedDocument_shipmentId_idx" ON "GeneratedDocument"("shipmentId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_orderId_idx" ON "GeneratedDocument"("orderId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_carrierId_idx" ON "GeneratedDocument"("carrierId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_customerId_idx" ON "GeneratedDocument"("customerId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_documentType_idx" ON "GeneratedDocument"("documentType");

-- CreateIndex
CREATE INDEX "GeneratedDocument_createdAt_idx" ON "GeneratedDocument"("createdAt");

-- CreateIndex
CREATE INDEX "GeneratedDocument_retentionExpiresAt_idx" ON "GeneratedDocument"("retentionExpiresAt");

-- CreateIndex
CREATE INDEX "CustomFieldVersion_entityType_active_idx" ON "CustomFieldVersion"("entityType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldVersion_entityType_version_key" ON "CustomFieldVersion"("entityType", "version");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_versionId_idx" ON "CustomFieldDefinition"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_versionId_fieldKey_key" ON "CustomFieldDefinition"("versionId", "fieldKey");

-- CreateIndex
CREATE INDEX "CustomFieldAudit_entityType_idx" ON "CustomFieldAudit"("entityType");

-- CreateIndex
CREATE INDEX "CustomFieldAudit_createdAt_idx" ON "CustomFieldAudit"("createdAt");

-- CreateIndex
CREATE INDEX "DomainEventLog_type_idx" ON "DomainEventLog"("type");

-- CreateIndex
CREATE INDEX "DomainEventLog_entityType_entityId_idx" ON "DomainEventLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DomainEventLog_orgId_idx" ON "DomainEventLog"("orgId");

-- CreateIndex
CREATE INDEX "DomainEventLog_timestamp_idx" ON "DomainEventLog"("timestamp");

-- CreateIndex
CREATE INDEX "DomainEventLog_createdAt_idx" ON "DomainEventLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_orgId_idx" ON "Notification"("orgId");

-- CreateIndex
CREATE INDEX "EventSubscription_orgId_active_idx" ON "EventSubscription"("orgId", "active");

-- CreateIndex
CREATE INDEX "EventSubscription_eventPattern_idx" ON "EventSubscription"("eventPattern");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPreference_userId_eventCategory_key" ON "UserNotificationPreference"("userId", "eventCategory");

-- CreateIndex
CREATE INDEX "EmailTemplate_eventType_idx" ON "EmailTemplate"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_organizationId_eventType_key" ON "EmailTemplate"("organizationId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReadModel_orderNumber_key" ON "OrderReadModel"("orderNumber");

-- CreateIndex
CREATE INDEX "OrderReadModel_orgId_idx" ON "OrderReadModel"("orgId");

-- CreateIndex
CREATE INDEX "OrderReadModel_status_idx" ON "OrderReadModel"("status");

-- CreateIndex
CREATE INDEX "OrderReadModel_deliveryStatus_idx" ON "OrderReadModel"("deliveryStatus");

-- CreateIndex
CREATE INDEX "OrderReadModel_customerId_idx" ON "OrderReadModel"("customerId");

-- CreateIndex
CREATE INDEX "OrderReadModel_createdAt_idx" ON "OrderReadModel"("createdAt");

-- CreateIndex
CREATE INDEX "OrderReadModel_shipmentId_idx" ON "OrderReadModel"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentReadModel_reference_key" ON "ShipmentReadModel"("reference");

-- CreateIndex
CREATE INDEX "ShipmentReadModel_orgId_idx" ON "ShipmentReadModel"("orgId");

-- CreateIndex
CREATE INDEX "ShipmentReadModel_status_idx" ON "ShipmentReadModel"("status");

-- CreateIndex
CREATE INDEX "ShipmentReadModel_customerId_idx" ON "ShipmentReadModel"("customerId");

-- CreateIndex
CREATE INDEX "ShipmentReadModel_carrierId_idx" ON "ShipmentReadModel"("carrierId");

-- CreateIndex
CREATE INDEX "ShipmentReadModel_createdAt_idx" ON "ShipmentReadModel"("createdAt");

-- CreateIndex
CREATE INDEX "ShipmentReadModel_currentLat_currentLng_idx" ON "ShipmentReadModel"("currentLat", "currentLng");

-- CreateIndex
CREATE INDEX "CarrierReadModel_orgId_idx" ON "CarrierReadModel"("orgId");

-- CreateIndex
CREATE INDEX "CarrierReadModel_status_idx" ON "CarrierReadModel"("status");

-- CreateIndex
CREATE INDEX "CarrierReadModel_name_idx" ON "CarrierReadModel"("name");

-- CreateIndex
CREATE INDEX "CustomerReadModel_orgId_idx" ON "CustomerReadModel"("orgId");

-- CreateIndex
CREATE INDEX "CustomerReadModel_name_idx" ON "CustomerReadModel"("name");

-- CreateIndex
CREATE INDEX "LaneReadModel_orgId_idx" ON "LaneReadModel"("orgId");

-- CreateIndex
CREATE INDEX "LaneReadModel_status_idx" ON "LaneReadModel"("status");

-- CreateIndex
CREATE INDEX "Issue_orgId_idx" ON "Issue"("orgId");

-- CreateIndex
CREATE INDEX "Issue_status_idx" ON "Issue"("status");

-- CreateIndex
CREATE INDEX "Issue_priority_idx" ON "Issue"("priority");

-- CreateIndex
CREATE INDEX "Issue_sourceEntityType_sourceEntityId_idx" ON "Issue"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "Issue_assigneeId_idx" ON "Issue"("assigneeId");

-- CreateIndex
CREATE INDEX "Issue_createdAt_idx" ON "Issue"("createdAt");

-- CreateIndex
CREATE INDEX "Issue_needsCapa_idx" ON "Issue"("needsCapa");

-- CreateIndex
CREATE INDEX "Issue_snoozedUntil_idx" ON "Issue"("snoozedUntil");

-- CreateIndex
CREATE INDEX "IssueReadModel_orgId_idx" ON "IssueReadModel"("orgId");

-- CreateIndex
CREATE INDEX "IssueReadModel_status_idx" ON "IssueReadModel"("status");

-- CreateIndex
CREATE INDEX "IssueReadModel_priority_idx" ON "IssueReadModel"("priority");

-- CreateIndex
CREATE INDEX "IssueReadModel_assigneeName_idx" ON "IssueReadModel"("assigneeName");

-- CreateIndex
CREATE INDEX "IssueReadModel_createdAt_idx" ON "IssueReadModel"("createdAt");

-- CreateIndex
CREATE INDEX "IssueReadModel_needsCapa_idx" ON "IssueReadModel"("needsCapa");

-- CreateIndex
CREATE INDEX "IssueReadModel_snoozedUntil_idx" ON "IssueReadModel"("snoozedUntil");

-- CreateIndex
CREATE INDEX "SlaPolicy_orgId_idx" ON "SlaPolicy"("orgId");

-- CreateIndex
CREATE INDEX "SlaPolicy_customerId_idx" ON "SlaPolicy"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_orgId_customerId_key" ON "SlaPolicy"("orgId", "customerId");

-- CreateIndex
CREATE INDEX "SlaRule_policyId_idx" ON "SlaRule"("policyId");

-- CreateIndex
CREATE INDEX "SlaRule_ruleType_idx" ON "SlaRule"("ruleType");

-- CreateIndex
CREATE INDEX "SlaEvaluation_orgId_idx" ON "SlaEvaluation"("orgId");

-- CreateIndex
CREATE INDEX "SlaEvaluation_entityType_entityId_idx" ON "SlaEvaluation"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SlaEvaluation_status_idx" ON "SlaEvaluation"("status");

-- CreateIndex
CREATE INDEX "SlaEvaluation_slaDueAt_idx" ON "SlaEvaluation"("slaDueAt");

-- CreateIndex
CREATE INDEX "SlaEvaluation_customerId_idx" ON "SlaEvaluation"("customerId");

-- CreateIndex
CREATE INDEX "SlaEvaluation_ruleType_idx" ON "SlaEvaluation"("ruleType");

-- CreateIndex
CREATE UNIQUE INDEX "SlaEvaluation_ruleId_entityType_entityId_key" ON "SlaEvaluation"("ruleId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "TradingPartner_entityType_idx" ON "TradingPartner"("entityType");

-- CreateIndex
CREATE INDEX "TradingPartner_customerId_idx" ON "TradingPartner"("customerId");

-- CreateIndex
CREATE INDEX "TradingPartner_carrierId_idx" ON "TradingPartner"("carrierId");

-- CreateIndex
CREATE INDEX "TradingPartner_active_idx" ON "TradingPartner"("active");

-- CreateIndex
CREATE INDEX "TradingPartner_inboundEnabled_idx" ON "TradingPartner"("inboundEnabled");

-- CreateIndex
CREATE INDEX "TradingPartner_outboundEnabled_idx" ON "TradingPartner"("outboundEnabled");

-- CreateIndex
CREATE INDEX "TradingPartnerTransaction_partnerId_idx" ON "TradingPartnerTransaction"("partnerId");

-- CreateIndex
CREATE INDEX "TradingPartnerTransaction_transactionType_idx" ON "TradingPartnerTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "TradingPartnerTransaction_direction_idx" ON "TradingPartnerTransaction"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "TradingPartnerTransaction_partnerId_transactionType_directi_key" ON "TradingPartnerTransaction"("partnerId", "transactionType", "direction");

-- CreateIndex
CREATE INDEX "EdiTransactionLog_partnerId_idx" ON "EdiTransactionLog"("partnerId");

-- CreateIndex
CREATE INDEX "EdiTransactionLog_transactionType_idx" ON "EdiTransactionLog"("transactionType");

-- CreateIndex
CREATE INDEX "EdiTransactionLog_direction_idx" ON "EdiTransactionLog"("direction");

-- CreateIndex
CREATE INDEX "EdiTransactionLog_status_idx" ON "EdiTransactionLog"("status");

-- CreateIndex
CREATE INDEX "EdiTransactionLog_shipmentId_idx" ON "EdiTransactionLog"("shipmentId");

-- CreateIndex
CREATE INDEX "EdiTransactionLog_fileHash_idx" ON "EdiTransactionLog"("fileHash");

-- CreateIndex
CREATE INDEX "EdiTransactionLog_createdAt_idx" ON "EdiTransactionLog"("createdAt");

-- CreateIndex
CREATE INDEX "EdiTransactionLog_source_idx" ON "EdiTransactionLog"("source");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierUser_email_key" ON "CarrierUser"("email");

-- CreateIndex
CREATE INDEX "CarrierUser_carrierId_idx" ON "CarrierUser"("carrierId");

-- CreateIndex
CREATE INDEX "CarrierUser_email_idx" ON "CarrierUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_reference_key" ON "Tender"("reference");

-- CreateIndex
CREATE INDEX "Tender_shipmentId_idx" ON "Tender"("shipmentId");

-- CreateIndex
CREATE INDEX "Tender_status_idx" ON "Tender"("status");

-- CreateIndex
CREATE INDEX "Tender_reference_idx" ON "Tender"("reference");

-- CreateIndex
CREATE INDEX "Tender_createdAt_idx" ON "Tender"("createdAt");

-- CreateIndex
CREATE INDEX "TenderOffer_tenderId_idx" ON "TenderOffer"("tenderId");

-- CreateIndex
CREATE INDEX "TenderOffer_carrierId_idx" ON "TenderOffer"("carrierId");

-- CreateIndex
CREATE INDEX "TenderOffer_status_idx" ON "TenderOffer"("status");

-- CreateIndex
CREATE INDEX "TenderOffer_expiresAt_idx" ON "TenderOffer"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenderOffer_tenderId_carrierId_key" ON "TenderOffer"("tenderId", "carrierId");

-- CreateIndex
CREATE INDEX "TenderBid_tenderId_idx" ON "TenderBid"("tenderId");

-- CreateIndex
CREATE INDEX "TenderBid_carrierId_idx" ON "TenderBid"("carrierId");

-- CreateIndex
CREATE INDEX "TenderBid_status_idx" ON "TenderBid"("status");

-- CreateIndex
CREATE INDEX "TenderBid_submittedAt_idx" ON "TenderBid"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenderBid_tenderOfferId_carrierId_key" ON "TenderBid"("tenderOfferId", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_externalId_key" ON "Device"("externalId");

-- CreateIndex
CREATE INDEX "Device_name_idx" ON "Device"("name");

-- CreateIndex
CREATE INDEX "Device_provider_idx" ON "Device"("provider");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "DeviceAssignment_deviceId_active_idx" ON "DeviceAssignment"("deviceId", "active");

-- CreateIndex
CREATE INDEX "DeviceAssignment_shipmentId_idx" ON "DeviceAssignment"("shipmentId");

-- CreateIndex
CREATE INDEX "DeviceAssignment_orderId_idx" ON "DeviceAssignment"("orderId");

-- CreateIndex
CREATE INDEX "SensorReading_deviceId_eventTime_idx" ON "SensorReading"("deviceId", "eventTime");

-- CreateIndex
CREATE INDEX "SensorReading_shipmentId_eventTime_idx" ON "SensorReading"("shipmentId", "eventTime");

-- CreateIndex
CREATE INDEX "SensorReading_orderId_eventTime_idx" ON "SensorReading"("orderId", "eventTime");

-- CreateIndex
CREATE INDEX "SensorReading_trackableUnitId_eventTime_idx" ON "SensorReading"("trackableUnitId", "eventTime");

-- CreateIndex
CREATE INDEX "SensorReading_isAlert_idx" ON "SensorReading"("isAlert");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceEvent_externalEventId_key" ON "DeviceEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "DeviceEvent_deviceId_startTime_idx" ON "DeviceEvent"("deviceId", "startTime");

-- CreateIndex
CREATE INDEX "DeviceEvent_shipmentId_idx" ON "DeviceEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "DeviceEvent_eventType_idx" ON "DeviceEvent"("eventType");

-- CreateIndex
CREATE INDEX "CargoScan_trackableUnitId_idx" ON "CargoScan"("trackableUnitId");

-- CreateIndex
CREATE INDEX "CargoScan_shipmentStopId_idx" ON "CargoScan"("shipmentStopId");

-- CreateIndex
CREATE INDEX "CargoScan_shipmentId_idx" ON "CargoScan"("shipmentId");

-- CreateIndex
CREATE INDEX "CargoScan_scannedAt_idx" ON "CargoScan"("scannedAt");

-- CreateIndex
CREATE INDEX "CargoDiscrepancy_shipmentId_idx" ON "CargoDiscrepancy"("shipmentId");

-- CreateIndex
CREATE INDEX "CargoDiscrepancy_trackableUnitId_idx" ON "CargoDiscrepancy"("trackableUnitId");

-- CreateIndex
CREATE INDEX "CargoDiscrepancy_status_idx" ON "CargoDiscrepancy"("status");

-- CreateIndex
CREATE INDEX "CargoDiscrepancy_discrepancyType_idx" ON "CargoDiscrepancy"("discrepancyType");

-- CreateIndex
CREATE INDEX "CargoDiscrepancy_detectedAt_idx" ON "CargoDiscrepancy"("detectedAt");

-- CreateIndex
CREATE INDEX "ColdChainProfile_orgId_idx" ON "ColdChainProfile"("orgId");

-- CreateIndex
CREATE INDEX "ColdChainProfile_active_idx" ON "ColdChainProfile"("active");

-- CreateIndex
CREATE INDEX "DeviceCalibration_deviceId_idx" ON "DeviceCalibration"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceCalibration_orgId_idx" ON "DeviceCalibration"("orgId");

-- CreateIndex
CREATE INDEX "DeviceCalibration_status_idx" ON "DeviceCalibration"("status");

-- CreateIndex
CREATE INDEX "DeviceCalibration_expiresAt_idx" ON "DeviceCalibration"("expiresAt");

-- CreateIndex
CREATE INDEX "ImmutableTemperatureLog_shipmentId_recordedAt_idx" ON "ImmutableTemperatureLog"("shipmentId", "recordedAt");

-- CreateIndex
CREATE INDEX "ImmutableTemperatureLog_deviceId_recordedAt_idx" ON "ImmutableTemperatureLog"("deviceId", "recordedAt");

-- CreateIndex
CREATE INDEX "ImmutableTemperatureLog_orgId_capturedAt_idx" ON "ImmutableTemperatureLog"("orgId", "capturedAt");

-- CreateIndex
CREATE INDEX "ImmutableTemperatureLog_isExcursion_idx" ON "ImmutableTemperatureLog"("isExcursion");

-- CreateIndex
CREATE INDEX "ImmutableTemperatureLog_isAlert_idx" ON "ImmutableTemperatureLog"("isAlert");

-- CreateIndex
CREATE INDEX "ColdChainExcursion_shipmentId_idx" ON "ColdChainExcursion"("shipmentId");

-- CreateIndex
CREATE INDEX "ColdChainExcursion_orgId_idx" ON "ColdChainExcursion"("orgId");

-- CreateIndex
CREATE INDEX "ColdChainExcursion_status_idx" ON "ColdChainExcursion"("status");

-- CreateIndex
CREATE INDEX "ColdChainExcursion_severity_idx" ON "ColdChainExcursion"("severity");

-- CreateIndex
CREATE INDEX "ColdChainExcursion_startedAt_idx" ON "ColdChainExcursion"("startedAt");

-- CreateIndex
CREATE INDEX "CAPAReport_orgId_idx" ON "CAPAReport"("orgId");

-- CreateIndex
CREATE INDEX "CAPAReport_issueId_idx" ON "CAPAReport"("issueId");

-- CreateIndex
CREATE INDEX "CAPAReport_shipmentId_idx" ON "CAPAReport"("shipmentId");

-- CreateIndex
CREATE INDEX "CAPAReport_status_idx" ON "CAPAReport"("status");

-- CreateIndex
CREATE INDEX "CAPAReport_reportNumber_idx" ON "CAPAReport"("reportNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLink_tokenHash_key" ON "MagicLink"("tokenHash");

-- CreateIndex
CREATE INDEX "MagicLink_userId_idx" ON "MagicLink"("userId");

-- CreateIndex
CREATE INDEX "MagicLink_tokenHash_idx" ON "MagicLink"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginAuditLog_userId_idx" ON "LoginAuditLog"("userId");

-- CreateIndex
CREATE INDEX "LoginAuditLog_createdAt_idx" ON "LoginAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "LoginAuditLog_method_idx" ON "LoginAuditLog"("method");

-- CreateIndex
CREATE INDEX "ShipmentAccessory_shipmentId_idx" ON "ShipmentAccessory"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentAccessory_deviceId_idx" ON "ShipmentAccessory"("deviceId");

-- CreateIndex
CREATE INDEX "ShipmentFlag_shipmentId_idx" ON "ShipmentFlag"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentFlag_resolved_idx" ON "ShipmentFlag"("resolved");

-- CreateIndex
CREATE INDEX "ConnectivityLog_createdAt_idx" ON "ConnectivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ConnectivityLog_locationId_idx" ON "ConnectivityLog"("locationId");

-- CreateIndex
CREATE INDEX "AgentDecision_orgId_idx" ON "AgentDecision"("orgId");

-- CreateIndex
CREATE INDEX "AgentDecision_agentType_idx" ON "AgentDecision"("agentType");

-- CreateIndex
CREATE INDEX "AgentDecision_entityType_entityId_idx" ON "AgentDecision"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AgentDecision_actionType_idx" ON "AgentDecision"("actionType");

-- CreateIndex
CREATE INDEX "AgentDecision_outcomeStatus_idx" ON "AgentDecision"("outcomeStatus");

-- CreateIndex
CREATE INDEX "AgentDecision_triggerEventType_idx" ON "AgentDecision"("triggerEventType");

-- CreateIndex
CREATE INDEX "AgentDecision_createdAt_idx" ON "AgentDecision"("createdAt");

-- CreateIndex
CREATE INDEX "AgentDecision_promotedToAutomation_idx" ON "AgentDecision"("promotedToAutomation");

-- CreateIndex
CREATE INDEX "AgentDecisionReadModel_orgId_idx" ON "AgentDecisionReadModel"("orgId");

-- CreateIndex
CREATE INDEX "AgentDecisionReadModel_agentType_idx" ON "AgentDecisionReadModel"("agentType");

-- CreateIndex
CREATE INDEX "AgentDecisionReadModel_actionType_idx" ON "AgentDecisionReadModel"("actionType");

-- CreateIndex
CREATE INDEX "AgentDecisionReadModel_outcomeStatus_idx" ON "AgentDecisionReadModel"("outcomeStatus");

-- CreateIndex
CREATE INDEX "AgentDecisionReadModel_createdAt_idx" ON "AgentDecisionReadModel"("createdAt");

-- CreateIndex
CREATE INDEX "AgentConfig_orgId_idx" ON "AgentConfig"("orgId");

-- CreateIndex
CREATE INDEX "AgentConfig_agentType_idx" ON "AgentConfig"("agentType");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfig_orgId_agentType_key" ON "AgentConfig"("orgId", "agentType");

-- CreateIndex
CREATE INDEX "AgentConfigVersion_configId_idx" ON "AgentConfigVersion"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfigVersion_configId_versionNumber_key" ON "AgentConfigVersion"("configId", "versionNumber");

-- CreateIndex
CREATE INDEX "AutomationRule_orgId_enabled_idx" ON "AutomationRule"("orgId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_eventPattern_idx" ON "AutomationRule"("eventPattern");

-- CreateIndex
CREATE INDEX "AutomationRule_priority_idx" ON "AutomationRule"("priority");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_orgId_idx" ON "AutomationExecutionLog"("orgId");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_ruleId_idx" ON "AutomationExecutionLog"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_createdAt_idx" ON "AutomationExecutionLog"("createdAt");

-- CreateIndex
CREATE INDEX "SkillConfig_orgId_idx" ON "SkillConfig"("orgId");

-- CreateIndex
CREATE INDEX "SkillConfig_skillType_idx" ON "SkillConfig"("skillType");

-- CreateIndex
CREATE UNIQUE INDEX "SkillConfig_orgId_skillType_name_key" ON "SkillConfig"("orgId", "skillType", "name");

-- CreateIndex
CREATE INDEX "SkillChain_orgId_idx" ON "SkillChain"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quote_orgId_idx" ON "Quote"("orgId");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "QuoteLineItem_quoteId_idx" ON "QuoteLineItem"("quoteId");

-- CreateIndex
CREATE INDEX "Charge_orgId_idx" ON "Charge"("orgId");

-- CreateIndex
CREATE INDEX "Charge_orderId_idx" ON "Charge"("orderId");

-- CreateIndex
CREATE INDEX "Charge_shipmentId_idx" ON "Charge"("shipmentId");

-- CreateIndex
CREATE INDEX "Charge_chargeCategory_idx" ON "Charge"("chargeCategory");

-- CreateIndex
CREATE INDEX "Charge_status_idx" ON "Charge"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentFinancialSummary_shipmentId_key" ON "ShipmentFinancialSummary"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentFinancialSummary_orgId_idx" ON "ShipmentFinancialSummary"("orgId");

-- CreateIndex
CREATE INDEX "ShipmentFinancialSummary_billingStatus_idx" ON "ShipmentFinancialSummary"("billingStatus");

-- CreateIndex
CREATE INDEX "ShipmentFinancialSummary_carrierPaymentStatus_idx" ON "ShipmentFinancialSummary"("carrierPaymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_orgId_idx" ON "Invoice"("orgId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_shipmentId_idx" ON "InvoiceLineItem"("shipmentId");

-- CreateIndex
CREATE INDEX "Payment_orgId_idx" ON "Payment"("orgId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "CarrierInvoice_orgId_idx" ON "CarrierInvoice"("orgId");

-- CreateIndex
CREATE INDEX "CarrierInvoice_carrierId_idx" ON "CarrierInvoice"("carrierId");

-- CreateIndex
CREATE INDEX "CarrierInvoice_status_idx" ON "CarrierInvoice"("status");

-- CreateIndex
CREATE INDEX "CarrierInvoice_dueDate_idx" ON "CarrierInvoice"("dueDate");

-- CreateIndex
CREATE INDEX "CarrierInvoice_matchStatus_idx" ON "CarrierInvoice"("matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierInvoice_orgId_carrierId_invoiceNumber_key" ON "CarrierInvoice"("orgId", "carrierId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "CarrierInvoiceLineItem_carrierInvoiceId_idx" ON "CarrierInvoiceLineItem"("carrierInvoiceId");

-- CreateIndex
CREATE INDEX "CarrierInvoiceLineItem_shipmentId_idx" ON "CarrierInvoiceLineItem"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialQuery_queryNumber_key" ON "FinancialQuery"("queryNumber");

-- CreateIndex
CREATE INDEX "FinancialQuery_orgId_idx" ON "FinancialQuery"("orgId");

-- CreateIndex
CREATE INDEX "FinancialQuery_status_idx" ON "FinancialQuery"("status");

-- CreateIndex
CREATE INDEX "FinancialQuery_queryType_idx" ON "FinancialQuery"("queryType");

-- CreateIndex
CREATE INDEX "FinancialQuery_invoiceId_idx" ON "FinancialQuery"("invoiceId");

-- CreateIndex
CREATE INDEX "FinancialQuery_carrierInvoiceId_idx" ON "FinancialQuery"("carrierInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");

-- CreateIndex
CREATE INDEX "CreditNote_orgId_idx" ON "CreditNote"("orgId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_customerId_idx" ON "CreditNote"("customerId");

-- CreateIndex
CREATE INDEX "CreditNote_carrierId_idx" ON "CreditNote"("carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceReadModel_invoiceNumber_key" ON "InvoiceReadModel"("invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceReadModel_orgId_idx" ON "InvoiceReadModel"("orgId");

-- CreateIndex
CREATE INDEX "InvoiceReadModel_status_idx" ON "InvoiceReadModel"("status");

-- CreateIndex
CREATE INDEX "InvoiceReadModel_customerId_idx" ON "InvoiceReadModel"("customerId");

-- CreateIndex
CREATE INDEX "InvoiceReadModel_dueDate_idx" ON "InvoiceReadModel"("dueDate");

-- CreateIndex
CREATE INDEX "InvoiceReadModel_daysPastDue_idx" ON "InvoiceReadModel"("daysPastDue");

-- CreateIndex
CREATE INDEX "Comment_orgId_idx" ON "Comment"("orgId");

-- CreateIndex
CREATE INDEX "Comment_entityType_entityId_idx" ON "Comment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Comment_createdAt_idx" ON "Comment"("createdAt");

-- CreateIndex
CREATE INDEX "IssueLabel_orgId_idx" ON "IssueLabel"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueLabel_orgId_name_key" ON "IssueLabel"("orgId", "name");

-- CreateIndex
CREATE INDEX "IssueLabelAssignment_issueId_idx" ON "IssueLabelAssignment"("issueId");

-- CreateIndex
CREATE INDEX "IssueLabelAssignment_labelId_idx" ON "IssueLabelAssignment"("labelId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueLabelAssignment_issueId_labelId_key" ON "IssueLabelAssignment"("issueId", "labelId");

-- CreateIndex
CREATE INDEX "KanbanView_orgId_idx" ON "KanbanView"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierTrackingIntegration_carrierId_key" ON "CarrierTrackingIntegration"("carrierId");

-- CreateIndex
CREATE INDEX "CarrierTrackingIntegration_providerType_idx" ON "CarrierTrackingIntegration"("providerType");

-- CreateIndex
CREATE INDEX "CarrierTrackingIntegration_status_idx" ON "CarrierTrackingIntegration"("status");

-- CreateIndex
CREATE INDEX "CarrierTrackingEvent_shipmentId_idx" ON "CarrierTrackingEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "CarrierTrackingEvent_carrierId_idx" ON "CarrierTrackingEvent"("carrierId");

-- CreateIndex
CREATE INDEX "CarrierTrackingEvent_integrationId_idx" ON "CarrierTrackingEvent"("integrationId");

-- CreateIndex
CREATE INDEX "CarrierTrackingEvent_trackingNumber_idx" ON "CarrierTrackingEvent"("trackingNumber");

-- CreateIndex
CREATE INDEX "CarrierTrackingEvent_occurredAt_idx" ON "CarrierTrackingEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "CarrierTrackingEvent_status_idx" ON "CarrierTrackingEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LaneRoute_laneId_key" ON "LaneRoute"("laneId");

-- CreateIndex
CREATE INDEX "LaneRoute_orgId_idx" ON "LaneRoute"("orgId");

-- CreateIndex
CREATE INDEX "QualityIssueSummary_orgId_dimensionType_idx" ON "QualityIssueSummary"("orgId", "dimensionType");

-- CreateIndex
CREATE INDEX "QualityIssueSummary_orgId_totalIssues_idx" ON "QualityIssueSummary"("orgId", "totalIssues");

-- CreateIndex
CREATE INDEX "QualityIssueSummary_lastIssueAt_idx" ON "QualityIssueSummary"("lastIssueAt");

-- CreateIndex
CREATE UNIQUE INDEX "QualityIssueSummary_orgId_dimensionType_dimensionId_key" ON "QualityIssueSummary"("orgId", "dimensionType", "dimensionId");

-- CreateIndex
CREATE INDEX "CAPAFollowUp_orgId_idx" ON "CAPAFollowUp"("orgId");

-- CreateIndex
CREATE INDEX "CAPAFollowUp_capaReportId_idx" ON "CAPAFollowUp"("capaReportId");

-- CreateIndex
CREATE INDEX "CAPAFollowUp_dueDate_idx" ON "CAPAFollowUp"("dueDate");

-- CreateIndex
CREATE INDEX "CAPAFollowUp_status_idx" ON "CAPAFollowUp"("status");

-- CreateIndex
CREATE INDEX "SOPChecklist_orgId_idx" ON "SOPChecklist"("orgId");

-- CreateIndex
CREATE INDEX "SOPChecklist_category_idx" ON "SOPChecklist"("category");

-- CreateIndex
CREATE INDEX "SOPChecklist_status_idx" ON "SOPChecklist"("status");

-- CreateIndex
CREATE INDEX "SOPChecklist_nextDueDate_idx" ON "SOPChecklist"("nextDueDate");

-- CreateIndex
CREATE INDEX "SOPChecklistItem_checklistId_idx" ON "SOPChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "SOPAudit_orgId_idx" ON "SOPAudit"("orgId");

-- CreateIndex
CREATE INDEX "SOPAudit_checklistId_idx" ON "SOPAudit"("checklistId");

-- CreateIndex
CREATE INDEX "SOPAudit_status_idx" ON "SOPAudit"("status");

-- CreateIndex
CREATE INDEX "SOPAudit_auditDate_idx" ON "SOPAudit"("auditDate");

-- CreateIndex
CREATE INDEX "SOPAuditResponse_auditId_idx" ON "SOPAuditResponse"("auditId");

-- CreateIndex
CREATE INDEX "SOPAuditResponse_checklistItemId_idx" ON "SOPAuditResponse"("checklistItemId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "Lane"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_coldChainProfileId_fkey" FOREIGN KEY ("coldChainProfileId") REFERENCES "ColdChainProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStop" ADD CONSTRAINT "ShipmentStop_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStop" ADD CONSTRAINT "ShipmentStop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivalCriteria" ADD CONSTRAINT "ArrivalCriteria_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lane" ADD CONSTRAINT "Lane_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lane" ADD CONSTRAINT "Lane_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLane" ADD CONSTRAINT "CustomerLane_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLane" ADD CONSTRAINT "CustomerLane_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "Lane"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaneCarrier" ADD CONSTRAINT "LaneCarrier_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "Lane"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaneCarrier" ADD CONSTRAINT "LaneCarrier_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaneStop" ADD CONSTRAINT "LaneStop_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "Lane"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaneStop" ADD CONSTRAINT "LaneStop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryStopId_fkey" FOREIGN KEY ("deliveryStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderShipment" ADD CONSTRAINT "OrderShipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderShipment" ADD CONSTRAINT "OrderShipment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableUnit" ADD CONSTRAINT "TrackableUnit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableUnit" ADD CONSTRAINT "TrackableUnit_currentStopId_fkey" FOREIGN KEY ("currentStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingLaneRequest" ADD CONSTRAINT "PendingLaneRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingLaneRequest" ADD CONSTRAINT "PendingLaneRequest_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingLaneRequest" ADD CONSTRAINT "PendingLaneRequest_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CustomFieldVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReadModel" ADD CONSTRAINT "OrderReadModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReadModel" ADD CONSTRAINT "OrderReadModel_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReadModel" ADD CONSTRAINT "OrderReadModel_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentReadModel" ADD CONSTRAINT "ShipmentReadModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentReadModel" ADD CONSTRAINT "ShipmentReadModel_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentReadModel" ADD CONSTRAINT "ShipmentReadModel_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentReadModel" ADD CONSTRAINT "ShipmentReadModel_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "Lane"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierReadModel" ADD CONSTRAINT "CarrierReadModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReadModel" ADD CONSTRAINT "CustomerReadModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaneReadModel" ADD CONSTRAINT "LaneReadModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueReadModel" ADD CONSTRAINT "IssueReadModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaRule" ADD CONSTRAINT "SlaRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingPartner" ADD CONSTRAINT "TradingPartner_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingPartner" ADD CONSTRAINT "TradingPartner_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingPartnerTransaction" ADD CONSTRAINT "TradingPartnerTransaction_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradingPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdiTransactionLog" ADD CONSTRAINT "EdiTransactionLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "TradingPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierUser" ADD CONSTRAINT "CarrierUser_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderOffer" ADD CONSTRAINT "TenderOffer_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderOffer" ADD CONSTRAINT "TenderOffer_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_tenderOfferId_fkey" FOREIGN KEY ("tenderOfferId") REFERENCES "TenderOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderBid" ADD CONSTRAINT "TenderBid_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "CarrierUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAssignment" ADD CONSTRAINT "DeviceAssignment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAssignment" ADD CONSTRAINT "DeviceAssignment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAssignment" ADD CONSTRAINT "DeviceAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_shipmentStopId_fkey" FOREIGN KEY ("shipmentStopId") REFERENCES "ShipmentStop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoScan" ADD CONSTRAINT "CargoScan_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_trackableUnitId_fkey" FOREIGN KEY ("trackableUnitId") REFERENCES "TrackableUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_expectedStopId_fkey" FOREIGN KEY ("expectedStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoDiscrepancy" ADD CONSTRAINT "CargoDiscrepancy_actualStopId_fkey" FOREIGN KEY ("actualStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCalibration" ADD CONSTRAINT "DeviceCalibration_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImmutableTemperatureLog" ADD CONSTRAINT "ImmutableTemperatureLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImmutableTemperatureLog" ADD CONSTRAINT "ImmutableTemperatureLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdChainExcursion" ADD CONSTRAINT "ColdChainExcursion_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdChainExcursion" ADD CONSTRAINT "ColdChainExcursion_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPAReport" ADD CONSTRAINT "CAPAReport_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPAReport" ADD CONSTRAINT "CAPAReport_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAuditLog" ADD CONSTRAINT "LoginAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentAccessory" ADD CONSTRAINT "ShipmentAccessory_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentFlag" ADD CONSTRAINT "ShipmentFlag_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecisionReadModel" ADD CONSTRAINT "AgentDecisionReadModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConfigVersion" ADD CONSTRAINT "AgentConfigVersion_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AgentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillConfig" ADD CONSTRAINT "SkillConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillChain" ADD CONSTRAINT "SkillChain_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_parentQuoteId_fkey" FOREIGN KEY ("parentQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentFinancialSummary" ADD CONSTRAINT "ShipmentFinancialSummary_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierInvoice" ADD CONSTRAINT "CarrierInvoice_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierInvoiceLineItem" ADD CONSTRAINT "CarrierInvoiceLineItem_carrierInvoiceId_fkey" FOREIGN KEY ("carrierInvoiceId") REFERENCES "CarrierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueLabelAssignment" ADD CONSTRAINT "IssueLabelAssignment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueLabelAssignment" ADD CONSTRAINT "IssueLabelAssignment_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "IssueLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierTrackingIntegration" ADD CONSTRAINT "CarrierTrackingIntegration_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierTrackingEvent" ADD CONSTRAINT "CarrierTrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierTrackingEvent" ADD CONSTRAINT "CarrierTrackingEvent_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierTrackingEvent" ADD CONSTRAINT "CarrierTrackingEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CarrierTrackingIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaneRoute" ADD CONSTRAINT "LaneRoute_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "Lane"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPAFollowUp" ADD CONSTRAINT "CAPAFollowUp_capaReportId_fkey" FOREIGN KEY ("capaReportId") REFERENCES "CAPAReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOPChecklistItem" ADD CONSTRAINT "SOPChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "SOPChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOPAudit" ADD CONSTRAINT "SOPAudit_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "SOPChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOPAuditResponse" ADD CONSTRAINT "SOPAuditResponse_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "SOPAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOPAuditResponse" ADD CONSTRAINT "SOPAuditResponse_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "SOPChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

