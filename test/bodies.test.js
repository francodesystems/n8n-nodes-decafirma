const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
	buildShipmentCreateBody,
	buildShipmentUpdateBody,
	buildVehicleBody,
	buildRouteBody,
	buildCmrUpdateBody,
} = require('../dist/nodes/DecaFirma/bodies');

// The fields POST /shipments accepts (CAMPOS_API + OTROS_CAMPOS in src/lib/api/cuerpo.ts):
// anything else is a validation_error, so the node must never send other keys.
const ACCEPTED = new Set([
	'reference',
	'clientRef',
	'shipperName',
	'shipperTaxId',
	'shipperAddress',
	'carrierName',
	'carrierTaxId',
	'carrierPhone',
	'carrierEmail',
	'consigneeName',
	'consigneeTaxId',
	'consigneeContact',
	'consigneeContactPhone',
	'consigneeEmail',
	'originName',
	'originAddress',
	'originPostcode',
	'originCity',
	'originProvince',
	'originPhone',
	'originContact',
	'destinationName',
	'destinationAddress',
	'destinationPostcode',
	'destinationCity',
	'destinationProvince',
	'destinationPhone',
	'goodsDescription',
	'weightKg',
	'packages',
	'transportDate',
	'transportTime',
	'plate',
	'trailerPlate',
	'vehicleTonnage',
	'driverName',
	'driverTaxId',
	'driverPhone',
	'noteKind',
	'freightTerms',
	'amount',
	'terms',
	'notes',
	'scaleGrossKg',
	'scaleTareKg',
	'scaleInTime',
	'scaleOutTime',
	'scaleTicket',
	'worksite',
	'baseDepartureTime',
	'returnMinutes',
	'issue',
	'lines',
	'deliveryNoteNumber',
	'seriesId',
	'specialAuthorization',
	'specialAuthorizationNumber',
	'deliveryNotePdf',
	'dangerousGoods',
	'adrExemption',
	'hourly',
]);

test('every create and update field the node offers is accepted by the API', () => {
	const { shipmentFields } = require('../dist/nodes/DecaFirma/descriptions/ShipmentDescription');
	const local = new Set(['deliveryNotePdfBinary']);
	for (const name of ['additionalFields', 'updateFields']) {
		const collection = shipmentFields.find((f) => f.name === name);
		for (const option of collection.options) {
			if (local.has(option.name)) continue;
			assert.ok(ACCEPTED.has(option.name), `${name}.${option.name} is not an API field`);
		}
	}
});

test('create: reference, issue, date only, JSON lines, booleans only when true, no node-only keys', () => {
	const body = buildShipmentCreateBody('both', ' PED-1 ', {
		shipperName: 'Cerámicas Levante, S.L.',
		transportDate: '2026-11-14T00:00:00.000+01:00',
		lines: '[{"description":"Palés","packages":2}]',
		dangerousGoods: '[]',
		hourly: false,
		specialAuthorization: true,
		specialAuthorizationNumber: ' A-1 ',
		returnMinutes: 30,
		deliveryNotePdfBinary: 'data',
		seriesId: '',
		notes: '',
	});
	assert.deepEqual(body, {
		shipperName: 'Cerámicas Levante, S.L.',
		transportDate: '2026-11-14',
		lines: [{ description: 'Palés', packages: 2 }],
		specialAuthorization: true,
		specialAuthorizationNumber: 'A-1',
		returnMinutes: 30,
		reference: 'PED-1',
		issue: 'both',
	});
	for (const key of Object.keys(body)) assert.ok(ACCEPTED.has(key), key);
});

test('create without reference and issue none', () => {
	assert.deepEqual(buildShipmentCreateBody('', '', {}), { issue: 'none' });
});

test('update: only what changes, false booleans and empty lists are sent, cleared fields go as null', () => {
	assert.deepEqual(
		buildShipmentUpdateBody({ plate: '1234KLM', hourly: false, lines: [] }, [
			'notes',
			'driverPhone',
		]),
		{
			plate: '1234KLM',
			hourly: false,
			lines: [],
			notes: null,
			driverPhone: null,
		},
	);
});

test('invalid JSON goes through the parser with the field name', () => {
	assert.throws(() => buildShipmentCreateBody('none', '', { lines: '[{' }), SyntaxError);
	const named = (value, field) => {
		try {
			return JSON.parse(value);
		} catch {
			throw new Error(`${field} is not valid JSON`);
		}
	};
	assert.throws(
		() => buildShipmentCreateBody('none', '', { lines: '[{' }, named),
		/Lines is not valid JSON/,
	);
	assert.throws(() => buildRouteBody('[', {}, {}, named), /Stops is not valid JSON/);
});

test('vehicle body', () => {
	assert.deepEqual(buildVehicleBody({ plate: ' 1234KLM ', reason: '' }), { plate: '1234KLM' });
	assert.deepEqual(
		buildVehicleBody({ trailerPlate: 'R1234BCD', removeTrailer: true, reason: 'Avería' }),
		{
			trailerPlate: null,
			reason: 'Avería',
		},
	);
	assert.deepEqual(buildVehicleBody({}), {});
});

test('route body', () => {
	assert.deepEqual(
		buildRouteBody(
			'[{"location":{"city":"Onda"}}]',
			{ deliveryNotes: true, seriesId: ' s1 ', fromDocumentId: '' },
			{
				reference: 'R-1',
				common: '{"plate":"1234KLM"}',
			},
		),
		{
			reference: 'R-1',
			common: { plate: '1234KLM' },
			stops: [{ location: { city: 'Onda' } }],
			deliveryNotes: true,
			seriesId: 's1',
		},
	);
	assert.deepEqual(buildRouteBody([{ location: { name: 'X' } }], {}), {
		stops: [{ location: { name: 'X' } }],
	});
});

test('cmr update body carries the reason and null for emptied fields', () => {
	assert.deepEqual(
		buildCmrUpdateBody('Cambio del cliente', { deliveryPlace: 'Rua 1', specialAgreements: '' }),
		{
			deliveryPlace: 'Rua 1',
			specialAgreements: null,
			reason: 'Cambio del cliente',
		},
	);
});
