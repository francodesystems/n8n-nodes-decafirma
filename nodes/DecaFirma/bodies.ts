import type { IDataObject } from 'n8n-workflow';

import { dateOnly } from './GenericFunctions';

// Pure builders of the request bodies, kept apart from the node so they can be tested.

export type JsonParser = (value: unknown, field: string) => unknown;

// Strings are parsed; objects from expressions pass as they are. A bad string
// throws JSON.parse's SyntaxError: the node passes its own parser that names the field.
export const parseJsonField: JsonParser = (value) => {
	if (typeof value !== 'string') return value;
	if (!value.trim()) return undefined;
	return JSON.parse(value);
};

const JSON_FIELDS: Record<string, string> = { lines: 'Lines', dangerousGoods: 'Dangerous Goods' };
const BOOLEAN_FIELDS = ['hourly', 'specialAuthorization', 'adrExemption'];
// Node-only fields that never go to the API as they are.
const LOCAL_FIELDS = ['deliveryNotePdfBinary'];

function shipmentFieldsToBody(
	fields: IDataObject,
	mode: 'create' | 'update',
	parse: JsonParser,
): IDataObject {
	const body: IDataObject = {};
	for (const [key, value] of Object.entries(fields)) {
		if (LOCAL_FIELDS.includes(key)) continue;
		if (key in JSON_FIELDS) {
			const parsed = parse(value, JSON_FIELDS[key]);
			if (parsed === undefined) continue;
			// On create an empty list says nothing; on update it clears what there is.
			if (mode === 'create' && Array.isArray(parsed) && parsed.length === 0) continue;
			body[key] = parsed as IDataObject[];
		} else if (BOOLEAN_FIELDS.includes(key)) {
			if (mode === 'create' && value !== true) continue;
			body[key] = value === true;
		} else if (key === 'transportDate') {
			const day = dateOnly(value);
			if (day) body.transportDate = day;
		} else if (
			key === 'specialAuthorizationNumber' ||
			key === 'deliveryNoteNumber' ||
			key === 'seriesId'
		) {
			if (typeof value === 'string' && value.trim()) body[key] = value.trim();
		} else if (value !== '' && value !== undefined && value !== null) {
			body[key] = value;
		}
	}
	return body;
}

// POST /shipments
export function buildShipmentCreateBody(
	issue: string,
	reference: string,
	additional: IDataObject,
	parse: JsonParser = parseJsonField,
): IDataObject {
	const body = shipmentFieldsToBody(additional, 'create', parse);
	if (reference && reference.trim()) body.reference = reference.trim();
	body.issue = issue || 'none';
	return body;
}

// PATCH /shipments/:id: only what changes; null empties a field.
export function buildShipmentUpdateBody(
	updateFields: IDataObject,
	clearFields: string[] = [],
	parse: JsonParser = parseJsonField,
): IDataObject {
	const body = shipmentFieldsToBody(updateFields, 'update', parse);
	for (const key of clearFields) body[key] = null;
	return body;
}

// PATCH /shipments/:id/vehicle
export function buildVehicleBody(fields: IDataObject): IDataObject {
	const body: IDataObject = {};
	if (typeof fields.plate === 'string' && fields.plate.trim()) body.plate = fields.plate.trim();
	if (fields.removeTrailer === true) body.trailerPlate = null;
	else if (typeof fields.trailerPlate === 'string' && fields.trailerPlate.trim()) {
		body.trailerPlate = fields.trailerPlate.trim();
	}
	if (typeof fields.reason === 'string' && fields.reason.trim()) body.reason = fields.reason.trim();
	return body;
}

// POST /routes and POST /routes/:id/stops
export function buildRouteBody(
	stops: unknown,
	options: IDataObject,
	extra: { reference?: string; common?: unknown } = {},
	parse: JsonParser = parseJsonField,
): IDataObject {
	const body: IDataObject = {};
	if (extra.reference && extra.reference.trim()) body.reference = extra.reference.trim();
	if (extra.common !== undefined) {
		const common = parse(extra.common, 'Common Data');
		if (common !== undefined) body.common = common as IDataObject;
	}
	const parsedStops = parse(stops, 'Stops');
	body.stops = (parsedStops ?? []) as IDataObject[];
	if (options.deliveryNotes === true) body.deliveryNotes = true;
	if (typeof options.seriesId === 'string' && options.seriesId.trim())
		body.seriesId = options.seriesId.trim();
	if (typeof options.fromDocumentId === 'string' && options.fromDocumentId.trim()) {
		body.fromDocumentId = options.fromDocumentId.trim();
	}
	return body;
}

// PATCH /cmr/:id: the fields that change plus the mandatory reason.
export function buildCmrUpdateBody(reason: string, fields: IDataObject): IDataObject {
	const body: IDataObject = {};
	for (const [key, value] of Object.entries(fields)) {
		if (typeof value === 'string') body[key] = value.trim() ? value : null;
	}
	body.reason = reason;
	return body;
}
