const { isTatkalBookingOpen } = require('./irctcRules');
const { daysBetweenIso, getIstParts } = require('./istTime');

const TATKAL_SURCHARGE = 1.3;

const daysUntilJourney = (journeyDate, now = new Date()) => (
    daysBetweenIso(getIstParts(now).dateStr, String(journeyDate).slice(0, 10))
);

const isTatkalEligible = (journeyDate, classCode = 'SL', departureTime = '08:00', now = new Date()) => {
    const open = isTatkalBookingOpen({ journeyDate, classCode, departureTime, now });
    return Boolean(open.ok);
};

const getTatkalPrice = (basePrice) => Math.round(Number(basePrice) * TATKAL_SURCHARGE);

module.exports = {
    TATKAL_SURCHARGE,
    isTatkalEligible,
    getTatkalPrice,
    daysUntilJourney
};
