# @francodesystems-npm/n8n-nodes-decafirma

[![npm version](https://img.shields.io/npm/v/@francodesystems-npm/n8n-nodes-decafirma.svg)](https://www.npmjs.com/package/@francodesystems-npm/n8n-nodes-decafirma)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> n8n community node for [DecaFirma](https://decafirma.com), the Spanish app for electronic transport documents: the DeCA (documento de control administrativo), delivery notes signed on the driver's phone, delivery routes, eCMR and the papers drivers upload.

This is an [n8n](https://n8n.io) community node that lets you use **DecaFirma** in your n8n workflows: create a shipment from an order in your ERP or e-commerce, issue its DeCA and delivery note, download the signed PDF when the customer signs, and react to every change with a webhook trigger. Built and maintained by [Francodesystems](https://francodesystems.com), the makers of DecaFirma.

[Installation](#installation) · [Operations](#operations) · [Trigger](#trigger) · [Credentials](#credentials) · [Compatibility](#compatibility) · [Usage](#usage) · [Resources](#resources)

## Pricing note

The DecaFirma API is a **paid add-on**, «Conexión con tu programa» (API, Odoo module and webhooks): **250 € a year or 25 € a month plus VAT**, on any paid plan. It is **included during the first month** of a new account. The free plan has no API (`plan_not_allowed`); a paid plan without the add-on answers `addon_required`.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

In your n8n instance: **Settings → Community Nodes → Install**, and enter:

```
@francodesystems-npm/n8n-nodes-decafirma
```

## Operations

Every operation maps to one endpoint of the [DecaFirma REST API](https://decafirma.com/desarrolladores) (`/api/v1`, JSON, in English).

| Resource | Operation | Endpoint |
|---|---|---|
| **Shipment** | Create (and issue the DeCA, the delivery note or both) | `POST /shipments` |
| | Get | `GET /shipments/:id` |
| | Update (new version of its documents, same QR) | `PATCH /shipments/:id` |
| | Issue Document | `POST /shipments/:id/issue` |
| | Change Vehicle | `PATCH /shipments/:id/vehicle` |
| **Document** | Get Many (changed since a date) | `GET /documents` |
| | Download PDF | `GET /documents/:id/pdf` |
| | Void | `POST /documents/:id/void` |
| | Send by Email | `POST /documents/:id/send` |
| **Route** | Create (one DeCA for every stop) | `POST /routes` |
| | Get | `GET /routes/:id` |
| | Add Stops | `POST /routes/:id/stops` |
| | Remove Stop | `DELETE /routes/:id/stops/:shipmentId` |
| | Create Delivery Notes | `POST /routes/:id/delivery-notes` |
| **CMR** (eCMR module) | Create | `POST /cmr` |
| | Get | `GET /cmr/:id` |
| | Get Many | `GET /cmr` |
| | Update | `PATCH /cmr/:id` |
| | Record Not Signed | `POST /cmr/:id/not-signed` |
| | Download PDF | `GET /cmr/:id/pdf` |
| **Attachment** (driver papers) | Get Many | `GET /attachments` |
| | Download File | `GET /attachments/:id/file` |
| | Set Invoiced | `POST /attachments/:id/invoiced` |
| **Series** | Get (delivery note numbering) | `GET /series` |
| **Order Text** | Parse (WhatsApp or email order → fields, creates nothing) | `POST /parse` |

Notes:

- **Idempotent by reference.** Creating a shipment or a route with a `reference` that already exists returns the existing one with `duplicate: true`, so retries never duplicate documents. The same goes for a CMR's `externalReference`.
- **If a document cannot be issued** (a missing field, a wrong tax ID…), the shipment is saved anyway and the node fails with the DecaFirma error code, the `details.reason` and the saved shipment id. Fix it with **Update** and then **Issue Document**. Turn on *Continue On Fail* to handle it in the workflow.
- **Get Many** on documents and attachments follows `since`/`until` pages; store the latest `changedAt` and pass it as **Since** next time to catch up without losing anything.
- Routes and CMRs take their nested bodies (stops, common data, the CMR) as JSON, exactly as documented on the developers page.
- **Download PDF / Download File** put the file in a binary field (default `data`).
- **Acting User** (in *Options*) sends `X-DecaFirma-User`, so the document history shows «María Pérez (desde n8n)».
- Every DecaFirma error keeps its stable `code` (`validation_error`, `unprocessable`, `rate_limited`…) in the error description. The API allows 120 requests per minute per key.

## Trigger

The **DecaFirma Trigger** node starts a workflow on DecaFirma webhooks:

| Event | When |
|---|---|
| `document.issued` | A DeCA or a delivery note was issued |
| `document.updated` | A new version came out (correction, vehicle change, new stop) |
| `document.voided` | A document was voided |
| `delivery_note.signed` | The customer signed the delivery note |
| `service_note.signed` | A service (hourly) delivery note was signed |
| `cmr.signed` | A party of an eCMR signed |
| `attachment.received` | The driver uploaded a paper of the shipment |

Activating the workflow registers the node URL with `POST /api/v1/webhook` and keeps the returned secret; deactivating it removes it with `DELETE /api/v1/webhook` (only if the URL is still the node's). Every delivery is verified against `X-DecaFirma-Signature` (`sha256=` + HMAC-SHA256 of the raw body with the secret, compared in constant time); unsigned or tampered requests get `401`. The output is the webhook body (`type`, `createdAt`, `document`, `routeId`, `shipment`, and `attachment` for papers) plus `event` and `deliveryId` (`X-DecaFirma-Delivery`).

Things to know:

- **A DecaFirma company has one webhook URL.** If it already sends webhooks elsewhere (for example to the Odoo module), the trigger refuses to take it over unless you enable **Replace Existing Webhook**.
- Registering webhooks needs a key created by an **administrator** of the company.
- DecaFirma only calls **public https** URLs, so n8n must be reachable from the internet.
- A failed delivery is not retried. Pair the trigger with a scheduled **Document → Get Many** to catch up.
- The test event (Configuración → Probar) is ignored unless **Include Test Event** is on.

## Credentials

Create an API key in DecaFirma → **Configuración → Conectar tu programa (API)** (administrators). It starts with `dfk_` and is shown once.

| Field | Notes |
|---|---|
| **API Key** | Sent as `Authorization: Bearer dfk_…`. What you issue with it is issued in the name of the person who created it; if that person can no longer issue, the key stops working (`key_owner_forbidden`). |
| **Base URL** | `https://decafirma.com` by default. |

The credential test calls `GET /api/v1/series`, which changes nothing.

## Compatibility

- Requires n8n version **1.0** or later.
- Node.js **20.15+**.
- No runtime dependencies.

## Usage

### Issue the DeCA and the delivery note for every new order

```
Shopify Trigger (order paid)  /  Webhook from your ERP
  → DecaFirma (Shipment / Create, Issue: Both, Reference: order number)
  → Email or WhatsApp the driver the publicUrl and signUrl
```

### Save the signed delivery note in your ERP

```
DecaFirma Trigger (delivery_note.signed)
  → DecaFirma (Document / Download PDF, Document ID: {{$json.document.id}})
  → Google Drive / your ERP (upload the signed PDF)
```

### Nightly catch-up

```
Schedule Trigger (daily)
  → DecaFirma (Document / Get Many, Since: last run)
  → Update the orders in your system
```

## Resources

- [DecaFirma API documentation](https://decafirma.com/desarrolladores)
- [DecaFirma](https://decafirma.com)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## Development

```bash
npm install
npm run build
npm run lint        # n8n-nodes-base rules + the n8n Cloud / verification rules
npm test            # build + unit tests (node --test)
npm run scan        # the static analysis of @n8n/scan-community-package, locally
```

## Releasing (maintainers)

Releases are published to npm by `.github/workflows/publish.yml` with an npm provenance attestation, as n8n requires for verified community nodes. Configure npm Trusted Publishing for `francodesystems/n8n-nodes-decafirma` (workflow `publish.yml`), then run `npm run release`; pushing the version tag triggers the workflow, which runs `npm publish --provenance`.

## License

[MIT](LICENSE)
