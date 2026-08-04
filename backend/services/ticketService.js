const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { parsePaymentBreakdown } = require('../utils/paymentBreakdown');
const { getBerthType } = require('../repositories/seatRepository');

const BRAND = {
    primary: '#12B8B8',
    dark: '#0AA6A6',
    deep: '#0F2D3D',
    light: '#E6F9F9',
    white: '#FFFFFF',
    text: '#1A2B33',
    muted: '#5A6B73',
    border: '#9DDEDE',
    rowAlt: '#F4FBFB'
};

const LOGO_PATH = path.join(__dirname, '../../frontend/public/logo.png');
const PAGE_MARGIN = 24;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return `${date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })} ${date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    })}`;
};

const formatJourneyDateShort = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
    });
};

const formatStopTime = (time, dayOffset = 0) => {
    if (!time) return '-';
    const normalized = String(time).trim();
    if (dayOffset > 0) return `${normalized} (+${dayOffset})`;
    return normalized;
};

const formatAmount = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const berthCode = (preference = '') => {
    const map = {
        Lower: 'LB',
        Middle: 'MB',
        Upper: 'UB',
        'Side Lower': 'SL',
        'Side Upper': 'SU',
        'No Preference': 'NA'
    };
    return map[preference] || 'NA';
};

const formatIrctcStatus = (booking, passenger, index) => {
    const status = passenger.passengerStatus || booking.status;
    if (booking.status === 'Waitlisted' || status === 'Waitlisted') {
        return booking.waitlistPosition ? `WL/${booking.waitlistPosition}` : 'WL';
    }
    if (booking.status === 'RAC' || status === 'RAC') return 'RAC';
    const seat = booking.seatNumbers?.[index];
    if (!seat) return 'CNF/NA/NA/NA';
    const berth = getBerthType(seat, booking.classCode) || berthCode(passenger.berthPreference);
    return `CNF/${booking.classCode || 'NA'}/${seat}/${berth}`;
};

const getBoardingAlighting = (booking) => {
    const train = booking.train || {};
    return {
        boarding: booking.boarding || {
            code: train.source || '-',
            name: train.source || '-',
            departureTime: train.departureTime
        },
        alighting: booking.alighting || {
            code: train.destination || '-',
            name: train.destination || '-',
            arrivalTime: train.arrivalTime
        }
    };
};

const getJourneyTimes = (booking) => {
    const { boarding, alighting } = getBoardingAlighting(booking);
    const train = booking.train || {};
    return {
        boardingTime: boarding.departureTime || train.departureTime || '-',
        reachTime: alighting.arrivalTime || train.arrivalTime || '-',
        duration: booking.duration || '-'
    };
};

const buildQrPayload = (booking) => {
    const { boarding, alighting } = getBoardingAlighting(booking);
    const { boardingTime, reachTime } = getJourneyTimes(booking);
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    return JSON.stringify({
        app: 'RailYatra',
        pnr: booking.pnrNumber,
        trainNumber: booking.train?.trainNumber,
        trainName: booking.train?.trainName,
        boarding: boarding.code,
        boardingName: boarding.name,
        boardingTime,
        alighting: alighting.code,
        alightingName: alighting.name,
        reachTime,
        journeyDate: booking.journeyDate,
        classCode: booking.classCode,
        status: booking.status,
        passengers: booking.passengers?.length || 0,
        totalFare: booking.grandTotal || booking.paymentBreakdown?.totalFare,
        verifyUrl: `${appUrl}/api/bookings/pnr/${booking.pnrNumber}`
    });
};

const drawRect = (doc, x, y, width, height, options = {}) => {
    doc.save();
    if (options.fill) {
        doc.fillColor(options.fill).rect(x, y, width, height).fill();
    }
    if (options.stroke !== false) {
        doc.strokeColor(options.strokeColor || BRAND.border)
            .lineWidth(options.lineWidth || 0.75)
            .rect(x, y, width, height)
            .stroke();
    }
    doc.restore();
};

const drawCellText = (doc, text, x, y, width, rowHeight, options = {}) => {
    const paddingX = options.paddingX ?? 6;
    const fontSize = options.size || 8;
    doc.fillColor(options.color || BRAND.text)
        .font(options.font || 'Helvetica')
        .fontSize(fontSize)
        .text(String(text ?? '-'), x + paddingX, y + (options.paddingTop ?? ((rowHeight - fontSize) / 2)), {
            width: width - paddingX * 2,
            align: options.align || 'left',
            lineBreak: false,
            ellipsis: true
        });
};

const drawTableRow = (doc, columns, x, y, rowHeight, options = {}) => {
    let cursor = x;
    columns.forEach((column) => {
        drawRect(doc, cursor, y, column.width, rowHeight, {
            fill: options.fill,
            strokeColor: options.strokeColor
        });
        drawCellText(doc, column.text, cursor, y, column.width, rowHeight, {
            font: options.font,
            size: options.size,
            color: options.color,
            align: column.align,
            paddingTop: options.paddingTop,
            paddingX: column.align === 'right' ? 8 : 6
        });
        cursor += column.width;
    });
};

const drawHeader = (doc, booking, x, y) => {
    const height = 58;
    drawRect(doc, x, y, CONTENT_WIDTH, height, { fill: BRAND.primary, stroke: false });

    try {
        doc.image(LOGO_PATH, x + 12, y + 10, { width: 36, height: 36 });
    } catch {
        doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(16).text('RY', x + 18, y + 20);
    }

    doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(15).text('RailYatra', x + 56, y + 14);
    doc.font('Helvetica').fontSize(8.5).text('Indian Railway E-Ticketing — Next Generation', x + 56, y + 32);
    doc.font('Helvetica-Bold').fontSize(11).text('Electronic Reservation Slip (ERS)', x, y + 14, {
        width: CONTENT_WIDTH - 12,
        align: 'right'
    });
    doc.font('Helvetica').fontSize(8.5).text(`— ${booking.bookingType || 'General'} User —`, x, y + 30, {
        width: CONTENT_WIDTH - 12,
        align: 'right'
    });

    return y + height;
};

const drawRouteBand = (doc, booking, x, y) => {
    const { boarding, alighting } = getBoardingAlighting(booking);
    const { boardingTime, reachTime, duration } = getJourneyTimes(booking);
    const height = 86;
    drawRect(doc, x, y, CONTENT_WIDTH, height, { fill: BRAND.light });

    const third = CONTENT_WIDTH / 3;

    doc.fillColor(BRAND.deep).font('Helvetica-Bold').fontSize(13)
        .text(boarding.code, x + 10, y + 8, { width: third - 14, align: 'left', lineBreak: false });

    doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.muted).text('FROM (Boarding)', x + 10, y + 24);

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.text)
        .text(boarding.name, x + 10, y + 36, { width: third - 14, lineGap: 0 });

    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.dark)
        .text(`Dep: ${formatStopTime(boardingTime)}`, x + 10, y + 58, { width: third - 14, lineGap: 0 });

    doc.fillColor(BRAND.dark).font('Helvetica-Bold').fontSize(12)
        .text(formatJourneyDateShort(booking.journeyDate), x + third, y + 18, { width: third, align: 'center' });

    doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.muted)
        .text('Journey Date', x + third, y + 34, { width: third, align: 'center' });

    if (duration && duration !== '-') {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.text)
            .text(`Duration: ${duration}`, x + third, y + 50, { width: third, align: 'center' });
    }

    doc.fillColor(BRAND.deep).font('Helvetica-Bold').fontSize(13)
        .text(alighting.code, x + third * 2, y + 8, { width: third - 10, align: 'right', lineBreak: false });

    doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.muted)
        .text('TO (Destination)', x + third * 2, y + 24, { width: third - 10, align: 'right' });

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.text)
        .text(alighting.name, x + third * 2, y + 36, { width: third - 10, align: 'right', lineGap: 0 });

    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.dark)
        .text(`Arr: ${formatStopTime(reachTime)}`, x + third * 2, y + 58, { width: third - 10, align: 'right', lineGap: 0 });

    return y + height;
};

const drawMetaTable = (doc, booking, x, y) => {
    const rowHeight = 34;
    const columns = [
        { width: CONTENT_WIDTH * 0.20, text: 'PNR' },
        { width: CONTENT_WIDTH * 0.32, text: 'Train No. / Name' },
        { width: CONTENT_WIDTH * 0.12, text: 'Class' },
        { width: CONTENT_WIDTH * 0.12, text: 'Quota' },
        { width: CONTENT_WIDTH * 0.24, text: 'Booking Date' }
    ];

    drawTableRow(doc, columns, x, y, 18, {
        fill: BRAND.dark,
        color: BRAND.white,
        font: 'Helvetica-Bold',
        size: 7.5,
        paddingTop: 4
    });

    const train = booking.train || {};
    const values = [
        booking.pnrNumber || '-',
        `${train.trainNumber || '-'} / ${train.trainName || '-'}`,
        booking.classCode || '-',
        booking.quota || 'General',
        formatDateTime(booking.bookingDate)
    ];

    drawTableRow(doc, columns.map((column, index) => ({ ...column, text: values[index] })), x, y + 18, rowHeight, {
        fill: BRAND.white,
        font: 'Helvetica-Bold',
        size: 8,
        paddingTop: 8
    });

    return y + 18 + rowHeight + 8;
};

const drawJourneyInfo = (doc, booking, x, y) => {
    const { boardingTime, reachTime, duration } = getJourneyTimes(booking);
    const columns = [
        { width: CONTENT_WIDTH * 0.22, text: 'Boarding Time' },
        { width: CONTENT_WIDTH * 0.22, text: 'Reach Time' },
        { width: CONTENT_WIDTH * 0.18, text: 'Duration' },
        { width: CONTENT_WIDTH * 0.18, text: 'Distance' },
        { width: CONTENT_WIDTH * 0.20, text: 'Ticket Status' }
    ];

    drawTableRow(doc, columns, x, y, 16, {
        fill: BRAND.primary,
        color: BRAND.white,
        font: 'Helvetica-Bold',
        size: 7.5,
        paddingTop: 3
    });

    const values = [
        formatStopTime(boardingTime),
        formatStopTime(reachTime),
        duration,
        booking.distanceKm ? `${booking.distanceKm} kms` : '-',
        booking.status || '-'
    ];

    drawTableRow(doc, columns.map((column, index) => ({ ...column, text: values[index] })), x, y + 16, 20, {
        fill: BRAND.white,
        font: 'Helvetica-Bold',
        size: 8.5,
        paddingTop: 5
    });

    return y + 36 + 10;
};

const drawPassengerSection = (doc, booking, x, y) => {
    doc.fillColor(BRAND.deep).font('Helvetica-Bold').fontSize(9).text('Passenger Details', x + 2, y);
    y += 14;

    const columns = [
        { width: CONTENT_WIDTH * 0.06, text: '#', align: 'center' },
        { width: CONTENT_WIDTH * 0.28, text: 'Name' },
        { width: CONTENT_WIDTH * 0.08, text: 'Age', align: 'center' },
        { width: CONTENT_WIDTH * 0.12, text: 'Gender', align: 'center' },
        { width: CONTENT_WIDTH * 0.23, text: 'Booking Status' },
        { width: CONTENT_WIDTH * 0.23, text: 'Current Status' }
    ];

    drawTableRow(doc, columns, x, y, 18, {
        fill: BRAND.dark,
        color: BRAND.white,
        font: 'Helvetica-Bold',
        size: 7.5,
        paddingTop: 4
    });

    y += 18;
    (booking.passengers || []).forEach((passenger, index) => {
        const statusText = formatIrctcStatus(booking, passenger, index);
        drawTableRow(doc, [
            { width: columns[0].width, text: String(index + 1), align: 'center' },
            { width: columns[1].width, text: passenger.name },
            { width: columns[2].width, text: passenger.age, align: 'center' },
            { width: columns[3].width, text: passenger.gender, align: 'center' },
            { width: columns[4].width, text: statusText },
            { width: columns[5].width, text: statusText }
        ], x, y, 22, {
            fill: index % 2 === 0 ? BRAND.white : BRAND.rowAlt,
            font: 'Helvetica',
            size: 8,
            paddingTop: 6
        });
        y += 22;
    });

    return y + 8;
};

const drawPaymentSection = (doc, booking, x, y) => {
    const breakdown = booking.paymentBreakdown || parsePaymentBreakdown(
        null,
        booking.totalPrice,
        booking.passengers?.length || 1
    );

    doc.fillColor(BRAND.deep).font('Helvetica-Bold').fontSize(9).text('Payment Details', x + 2, y);
    y += 14;

    const rows = [
        ['Ticket Fare', breakdown.ticketFare],
        ['RailYatra / IRCTC Convenience Fee (Incl. of GST)', breakdown.irctcConvenienceFee],
        ['Travel Insurance Premium (Incl. of GST)', breakdown.travelInsurance],
        ['PG Charge', breakdown.pgCharge]
    ];

    if (breakdown.cancellationCover > 0) {
        rows.push(['Free Cancellation Premium', breakdown.cancellationCover]);
    }
    if (breakdown.agentServiceCharge > 0) {
        rows.push(['Agent Service Charge', breakdown.agentServiceCharge]);
    }
    rows.push(['Total Fare (all inclusive)', breakdown.totalFare]);

    const labelWidth = CONTENT_WIDTH * 0.68;
    const valueWidth = CONTENT_WIDTH * 0.32;

    rows.forEach((row, index) => {
        const isTotal = index === rows.length - 1;
        drawTableRow(doc, [
            { width: labelWidth, text: row[0] },
            { width: valueWidth, text: formatAmount(row[1]), align: 'right' }
        ], x, y, isTotal ? 26 : 20, {
            fill: isTotal ? BRAND.light : index % 2 === 0 ? BRAND.white : BRAND.rowAlt,
            font: isTotal ? 'Helvetica-Bold' : 'Helvetica',
            size: isTotal ? 8.5 : 7.8,
            paddingTop: isTotal ? 8 : 5
        });
        y += isTotal ? 26 : 20;
    });

    doc.fillColor(BRAND.muted).font('Helvetica').fontSize(7.5)
        .text(`Payment Status: ${booking.paymentStatus || '-'}  |  Booked By: ${booking.user?.name || '-'}`, x + 2, y + 4);

    if (breakdown.gstOnConvenience > 0) {
        doc.fontSize(7).text(
            `GST on convenience fee: ${formatAmount(breakdown.gstOnConvenience)} (included above)`,
            x + 2,
            y + 14
        );
        y += 10;
    }

    return y + 22;
};

const drawSecurityBlock = async (doc, booking, x, y) => {
    const blockHeight = 96;
    drawRect(doc, x, y, CONTENT_WIDTH, blockHeight, { fill: BRAND.white });

    const qrPayload = buildQrPayload(booking);
    try {
        const qrBuffer = await QRCode.toBuffer(qrPayload, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 220,
            color: { dark: BRAND.deep, light: '#FFFFFF' }
        });
        doc.image(qrBuffer, x + 10, y + 10, { width: 76, height: 76 });
    } catch {
        drawRect(doc, x + 10, y + 10, 76, 76, { fill: BRAND.light });
    }

    doc.fillColor(BRAND.deep).font('Helvetica-Bold').fontSize(8).text('Scan QR for ticket verification', x + 96, y + 10);
    doc.font('Helvetica').fontSize(7).fillColor(BRAND.muted)
        .text('Contains PNR, train, boarding/alighting stations, journey date, class, and verification URL.', x + 96, y + 22, {
            width: CONTENT_WIDTH - 108
        });

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND.text)
        .text(`PNR: ${booking.pnrNumber}`, x + 96, y + 44);
    doc.font('Helvetica').fontSize(7).fillColor(BRAND.muted)
        .text(`E-Ticket ID: RY-${booking.id}-${booking.pnrNumber}`, x + 96, y + 56);

    const { boarding, alighting } = getBoardingAlighting(booking);
    const { boardingTime, reachTime } = getJourneyTimes(booking);
    doc.text(
        `${boarding.code} (${formatStopTime(boardingTime)}) → ${alighting.code} (${formatStopTime(reachTime)})  |  ${booking.classCode}  |  ${formatJourneyDateShort(booking.journeyDate)}`,
        x + 96,
        y + 68
    );

    return y + blockHeight + 8;
};

const drawInstructions = (doc, x, y) => {
    doc.fillColor(BRAND.deep).font('Helvetica-Bold').fontSize(8.5).text('Important Instructions', x + 2, y);
    y += 12;

    const instructions = [
        '1. Prescribed Original ID proof is required during journey — Voter ID, Driving Licence, Passport, Aadhaar, or other valid photo ID.',
        '2. E-ticket must be shown during ticket checking along with valid ID proof of at least one passenger.',
        '3. Boarding and alighting are valid only between the stations shown on this ticket.',
        '4. Fully waitlisted e-tickets are not allowed to board the train. Confirmed / RAC passengers appear on the reservation chart.',
        '5. Cancellation and refund rules apply as per Indian Railways policy.',
        '6. This is a computer-generated Electronic Reservation Slip (ERS) and does not require a signature.'
    ];

    doc.fillColor(BRAND.text).font('Helvetica').fontSize(7.1);
    instructions.forEach((line, index) => {
        doc.text(line, x + 4, y + index * 10.5, { width: CONTENT_WIDTH - 8, lineGap: 0 });
    });

    return y + instructions.length * 10.5 + 8;
};

const drawFooter = (doc, x, y) => {
    drawRect(doc, x, y, CONTENT_WIDTH, 28, { fill: BRAND.deep, stroke: false });
    doc.fillColor(BRAND.white).font('Helvetica').fontSize(7)
        .text('RailYatra — Your journey, simplified  |  Support: support@railyatra.in  |  www.railyatra.in', x + 8, y + 10, {
            width: CONTENT_WIDTH - 16,
            align: 'center'
        });
};

const assertConfirmedBookingHasSeats = (booking) => {
    if (booking.status !== 'Confirmed') return;
    const needed = booking.passengers?.length || 0;
    const seats = booking.seatNumbers || [];
    if (!needed || seats.length < needed || seats.some((seat) => !seat)) {
        throw new Error('Confirmed booking is missing seat numbers');
    }
};

const generateTicketPdf = async (booking) => {
    assertConfirmedBookingHasSeats(booking);

    const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE_MARGIN,
        info: {
            Title: `RailYatra E-Ticket — PNR ${booking.pnrNumber}`,
            Author: 'RailYatra',
            Subject: 'Electronic Reservation Slip'
        }
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const x = PAGE_MARGIN;
    let y = PAGE_MARGIN;

    y = drawHeader(doc, booking, x, y);
    y = drawRouteBand(doc, booking, x, y);
    y = drawMetaTable(doc, booking, x, y);
    y = drawJourneyInfo(doc, booking, x, y);
    y = drawPassengerSection(doc, booking, x, y);
    y = drawPaymentSection(doc, booking, x, y);
    y = await drawSecurityBlock(doc, booking, x, y);
    y = drawInstructions(doc, x, y);
    drawFooter(doc, x, Math.min(Math.max(y, 760), 800));

    doc.end();

    return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
};

module.exports = { generateTicketPdf, buildQrPayload };
