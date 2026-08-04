const { getPool } = require('../../database/connection');
const bookingRepository = require('../repositories/bookingRepository');
const paymentRepository = require('../repositories/paymentRepository');
const outboxRepository = require('../repositories/outboxRepository');
const razorpayService = require('./razorpayService');
const logger = require('../utils/logger');

async function findPaidUnconfirmed() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT b.id, b.userId, b.pnrNumber, b.grandTotal, b.totalPrice, b.updatedAt
        FROM Bookings b
        WHERE b.paymentStatus = 'Paid'
          AND b.status IN ('Pending', 'RAC', 'Waitlisted')
          AND b.updatedAt < DATEADD(MINUTE, -2, SYSUTCDATETIME())`);
    return result.recordset;
}

async function reconcilePaidUnconfirmed() {
    const rows = await findPaidUnconfirmed();
    let fixed = 0;

    for (const row of rows) {
        try {
            await bookingRepository.confirmBooking(row.id);
            await outboxRepository.enqueue({
                aggregateType: 'booking',
                aggregateId: row.id,
                eventType: 'payment.reconciled',
                payload: { bookingId: row.id, action: 'auto_confirm' }
            });
            fixed += 1;
        } catch (err) {
            logger.warn('Reconcile confirm failed', { bookingId: row.id, error: err.message });
        }
    }

    return { checked: rows.length, fixed };
}

async function findStuckPendingPayments() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT b.id, p.razorpayOrderId
        FROM Bookings b
        INNER JOIN Payments p ON p.bookingId = b.id
        WHERE b.status = 'Pending' AND b.paymentStatus = 'Pending'
          AND b.paymentHoldExpiresAt IS NOT NULL
          AND b.paymentHoldExpiresAt < DATEADD(MINUTE, -5, SYSUTCDATETIME())
          AND p.status = 'Pending'`);
    return result.recordset;
}

async function reconcileStuckPayments() {
    const rows = await findStuckPendingPayments();
    let marked = 0;
    for (const row of rows) {
        await paymentRepository.markFailed(row.id);
        marked += 1;
    }
    return { checked: rows.length, marked };
}

async function retryFailedRefunds() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT r.bookingId, r.refundAmount, p.razorpayPaymentId
        FROM Refunds r
        INNER JOIN Payments p ON p.bookingId = r.bookingId
        WHERE r.status = 'Failed' AND p.razorpayPaymentId IS NOT NULL`);
    let retried = 0;

    for (const row of result.recordset) {
        try {
            await razorpayService.processRefund({
                paymentId: row.razorpayPaymentId,
                amount: row.refundAmount
            });
            await pool.request()
                .input('bookingId', 'Int', row.bookingId)
                .query(`UPDATE Refunds SET status = 'Processed' WHERE bookingId = @bookingId`);
            retried += 1;
        } catch (_) { /* will retry next run */ }
    }
    return { checked: result.recordset.length, retried };
}

async function runFullReconciliation() {
    const paid = await reconcilePaidUnconfirmed();
    const stuck = await reconcileStuckPayments();
    const refunds = await retryFailedRefunds();

    const summary = {
        paidUnconfirmed: paid,
        stuckPayments: stuck,
        failedRefunds: refunds,
        runAt: new Date().toISOString()
    };

    try {
        const pool = await getPool();
        await pool.request()
            .input('runType', 'NVarChar', 'full')
            .input('matched', 'Int', paid.fixed + stuck.marked + refunds.retried)
            .input('mismatch', 'Int', paid.checked - paid.fixed)
            .input('fixed', 'Int', paid.fixed + refunds.retried)
            .input('details', 'NVarChar', JSON.stringify(summary).slice(0, 4000))
            .query(`INSERT INTO ReconciliationLog (runType, matchedCount, mismatchCount, autoFixedCount, details)
                    VALUES (@runType, @matched, @mismatch, @fixed, @details)`);
    } catch (_) { /* table optional */ }

    return summary;
}

module.exports = {
    runFullReconciliation,
    reconcilePaidUnconfirmed,
    reconcileStuckPayments,
    retryFailedRefunds,
    findPaidUnconfirmed
};
