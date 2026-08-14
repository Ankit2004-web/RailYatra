const crypto = require('crypto');

const store = new Map();
const TTL_MS = 5 * 60 * 1000;
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

const cleanup = () => {
    const now = Date.now();
    for (const [id, entry] of store.entries()) {
        if (entry.expiresAt <= now) store.delete(id);
    }
};

setInterval(cleanup, 60 * 1000).unref();

function randomInt(max) {
    return crypto.randomInt(max);
}

function randomCode(length = CODE_LENGTH) {
    let code = '';
    for (let i = 0; i < length; i += 1) {
        code += CHARSET[randomInt(CHARSET.length)];
    }
    return code;
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildCaptchaSvg(text) {
    const width = 200;
    const height = 64;
    const chars = [...text].map((ch, index) => {
        const x = 22 + index * 34;
        const y = 42 + randomInt(9) - 4;
        const rot = randomInt(25) - 12;
        const fill = ['#0F2D3D', '#125B6E', '#1A4A5C', '#0D7377'][index % 4];
        return `<text x="${x}" y="${y}" fill="${fill}" font-size="30" font-family="Georgia, Times, serif" font-weight="700" letter-spacing="2" transform="rotate(${rot} ${x} ${y})">${escapeXml(ch)}</text>`;
    }).join('');

    const noiseLines = Array.from({ length: 6 }, () => {
        const x1 = randomInt(width);
        const y1 = randomInt(height);
        const x2 = randomInt(width);
        const y2 = randomInt(height);
        const opacity = (20 + randomInt(35)) / 100;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#12B8B8" stroke-width="${1 + randomInt(2)}" opacity="${opacity}" />`;
    }).join('');

    const dots = Array.from({ length: 28 }, () => {
        const cx = randomInt(width);
        const cy = randomInt(height);
        return `<circle cx="${cx}" cy="${cy}" r="${1 + randomInt(2)}" fill="#0F2D3D" opacity="0.18" />`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="CAPTCHA">
      <rect width="100%" height="100%" fill="#E7F4F6"/>
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="#B7D4DA" rx="8"/>
      ${noiseLines}
      ${dots}
      ${chars}
    </svg>`;
}

const createChallenge = () => {
    const answer = randomCode();
    const captchaId = crypto.randomBytes(16).toString('hex');
    const svg = buildCaptchaSvg(answer);

    store.set(captchaId, {
        answer,
        expiresAt: Date.now() + TTL_MS
    });

    const payload = {
        captchaId,
        image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    };

    if (process.env.NODE_ENV !== 'production') {
        payload.devAnswer = answer;
    }

    return payload;
};

const verifyChallenge = (captchaId, captchaAnswer) => {
    if (!captchaId || captchaAnswer === undefined || captchaAnswer === null) {
        return false;
    }

    const entry = store.get(captchaId);
    if (!entry || entry.expiresAt <= Date.now()) {
        store.delete(captchaId);
        return false;
    }

    const submitted = String(captchaAnswer).trim().replace(/\s+/g, '').toUpperCase();
    const valid = submitted === entry.answer;
    store.delete(captchaId);
    return valid;
};

module.exports = { createChallenge, verifyChallenge };
