import type { INodeProperties } from 'n8n-workflow';

import { binaryPropertyField, idField, sinceField } from './common';

export const cmrOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['cmr'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description:
					'Issue an international consignment note (eCMR) and get the signing link of each party',
				action: 'Create a CMR',
			},
			{
				name: 'Download PDF',
				value: 'downloadPdf',
				description: 'Download the current version of the CMR PDF, with its version and SHA-256',
				action: 'Download the PDF of a CMR',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the CMR: signatures, signing links, versions and hashes',
				action: 'Get a CMR',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'CMRs changed since a date, oldest first',
				action: 'Get many consignment notes',
			},
			{
				name: 'Record Not Signed',
				value: 'notSigned',
				description: 'Record that the sender or the consignee does not sign, with the reason',
				action: 'Record that a CMR party does not sign',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change what can still be changed before delivery, with a reason',
				action: 'Update a CMR',
			},
		],
		default: 'create',
	},
];

const CMR_EXAMPLE = JSON.stringify(
	{
		externalReference: 'SO-2026-0412',
		sender: {
			name: 'Estampaciones Vallès SL',
			taxId: 'B12345678',
			address: 'C/ Industria 4, 08202 Sabadell',
			country: 'ES',
		},
		consignee: {
			name: 'Metalúrgica Lisboa Lda',
			taxId: 'PT509876543',
			address: 'Rua do Porto 12, 1100 Lisboa',
			country: 'PT',
		},
		takingOver: { place: 'Polígono Can Roqueta, Sabadell', country: 'ES' },
		takingOverDate: '2026-10-28',
		delivery: { place: 'Rua do Porto 12, Lisboa', country: 'PT' },
		goods: { nature: 'Piezas de acero', packages: 12, packing: 'Palets', grossWeightKg: 8400 },
		vehicle: { plate: '7031HBS', driverName: 'Daniel Rodríguez' },
		paymentTerms: 'prepaid',
	},
	null,
	2,
);

export const cmrFields: INodeProperties[] = [
	// create
	{
		displayName:
			'The eCMR is a separate paid module of DecaFirma (included in its 7-day trial). A transport inside Spain carries a DeCA, not a CMR.',
		name: 'cmrNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['cmr'], operation: ['create'] } },
	},
	{
		displayName: 'CMR (JSON)',
		name: 'cmr',
		type: 'json',
		required: true,
		default: CMR_EXAMPLE,
		description:
			'The CMR as documented in decafirma.com/desarrolladores#cmr-create: sender, consignee, takingOver, takingOverDate, delivery, goods, vehicle, paymentTerms… A repeated externalReference returns the live CMR with duplicate: true',
		displayOptions: { show: { resource: ['cmr'], operation: ['create'] } },
	},

	idField(
		'cmr',
		['get', 'downloadPdf', 'notSigned', 'update'],
		'CMR ID',
		'cmrId',
		'The ID DecaFirma gave the CMR',
	),

	// get many
	sinceField('cmr', ['getAll'], 'CMRs'),
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['cmr'], operation: ['getAll'] } },
	},

	// download
	binaryPropertyField('cmr', ['downloadPdf']),

	// not signed
	{
		displayName: 'Party',
		name: 'party',
		type: 'options',
		options: [
			{ name: 'Sender', value: 'sender' },
			{ name: 'Consignee', value: 'consignee' },
		],
		default: 'sender',
		displayOptions: { show: { resource: ['cmr'], operation: ['notSigned'] } },
	},
	{
		displayName: 'Reason',
		name: 'reason',
		type: 'string',
		required: true,
		default: '',
		description: 'Why that party does not sign',
		displayOptions: { show: { resource: ['cmr'], operation: ['notSigned'] } },
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'Name of the person who did not sign, if known',
		displayOptions: { show: { resource: ['cmr'], operation: ['notSigned'] } },
	},

	// update
	{
		displayName: 'Reason',
		name: 'reason',
		type: 'string',
		required: true,
		default: '',
		description: 'Why it changes. It stays in the change log with the previous value.',
		displayOptions: { show: { resource: ['cmr'], operation: ['update'] } },
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['cmr'], operation: ['update'] } },
		options: [
			{
				displayName: 'Delivery Place',
				name: 'deliveryPlace',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Documents Attached',
				name: 'documentsAttached',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Sender Instructions',
				name: 'senderInstructions',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Special Agreements',
				name: 'specialAgreements',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Successive Carriers',
				name: 'successiveCarriers',
				type: 'string',
				default: '',
			},
		],
	},
];
