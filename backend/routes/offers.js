const express = require('express');
const { getOffersPayload } = require('../../shared/offers/engine');

const router = express.Router();

/** Daily-refreshed offers catalog (IST calendar day). */
router.get('/', (req, res) => {
    try {
        const payload = getOffersPayload(new Date());
        res.set('Cache-Control', 'public, max-age=300');
        res.json(payload);
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Could not load offers' });
    }
});

module.exports = router;
