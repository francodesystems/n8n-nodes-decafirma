const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
	collectSincePages,
	compact,
	dateOnly,
	isoDateTime,
	decaFirmaErrorOf,
	fileNameFromDisposition,
	headerSafe,
} = require('../dist/nodes/DecaFirma/GenericFunctions');

// A fake GET /documents: rows ordered by changedAt, { since, until, hasMore, data },
// «gt since», at most 500 per page, as in src/app/api/v1/documents/route.ts.
function fakeEndpoint(total) {
	const t0 = Date.parse('2026-11-01T00:00:00.000Z');
	const rows = Array.from({ length: total }, (_, i) => ({
		id: `d${i}`,
		changedAt: new Date(t0 + (i + 1) * 1000).toISOString(),
	}));
	const calls = [];
	const fetchPage = async (since, limit) => {
		calls.push({ since, limit });
		assert.ok(limit >= 1 && limit <= 500, `limit ${limit} out of range`);
		const from = since ? Date.parse(since) : t0;
		const data = rows.filter((r) => Date.parse(r.changedAt) > from).slice(0, limit);
		const until = data.length ? data[data.length - 1].changedAt : new Date(from).toISOString();
		return { since: new Date(from).toISOString(), until, hasMore: data.length === limit, data };
	};
	return { rows, calls, fetchPage };
}

test('Return All follows «until» while hasMore', async () => {
	const api = fakeEndpoint(1200);
	const out = await collectSincePages(api.fetchPage, null, null);
	assert.equal(out.length, 1200);
	assert.deepEqual(out, api.rows);
	assert.deepEqual(
		api.calls.map((c) => c.limit),
		[500, 500, 500],
	);
	assert.equal(api.calls[0].since, null);
	assert.equal(api.calls[1].since, api.rows[499].changedAt);
});

test('a limit reads only the pages it needs and asks only for what is left', async () => {
	const api = fakeEndpoint(1200);
	const out = await collectSincePages(api.fetchPage, null, 600);
	assert.equal(out.length, 600);
	assert.deepEqual(
		api.calls.map((c) => c.limit),
		[500, 100],
	);
});

test('starts at the given since', async () => {
	const api = fakeEndpoint(10);
	const out = await collectSincePages(api.fetchPage, api.rows[4].changedAt, 50);
	assert.deepEqual(
		out.map((r) => r.id),
		['d5', 'd6', 'd7', 'd8', 'd9'],
	);
});

test('an exact multiple of the page size ends on the empty page', async () => {
	const api = fakeEndpoint(500);
	const out = await collectSincePages(api.fetchPage, null, null);
	assert.equal(out.length, 500);
	assert.equal(api.calls.length, 2);
});

test('stops if «until» does not move forward', async () => {
	let n = 0;
	const out = await collectSincePages(
		async () => ({ until: '2026-11-01T00:00:00.000Z', hasMore: true, data: [{ id: String(n++) }] }),
		'2026-11-01T00:00:00.000Z',
		null,
	);
	assert.equal(out.length, 1);
});

test('compact drops empty values but keeps false and 0', () => {
	assert.deepEqual(compact({ a: '', b: undefined, c: null, d: false, e: 0, f: 'x' }), {
		d: false,
		e: 0,
		f: 'x',
	});
});

test('dateOnly and isoDateTime', () => {
	assert.equal(dateOnly('2026-03-01T00:00:00.000+01:00'), '2026-03-01');
	assert.equal(dateOnly(''), undefined);
	assert.equal(isoDateTime('2026-11-01T10:00:00.000+01:00'), '2026-11-01T09:00:00.000Z');
	assert.equal(isoDateTime(''), undefined);
});

test('decaFirmaErrorOf reads { error: { code, message, details } } and the saved shipment', () => {
	const body = {
		id: 'cmu1',
		error: {
			code: 'unprocessable',
			message: 'The DeCA was not issued: …',
			details: { reason: 'missing_fields', document: 'deca' },
		},
	};
	const e = decaFirmaErrorOf({ response: { data: body } });
	assert.equal(e.code, 'unprocessable');
	assert.equal(e.reason, 'missing_fields');
	assert.equal(e.savedId, 'cmu1');
	assert.equal(
		decaFirmaErrorOf({ cause: { response: { body: JSON.stringify(body) } } }).code,
		'unprocessable',
	);
	const v = decaFirmaErrorOf({
		response: {
			data: Buffer.from(
				JSON.stringify({ error: { code: 'validation_error', message: 'x', details: ['a'] } }),
			),
		},
	});
	assert.deepEqual(v.details, ['a']);
	assert.equal(v.savedId, undefined);
	assert.equal(decaFirmaErrorOf({ response: { data: '<html>' } }), null);
	assert.equal(decaFirmaErrorOf(new Error('socket hang up')), null);
});

test('fileNameFromDisposition and headerSafe', () => {
	assert.equal(
		fileNameFromDisposition('attachment; filename="DECA-2026-0001-v2.pdf"'),
		'DECA-2026-0001-v2.pdf',
	);
	assert.equal(fileNameFromDisposition(undefined), null);
	assert.equal(headerSafe('Maria Perez'), 'Maria Perez');
	assert.equal(headerSafe('María\nPérez'), 'Mar%C3%ADa%20P%C3%A9rez');
});
