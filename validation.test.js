const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIdentifier, validateData, validDate } = require('./validation');

test('normalizes Uzbekistan phone numbers and Gmail addresses', () => {
    assert.deepEqual(normalizeIdentifier('phone', '+998 90 123 45 67'), {
        identifier: 'p998901234567',
        label: '+998 901234567'
    });
    assert.deepEqual(normalizeIdentifier('mail', 'Test.User@GMAIL.COM'), {
        identifier: 'mtest.user@gmail.com',
        label: 'test.user@gmail.com'
    });
});

test('rejects invalid account identifiers', () => {
    assert.throws(() => normalizeIdentifier('phone', '123'), { status: 400 });
    assert.throws(() => normalizeIdentifier('mail', 'test@example.com'), { status: 400 });
    assert.throws(() => normalizeIdentifier('unknown', 'value'), { status: 400 });
});

test('validates and sanitizes all accounting record types', () => {
    const result = validateData({
        purchases: [{ id: 1, n: '  Guruch ', q: 2, p: 12000, d: '2026-10-16', ignored: true }],
        sales: [{ id: 'sale-id', n: 'Guruch', q: 1.5, p: 15000, d: '2026-10-16' }],
        workers: [{ id: 2, n: 'Ali', q: 8, p: 20000, d: '2026-10-16' }],
        extras: [{ id: 3, n: 'Yetkazib berish', t: 'out', a: 5000, d: '2026-10-16' }]
    });

    assert.deepEqual(result.purchases[0], { id: 1, n: 'Guruch', q: 2, p: 12000, d: '2026-10-16' });
    assert.deepEqual(result.extras[0], { id: 3, n: 'Yetkazib berish', t: 'out', a: 5000, d: '2026-10-16' });
    assert.equal(result.sales.length, 1);
    assert.equal(result.workers.length, 1);
});

test('rejects invalid accounting records and dates', () => {
    assert.equal(validDate('2026-02-30'), false);
    assert.throws(() => validateData({ purchases: [], sales: [], workers: [], extras: [{ id: 1, n: 'X', t: 'other', a: 3, d: '2026-10-16' }] }), { status: 400 });
    assert.throws(() => validateData({ purchases: [], sales: [], workers: [], extras: [], invalid: [] }), { status: 400 });
    assert.throws(() => validateData({ purchases: [], sales: [], workers: [] }), { status: 400 });
});
