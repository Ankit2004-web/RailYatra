const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getRecommendations } = require('../services/recommendationService');

router.post('/', auth, async (req, res) => {
    try {
        const { trainId, classCode, passengers, preferences } = req.body;
        if (!trainId || !classCode) {
            return res.status(400).json({ msg: 'trainId and classCode required' });
        }
        const recommendations = await getRecommendations({
            trainId,
            classCode,
            passengers: passengers || [],
            preferences: preferences || {}
        });
        res.json(recommendations);
    } catch (err) {
        res.status(500).json({ msg: 'Could not generate recommendations' });
    }
});

module.exports = router;
