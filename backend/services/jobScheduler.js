const bookingRepository = require('../repositories/bookingRepository');
const chartService = require('./chartService');
const reconciliationService = require('./reconciliationService');
const outboxProcessor = require('./outboxProcessor');
const searchCacheRepository = require('../repositories/searchCacheRepository');
const idempotencyRepository = require('../repositories/idempotencyRepository');
const logger = require('../utils/logger');

function startBackgroundJobs() {
    setInterval(() => {
        bookingRepository.releaseExpiredPaymentHolds().catch((err) => {
            logger.warn('Hold release failed', { error: err.message });
        });
    }, 60 * 1000).unref();

    setInterval(() => {
        chartService.prepareChartsForUpcomingJourneys().catch(() => {});
    }, 5 * 60 * 1000).unref();

    setInterval(() => {
        outboxProcessor.processOutboxBatch().catch(() => {});
    }, 30 * 1000).unref();

    setInterval(() => {
        reconciliationService.runFullReconciliation().catch((err) => {
            logger.warn('Reconciliation failed', { error: err.message });
        });
    }, 15 * 60 * 1000).unref();

    setInterval(() => {
        searchCacheRepository.purgeExpired().catch(() => {});
    }, 60 * 60 * 1000).unref();

    setInterval(() => {
        const pool = require('../../database/connection').getPool();
        pool.then((p) => p.request().query(
            'DELETE FROM IdempotencyKeys WHERE expiresAt < SYSUTCDATETIME()'
        )).catch(() => {});
    }, 6 * 60 * 60 * 1000).unref();

    logger.info('Background jobs started: holds, chart, outbox, reconcile, cache purge');
}

module.exports = { startBackgroundJobs };
