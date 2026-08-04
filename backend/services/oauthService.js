const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const oauthRepository = require('../repositories/oauthRepository');
const { resolveRole } = require('../constants/roles');

const signToken = (user) => jwt.sign({
    user: { id: user.id, isAdmin: !!user.isAdmin, role: resolveRole(user) }
}, process.env.JWT_SECRET, { expiresIn: '24h' });

const devProviders = {
    google: { name: 'Google User', emailDomain: 'gmail.com' },
    facebook: { name: 'Facebook User', emailDomain: 'facebook.com' }
};

async function loginOrRegisterOAuth({ provider, providerUserId, email, name }) {
    let account = await oauthRepository.findByProvider(provider, providerUserId);
    if (account) {
        const user = await userRepository.findById(account.userId);
        if (!user) throw new Error('Linked user not found');
        return { token: signToken(user), user: userRepository.toSafeUser(user), isNew: false };
    }

    let user = email ? await userRepository.findByEmail(email) : null;
    if (!user) {
        const safeEmail = email || `${provider}_${providerUserId}@oauth.local`;
        user = await userRepository.create({
            name: name || `${provider} user`,
            email: safeEmail,
            password: crypto.randomBytes(16).toString('hex'),
            phone: '0000000000'
        });
    }

    await oauthRepository.link({ userId: user.id, provider, providerUserId, email });
    return { token: signToken(user), user: userRepository.toSafeUser(user), isNew: true };
}

async function handleDevOAuth(provider, profileEmail) {
    const meta = devProviders[provider];
    if (!meta) throw new Error('Unsupported provider');
    const providerUserId = crypto.createHash('sha256').update(`${provider}:${profileEmail || 'anon'}`).digest('hex').slice(0, 16);
    const email = profileEmail || `${providerUserId}@${meta.emailDomain}`;
    return loginOrRegisterOAuth({ provider, providerUserId, email, name: meta.name });
}

async function verifyGoogleToken(idToken) {
    if (!idToken) throw new Error('Missing Google token');
    if (process.env.GOOGLE_CLIENT_ID) {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
        if (!res.ok) throw new Error('Invalid Google token');
        const data = await res.json();
        if (data.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Google audience mismatch');
        return loginOrRegisterOAuth({
            provider: 'google',
            providerUserId: data.sub,
            email: data.email,
            name: data.name
        });
    }
    return handleDevOAuth('google', idToken.includes('@') ? idToken : null);
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
    return handleDevOAuth('facebook', null);
}

module.exports = {
    verifyGoogleToken,
    verifyFacebookToken,
    loginOrRegisterOAuth
};
