const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const savedPassengerRepository = require('../repositories/savedPassengerRepository');

const passengerFields = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('age').isInt({ min: 1, max: 120 }).withMessage('Valid age is required'),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
    body('berthPreference').optional({ nullable: true }).custom((value) => {
        if (value == null || value === '' || value === 'No Preference') return true;
        return ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper', 'Window', 'Aisle'].includes(value);
    })
];

router.get('/saved', auth, async (req, res) => {
    try {
        const passengers = await savedPassengerRepository.findByUserId(req.user.id);
        res.json(passengers);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/saved', auth, passengerFields, validate, async (req, res) => {
    try {
        const passenger = await savedPassengerRepository.create(req.user.id, req.body);
        res.status(201).json(passenger);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/saved/:id', auth, [param('id').isInt({ min: 1 }), ...passengerFields], validate, async (req, res) => {
    try {
        const passenger = await savedPassengerRepository.update(req.params.id, req.user.id, req.body);
        if (!passenger) {
            return res.status(404).json({ msg: 'Saved passenger not found' });
        }
        res.json(passenger);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/saved/:id', auth, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
    try {
        const removed = await savedPassengerRepository.remove(req.params.id, req.user.id);
        if (!removed) {
            return res.status(404).json({ msg: 'Saved passenger not found' });
        }
        res.json({ msg: 'Saved passenger removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
