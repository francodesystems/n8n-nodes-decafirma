import { createHmac, timingSafeEqual } from 'crypto';

export type SignatureCheck =
	{ valid: true } | { valid: false; reason: 'missing' | 'malformed' | 'mismatch' };

// X-DecaFirma-Signature: sha256=<hex HMAC-SHA256(secret, raw body)>, the same
// as DecaFirma signs it (firmarCuerpo in its webhooks module). The raw body are
// the bytes as they arrived, before parsing the JSON.
export function verifyDecaFirmaSignature(
	secret: string,
	rawBody: string | Buffer,
	header: string | undefined,
): SignatureCheck {
	if (!header || !header.trim()) return { valid: false, reason: 'missing' };
	const match = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
	if (!match) return { valid: false, reason: 'malformed' };
	const expected = createHmac('sha256', secret).update(rawBody).digest();
	const given = Buffer.from(match[1], 'hex');
	return given.length === expected.length && timingSafeEqual(given, expected)
		? { valid: true }
		: { valid: false, reason: 'mismatch' };
}
