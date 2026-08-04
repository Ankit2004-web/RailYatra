const CANCELLATION_CHARGE = 20;

const getHoursUntilJourney = (journeyDate) => {
    const journey = new Date(journeyDate);
    journey.setHours(0, 0, 0, 0);
    const now = new Date();
    return (journey.getTime() - now.getTime()) / (1000 * 60 * 60);
};

const calculateRefund = ({ totalPrice, journeyDate, paymentStatus, bookingStatus, passengerCount = 1 }) => {
    const originalAmount = Number(totalPrice || 0);

    if (bookingStatus === 'Waitlisted' || bookingStatus === 'RAC' || paymentStatus !== 'Paid') {
        return {
            originalAmount,
            refundPercent: paymentStatus === 'Paid' ? 100 : 0,
            cancellationCharge: 0,
            refundAmount: paymentStatus === 'Paid' ? originalAmount : 0,
            rule: bookingStatus === 'Waitlisted'
                ? 'Full refund for waitlisted booking'
                : bookingStatus === 'RAC'
                    ? 'Full refund for RAC booking'
                    : 'No payment made'
        };
    }

    const hoursLeft = getHoursUntilJourney(journeyDate);
    let refundPercent = 0;
    let rule = '';

    if (hoursLeft >= 48) {
        refundPercent = 100;
        rule = 'Cancelled 48+ hours before journey';
    } else if (hoursLeft >= 24) {
        refundPercent = 50;
        rule = 'Cancelled 24-48 hours before journey';
    } else if (hoursLeft > 0) {
        refundPercent = 25;
        rule = 'Cancelled within 24 hours of journey';
    } else {
        refundPercent = 0;
        rule = 'Journey date passed — no refund';
    }

    const charge = refundPercent > 0 ? CANCELLATION_CHARGE * passengerCount : 0;
    const grossRefund = Math.round((originalAmount * refundPercent) / 100);
    const refundAmount = Math.max(0, grossRefund - charge);

    return {
        originalAmount,
        refundPercent,
        cancellationCharge: charge,
        refundAmount,
        rule
    };
};

module.exports = { calculateRefund, CANCELLATION_CHARGE };
