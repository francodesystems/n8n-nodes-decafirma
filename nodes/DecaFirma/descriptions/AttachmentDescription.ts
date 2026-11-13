import type { INodeProperties } from 'n8n-workflow';

import { binaryPropertyField, idField, returnAllAndLimit, sinceField } from './common';

export const attachmentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['attachment'] } },
		options: [
			{
				name: 'Download File',
				value: 'download',
				description: 'Download the photo or PDF of the paper, as it was uploaded',
				action: 'Download an attachment',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description:
					'Papers uploaded by drivers (or corrected, or marked invoiced) since a date, oldest first',
				action: 'Get many attachments',
			},
			{
				name: 'Set Invoiced',
				value: 'setInvoiced',
				description: 'Mark the paper as invoiced, or not, so it is not invoiced twice',
				action: 'Set whether an attachment is invoiced',
			},
		],
		default: 'getAll',
	},
];

export const attachmentFields: INodeProperties[] = [
	{
		displayName:
			'Attachments (the papers drivers upload: delivery notes, weighbridge tickets…) are not included in the free plan',
		name: 'attachmentNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['attachment'] } },
	},
	idField(
		'attachment',
		['download', 'setInvoiced'],
		'Attachment ID',
		'attachmentId',
		'The ID of the paper',
	),
	sinceField('attachment', ['getAll'], 'attachments'),
	...returnAllAndLimit('attachment', 'getAll'),
	binaryPropertyField('attachment', ['download']),
	{
		displayName: 'Invoiced',
		name: 'invoiced',
		type: 'boolean',
		default: true,
		description: 'Whether the paper is invoiced',
		displayOptions: { show: { resource: ['attachment'], operation: ['setInvoiced'] } },
	},
];
