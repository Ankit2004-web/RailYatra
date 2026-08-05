const driver = (process.env.DB_DRIVER || '').toLowerCase();

if (driver === 'sqlite') {
    module.exports = require('./connection-sqlite');
} else if (driver === 'tedious' || process.env.DB_TRUSTED_CONNECTION === 'false') {
    module.exports = require('./connection-tedious');
} else {
    module.exports = require('./connection-native');
}
