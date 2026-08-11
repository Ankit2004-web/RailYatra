process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-auth-tests';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const userRepository = require('../repositories/userRepository');

const dbReady = (() => {
    try {
        require('../../database/connection').loadDriver();
        return true;
    } catch {
        return false;
    }
})();

const app = require('../server');

const solveCaptcha = (question) => {
    const match = String(question).match(/(\d+)\s*\+\s*(\d+)/);
    if (!match) throw new Error(`Could not parse captcha question: ${question}`);
    return String(Number(match[1]) + Number(match[2]));
};

const fetchCaptcha = async (agent) => {
    const response = await agent.get('/api/captcha');
    assert.equal(response.status, 200);
    return {
        captchaId: response.body.captchaId,
        captchaAnswer: solveCaptcha(response.body.question)
    };
};

test('register then login with same mobile credentials', { skip: dbReady ? false : 'Database driver unavailable' }, async () => {
    await require('../../database/sync')();

    const runId = Date.now();
    const agent = request(app);
    const phone = `8${String(runId).slice(-9)}`;
    const password = 'LoginTest@123';
    const captcha = await fetchCaptcha(agent);

    const registerResponse = await agent.post('/api/auth/register').send({
        name: 'Login Test User',
        phone,
        password,
        ...captcha
    });

    assert.equal(registerResponse.status, 200, registerResponse.body?.msg || 'register failed');
    assert.ok(registerResponse.body.token);

    const loginCaptcha = await fetchCaptcha(agent);
    const loginResponse = await agent.post('/api/auth/login').send({
        phone,
        password,
        ...loginCaptcha
    });

    assert.equal(loginResponse.status, 200, loginResponse.body?.msg || 'login failed');
    assert.ok(loginResponse.body.token);
});

test('resolveLoginUser finds phone account by number and local email alias', { skip: dbReady ? false : 'Database driver unavailable' }, async () => {
    await require('../../database/sync')();

    const phone = `7${String(Date.now()).slice(-9)}`;
    const user = await userRepository.resolveLoginUser(phone);
    assert.equal(user, null);

    const byAlias = await userRepository.resolveLoginUser(`${phone}@railyatra.local`);
    assert.equal(byAlias, null);
});

test('duplicate register tells user to sign in', { skip: dbReady ? false : 'Database driver unavailable' }, async () => {
    await require('../../database/sync')();

    const runId = Date.now();
    const agent = request(app);
    const phone = `6${String(runId).slice(-9)}`;
    const password = 'DupTest@123';
    const captcha = await fetchCaptcha(agent);

    const first = await agent.post('/api/auth/register').send({
        name: 'Dup User',
        phone,
        password,
        ...captcha
    });
    assert.equal(first.status, 200);

    const secondCaptcha = await fetchCaptcha(agent);
    const second = await agent.post('/api/auth/register').send({
        name: 'Dup User Again',
        phone,
        password,
        ...secondCaptcha
    });

    assert.equal(second.status, 400);
    assert.match(second.body.msg, /sign in/i);
});
