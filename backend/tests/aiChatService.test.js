const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildFallbackReply,
    resolveProvider,
    generateSupportReply
} = require('../services/aiChatService');

test('buildFallbackReply matches PNR queries', () => {
    const reply = buildFallbackReply('How do I check my PNR status?');
    assert.match(reply, /PNR/i);
});

test('buildFallbackReply returns generic help for unknown topics', () => {
    const reply = buildFallbackReply('hello there');
    assert.match(reply, /support ticket|detail/i);
});

test('resolveProvider uses fallback when no keys configured', () => {
    const orig = { ...process.env };
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.AI_CHAT_PROVIDER = 'auto';
    assert.equal(resolveProvider(), 'fallback');
    Object.assign(process.env, orig);
});

test('generateSupportReply uses fallback without API keys', async () => {
    const orig = { ...process.env };
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.AI_CHAT_PROVIDER = 'auto';

    const result = await generateSupportReply([
        { sender: 'agent', message: 'Hello!' },
        { sender: 'user', message: 'I need a refund for my cancelled ticket' }
    ]);

    assert.equal(result.provider, 'fallback');
    assert.match(result.reply, /refund/i);
    Object.assign(process.env, orig);
});
