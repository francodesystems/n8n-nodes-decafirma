import type { INodeProperties } from 'n8n-workflow';

import { binaryPropertyField, idField, returnAllAndLimit, sinceField } from './common';

export const documentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['document'] } },
		options: [
			{
				name: 'Download PDF',
				value: 'downloadPdf',
				description:
					'Download the latest version of the PDF, with its QR (signed, once it is signed)',
				action: 'Download the PDF of a document',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description:
					'Documents issued, in a new version, voided or signed since a date, oldest first',
				action: 'Get many documents',
			},
			{
				name: 'Send by Email',
				value: 'send',
				description:
					'Email the driver the QR link and, for an unsigned delivery note, the signing link',
				action: 'Send a document by email',
			},
			{
				name: 'Void',
				value: 'void',
				description: 'Void a document: nothing is deleted, a new version says it is void and why',
				action: 'Void a document',
			},
		],
		default: 'getAll',
	},
];

export const documentFields: INodeProperties[] = [
	idField(
		'document',
		['downloadPdf', 'send', 'void'],
		'Document ID',
		'documentId',
		'The ID of the DeCA, delivery note or ADR document (documents[].id in a shipment)',
	),

	// get many
	sinceField('document', ['getAll'], 'documents'),
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		options: [
			{ name: 'All', value: '' },
			{ name: 'DeCA', value: 'deca' },
			{ name: 'Delivery Note', value: 'delivery_note' },
		],
		default: '',
		displayOptions: { show: { resource: ['document'], operation: ['getAll'] } },
	},
	...returnAllAndLimit('document', 'getAll'),

	// download
	binaryPropertyField('document', ['downloadPdf']),

	// send
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		description: 'Who receives it, usually the driver',
		displayOptions: { show: { resource: ['document'], operation: ['send'] } },
	},
	{
		displayName: 'Include Related Document',
		name: 'includeRelated',
		type: 'boolean',
		default: false,
		description:
			'Whether to add the other document of the same shipment (the DeCA with the delivery note, or the other way round) to the same email',
		displayOptions: { show: { resource: ['document'], operation: ['send'] } },
	},

	// void
	{
		displayName: 'Reason',
		name: 'reason',
		type: 'string',
		required: true,
		default: '',
		description: 'Why it is voided (printed on the voided version, up to 300 characters)',
		displayOptions: { show: { resource: ['document'], operation: ['void'] } },
	},
];
