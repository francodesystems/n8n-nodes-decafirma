import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type Context = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

export interface RequestOptions {
	itemIndex?: number;
	// X-DecaFirma-User: who did it in your program, shown in the document history.
	actingUser?: string;
}

export async function apiBaseUrl(this: Context): Promise<string> {
	const credentials = await this.getCredentials('decaFirmaApi');
	const raw = ((credentials.baseUrl as string) || 'https://decafirma.com').trim();
	return `${raw.replace(/\/+$/, '')}/api/v1`;
}

// A header only carries bytes: DecaFirma reads %-escapes back («Mar%C3%ADa» → «María»).
export function headerSafe(value: string): string {
	const clean = value.replace(/[\r\n\t]+/g, ' ').trim();
	return /^[\x20-\x7e]*$/.test(clean) ? clean : encodeURIComponent(clean);
}

// DecaFirma answers every error as { error: { code, message, details? } },
// with details.reason on a 422 (business rule).
export function decaFirmaErrorOf(
	error: unknown,
): { code: string; message: string; reason?: string; details?: unknown; savedId?: string } | null {
	const e = error as {
		response?: { data?: unknown; body?: unknown };
		cause?: { response?: { data?: unknown; body?: unknown } };
	};
	const candidates = [
		e?.response?.data,
		e?.response?.body,
		e?.cause?.response?.data,
		e?.cause?.response?.body,
	];
	for (const raw of candidates) {
		let data = raw;
		if (Buffer.isBuffer(data)) data = data.toString('utf8');
		if (typeof data === 'string') {
			try {
				data = JSON.parse(data);
			} catch {
				continue;
			}
		}
		const inner = (data as { error?: { code?: unknown; message?: unknown; details?: unknown } })
			?.error;
		if (inner && typeof inner.code === 'string') {
			const details = inner.details as { reason?: unknown } | undefined;
			return {
				code: inner.code,
				message: typeof inner.message === 'string' ? inner.message : inner.code,
				reason: typeof details?.reason === 'string' ? details.reason : undefined,
				details: inner.details,
				// A 422 on create or issue still carries the saved shipment.
				savedId:
					typeof (data as { id?: unknown }).id === 'string'
						? (data as { id: string }).id
						: undefined,
			};
		}
	}
	return null;
}

function detailsText(details: unknown): string {
	if (details === undefined || details === null) return '';
	if (Array.isArray(details))
		return ` Details: ${details.map((d) => (typeof d === 'string' ? d : JSON.stringify(d))).join(' ')}`;
	return ` Details: ${JSON.stringify(details)}`;
}

function toApiError(this: Context, error: unknown, options: RequestOptions): NodeApiError {
	const api = decaFirmaErrorOf(error);
	const extra = options.itemIndex === undefined ? {} : { itemIndex: options.itemIndex };
	if (api) {
		return new NodeApiError(this.getNode(), error as JsonObject, {
			message: api.message,
			description:
				`DecaFirma error code: ${api.code}${api.reason ? ` (reason: ${api.reason})` : ''}.${detailsText(api.details)}` +
				(api.savedId
					? ` The shipment is saved with id ${api.savedId}: fix it and use Shipment → Issue Document.`
					: ''),
			...extra,
		});
	}
	return new NodeApiError(this.getNode(), error as JsonObject, extra);
}

function headersFor(options: RequestOptions): IDataObject {
	const headers: IDataObject = {};
	if (options.actingUser && options.actingUser.trim())
		headers['X-DecaFirma-User'] = headerSafe(options.actingUser);
	return headers;
}

export async function decaFirmaApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	body: IDataObject | undefined = undefined,
	qs: IDataObject = {},
	options: RequestOptions = {},
): Promise<IDataObject> {
	const request: IHttpRequestOptions = {
		method,
		url: `${await apiBaseUrl.call(this)}${path}`,
		qs,
		headers: headersFor(options),
		json: true,
	};
	if (body !== undefined && method !== 'GET' && method !== 'DELETE') request.body = body;
	try {
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'decaFirmaApi',
			request,
		)) as IDataObject | undefined;
		return response ?? {};
	} catch (error) {
		throw toApiError.call(this, error, options);
	}
}

export interface BinaryResponse {
	body: Buffer;
	contentType: string;
	fileName: string | null;
	headers: Record<string, string | undefined>;
}

export function fileNameFromDisposition(header: string | undefined): string | null {
	if (!header) return null;
	const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
	return match ? decodeURIComponent(match[1]) : null;
}

export async function decaFirmaBinaryRequest(
	this: IExecuteFunctions,
	path: string,
	options: RequestOptions = {},
): Promise<BinaryResponse> {
	const request: IHttpRequestOptions = {
		method: 'GET',
		url: `${await apiBaseUrl.call(this)}${path}`,
		headers: headersFor(options),
		encoding: 'arraybuffer',
		json: false,
		returnFullResponse: true,
	};
	try {
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'decaFirmaApi',
			request,
		)) as { body: ArrayBuffer | Buffer; headers: Record<string, string | undefined> };
		const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body);
		return {
			body,
			contentType: response.headers?.['content-type'] ?? 'application/octet-stream',
			fileName: fileNameFromDisposition(response.headers?.['content-disposition']),
			headers: response.headers ?? {},
		};
	} catch (error) {
		throw toApiError.call(this, error, options);
	}
}

// GET /documents and GET /attachments answer { since, until, hasMore, data }:
// the next page starts at the «until» of this one.
export type SincePageFetcher = (since: string | null, limit: number) => Promise<IDataObject>;

export const MAX_PAGE_SIZE = 500;

export async function collectSincePages(
	fetchPage: SincePageFetcher,
	since: string | null,
	limit: number | null,
	maxPages = 1000,
): Promise<IDataObject[]> {
	const out: IDataObject[] = [];
	let cursor = since;
	for (let pages = 0; pages < maxPages; pages++) {
		const remaining = limit === null ? MAX_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, limit - out.length);
		const page = await fetchPage(cursor, remaining);
		const data = Array.isArray(page.data) ? (page.data as IDataObject[]) : [];
		out.push(...data);
		if (limit !== null && out.length >= limit) break;
		const until = typeof page.until === 'string' ? page.until : null;
		// Without more, or if «until» does not move forward, there is nothing else to read.
		if (page.hasMore !== true || !until || until === cursor || data.length === 0) break;
		cursor = until;
	}
	return limit === null ? out : out.slice(0, limit);
}

// Drops empty values from an n8n collection so only what the user set is sent.
export function compact(fields: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value === '' || value === undefined || value === null) continue;
		out[key] = value;
	}
	return out;
}

// n8n dateTime → YYYY-MM-DD.
export function dateOnly(value: unknown): string | undefined {
	if (typeof value !== 'string' || !value) return undefined;
	const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
	return match ? match[1] : value;
}

// n8n dateTime (with or without zone) → ISO 8601 for «since».
export function isoDateTime(value: unknown): string | undefined {
	if (typeof value !== 'string' || !value.trim()) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
