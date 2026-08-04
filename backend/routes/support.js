const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/rbac');
const { ROLES } = require('../constants/roles');
const supportRepository = require('../repositories/supportRepository');
const chatRepository = require('../repositories/chatRepository');
const crypto = require('crypto');

const ticketRules = [
    body('subject').trim().notEmpty().isLength({ max: 200 }),
    body('category').trim().notEmpty(),
    body('message').trim().notEmpty().isLength({ max: 5000 })
];

router.get('/faq', (_req, res) => {
    res.json([
        { q: 'How do I check PNR status?', a: 'Use the PNR Status page and enter your 10-digit PNR.' },
        { q: 'When will I get a refund?', a: 'Refunds are processed per IRCTC-style rules based on cancellation time.' },
        { q: 'What is RAC?', a: 'Reservation Against Cancellation — a shared berth until chart preparation.' },
        { q: 'How do I download my e-ticket?', a: 'Go to My Bookings and click E-Ticket for confirmed bookings.' },
        { q: 'Lost ticket — what now?', a: 'Raise a support ticket with your PNR and registered mobile number.' }
    ]);
});

router.post('/tickets', auth, ticketRules, validate, async (req, res) => {
    try {
        const ticket = await supportRepository.create({
            userId: req.user.id,
            ...req.body
        });
        res.status(201).json(ticket);
    } catch (err) {
        res.status(500).json({ msg: 'Could not create support ticket' });
    }
});

router.get('/tickets', auth, async (req, res) => {
    try {
        const tickets = await supportRepository.findByUserId(req.user.id);
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/tickets/all', auth, requireRole(ROLES.CUSTOMER_SUPPORT, ROLES.ADMIN), async (req, res) => {
    try {
        const tickets = await supportRepository.findAll({ status: req.query.status });
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/tickets/:id', auth, requireRole(ROLES.CUSTOMER_SUPPORT, ROLES.ADMIN), async (req, res) => {
    try {
        const ticket = await supportRepository.updateStatus(req.params.id, req.body.status);
        if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
        res.json(ticket);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/chat/session', auth, async (req, res) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const welcome = await chatRepository.addMessage({
        userId: req.user.id,
        sessionId,
        sender: 'agent',
        message: 'Hello! I am RailYatra support. How can I help you today?'
    });
    res.json({ sessionId, welcome });
});

router.get('/chat/:sessionId', auth, async (req, res) => {
    try {
        const messages = await chatRepository.findBySession(req.params.sessionId);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/chat/:sessionId', auth, [
    body('message').trim().notEmpty().isLength({ max: 2000 })
], validate, async (req, res) => {
    try {
        const userMsg = await chatRepository.addMessage({
            userId: req.user.id,
            sessionId: req.params.sessionId,
            sender: 'user',
            message: req.body.message
        });

        const lower = req.body.message.toLowerCase();
        let reply = 'Thank you for your message. A support agent will follow up shortly.';
        if (lower.includes('pnr')) reply = 'Please share your 10-digit PNR. You can also check status on the PNR page.';
        else if (lower.includes('refund')) reply = 'Refunds follow IRCTC cancellation rules. Check My Bookings for refund status.';
        else if (lower.includes('lost') || lower.includes('ticket')) reply = 'For lost tickets, raise a ticket with PNR and registered mobile number.';
        else if (lower.includes('cancel')) reply = 'You can cancel from My Bookings. Partial passenger cancellation is supported for multi-passenger tickets.';

        const agentMsg = await chatRepository.addMessage({
            userId: req.user.id,
            sessionId: req.params.sessionId,
            sender: 'agent',
            message: reply
        });

        res.json({ userMsg, agentMsg });
    } catch (err) {
        res.status(500).json({ msg: 'Chat failed' });
    }
});

module.exports = router;
