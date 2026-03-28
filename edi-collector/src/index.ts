import { loadAppConfig } from './config.js';
import { refreshSchedule, stopAll } from './scheduler.js';
import { log, setLogLevel } from './logger.js';

async function main() {
  const config = loadAppConfig();
  setLogLevel(config.logLevel);

  log.info('EDI Collector starting...');
  log.info(`Backend: ${config.backendUrl}`);
  log.info(`Config refresh interval: ${config.pollConfigInterval}s`);

  // Initial schedule load
  await refreshSchedule(config);

  // Periodically refresh partner configs
  setInterval(() => {
    refreshSchedule(config);
  }, config.pollConfigInterval * 1000);

  // Graceful shutdown
  const shutdown = () => {
    log.info('Shutting down...');
    stopAll();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log.info('EDI Collector running. Press Ctrl+C to stop.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
