import type { INodeProperties } from 'n8n-workflow';

import { idField } from './common';

export const routeOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['route'] } },
		options: [
			{
				name: 'Add Stops',
				value: 'addStops',
				description:
					'Add stops with the truck on the road: the route DeCA comes out in a new version',
				action: 'Add stops to a route',
			},
			{
				name: 'Create',
				value: 'create',
				description:
					'A delivery route with one DeCA for every stop and, if asked, a delivery note per stop. Idempotent by reference.',
				action: 'Create a route',
			},
			{
				name: 'Create Delivery Notes',
				value: 'createDeliveryNotes',
				description: 'Issue the delivery notes of the stops that do not have one yet',
				action: 'Create the delivery notes of a route',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the route, its DeCA and every stop with its delivery note',
				action: 'Get a route',
			},
			{
				name: 'Remove Stop',
				value: 'removeStop',
				description:
					'The stop no longer goes on that truck. A signed delivery note cannot be removed.',
				action: 'Remove a stop from a route',
			},
		],
		default: 'create',
	},
];

const STOPS_EXAMPLE = JSON.stringify(
	[
		{
			type: 'delivery',
			location: { name: 'Almacenes Pérez', city: 'Riba-roja de Túria' },
			consigneeName: 'Almacenes Pérez, S.A.',
			goodsDescription: 'Palés de azulejo',
			packages: 4,
			weightKg: 3000,
		},
	],
	null,
	2,
);

const COMMON_EXAMPLE = JSON.stringify(
	{
		shipperName: 'Cerámicas Levante, S.L.',
		shipperTaxId: 'B98765431',
		shipperAddress: 'Camí Collet 14, 12200 Onda',
		transportDate: '2026-10-05',
		plate: '1234KLM',
		driverName: 'Paco Martínez',
		base: { name: 'Nave Onda', city: 'Onda' },
	},
	null,
	2,
);

const stopsField = (operations: string[]): INodeProperties => ({
	displayName: 'Stops (JSON)',
	name: 'stops',
	type: 'json',
	required: true,
	default: STOPS_EXAMPLE,
	description:
		'Array of stops (at most 50): type (delivery or pickup), location { name, address, postcode, city, province }, consigneeName, consigneeTaxId, contact, phone, email, goodsDescription, packages, weightKg, clientRef, deliveryNoteNumber',
	displayOptions: { show: { resource: ['route'], operation: operations } },
});

const deliveryNoteOptions: INodeProperties[] = [
	{
		displayName: 'Delivery Notes',
		name: 'deliveryNotes',
		type: 'boolean',
		default: false,
		description: 'Whether to issue a delivery note for each stop as well',
	},
	{
		displayName: 'Series ID',
		name: 'seriesId',
		type: 'string',
		default: '',
		description:
			'Numbering series of the delivery notes (Series → Get). Empty means the default one.',
	},
];

export const routeFields: INodeProperties[] = [
	// create
	{
		displayName: 'Reference',
		name: 'reference',
		type: 'string',
		default: '',
		description:
			'Your reference for the route. The same reference returns the existing route, with duplicate: true, instead of creating another.',
		displayOptions: { show: { resource: ['route'], operation: ['create'] } },
	},
	{
		displayName: 'Common Data (JSON)',
		name: 'common',
		type: 'json',
		default: COMMON_EXAMPLE,
		description:
			'What all the stops share: shipper, carrier, transportDate (YYYY-MM-DD), transportTime, plate, trailerPlate, driver, notes, base { name, address, postcode, city, province }, dangerousGoods, adrExemption. Without a carrier, your company carries it.',
		displayOptions: { show: { resource: ['route'], operation: ['create'] } },
	},
	stopsField(['create', 'addStops']),
	{
		displayName: 'Options',
		name: 'routeOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['route'], operation: ['create'] } },
		options: [
			...deliveryNoteOptions,
			{
				displayName: 'From Document ID',
				name: 'fromDocumentId',
				type: 'string',
				default: '',
				description:
					'Turn this single DeCA into stop 1 of the new route (new version of the same DeCA, same QR)',
			},
		],
	},

	idField(
		'route',
		['get', 'addStops', 'removeStop', 'createDeliveryNotes'],
		'Route ID',
		'routeId',
		'The ID DecaFirma gave the route',
	),
	{
		displayName: 'Options',
		name: 'routeOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['route'], operation: ['addStops'] } },
		options: deliveryNoteOptions,
	},

	// remove stop
	idField(
		'route',
		['removeStop'],
		'Shipment ID',
		'shipmentId',
		'The shipment of the stop to remove',
	),

	// delivery notes
	{
		displayName: 'Options',
		name: 'deliveryNoteOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['route'], operation: ['createDeliveryNotes'] } },
		options: [
			{
				displayName: 'Numbers (JSON)',
				name: 'numbers',
				type: 'json',
				default: '{}',
				description:
					'Manual number per stop: { "shipmentId": "05400" } (the key is the ID of the stop shipment). With numbers, the series is not used.',
			},
			{
				displayName: 'Series ID',
				name: 'seriesId',
				type: 'string',
				default: '',
				description: 'Numbering series of the delivery notes. Empty means the default one.',
			},
		],
	},
];
