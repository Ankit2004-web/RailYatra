/**
 * Normalize email for lookup/storage (case-insensitive; Gmail ignores dots in local part).
 */
function normalizeEmail(email) {
    const trimmed = String(email || '').trim().toLowerCase();
    const at = trimmed.indexOf('@');
    if (at <= 0) return trimmed;

    let local = trimmed.slice(0, at);
    let domain = trimmed.slice(at + 1);

    if (domain === 'googlemail.com') {
        domain = 'gmail.com';
    }

    if (domain === 'gmail.com') {
        local = local.replace(/\./g, '');
    }

    return `${local}@${domain}`;
}

module.exports = { normalizeEmail };
