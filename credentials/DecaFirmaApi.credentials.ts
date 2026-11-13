import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DecaFirmaApi implements ICredentialType {
	name = 'decaFirmaApi';

	displayName = 'DecaFirma API';

	icon = { light: 'file:decafirma.svg', dark: 'file:decafirma.dark.svg' } as const;

	// eslint-disable-next-line n8n-nodes-base/cred-class-field-documentation-url-miscased
	documentationUrl = 'https://decafirma.com/desarrolladores';

	properties: INodeProperties[] = [
		{
			displayName:
				'The DecaFirma API is a paid add-on, «Conexión con tu programa» (API, Odoo module and webhooks): 250 € a year or 25 € a month plus VAT, on any paid plan. It is included during the first month of a new account. The free plan has no API.',
			name: 'planNotice',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'dfk_...',
			description:
				'An API key starting with dfk_. An administrator creates it in DecaFirma → Configuración → Conectar tu programa (API). What you issue with it is issued in the name of the person who created it.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://decafirma.com',
			description: 'Only change it to point the node at another DecaFirma installation',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				'X-DecaFirma-Client': 'n8n',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}/api/v1',
			url: '/series',
			method: 'GET',
		},
	};
}
