const CANCELLATION_CHARGE = 20;
const CLERKAGE_FEE = 10;

const getHoursUntilJourney = (journeyDate) => {
    const journey = new Date(journeyDate);
    journey.setHours(0, 0, 0, 0);
    const now = new Date();
    return (journey.getTime() - now.getTime()) / (1000 * 60 * 60);
};

const isTatkalType = (bookingType, quota) => (
    bookingType === 'Tatkal'
    || quota === 'Tatkal'
    || quota === 'PremiumTatkal'
);

const refundCauseFromTrainStatus = (status) => {
    const value = String(status || '').toLowerCase();
    if (value.includes('cancel')) return 'train_cancelled';
    if (value.includes('divert')) return 'diverted';
    return 'voluntary';
};

const calculateRefund = ({
    totalPrice,
    journeyDate,
    paymentStatus,
    bookingStatus,
    passengerCount = 1,
    bookingType = 'General',
    quota = 'General',
    cause = 'voluntary'
}) => {
    const originalAmount = Number(totalPrice || 0);
    const tatkal = isTatkalType(bookingType, quota);

    if (cause === 'train_cancelled' || cause === 'delay' || cause === 'diverted') {
        return {
            originalAmount,
            refundPercent: paymentStatus === 'Paid' ? 100 : 0,
            cancellationCharge: 0,
            refundAmount: paymentStatus === 'Paid' ? originalAmount : 0,
            rule: 'Full refund for train cancellation, delay over 3 hours, or diversion (TDR)'
        };
    }

    if (bookingStatus === 'Waitlisted' || bookingStatus === 'RAC' || paymentStatus !== 'Paid') {
        if (tatkal && paymentStatus === 'Paid' && (bookingStatus === 'Waitlisted' || bookingStatus === 'RAC')) {
            const clerkage = CLERKAGE_FEE * passengerCount;
            return {
                originalAmount,
                refundPercent: 100,
                cancellationCharge: clerkage,
                refundAmount: Math.max(0, originalAmount - clerkage),
                rule: 'Tatkal waitlist/RAC not confirmed after chart — full refund minus clerkage'
            };
        }
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

    if (tatkal && bookingStatus === 'Confirmed') {
        return {
            originalAmount,
            refundPercent: 0,
            cancellationCharge: originalAmount,
            refundAmount: 0,
            rule: 'Confirmed Tatkal — no refund if cancelled by the passenger'
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

module.exports = {
    calculateRefund,
    CANCELLATION_CHARGE,
    CLERKAGE_FEE,
    refundCauseFromTrainStatus
};
