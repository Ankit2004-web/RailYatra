const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const { apiLimiter } = require('./middleware/rateLimit');
const syncDatabase = require('../database/sync');
const seedDatabase = require('../database/seed');

const authRoutes = require('./routes/auth');
const trainRoutes = require('./routes/trains');
const bookingRoutes = require('./routes/bookings');
const stationRoutes = require('./routes/stations');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const captchaRoutes = require('./routes/captcha');
const fareRoutes = require('./routes/fares');
const availabilityRoutes = require('./routes/availability');
const passengerRoutes = require('./routes/passengers');
const handlePaymentWebhook = require('./routes/paymentWebhook');
const otpRoutes = require('./routes/otp');
const notificationRoutes = require('./routes/notifications');
const supportRoutes = require('./routes/support');
const liveTrainRoutes = require('./routes/liveTrain');
const trainCoachRoutes = require('./routes/trainCoach');
const profileRoutes = require('./routes/profile');
const mfaRoutes = require('./routes/mfa');
const oauthRoutes = require('./routes/oauth');
const recommendationRoutes = require('./routes/recommendations');
const { startBackgroundJobs } = require('./services/jobScheduler');
const { errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR: AVATAR_UPLOAD_DIR } = require('./services/avatarService');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com', 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
            fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", 'https://api.razorpay.com'],
            frameSrc: ['https://api.razorpay.com']
        }
    }
}));

app.use(cors());
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handlePaymentWebhook);
app.use(express.json({ limit: '5mb' }));
app.use('/uploads/avatars', express.static(AVATAR_UPLOAD_DIR));
app.use(requestLogger);
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/train', trainCoachRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/captcha', captchaRoutes);
app.use('/api/fares', fareRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/passengers', passengerRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/live-trains', liveTrainRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/recommendations', recommendationRoutes);

app.get('/api/health', async (req, res) => {
    res.json({
        status: 'ok',
        database: 'Microsoft SQL Server',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health/ready', async (req, res) => {
    try {
        const { getPool } = require('../database/connection');
        const pool = await getPool();
        await pool.request().query('SELECT 1 AS ok');
        res.json({
            status: 'ready',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(503).json({
            status: 'not_ready',
            database: 'disconnected',
            detail: err.message
        });
    }
});

app.get('/api/openapi.yaml', (req, res) => {
    const specPath = path.join(__dirname, 'docs/openapi.yaml');
    if (fs.existsSync(specPath)) {
        res.type('text/yaml').send(fs.readFileSync(specPath, 'utf8'));
    } else {
        res.status(404).json({ msg: 'OpenAPI spec not found' });
    }
});

app.get('/api/docs', (req, res) => {
    res.json({
        openapi: '/api/openapi.yaml',
        swaggerUi: '/api/swagger',
        documentation: [
            '/docs/RAILWAY_DATA_ARCHITECTURE.md',
            '/docs/RAILWAY_DATA_IMPORT.md',
            '/docs/RAILWAY_DATA_DICTIONARY.md'
        ]
    });
});

app.get('/api/swagger', (req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RailYatra API — Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
    <style>body { margin: 0; } .topbar { display: none; }</style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api/openapi.yaml',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
            layout: 'BaseLayout'
        });
    </script>
</body>
</html>`);
});

const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
const frontendPath = frontendDist;

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || path.extname(req.path)) {
        return next();
    }

    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use('/api', (req, res) => {
    res.status(404).json({ msg: 'API route not found. Restart the server if you recently updated the app.' });
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            type: 'about:blank',
            title: 'Payload Too Large',
            status: 413,
            detail: 'Image is too large. Try a smaller photo.'
        });
    }
    errorHandler(err, req, res, next);
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('JWT_SECRET must be set to a secure value (min 16 chars) in production');
            }
            console.warn('Warning: JWT_SECRET is missing or weak. Set a strong secret before deploying.');
        }

        await syncDatabase();
        await seedDatabase();

        const coachCapacityRulesService = require('./services/coachCapacityRulesService');
        await coachCapacityRulesService.loadRulesCache();
        console.log('Loaded IR CoachCapacityRules for per-coach seating data.');

        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            console.log(`Server running on port ${PORT}`);
            console.log(`http://localhost:${PORT}`);
            console.log('Database: Microsoft SQL Server');

            startBackgroundJobs();
        });
    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

if (require.main === module) {
    const { assertSupportedNodeVersion } = require('./utils/nodeVersion');
    assertSupportedNodeVersion();
    startServer();
}

module.exports = app;
