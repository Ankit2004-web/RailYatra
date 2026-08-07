const test = require('node:test');
const assert = require('node:assert/strict');
const liveTrainService = require('../services/liveTrainService');

test('browseCatalog returns paginated catalog shape', async () => {
    const dbReady = (() => {
        try {
            require('../../database/connection').loadDriver();
            return true;
        } catch {
            return false;
        }
    })();

    if (!dbReady) {
        return;
    }

    const result = await liveTrainService.browseCatalog({ page: 1, pageSize: 5 });
    assert.equal(result.mode, 'catalog');
    assert.ok(Array.isArray(result.items));
    assert.ok(result.totalItems >= 0);
    if (result.items.length) {
        assert.ok(result.items[0].trainNumber);
        assert.ok(result.items[0].route.includes('→'));
    }
});

test('getScheduledPreview uses RailYatra app stations for catalog trains', async () => {
    const dbReady = (() => {
        try {
            require('../../database/connection').loadDriver();
            return true;
        } catch {
            return false;
        }
    })();

    if (!dbReady) {
        return;
    }

    const catalog = await liveTrainService.browseCatalog({ page: 1, pageSize: 1 });
    if (!catalog.items.length) {
        return;
    }

    const preview = await liveTrainService.getScheduledPreview(catalog.items[0].trainNumber);
    assert.equal(preview.provider, 'railyatra');
    assert.equal(preview.dataSource, 'railyatra-stations');
    assert.ok(preview.routeTimeline || preview.routeStops?.length >= 0);
    if (preview.routeTimeline?.stops?.length) {
        assert.equal(preview.routeTimeline.dataScope, 'railyatra-stations');
    }
});

test('mapCatalogItem shapes suggestion entries', () => {
    const item = liveTrainService.mapCatalogItem({
        trainId: 1,
        trainNumber: '12021',
        trainName: 'Barbil Janshatabdi',
        route: 'HOWRAH JN → Barbil',
        source: 'HOWRAH JN',
        destination: 'Barbil',
        departureTime: '06:20',
        stopCount: 55
    });
    assert.equal(item.trainNumber, '12021');
    assert.equal(item.route, 'HOWRAH JN → Barbil');
});
