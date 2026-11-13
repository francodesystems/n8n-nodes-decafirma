import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { decaFirmaApiRequest } from './GenericFunctions';
import { verifyDecaFirmaSignature } from './signature';

export const DECAFIRMA_WEBHOOK_EVENTS = [
	{
		name: 'Attachment Received',
		value: 'attachment.received',
		description: 'The driver uploaded a paper of the shipment (it arrives in «attachment»)',
	},
	{
		name: 'CMR Signed',
		value: 'cmr.signed',
		description: 'One of the three parties of an eCMR signed (sender, carrier or consignee)',
	},
	{
		name: 'Delivery Note Signed',
		value: 'delivery_note.signed',
		description: 'The customer signed the delivery note; Download PDF now returns the signed one',
	},
	{
		name: 'Document Issued',
		value: 'document.issued',
		description: 'A DeCA or a delivery note was issued',
	},
	{
		name: 'Document Updated',
		value: 'document.updated',
		description: 'A new version came out (a correction, a vehicle change, a new stop)',
	},
	{
		name: 'Document Voided',
		value: 'document.voided',
		description: 'A document was voided',
	},
	{
		name: 'Service Note Signed',
		value: 'service_note.signed',
		description: 'A service delivery note (hourly work) was signed',
	},
];

export class DecaFirmaTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DecaFirma Trigger',
		name: 'decaFirmaTrigger',
		icon: { light: 'file:decafirma.svg', dark: 'file:decafirma.dark.svg' },
		group: ['trigger'],
		version: 1,
		// A trigger is never usable as an AI tool. n8n's type only permits `true`
		// (undefined already means "not a tool"), so we cast to declare it explicitly.
		usableAsTool: false as unknown as undefined,
		subtitle: '={{($parameter["events"] || []).join(", ")}}',
		description:
			'Starts the workflow when a DecaFirma document is issued, changes, is voided or signed, or a driver uploads a paper. Needs the paid «Conexión con tu programa» add-on (included in the first month).',
		defaults: {
			name: 'DecaFirma Trigger',
		},
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'decaFirmaApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'A DecaFirma company has ONE webhook URL. Activating the workflow sets it to this node (POST /api/v1/webhook) and deactivating it removes it. If your company already sends webhooks somewhere else (for example the Odoo module), enable «Replace Existing Webhook» only if you mean to move them here. The API key must belong to an administrator. DecaFirma only calls public https URLs and every delivery is checked against its X-DecaFirma-Signature.',
				name: 'setupNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: DECAFIRMA_WEBHOOK_EVENTS,
				default: ['delivery_note.signed'],
				description:
					'The events that start the workflow. DecaFirma sends every event to the URL; the others are acknowledged and ignored.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Include Test Event',
						name: 'includeTest',
						type: 'boolean',
						default: false,
						description:
							'Whether the test event (Configuración → Probar, or POST /api/v1/webhook/test) also starts the workflow',
					},
					{
						displayName: 'Replace Existing Webhook',
						name: 'replaceExisting',
						type: 'boolean',
						default: false,
						description:
							'Whether to take over the webhook URL when the company already sends its webhooks to another address',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const current = await decaFirmaApiRequest.call(this, 'GET', '/webhook');
				return current.url === webhookUrl && Boolean(webhookData.secret);
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const options = this.getNodeParameter('options', {}) as IDataObject;
				const current = await decaFirmaApiRequest.call(this, 'GET', '/webhook');
				if (
					typeof current.url === 'string' &&
					current.url &&
					current.url !== webhookUrl &&
					options.replaceExisting !== true
				) {
					throw new NodeOperationError(
						this.getNode(),
						'This DecaFirma company already sends its webhooks to another URL',
						{
							description: `Webhooks currently go to ${current.url}. A company has only one webhook URL: enable «Replace Existing Webhook» in the trigger options to move them to n8n.`,
						},
					);
				}
				// Every call returns a new secret: the one that counts is always the last one.
				const body = await decaFirmaApiRequest.call(this, 'POST', '/webhook', { url: webhookUrl });
				if (typeof body.secret !== 'string' || !body.secret) return false;
				webhookData.secret = body.secret;
				webhookData.url = webhookUrl;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl =
					(webhookData.url as string) || (this.getNodeWebhookUrl('default') as string);
				try {
					const current = await decaFirmaApiRequest.call(this, 'GET', '/webhook');
					// Never remove a URL that is not this node's (someone moved the webhooks elsewhere).
					if (current.url === webhookUrl)
						await decaFirmaApiRequest.call(this, 'DELETE', '/webhook');
				} catch (error) {
					this.logger.warn('DecaFirma Trigger: could not remove the webhook in DecaFirma', {
						error: (error as Error).message,
					});
					return false;
				}
				delete webhookData.secret;
				delete webhookData.url;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const webhookData = this.getWorkflowStaticData('node');
		const secret = (webhookData.secret as string) || '';
		const headers = this.getHeaderData() as IDataObject;
		const body = this.getBodyData() as IDataObject;
		const req = this.getRequestObject();
		const res = this.getResponseObject();

		const rawBody = (req as unknown as { rawBody?: Buffer | string }).rawBody;
		const raw = rawBody === undefined ? JSON.stringify(body) : rawBody;

		const check = secret
			? verifyDecaFirmaSignature(
					secret,
					raw,
					headers['x-decafirma-signature'] as string | undefined,
				)
			: ({ valid: false, reason: 'missing' } as const);
		if (!check.valid) {
			res.status(401).json({ error: `Invalid DecaFirma signature (${check.reason})` });
			return { noWebhookResponse: true };
		}

		const type = (headers['x-decafirma-event'] as string) || (body.type as string) || '';
		const events = this.getNodeParameter('events', []) as string[];
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const isTest = type === 'test';
		if ((isTest && options.includeTest !== true) || (!isTest && !events.includes(type))) {
			return { webhookResponse: 'OK' };
		}

		return {
			workflowData: [
				this.helpers.returnJsonArray([
					{
						...body,
						event: type,
						deliveryId: headers['x-decafirma-delivery'] ?? null,
					},
				]),
			],
		};
	}
}
