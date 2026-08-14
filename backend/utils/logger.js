const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format((info) => {
            const { redactIdentityText, maskIdentity } = require('./identityPrivacy');
            if (typeof info.message === 'string') {
                info.message = redactIdentityText(info.message);
            }
            for (const key of Object.keys(info)) {
                const value = info[key];
                if (typeof value === 'string' && /idNumber|aadhaar|aadhar|panNumber|passport|voter/i.test(key)) {
                    info[key] = maskIdentity(key, value);
                } else if (typeof value === 'string') {
                    info[key] = redactIdentityText(value);
                }
            }
            return info;
        })(),
        winston.format.json()
    ),
    defaultMeta: { service: 'railway-api' },
    transports: [
        new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logsDir, 'combined.log') })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

module.exports = logger;
