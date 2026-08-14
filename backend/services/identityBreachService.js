const identityVaultRepository = require('../repositories/identityVaultRepository');
const notificationRepository = require('../repositories/notificationRepository');
const userRepository = require('../repositories/userRepository');
const { getPool } = require('../../database/connection');
const { deliverEmail } = require('./emailService');
const logger = require('../utils/logger');

const DPBI_NOTICE_HOURS = 72;

async function recordIncident({ summary, detectedAt, reportedBy }) {
    const pool = await getPool();
    const userIds = await identityVaultRepository.listUserIdsWithVault();
    await pool.request()
        .input('summary', 'NVarChar', summary)
        .input('detectedAt', 'NVarChar', detectedAt || new Date().toISOString())
        .input('reportedBy', 'Int', reportedBy || null)
        .input('userCount', 'Int', userIds.length)
        .input('dpbiDeadline', 'NVarChar', new Date(Date.now() + DPBI_NOTICE_HOURS * 3600 * 1000).toISOString())
        .query(`INSERT INTO IdentityBreachIncidents
            (summary, detectedAt, reportedBy, userCount, status, dpbiDeadline)
            VALUES (@summary, @detectedAt, @reportedBy, @userCount, 'notifying', @dpbiDeadline)`);

    const created = await pool.request().query(
        'SELECT TOP 1 * FROM IdentityBreachIncidents ORDER BY id DESC'
    );
    const incident = created.recordset[0];

    let notified = 0;
    for (const userId of userIds) {
        const user = await userRepository.findById(userId);
        await notificationRepository.create({
            userId,
            type: 'security',
            title: 'Identity data incident notice',
            message: 'We detected a possible identity-data incident. RailYatra stores Aadhaar/PAN only as masked tokens. Please review Profile → Identity vault and unlink any saved IDs you no longer need. A notice is being prepared for the Data Protection Board of India.',
            meta: { incidentId: incident?.id }
        }).catch(() => {});

        if (user?.email) {
            await deliverEmail({
                to: user.email,
                subject: 'RailYatra — identity data incident notice',
                html: `<p>We are notifying you of a possible identity-data incident affecting RailYatra.</p>
                       <p>Aadhaar and PAN are not stored in plaintext. Please sign in, open Profile, and unlink any saved ID you do not need.</p>
                       <p>This notice is also logged for the Data Protection Board of India (DPBI) within ${DPBI_NOTICE_HOURS} hours.</p>`
            }).catch(() => {});
        }
        notified += 1;
    }

    if (incident?.id) {
        await pool.request()
            .input('id', 'Int', incident.id)
            .input('notified', 'Int', notified)
            .query(`UPDATE IdentityBreachIncidents
                    SET status = 'users_notified', usersNotifiedAt = SYSUTCDATETIME(), usersNotified = @notified
                    WHERE id = @id`);
    }

    logger.warn('Identity breach incident recorded', {
        incidentId: incident?.id,
        userCount: userIds.length,
        summary
    });

    return {
        incidentId: incident?.id,
        affectedUsers: userIds.length,
        notified,
        dpbiDeadlineHours: DPBI_NOTICE_HOURS,
        dpbiStatus: 'logged_pending_board_filing'
    };
}

module.exports = { recordIncident, DPBI_NOTICE_HOURS };
