const outboxRepository = require('../repositories/outboxRepository');
const notificationRepository = require('../repositories/notificationRepository');
const loyaltyRepository = require('../repositories/loyaltyRepository');
const auditRepository = require('../repositories/auditRepository');
const logger = require('../utils/logger');

async function handleEvent(event) {
    const payload = JSON.parse(event.payload || '{}');

    switch (event.eventType) {
        case 'booking.confirmed':
            if (payload.userId) {
                await notificationRepository.create({
                    userId: payload.userId,
                    type: 'booking_confirmed',
                    title: 'Booking confirmed',
                    message: `PNR ${payload.pnr} confirmed.`,
                    meta: payload
                }).catch(() => {});
                if (payload.points) {
                    await loyaltyRepository.addPoints(payload.userId, payload.points, 'booking_confirmed').catch(() => {});
                }
            }
            await auditRepository.log({
                userId: payload.userId,
                action: 'booking.confirmed',
                resource: `booking:${event.aggregateId}`,
                details: payload
            }).catch(() => {});
            break;

        case 'booking.cancelled':
            if (payload.userId) {
                await notificationRepository.create({
                    userId: payload.userId,
                    type: 'booking_cancelled',
                    title: 'Booking cancelled',
                    message: payload.message || 'Your booking was cancelled.',
                    meta: payload
                }).catch(() => {});
            }
            break;

        case 'payment.reconciled':
            await auditRepository.log({
                userId: null,
                action: 'payment.reconciled',
                resource: `booking:${event.aggregateId}`,
                details: payload
            }).catch(() => {});
            break;

        default:
            logger.info('Outbox event skipped', { eventType: event.eventType });
    }
}

async function processOutboxBatch(limit = 50) {
    const events = await outboxRepository.fetchPending(limit);
    let processed = 0;

    for (const event of events) {
        try {
            await handleEvent(event);
            await outboxRepository.markDone(event.id);
            processed += 1;
        } catch (err) {
            await outboxRepository.markFailed(event.id, err.message);
        }
    }
    return processed;
}

module.exports = { processOutboxBatch, handleEvent };
