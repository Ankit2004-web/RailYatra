function problemDetails({ status, title, detail, instance, errors }) {
    return {
        type: 'about:blank',
        title: title || 'Error',
        status,
        detail: detail || title,
        instance: instance || undefined,
        errors: errors || undefined
    };
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    const status = err.status || err.statusCode || 500;
    const body = problemDetails({
        status,
        title: err.title || (status >= 500 ? 'Internal Server Error' : 'Request Error'),
        detail: err.message || 'An error occurred',
        instance: req.originalUrl,
        errors: err.errors
    });

    if (status >= 500) {
        const logger = require('../utils/logger');
        logger.error('Unhandled error', { error: err.message, path: req.path });
    }

    res.status(status).json(body);
}

module.exports = { errorHandler, problemDetails };
