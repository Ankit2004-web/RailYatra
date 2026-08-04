const { body } = require('express-validator');

const VALID_CLASS_CODES = ['SL', '2S', '3A', '2A', '1A', 'CC', 'EC'];

const bookingRules = [
    body('trainId').isInt({ min: 1 }).withMessage('Valid train ID is required'),
    body('journeyDate').isISO8601().withMessage('Valid journey date is required'),
    body('classCode').isIn(VALID_CLASS_CODES).withMessage('Valid class code is required'),
    body('bookingType').optional().isIn(['General', 'Tatkal']).withMessage('Booking type must be General or Tatkal'),
    body('quota').optional().isIn(['General', 'Ladies', 'SeniorCitizen']).withMessage('Invalid quota'),
    body('joinWaitlist').optional().isBoolean().withMessage('joinWaitlist must be boolean'),
    body('joinRac').optional().isBoolean().withMessage('joinRac must be boolean'),
    body('seatNumbers').optional().isArray().withMessage('seatNumbers must be an array'),
    body('seatNumbers.*').optional().isInt({ min: 1 }).withMessage('Invalid seat number'),
    body('passengers').isArray({ min: 1 }).withMessage('At least one passenger is required'),
    body('passengers.*.name').trim().notEmpty().withMessage('Passenger name is required'),
    body('passengers.*.age').isInt({ min: 1, max: 120 }).withMessage('Passenger age must be between 1 and 120'),
    body('passengers.*.gender').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender value'),
    body('passengers.*.berthPreference').optional().isIn(['No Preference', 'Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper']).withMessage('Invalid berth preference'),
    body('fromStopSequence').optional().isInt({ min: 1 }).withMessage('fromStopSequence must be a positive integer'),
    body('toStopSequence').optional().isInt({ min: 1 }).withMessage('toStopSequence must be a positive integer'),
    body('fromStationId').optional().isInt({ min: 1 }).withMessage('fromStationId must be a positive integer'),
    body('toStationId').optional().isInt({ min: 1 }).withMessage('toStationId must be a positive integer'),
    body('fromStationCode').optional().trim().notEmpty().withMessage('fromStationCode cannot be empty'),
    body('toStationCode').optional().trim().notEmpty().withMessage('toStationCode cannot be empty'),
    body('captchaId').notEmpty().withMessage('Captcha is required'),
    body('captchaAnswer').notEmpty().withMessage('Captcha answer is required')
];

const updateBookingRules = [
    body('status').isIn(['Confirmed', 'Cancelled']).withMessage('Status must be Confirmed or Cancelled')
];

module.exports = { bookingRules, updateBookingRules };
