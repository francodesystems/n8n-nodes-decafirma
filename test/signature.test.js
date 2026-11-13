const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

const { verifyDecaFirmaSignature } = require('../dist/nodes/DecaFirma/signature');

const secret = 'whsec_test_secret_0123456789abcdef';
const body = JSON.stringify({
	type: 'delivery_note.signed',
	createdAt: '2026-11-13T10:00:00.000Z',
	document: {
		id: 'cmw1',
		type: 'delivery_note',
		reference: 'ALB-2026-0042',
		version: 2,
		status: 'active',
	},
	routeId: null,
	shipment: { id: 'cmu1', reference: 'PED-4521', status: 'delivered' },
});

// The same algorithm DecaFirma uses (firmarCuerpo in src/lib/webhooks.ts).
const sign = (s, b) => `sha256=${createHmac('sha256', s).update(b).digest('hex')}`;

test('accepts a valid signature over a string body', () => {
	assert.deepEqual(verifyDecaFirmaSignature(secret, body, sign(secret, body)), { valid: true });
});

test('accepts a valid signature over the raw Buffer body, with non-ASCII bytes', () => {
	const raw = Buffer.from(
		JSON.stringify({ type: 'document.issued', shipment: { reference: 'Señal Ñ «x»' } }),
		'utf8',
	);
	assert.equal(verifyDecaFirmaSignature(secret, raw, sign(secret, raw)).valid, true);
});

test('accepts upper-case hex and surrounding spaces', () => {
	assert.equal(
		verifyDecaFirmaSignature(
			secret,
			body,
			` ${sign(secret, body).toUpperCase().replace('SHA256', 'sha256')} `,
		).valid,
		true,
	);
});

test('refuses a tampered body', () => {
	assert.deepEqual(
		verifyDecaFirmaSignature(secret, body.replace('PED-4521', 'PED-9999'), sign(secret, body)),
		{
			valid: false,
			reason: 'mismatch',
		},
	);
});

test('refuses a signature made with another secret', () => {
	assert.equal(
		verifyDecaFirmaSignature(secret, body, sign('whsec_other', body)).reason,
		'mismatch',
	);
});

test('missing and malformed headers', () => {
	assert.equal(verifyDecaFirmaSignature(secret, body, undefined).reason, 'missing');
	assert.equal(verifyDecaFirmaSignature(secret, body, '  ').reason, 'missing');
	assert.equal(verifyDecaFirmaSignature(secret, body, 'abc').reason, 'malformed');
	assert.equal(verifyDecaFirmaSignature(secret, body, 'sha256=xyz').reason, 'malformed');
	assert.equal(
		verifyDecaFirmaSignature(secret, body, `sha1=${'a'.repeat(64)}`).reason,
		'malformed',
	);
	// Sourevo-style header is not DecaFirma's.
	assert.equal(
		verifyDecaFirmaSignature(secret, body, `t=1,v1=${'a'.repeat(64)}`).reason,
		'malformed',
	);
});
