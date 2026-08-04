const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationRepository = require('../repositories/notificationRepository');

router.get('/', auth, async (req, res) => {
    try {
        const notifications = await notificationRepository.findByUserId(req.user.id);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/read-all', auth, async (req, res) => {
    try {
        await notificationRepository.markAllRead(req.user.id);
        res.json({ msg: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/:id/read', auth, async (req, res) => {
    try {
        await notificationRepository.markRead(req.params.id, req.user.id);
        res.json({ msg: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
