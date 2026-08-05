const useTedious = process.env.DB_DRIVER === 'tedious'
    || process.env.RENDER
    || process.env.RAILWAY_ENVIRONMENT
    || process.env.VERCEL
    || (process.platform !== 'win32' && process.env.DB_TRUSTED_CONNECTION === 'false');

module.exports = useTedious
    ? require('./connection-tedious')
    : require('./connection-native');
