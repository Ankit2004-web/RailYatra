const test = require('node:test');
const assert = require('node:assert/strict');
const { isSupportedNodeVersion, getNodeMajorVersion } = require('../utils/nodeVersion');

test('getNodeMajorVersion returns numeric major version', () => {
    assert.ok(Number.isInteger(getNodeMajorVersion()));
    assert.ok(getNodeMajorVersion() >= 18);
});

test('isSupportedNodeVersion accepts Node 20-22 range', () => {
    const major = getNodeMajorVersion();
    if (major >= 20 && major <= 22) {
        assert.equal(isSupportedNodeVersion(), true);
    }
});
