/**
 * Map legacy `email` login field to `phone` for shared login handler.
 */
function normalizeLoginBody(req, res, next) {
    if (!req.body.phone && req.body.email) {
        req.body.phone = req.body.email;
    }
    next();
}

module.exports = normalizeLoginBody;
