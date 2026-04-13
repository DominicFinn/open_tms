-- Drop legacy EDI models
-- These have been replaced by TradingPartner + EdiTransactionLog

-- Drop EdiFile (replaced by EdiTransactionLog)
DROP TABLE IF EXISTS "EdiFile" CASCADE;

-- Drop EdiPartner (replaced by TradingPartner)
DROP TABLE IF EXISTS "EdiPartner" CASCADE;

-- Drop OutboundIntegrationLog (replaced by EdiTransactionLog for outbound)
DROP TABLE IF EXISTS "OutboundIntegrationLog" CASCADE;

-- Drop OutboundIntegration (replaced by TradingPartner outbound config)
DROP TABLE IF EXISTS "OutboundIntegration" CASCADE;
