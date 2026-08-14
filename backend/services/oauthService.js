const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const oauthRepository = require('../repositories/oauthRepository');
const { resolveRole } = require('../constants/roles');

const signToken = (user) => jwt.sign({
    user: { id: user.id, isAdmin: !!user.isAdmin, role: resolveRole(user) }
}, process.env.JWT_SECRET, { expiresIn: '24h' });

const assertActiveUser = (user) => {
    if (!user) throw new Error('Linked user not found');
    if (user.isBlocked) throw new Error('Your account has been blocked. Contact support for assistance.');
    return user;
};

function getGoogleClientId() {
    return String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

function isEmailVerified(value) {
    return value === true || value === 'true' || value === '1';
}

const devProviders = {
    google: { name: 'Google User', emailDomain: 'gmail.com' },
    facebook: { name: 'Facebook User', emailDomain: 'facebook.com' }
};

async function loginOrRegisterOAuth({ provider, providerUserId, email, name }) {
    let account = await oauthRepository.findByProvider(provider, providerUserId);
    if (account) {
        const user = assertActiveUser(await userRepository.findById(account.userId));
        return { token: signToken(user), user: userRepository.toSafeUser(user), isNew: false };
    }

    let user = email ? await userRepository.findByEmail(email) : null;
    if (user) {
        assertActiveUser(user);
    } else {
        const safeEmail = email || `${provider}_${providerUserId}@oauth.local`;
        const phone = await userRepository.allocateSyntheticPhone(safeEmail);
        user = await userRepository.create({
            name: name || `${provider} user`,
            email: safeEmail,
            password: crypto.randomBytes(16).toString('hex'),
            phone
        });
    }

    await oauthRepository.link({ userId: user.id, provider, providerUserId, email: email || null });
    return { token: signToken(user), user: userRepository.toSafeUser(user), isNew: true };
}

async function handleDevOAuth(provider, profileEmail) {
    const meta = devProviders[provider];
    if (!meta) throw new Error('Unsupported provider');
    const providerUserId = crypto.createHash('sha256').update(`${provider}:${profileEmail || 'anon'}`).digest('hex').slice(0, 16);
    const email = profileEmail || `${providerUserId}@${meta.emailDomain}`;
    return loginOrRegisterOAuth({ provider, providerUserId, email, name: meta.name });
}

function allowDevOAuth() {
    return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_OAUTH === '1';
}

async function verifyGoogleToken(idToken) {
    if (!idToken) throw new Error('Missing Google token');
    const clientId = getGoogleClientId();

    if (clientId) {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
        if (!res.ok) throw new Error('Invalid Google token');
        const data = await res.json();
        if (data.aud !== clientId) throw new Error('Google audience mismatch');
        const email = isEmailVerified(data.email_verified) ? data.email : null;
        return loginOrRegisterOAuth({
            provider: 'google',
            providerUserId: data.sub,
            email,
            name: data.name
        });
    }

    if (allowDevOAuth() && String(idToken).includes('@')) {
        return handleDevOAuth('google', idToken);
    }

    throw new Error('Google Sign-In is not configured');
}

async function verifyFacebookToken(accessToken) {
    if (!accessToken) throw new Error('Missing Facebook token');
    if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
        const res = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`);
        if (!res.ok) throw new Error('Invalid Facebook token');
        const data = await res.json();
        return loginOrRegisterOAuth({
            provider: 'facebook',
            providerUserId: data.id,
            email: data.email,
            name: data.name
        });
    }
    if (allowDevOAuth()) {
        return handleDevOAuth('facebook', null);
    }
    throw new Error('Facebook Sign-In is not configured');
}

module.exports = {
    verifyGoogleToken,
    verifyFacebookToken,
    loginOrRegisterOAuth,
    getGoogleClientId
};
