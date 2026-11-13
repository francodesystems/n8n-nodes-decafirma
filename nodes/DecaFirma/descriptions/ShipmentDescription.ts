import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { idField } from './common';

export const shipmentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['shipment'] } },
		options: [
			{
				name: 'Change Vehicle',
				value: 'changeVehicle',
				description:
					'The truck or trailer changed on the road: the DeCA comes out in a new version with the same QR',
				action: 'Change the vehicle of a shipment',
			},
			{
				name: 'Create',
				value: 'create',
				description:
					'Create a shipment and, if asked, issue its DeCA, its delivery note or both. Idempotent by reference.',
				action: 'Create a shipment',
			},
			{
				name: 'Get',
				value: 'get',
				description:
					'Get a shipment with its documents, links and whether the delivery note is signed',
				action: 'Get a shipment',
			},
			{
				name: 'Issue Document',
				value: 'issue',
				description: 'Issue the DeCA or the delivery note of a shipment created without it',
				action: 'Issue a document for a shipment',
			},
			{
				name: 'Update',
				value: 'update',
				description:
					'Correct the shipment data: its documents come out in a new version with the same QR',
				action: 'Update a shipment',
			},
		],
		default: 'create',
	},
];

const text = (displayName: string, name: string, description?: string): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	default: '',
	...(description ? { description } : {}),
});

const NOTE_KIND_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Delivery', value: 'DELIVERY' },
	{ name: 'Pickup', value: 'PICKUP' },
	{ name: 'Service (Hourly Work)', value: 'SERVICE' },
];

// The text fields of POST /shipments and PATCH /shipments/:id, in the API's own names.
const shipmentTextFields: INodeProperties[] = [
	text('Amount', 'amount', 'Price of the transport, as text (for example 350.00)'),
	text(
		'Base Departure Time',
		'baseDepartureTime',
		'Hourly service: when the vehicle leaves the base, HH:MM (Spanish time)',
	),
	text('Carrier Email', 'carrierEmail'),
	text(
		'Carrier Name',
		'carrierName',
		'Empty carrier name and tax ID means your own company carries it',
	),
	text('Carrier Phone', 'carrierPhone'),
	text('Carrier Tax ID', 'carrierTaxId'),
	text('Client Reference', 'clientRef', 'The order number of your customer'),
	text('Consignee Contact', 'consigneeContact'),
	text('Consignee Contact Phone', 'consigneeContactPhone'),
	text('Consignee Email', 'consigneeEmail'),
	text('Consignee Name', 'consigneeName'),
	text('Consignee Tax ID', 'consigneeTaxId'),
	text('Destination Address', 'destinationAddress'),
	text('Destination City', 'destinationCity'),
	text('Destination Name', 'destinationName', 'Name of the place (warehouse, site…)'),
	text('Destination Phone', 'destinationPhone'),
	text('Destination Postcode', 'destinationPostcode'),
	text('Destination Province', 'destinationProvince'),
	text('Driver Name', 'driverName'),
	text('Driver Phone', 'driverPhone'),
	text('Driver Tax ID', 'driverTaxId'),
	{
		displayName: 'Freight Terms',
		name: 'freightTerms',
		type: 'options',
		options: [
			{ name: 'Collect', value: 'COLLECT' },
			{ name: 'Prepaid', value: 'PREPAID' },
		],
		default: 'PREPAID',
	},
	text('Goods Description', 'goodsDescription'),
	{
		displayName: 'Note Kind',
		name: 'noteKind',
		type: 'options',
		options: NOTE_KIND_OPTIONS,
		default: 'DELIVERY',
		description: 'What the delivery note records',
	},
	text('Notes', 'notes'),
	text('Origin Address', 'originAddress'),
	text('Origin City', 'originCity'),
	text('Origin Contact', 'originContact'),
	text('Origin Name', 'originName', 'Name of the place (warehouse, site…)'),
	text('Origin Phone', 'originPhone'),
	text('Origin Postcode', 'originPostcode'),
	text('Origin Province', 'originProvince'),
	text('Packages', 'packages', 'Number of packages'),
	text('Plate', 'plate', 'Truck plate'),
	text(
		'Reference',
		'reference',
		'Your reference for the shipment. A repeated reference returns the existing shipment instead of creating another.',
	),
	{
		displayName: 'Return Minutes',
		name: 'returnMinutes',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 600 },
		default: 30,
		description: 'Hourly service: minutes from the signature back to the base',
	},
	text(
		'Scale Gross Kg',
		'scaleGrossKg',
		'Weighbridge gross weight in kg (under 100 is read as tonnes)',
	),
	text('Scale In Time', 'scaleInTime', 'Weighbridge entry time, HH:MM'),
	text('Scale Out Time', 'scaleOutTime', 'Weighbridge exit time, HH:MM'),
	text('Scale Tare Kg', 'scaleTareKg', 'Weighbridge tare in kg'),
	text('Scale Ticket', 'scaleTicket', 'Weighbridge ticket number'),
	text('Shipper Address', 'shipperAddress'),
	text('Shipper Name', 'shipperName'),
	text('Shipper Tax ID', 'shipperTaxId'),
	text('Terms', 'terms'),
	text('Trailer Plate', 'trailerPlate'),
	{
		displayName: 'Transport Date',
		name: 'transportDate',
		type: 'dateTime',
		default: '',
		description: 'Day of the transport (only the date is sent)',
	},
	text('Transport Time', 'transportTime', 'HH:MM'),
	text('Vehicle Tonnage', 'vehicleTonnage'),
	text('Weight (Kg)', 'weightKg'),
	text('Worksite', 'worksite', 'Work or site the goods go to (earthworks and aggregates)'),
];

// Fields that are not plain text, shared by create and update.
const shipmentExtraFields: INodeProperties[] = [
	{
		displayName: 'ADR Exemption (1.1.3.6)',
		name: 'adrExemption',
		type: 'boolean',
		default: false,
		description:
			'Whether the dangerous goods travel under the ADR 1.1.3.6 exemption (needs Dangerous Goods)',
	},
	{
		displayName: 'Dangerous Goods (JSON)',
		name: 'dangerousGoods',
		type: 'json',
		default: '[]',
		description:
			'ADR lines as a JSON array, the same as in the eCMR (unNumber, name, class, packingGroup, quantity, unit…). See decafirma.com/desarrolladores.',
	},
	{
		displayName: 'Hourly',
		name: 'hourly',
		type: 'boolean',
		default: false,
		description: 'Whether it is an hourly service, from the base back to the base',
	},
	{
		displayName: 'Lines (JSON)',
		name: 'lines',
		type: 'json',
		default: '[]',
		description:
			'Delivery note lines as a JSON array: [{ "description": "…", "reference": "…", "packages": 2, "weightKg": "120" }]. On update they replace the current lines.',
	},
	{
		displayName: 'Special Authorization',
		name: 'specialAuthorization',
		type: 'boolean',
		default: false,
		description: 'Whether the transport runs under a special authorization (art. 6.e).',
	},
	{
		displayName: 'Special Authorization Number',
		name: 'specialAuthorizationNumber',
		type: 'string',
		default: '',
	},
];

const ISSUE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Both', value: 'both', description: 'The DeCA and the delivery note' },
	{ name: 'DeCA', value: 'deca', description: 'Documento de control administrativo' },
	{
		name: 'Delivery Note',
		value: 'delivery_note',
		description: 'Albarán to be signed on delivery',
	},
	{ name: 'None', value: 'none', description: 'Only save the shipment' },
];

const deliveryNoteNumbering: INodeProperties[] = [
	{
		displayName: 'Delivery Note Number',
		name: 'deliveryNoteNumber',
		type: 'string',
		default: '',
		description: 'Number of the delivery note set by your program (manual numbering)',
	},
	{
		displayName: 'Delivery Note PDF Binary Field',
		name: 'deliveryNotePdfBinary',
		type: 'string',
		default: '',
		description:
			'Name of an input binary field with the delivery note PDF of your own program, to be signed instead of the one DecaFirma makes (5 MB max)',
	},
	{
		displayName: 'Series ID',
		name: 'seriesId',
		type: 'string',
		default: '',
		description:
			'Numbering series of the delivery note (Series → Get). Empty means the default one.',
	},
];

export const shipmentFields: INodeProperties[] = [
	// create
	{
		displayName: 'Issue',
		name: 'issue',
		type: 'options',
		options: ISSUE_OPTIONS,
		default: 'both',
		description:
			'What to issue in the same call. If something is missing the shipment is saved anyway and the error says what to fix; then use Issue Document.',
		displayOptions: { show: { resource: ['shipment'], operation: ['create'] } },
	},
	{
		displayName: 'Reference',
		name: 'reference',
		type: 'string',
		default: '',
		description:
			'Your reference (order number). Retrying with the same reference returns the existing shipment, with duplicate: true, instead of creating another.',
		displayOptions: { show: { resource: ['shipment'], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['shipment'], operation: ['create'] } },
		options: [
			...shipmentTextFields.filter((f) => f.name !== 'reference'),
			...shipmentExtraFields,
			...deliveryNoteNumbering,
		].sort((a, b) => a.displayName.localeCompare(b.displayName)),
	},

	// get, update, issue, change vehicle
	idField(
		'shipment',
		['get', 'update', 'issue', 'changeVehicle'],
		'Shipment ID',
		'shipmentId',
		'The ID DecaFirma gave the shipment (id in the Create output)',
	),

	// update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description:
			'Only the fields you add are changed. A signed delivery note is never rewritten and shared route data is corrected in every stop.',
		displayOptions: { show: { resource: ['shipment'], operation: ['update'] } },
		options: [...shipmentTextFields, ...shipmentExtraFields].sort((a, b) =>
			a.displayName.localeCompare(b.displayName),
		),
	},
	{
		displayName: 'Fields to Clear',
		name: 'clearFields',
		type: 'multiOptions',
		default: [],
		description: 'Text fields to empty in DecaFirma',
		displayOptions: { show: { resource: ['shipment'], operation: ['update'] } },
		options: shipmentTextFields
			.filter((f) => f.type === 'string')
			.map((f) => ({ name: f.displayName, value: f.name })),
	},

	// issue
	{
		displayName: 'Document Type',
		name: 'documentType',
		type: 'options',
		options: [
			{ name: 'DeCA', value: 'deca' },
			{ name: 'Delivery Note', value: 'delivery_note' },
		],
		default: 'deca',
		displayOptions: { show: { resource: ['shipment'], operation: ['issue'] } },
	},
	{
		displayName: 'Options',
		name: 'issueOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: ['shipment'], operation: ['issue'], documentType: ['delivery_note'] },
		},
		options: deliveryNoteNumbering,
	},

	// change vehicle
	{
		displayName: 'Vehicle',
		name: 'vehicleFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description:
			'Send the plate, the trailer plate or both. In a route the vehicle changes for every stop.',
		displayOptions: { show: { resource: ['shipment'], operation: ['changeVehicle'] } },
		options: [
			{
				displayName: 'Plate',
				name: 'plate',
				type: 'string',
				default: '',
				description: 'New truck plate',
			},
			{
				displayName: 'Reason',
				name: 'reason',
				type: 'string',
				default: '',
				description: 'Printed on the new version. Empty means «Cambio de matrícula en ruta».',
			},
			{
				displayName: 'Remove Trailer',
				name: 'removeTrailer',
				type: 'boolean',
				default: false,
				description: 'Whether the shipment goes on without a trailer',
			},
			{
				displayName: 'Trailer Plate',
				name: 'trailerPlate',
				type: 'string',
				default: '',
				description: 'New trailer plate',
			},
		],
	},
];
