const round2 = (value) => Math.round(Number(value) * 100) / 100;

/**
 * IRCTC-style payment breakdown (mirrors typical ERS line items).
 * ticketFare = base railway fare only; totalFare = all inclusive amount charged.
 */
const calculatePaymentBreakdown = ({
    ticketFare,
    passengerCount = 1,
    includeInsurance = false,
    includeCancellationCover = false
}) => {
    const fare = round2(ticketFare);
    const passengers = Math.max(Number(passengerCount) || 1, 1);

    const convenienceExGst = round2(Math.max(15, Math.min(40, fare * 0.015)) * passengers);
    const gstOnConvenience = round2(convenienceExGst * 0.18);
    const irctcConvenienceFee = round2(convenienceExGst + gstOnConvenience);

    const insuranceExGst = includeInsurance ? round2(0.35 * passengers) : 0;
    const gstOnInsurance = round2(insuranceExGst * 0.18);
    const travelInsurance = round2(insuranceExGst + gstOnInsurance);

    const cancellationCover = includeCancellationCover ? round2(Math.max(49, fare * 0.05)) : 0;

    const pgCharge = round2(Math.max(5, fare * 0.008 + passengers * 2));
    const agentServiceCharge = 0;

    const totalFare = round2(
        fare
        + irctcConvenienceFee
        + travelInsurance
        + cancellationCover
        + pgCharge
        + agentServiceCharge
    );

    return {
        ticketFare: fare,
        irctcConvenienceFee,
        convenienceFeeExGst: convenienceExGst,
        gstOnConvenience,
        travelInsurance,
        cancellationCover,
        pgCharge,
        agentServiceCharge,
        totalFare,
        passengerCount: passengers
    };
};

const parsePaymentBreakdown = (value, ticketFare, passengerCount = 1) => {
    if (!value) {
        return calculatePaymentBreakdown({ ticketFare, passengerCount });
    }
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (parsed?.totalFare != null) return parsed;
    } catch {
        // fall through
    }
    return calculatePaymentBreakdown({ ticketFare, passengerCount });
};

module.exports = {
    calculatePaymentBreakdown,
    parsePaymentBreakdown,
    round2
};
