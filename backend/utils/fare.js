const { getTatkalPrice } = require('./tatkal');
const { validateQuota, calculateTotalFare } = require('./quota');

const calculateBookingFare = ({
    basePrice,
    bookingType,
    quota = 'General',
    passengers,
    journeyDate
}) => {
    const quotaCheck = validateQuota(quota, passengers);
    if (quotaCheck.error) return quotaCheck;

    let classPrice = Number(basePrice);
    const tatkal = bookingType === 'Tatkal' || quota === 'Tatkal' || quota === 'PremiumTatkal';
    if (tatkal) {
        classPrice = getTatkalPrice(classPrice);
    }

    const { totalPrice, pricePerTicket } = calculateTotalFare({
        basePrice: classPrice,
        quota,
        passengers,
        bookingType
    });

    return { totalPrice, pricePerTicket };
};

module.exports = { calculateBookingFare };
