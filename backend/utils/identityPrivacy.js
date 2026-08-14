const crypto = require('crypto');

const NOTICE_VERSION = '2026-08-14';
const PURPOSES = {
    journey_id_proof: {
        id: 'journey_id_proof',
        title: 'Journey ID proof',
        retention: 'Until 90 days after the journey date, then deleted from the vault.',
        why: 'Indian Railways may ask for photo ID during travel. We only keep a masked number and a one-way fingerprint unless you ask us to save it for later bookings.'
    },
    tatkal_verification: {
        id: 'tatkal_verification',
        title: 'Tatkal / Aadhaar verification',
        retention: 'Account Aadhaar-verified flag is kept while your account is open. Passenger Aadhaar numbers are not stored in plaintext.',
        why: 'Opening-day ARP, Tatkal OTP, and the 24-ticket monthly cap require Aadhaar authentication. We do not use this for marketing.'
    },
    saved_passenger_id: {
        id: 'saved_passenger_id',
        title: 'Save ID for future journeys',
        retention: 'Until you unlink it, or your account is deleted.',
        why: 'Optional. Lets you reuse a masked ID on later tickets without typing it again. You can unlink it in one click on Profile.'
    }
};

const AADHAAR_TYPES = new Set(['aadhaar', 'aadhar']);
const PAN_TYPES = new Set(['pan']);
const PASSPORT_TYPES = new Set(['passport']);
const VOTER_TYPES = new Set(['voter', 'voter id', 'voterid', 'epic']);

function classifyIdType(idType) {
    const type = String(idType || '').trim().toLowerCase();
    if (AADHAAR_TYPES.has(type)) return 'Aadhaar';
    if (PAN_TYPES.has(type)) return 'PAN';
    if (PASSPORT_TYPES.has(type)) return 'Passport';
    if (VOTER_TYPES.has(type)) return 'Voter ID';
    return String(idType || '').trim() || null;
}

function normalizeAadhaar(value) {
    return String(value || '').replace(/\D/g, '');
}

function normalizePan(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeGenericId(value) {
    return String(value || '').toUpperCase().replace(/\s+/g, '');
}

function looksLikePlainAadhaar(value) {
    return /^\d{12}$/.test(normalizeAadhaar(value)) && !/^x+$/i.test(String(value || '').replace(/\D/g, ''));
}

function looksLikePlainPan(value) {
    return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizePan(value));
}

function isMaskedIdentity(value) {
    const text = String(value || '');
    return /x{2,}/i.test(text);
}

function maskAadhaar(value) {
    const digits = normalizeAadhaar(value);
    if (digits.length < 4) return 'XXXX-XXXX-XXXX';
    return `XXXX-XXXX-${digits.slice(-4)}`;
}

function maskPan(value) {
    const pan = normalizePan(value);
    if (pan.length !== 10) return 'XXXXX9999X';
    return `${pan.slice(0, 3)}XX${pan.slice(5, 9)}X`;
}

function maskPassport(value) {
    const raw = normalizeGenericId(value);
    if (raw.length < 3) return 'XXXXXXX';
    return `${raw[0]}${'X'.repeat(Math.max(raw.length - 3, 1))}${raw.slice(-2)}`;
}

function maskVoterId(value) {
    const raw = normalizeGenericId(value);
    if (raw.length < 3) return 'XXXXXXX';
    return `${raw.slice(0, 2)}${'X'.repeat(Math.max(raw.length - 4, 1))}${raw.slice(-2)}`;
}

function maskIdentity(idType, value) {
    if (!value) return '';
    if (isMaskedIdentity(value) && !looksLikePlainAadhaar(value) && !looksLikePlainPan(value)) {
        return String(value);
    }
    const kind = classifyIdType(idType);
    if (kind === 'Aadhaar' || looksLikePlainAadhaar(value)) return maskAadhaar(value);
    if (kind === 'PAN' || looksLikePlainPan(value)) return maskPan(value);
    if (kind === 'Passport') return maskPassport(value);
    if (kind === 'Voter ID') return maskVoterId(value);
    const text = String(value);
    if (text.length <= 4) return 'X'.repeat(text.length);
    return `${'X'.repeat(text.length - 4)}${text.slice(-4)}`;
}

function last4(idType, value) {
    const kind = classifyIdType(idType);
    if (kind === 'Aadhaar' || looksLikePlainAadhaar(value)) return normalizeAadhaar(value).slice(-4);
    if (kind === 'PAN' || looksLikePlainPan(value)) return normalizePan(value).slice(-4);
    return normalizeGenericId(value).slice(-4);
}

function normalizeIdentity(idType, value) {
    const kind = classifyIdType(idType);
    if (kind === 'Aadhaar') return normalizeAadhaar(value);
    if (kind === 'PAN') return normalizePan(value);
    return normalizeGenericId(value);
}

function looksLikePlainIdentity(idType, value) {
    if (!value || isMaskedIdentity(value)) return false;
    const kind = classifyIdType(idType);
    if (kind === 'Aadhaar') return looksLikePlainAadhaar(value);
    if (kind === 'PAN') return looksLikePlainPan(value);
    if (kind === 'Passport' || kind === 'Voter ID') return normalizeGenericId(value).length >= 6;
    return looksLikePlainAadhaar(value) || looksLikePlainPan(value);
}

function redactIdentityText(text) {
    return String(text || '')
        .replace(/(?<!\d)\d{12}(?!\d)/g, (match) => maskAadhaar(match))
        .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, (match) => maskPan(match));
}

function redactDeep(value, key = '') {
    if (value == null) return value;
    if (typeof value === 'string') {
        if (/idNumber|aadhaar|aadhar|panNumber|passport|voter/i.test(key)) {
            return maskIdentity(key, value);
        }
        return redactIdentityText(value);
    }
    if (Array.isArray(value)) return value.map((item) => redactDeep(item, key));
    if (typeof value === 'object') {
        const out = {};
        for (const [childKey, childValue] of Object.entries(value)) {
            if (/idFingerprint|ciphertext|vaultKey|authTag/i.test(childKey)) {
                out[childKey] = '[redacted]';
            } else {
                out[childKey] = redactDeep(childValue, childKey);
            }
        }
        return out;
    }
    return value;
}

function vaultKeyBuffer() {
    const explicit = process.env.IDENTITY_VAULT_KEY || '';
    const seed = explicit || `${process.env.JWT_SECRET || 'dev-identity-vault'}::railyatra-adv-v1`;
    return crypto.scryptSync(seed, 'railyatra-aadhaar-data-vault', 32);
}

function hmacFingerprint(idType, value) {
    if (!value || (isMaskedIdentity(value) && !looksLikePlainAadhaar(value) && !looksLikePlainPan(value))) {
        return null;
    }
    const normalized = normalizeIdentity(idType, value);
    if (!normalized || normalized.length < 6) return null;
    return crypto.createHmac('sha256', vaultKeyBuffer())
        .update(`${classifyIdType(idType)}:${normalized}`)
        .digest('hex');
}

function encryptIdentity(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', vaultKeyBuffer(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        ciphertext: encrypted.toString('hex')
    };
}

function decryptIdentity({ iv, authTag, ciphertext }) {
    if (!iv || !authTag || !ciphertext) return null;
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        vaultKeyBuffer(),
        Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'hex')),
        decipher.final()
    ]);
    return decrypted.toString('utf8');
}

function newVaultToken() {
    return `adv_${crypto.randomBytes(18).toString('hex')}`;
}

function toPublicPassenger(passenger) {
    if (!passenger) return passenger;
    const {
        idFingerprint,
        ciphertext,
        iv,
        authTag,
        ...safe
    } = passenger;
    return {
        ...safe,
        idNumber: maskIdentity(passenger.idType, passenger.idNumber),
        idToken: passenger.idToken || null
    };
}

function notices() {
    return {
        version: NOTICE_VERSION,
        purposes: Object.values(PURPOSES),
        rules: {
            aadhaar: 'Aadhaar numbers are never stored in plaintext. They are tokenized in a separate vault. UI, tickets, and logs show only XXXX-XXXX-1234. We do not accept Aadhaar card images or QR codes.',
            pan: 'PAN is masked as ABCXX1234X on screens. Full PAN is not stored next to phone or address.',
            passportVoter: 'Passport and Voter ID need a separate, unticked consent. Unlink is one click. We do not OCR the passport last page.',
            marketing: 'Identity data is never used for marketing or profiling.',
            digilocker: 'Prefer DigiLocker verification tokens instead of uploading ID images. RailYatra does not store ID photos.'
        }
    };
}

module.exports = {
    NOTICE_VERSION,
    PURPOSES,
    classifyIdType,
    normalizeAadhaar,
    normalizePan,
    looksLikePlainAadhaar,
    looksLikePlainPan,
    looksLikePlainIdentity,
    isMaskedIdentity,
    maskAadhaar,
    maskPan,
    maskPassport,
    maskVoterId,
    maskIdentity,
    last4,
    normalizeIdentity,
    redactIdentityText,
    redactDeep,
    hmacFingerprint,
    encryptIdentity,
    decryptIdentity,
    newVaultToken,
    toPublicPassenger,
    notices
};
