const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are RailYatra AI Support — a helpful assistant for an Indian railway ticket booking platform (similar to IRCTC).

Help users with:
- PNR status checks (10-digit PNR on the PNR Status page)
- Bookings, e-tickets, and My Bookings
- Cancellations and partial passenger cancellation
- Refunds per IRCTC-style cancellation rules
- RAC, waitlist, and chart preparation
- Lost tickets — advise raising a support ticket with PNR and registered mobile
- Live train status and station search

Be concise, friendly, and accurate. Use short paragraphs or bullet points when helpful.
If you cannot resolve an issue, suggest raising a support ticket on the Support page or calling the helpline.
Do not invent PNR numbers, refund amounts, or booking details — ask the user for their PNR or booking info when needed.
Never mention that you are powered by Groq, Gemini, or any third-party AI provider.`;

const FALLBACK_REPLIES = [
    { match: (t) => /pnr/i.test(t), reply: 'Please share your 10-digit PNR, or check status instantly on the PNR Status page from the main menu.' },
    { match: (t) => /refund/i.test(t), reply: 'Refunds follow IRCTC cancellation rules based on how early you cancel. Check My Bookings for refund status on cancelled tickets.' },
    { match: (t) => /lost|misplace/i.test(t), reply: 'For lost tickets, raise a support ticket with your PNR and registered mobile number. You can also download e-tickets from My Bookings.' },
    { match: (t) => /cancel/i.test(t), reply: 'You can cancel from My Bookings. Partial passenger cancellation is supported for multi-passenger tickets.' },
    { match: (t) => /rac|waitlist|wl/i.test(t), reply: 'RAC (Reservation Against Cancellation) means a shared berth until chart preparation. Waitlisted tickets may confirm if others cancel — check PNR status regularly.' },
    { match: (t) => /book|ticket/i.test(t), reply: 'Search trains from the home page, select a train, add passenger details, and complete payment. Your e-ticket appears in My Bookings once confirmed.' },
    { match: (t) => /live|running|delay/i.test(t), reply: 'Use Live Train Status and enter your train number for real-time running information from Indian Railways NTES data.' }
];

function buildFallbackReply(userMessage) {
    const text = String(userMessage || '').trim();
    const rule = FALLBACK_REPLIES.find((r) => r.match(text));
    return rule?.reply || 'Thank you for reaching out. For complex issues, please raise a support ticket on this page or describe your booking/PNR question in more detail.';
}

function resolveProvider() {
    const configured = (process.env.AI_CHAT_PROVIDER || 'auto').toLowerCase();
    if (configured === 'fallback') return 'fallback';
    if (configured === 'groq' && process.env.GROQ_API_KEY) return 'groq';
    if (configured === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
    if (configured === 'auto') {
        if (process.env.GROQ_API_KEY) return 'groq';
        if (process.env.GEMINI_API_KEY) return 'gemini';
    }
    return 'fallback';
}

function mapHistoryToOpenAi(messages) {
    return (messages || [])
        .filter((m) => m?.message)
        .slice(-20)
        .map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.message
        }));
}

function mapHistoryToGemini(messages) {
    return (messages || [])
        .filter((m) => m?.message)
        .slice(-20)
        .map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.message }]
        }));
}

async function callGroq(messages) {
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...mapHistoryToOpenAi(messages)
            ],
            temperature: 0.4,
            max_tokens: 512
        }),
        signal: AbortSignal.timeout(Number(process.env.AI_CHAT_TIMEOUT_MS) || 25000)
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Groq API ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Groq returned empty response');
    return content;
}

async function callGemini(messages) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const contents = mapHistoryToGemini(messages);
    if (contents.length === 0) throw new Error('No messages for Gemini');

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 512
            }
        }),
        signal: AbortSignal.timeout(Number(process.env.AI_CHAT_TIMEOUT_MS) || 25000)
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Gemini API ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
    if (!content) throw new Error('Gemini returned empty response');
    return content;
}

async function generateSupportReply(messages) {
    const history = Array.isArray(messages) ? messages : [];
    const lastUser = [...history].reverse().find((m) => m.sender === 'user');
    const fallback = buildFallbackReply(lastUser?.message);

    const provider = resolveProvider();
    if (provider === 'fallback') {
        logger.info('[AI chat] Using keyword fallback (no API key configured)');
        return { reply: fallback, provider: 'fallback' };
    }

    try {
        const reply = provider === 'gemini'
            ? await callGemini(history)
            : await callGroq(history);
        return { reply, provider };
    } catch (err) {
        logger.warn('[AI chat] Provider failed, using fallback', { provider, error: err.message });
        return { reply: fallback, provider: 'fallback', error: err.message };
    }
}

module.exports = {
    SYSTEM_PROMPT,
    buildFallbackReply,
    resolveProvider,
    generateSupportReply
};
