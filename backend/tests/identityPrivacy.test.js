const test = require('node:test');
const assert = require('node:assert/strict');
const {
    maskAadhaar,
    maskPan,
    maskIdentity,
    looksLikePlainAadhaar,
    looksLikePlainPan,
    redactIdentityText,
    hmacFingerprint,
    encryptIdentity,
    decryptIdentity,
    toPublicPassenger
} = require('../utils/identityPrivacy');

test('Aadhaar is masked to last 4 digits', () => {
    assert.equal(maskAadhaar('123412341234'), 'XXXX-XXXX-1234');
    assert.equal(maskIdentity('Aadhaar', '1234 1234 1234'), 'XXXX-XXXX-1234');
});

test('PAN mid-section is masked', () => {
    assert.equal(maskPan('ABCDE1234F'), 'ABCXX1234X');
    assert.equal(maskIdentity('PAN', 'ABCDE1234F'), 'ABCXX1234X');
});

test('plaintext Aadhaar is detected and PAN is not treated as Aadhaar', () => {
    assert.equal(looksLikePlainAadhaar('123412341234'), true);
    assert.equal(looksLikePlainAadhaar('XXXX-XXXX-1234'), false);
    assert.equal(looksLikePlainPan('ABCDE1234F'), true);
});

test('logs redact 12-digit Aadhaar and PAN', () => {
    const text = redactIdentityText('aadhaar 123412341234 pan ABCDE1234F');
    assert.equal(text.includes('123412341234'), false);
    assert.equal(text.includes('ABCDE1234F'), false);
    assert.match(text, /XXXX-XXXX-1234/);
    assert.match(text, /ABCXX1234X/);
});

test('vault encrypts and decrypts without exposing plaintext in public passenger', () => {
    const sealed = encryptIdentity('123412341234');
    assert.notEqual(sealed.ciphertext, '123412341234');
    assert.equal(decryptIdentity(sealed), '123412341234');

    const publicPassenger = toPublicPassenger({
        name: 'Asha',
        idType: 'Aadhaar',
        idNumber: '123412341234',
        idFingerprint: 'secret-hash',
        idToken: 'adv_abc'
    });
    assert.equal(publicPassenger.idNumber, 'XXXX-XXXX-1234');
    assert.equal(publicPassenger.idFingerprint, undefined);
    assert.equal(hmacFingerprint('Aadhaar', '123412341234').length, 64);
    assert.equal(hmacFingerprint('Aadhaar', 'XXXX-XXXX-1234'), null);
});
