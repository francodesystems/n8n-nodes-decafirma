import type { INodeProperties } from 'n8n-workflow';

export function returnAllAndLimit(resource: string, operation: string): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show: { resource: [resource], operation: [operation] } },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: {
				minValue: 1,
			},
			default: 50,
			description: 'Max number of results to return',
			displayOptions: {
				show: { resource: [resource], operation: [operation], returnAll: [false] },
			},
		},
	];
}

export function idField(
	resource: string,
	operations: string[],
	displayName: string,
	name: string,
	description: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		required: true,
		default: '',
		description,
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}

export function sinceField(resource: string, operations: string[], what: string): INodeProperties {
	return {
		displayName: 'Since',
		name: 'since',
		type: 'dateTime',
		default: '',
		description: `Only ${what} changed after this moment. Empty means the last 7 days. To catch up without losing anything, store the latest changedAt and pass it next time.`,
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}

export function binaryPropertyField(
	resource: string,
	operations: string[],
	description = 'Name of the binary property to write the file to',
): INodeProperties {
	return {
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the output binary field to put the file in',
		description,
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}
