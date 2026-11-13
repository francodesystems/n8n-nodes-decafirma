import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { attachmentFields, attachmentOperations } from './descriptions/AttachmentDescription';
import { cmrFields, cmrOperations } from './descriptions/CmrDescription';
import { documentFields, documentOperations } from './descriptions/DocumentDescription';
import { routeFields, routeOperations } from './descriptions/RouteDescription';
import { shipmentFields, shipmentOperations } from './descriptions/ShipmentDescription';
import {
	buildCmrUpdateBody,
	buildRouteBody,
	buildShipmentCreateBody,
	buildShipmentUpdateBody,
	buildVehicleBody,
	parseJsonField,
} from './bodies';
import {
	collectSincePages,
	compact,
	decaFirmaApiRequest,
	decaFirmaBinaryRequest,
	isoDateTime,
	type RequestOptions,
} from './GenericFunctions';

const enc = encodeURIComponent;

export class DecaFirma implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DecaFirma',
		name: 'decaFirma',
		icon: { light: 'file:decafirma.svg', dark: 'file:decafirma.dark.svg' },
		group: ['transform'],
		version: 1,
		usableAsTool: true,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Spanish electronic transport documents with DecaFirma: shipments, DeCA, signed delivery notes, routes, eCMR and driver papers. Needs the paid «Conexión con tu programa» add-on (included in the first month).',
		defaults: {
			name: 'DecaFirma',
		},
		// eslint-plugin-n8n-nodes-base@1.16.x predates NodeConnectionTypes and only
		// recognizes the 'main' string literal; the enum is the current n8n standard.
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [NodeConnectionTypes.Main],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'decaFirmaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'The DecaFirma API is the paid add-on «Conexión con tu programa» (250 € a year or 25 € a month plus VAT), on any paid plan and included in the first month of a new account. The free plan has no API.',
				name: 'planNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Attachment', value: 'attachment' },
					{ name: 'CMR', value: 'cmr' },
					{ name: 'Document', value: 'document' },
					{ name: 'Order Text', value: 'text' },
					{ name: 'Route', value: 'route' },
					{ name: 'Series', value: 'series' },
					{ name: 'Shipment', value: 'shipment' },
				],
				default: 'shipment',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['series'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						description:
							'Delivery note numbering series and the next number of each (the ID goes in Series ID)',
						action: 'Get the numbering series',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['text'] } },
				options: [
					{
						name: 'Parse',
						value: 'parse',
						description:
							'Read a shipment order from a WhatsApp or email text and get its fields. It never creates anything.',
						action: 'Parse a shipment order text',
					},
				],
				default: 'parse',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 6 },
				required: true,
				default: '',
				description:
					'The order as written (WhatsApp, email…). It counts towards the daily text quota of the account and is not stored.',
				displayOptions: { show: { resource: ['text'], operation: ['parse'] } },
			},
			...shipmentOperations,
			...shipmentFields,
			...documentOperations,
			...documentFields,
			...routeOperations,
			...routeFields,
			...cmrOperations,
			...cmrFields,
			...attachmentOperations,
			...attachmentFields,
			{
				displayName: 'Options',
				name: 'requestOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Acting User',
						name: 'actingUser',
						type: 'string',
						default: '',
						description:
							'Name of the person in your program, shown in the document history as «María Pérez (desde n8n)» (X-DecaFirma-User header)',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const requestOptions = this.getNodeParameter('requestOptions', i, {}) as IDataObject;
				const opts: RequestOptions = {
					itemIndex: i,
					actingUser: (requestOptions.actingUser as string) || undefined,
				};

				const get = (path: string, qs: IDataObject = {}) =>
					decaFirmaApiRequest.call(this, 'GET', path, undefined, qs, opts);
				const post = (path: string, body: IDataObject = {}) =>
					decaFirmaApiRequest.call(this, 'POST', path, body, {}, opts);
				const patch = (path: string, body: IDataObject) =>
					decaFirmaApiRequest.call(this, 'PATCH', path, body, {}, opts);
				const del = (path: string) =>
					decaFirmaApiRequest.call(this, 'DELETE', path, undefined, {}, opts);
				const param = (name: string) => this.getNodeParameter(name, i) as string;
				// JSON fields: a bad string fails naming the field.
				const parse = (value: unknown, label: string): unknown => {
					try {
						return parseJsonField(value, label);
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							`${label} is not valid JSON: ${(error as Error).message}`,
							{ itemIndex: i },
						);
					}
				};
				const json = (name: string, label: string) => parse(this.getNodeParameter(name, i), label);

				const listSince = async (path: string, qs: IDataObject = {}) => {
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
					const limit = returnAll ? null : (this.getNodeParameter('limit', i, 50) as number);
					const since = isoDateTime(this.getNodeParameter('since', i, ''));
					return collectSincePages(
						async (from, pageSize) =>
							get(path, compact({ ...qs, since: from ?? undefined, limit: pageSize })),
						since ?? null,
						limit,
					);
				};

				const pdfBase64 = async (property: unknown): Promise<string | undefined> => {
					if (typeof property !== 'string' || !property.trim()) return undefined;
					this.helpers.assertBinaryData(i, property.trim());
					const buffer = await this.helpers.getBinaryDataBuffer(i, property.trim());
					return buffer.toString('base64');
				};

				const download = async (path: string) => {
					const property = this.getNodeParameter('binaryPropertyName', i) as string;
					const file = await decaFirmaBinaryRequest.call(this, path, opts);
					const binary = await this.helpers.prepareBinaryData(
						file.body,
						file.fileName ?? undefined,
						file.contentType.split(';')[0],
					);
					const meta: IDataObject = { fileName: file.fileName, mimeType: binary.mimeType };
					if (file.headers['x-cmr-version']) meta.version = Number(file.headers['x-cmr-version']);
					if (file.headers['x-cmr-sha256']) meta.sha256 = file.headers['x-cmr-sha256'];
					returnData.push({ json: meta, binary: { [property]: binary }, pairedItem: { item: i } });
				};

				let result: IDataObject | IDataObject[] | undefined;

				if (resource === 'shipment') {
					const id = () => enc(param('shipmentId'));
					if (operation === 'create') {
						const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
						const body = buildShipmentCreateBody(
							param('issue'),
							param('reference'),
							additional,
							parse,
						);
						const pdf = await pdfBase64(additional.deliveryNotePdfBinary);
						if (pdf) body.deliveryNotePdf = pdf;
						result = await post('/shipments', body);
					} else if (operation === 'get') {
						result = await get(`/shipments/${id()}`);
					} else if (operation === 'update') {
						const body = buildShipmentUpdateBody(
							this.getNodeParameter('updateFields', i, {}) as IDataObject,
							this.getNodeParameter('clearFields', i, []) as string[],
							parse,
						);
						if (!Object.keys(body).length) {
							throw new NodeOperationError(
								this.getNode(),
								'Add at least one field to update or clear',
								{
									itemIndex: i,
								},
							);
						}
						result = await patch(`/shipments/${id()}`, body);
					} else if (operation === 'issue') {
						const type = param('documentType');
						const body: IDataObject = { type };
						if (type === 'delivery_note') {
							const issueOptions = this.getNodeParameter('issueOptions', i, {}) as IDataObject;
							if (
								typeof issueOptions.deliveryNoteNumber === 'string' &&
								issueOptions.deliveryNoteNumber.trim()
							) {
								body.deliveryNoteNumber = issueOptions.deliveryNoteNumber.trim();
							}
							if (typeof issueOptions.seriesId === 'string' && issueOptions.seriesId.trim()) {
								body.seriesId = issueOptions.seriesId.trim();
							}
							const pdf = await pdfBase64(issueOptions.deliveryNotePdfBinary);
							if (pdf) body.deliveryNotePdf = pdf;
						}
						result = await post(`/shipments/${id()}/issue`, body);
					} else if (operation === 'changeVehicle') {
						const body = buildVehicleBody(
							this.getNodeParameter('vehicleFields', i, {}) as IDataObject,
						);
						if (!('plate' in body) && !('trailerPlate' in body)) {
							throw new NodeOperationError(
								this.getNode(),
								'Add the new plate, the new trailer plate or both',
								{
									itemIndex: i,
								},
							);
						}
						result = await patch(`/shipments/${id()}/vehicle`, body);
					}
				} else if (resource === 'document') {
					const id = () => enc(param('documentId'));
					if (operation === 'getAll') {
						result = await listSince('/documents', { type: param('type') || undefined });
					} else if (operation === 'downloadPdf') {
						await download(`/documents/${id()}/pdf`);
						continue;
					} else if (operation === 'send') {
						result = await post(`/documents/${id()}/send`, {
							email: param('email').trim(),
							includeRelated: this.getNodeParameter('includeRelated', i, false) as boolean,
						});
					} else if (operation === 'void') {
						result = await post(`/documents/${id()}/void`, { reason: param('reason') });
					}
				} else if (resource === 'route') {
					const id = () => enc(param('routeId'));
					if (operation === 'create') {
						result = await post(
							'/routes',
							buildRouteBody(
								this.getNodeParameter('stops', i),
								this.getNodeParameter('routeOptions', i, {}) as IDataObject,
								{
									reference: param('reference'),
									common: this.getNodeParameter('common', i, ''),
								},
								parse,
							),
						);
					} else if (operation === 'get') {
						result = await get(`/routes/${id()}`);
					} else if (operation === 'addStops') {
						result = await post(
							`/routes/${id()}/stops`,
							buildRouteBody(
								this.getNodeParameter('stops', i),
								this.getNodeParameter('routeOptions', i, {}) as IDataObject,
								{},
								parse,
							),
						);
					} else if (operation === 'removeStop') {
						result = await del(`/routes/${id()}/stops/${enc(param('shipmentId'))}`);
					} else if (operation === 'createDeliveryNotes') {
						const options = this.getNodeParameter('deliveryNoteOptions', i, {}) as IDataObject;
						const body: IDataObject = {};
						const numbers = parse(options.numbers, 'Numbers');
						if (numbers && typeof numbers === 'object' && Object.keys(numbers).length) {
							body.numbers = numbers as IDataObject;
						} else if (typeof options.seriesId === 'string' && options.seriesId.trim()) {
							body.seriesId = options.seriesId.trim();
						}
						result = await post(`/routes/${id()}/delivery-notes`, body);
					}
				} else if (resource === 'cmr') {
					const id = () => enc(param('cmrId'));
					if (operation === 'create') {
						const cmr = json('cmr', 'CMR');
						if (!cmr || typeof cmr !== 'object' || Array.isArray(cmr)) {
							throw new NodeOperationError(this.getNode(), 'CMR must be a JSON object', {
								itemIndex: i,
							});
						}
						result = await post('/cmr', cmr as IDataObject);
					} else if (operation === 'get') {
						result = await get(`/cmr/${id()}`);
					} else if (operation === 'getAll') {
						const since = isoDateTime(this.getNodeParameter('since', i, ''));
						const page = await get(
							'/cmr',
							compact({
								since,
								limit: Math.min(this.getNodeParameter('limit', i, 50) as number, 500),
							}),
						);
						result = (Array.isArray(page.data) ? page.data : []) as IDataObject[];
					} else if (operation === 'downloadPdf') {
						await download(`/cmr/${id()}/pdf`);
						continue;
					} else if (operation === 'notSigned') {
						result = await post(
							`/cmr/${id()}/not-signed`,
							compact({ party: param('party'), reason: param('reason'), name: param('name') }),
						);
					} else if (operation === 'update') {
						const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
						if (!Object.keys(fields).length) {
							throw new NodeOperationError(this.getNode(), 'Add at least one field to update', {
								itemIndex: i,
							});
						}
						result = await patch(`/cmr/${id()}`, buildCmrUpdateBody(param('reason'), fields));
					}
				} else if (resource === 'attachment') {
					const id = () => enc(param('attachmentId'));
					if (operation === 'getAll') {
						result = await listSince('/attachments');
					} else if (operation === 'download') {
						await download(`/attachments/${id()}/file`);
						continue;
					} else if (operation === 'setInvoiced') {
						result = await post(`/attachments/${id()}/invoiced`, {
							invoiced: this.getNodeParameter('invoiced', i, true) as boolean,
						});
					}
				} else if (resource === 'series') {
					result = await get('/series');
				} else if (resource === 'text') {
					result = await post('/parse', { text: param('text') });
				}

				if (result === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						`Unknown operation: ${resource} ${operation}`,
						{
							itemIndex: i,
						},
					);
				}
				for (const row of Array.isArray(result) ? result : [result]) {
					returnData.push({ json: row, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Request errors already are NodeApiError with the DecaFirma code and the item index.
				const failure =
					error instanceof NodeApiError || error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				throw failure;
			}
		}

		return [returnData];
	}
}
