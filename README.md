# @propeller-commerce/propeller-v2-punchout

**OCI + cXML PunchOut** for the Propeller eCommerce V2 platform — server-side,
framework-agnostic, and **SDK-free** (pure functions, one small parse
dependency). It turns an inbound procurement handshake into a live storefront
session and converts the shopper's cart back into the ERP's wire format.

Sits on top of **magic-token login** (`propeller-v2-react-ui` ≥ 0.10.0 /
`propeller-v2-vue-ui` ≥ 0.8.0): the buyer "punches out" from their ERP (SAP
Ariba, Coupa, SAP OCI…), shops in a real session, then transfers the cart back
as a requisition.

The host app owns the HTTP layer, the SDK client (contact lookup + magic-token
minting), and the punchout session cookie. This package parses/builds the wire
formats and maps the cart to the ERP's fields through a **configurable mapping**.

---

## Install

```bash
npm install @propeller-commerce/propeller-v2-punchout
```

Node ≥ 18. Ships CJS + ESM + type declarations.

## The two protocols

| | OCI (SAP Open Catalog Interface) | cXML (Ariba / Coupa) |
|---|---|---|
| Inbound handshake | none — the ERP opens a URL with a pre-provisioned token | `PunchOutSetupRequest` XML POST |
| Sign-in | magic-token in the entry URL | magic-token minted during setup |
| Cart return | HTML form of `NEW_ITEM-*[i]` fields → `HOOK_URL` | `PunchOutOrderMessage` XML → `BrowserFormPost` URL |

## Flow

```
cXML  ERP ──POST PunchOutSetupRequest──▶ /api/punchout/cxml/setup
          (validateSharedSecret, resolve buyer, mint 1-time / 1h magic token)
      ◀── PunchOutSetupResponse (StartPage = /api/punchout/enter?…) ──
OCI   ERP ──GET /api/punchout/enter?mode=oci&mtoken=…&HOOK_URL=…&~CALLER=… ──▶

  /api/punchout/enter    → set httpOnly `punchout` cookie → 302 → /magic-login?mtoken=…&redirect=/cart
  buyer shops …
  [Transfer cart]        → POST /api/punchout/transfer → build fields/XML → self-submitting <form> → ERP
```

## API

| Function | Purpose |
|---|---|
| `parseSetupRequest(xml)` | Parse an inbound cXML PunchOutSetupRequest (XXE-safe; tolerates MIME preambles). Returns `{ fromIdentity, toIdentity, senderIdentity, sharedSecret, buyerCookie, browserFormPostUrl, … }`. |
| `validateSharedSecret(req, stored)` | Constant-time secret compare. |
| `buildSetupResponse({ startUrl })` / `buildErrorResponse(code, text)` | The cXML setup reply (StartPage URL wrapped in CDATA — the Ariba/Coupa `&`-escaping trap). |
| `buildOrderCxml(cart, ctx, mapping?)` | The `PunchOutOrderMessage` cart transfer. From/To swapped; `Total = totalGross`, `Tax = totalNet − totalGross` (Propeller's inverted naming). |
| `mapOciParams(query)` | Extract OCI session params (`~CALLER/~OKCODE/~TARGET/CLASSIFICATION/…`) from the entry URL, stripping the `~`. |
| `buildOciFields(cart, ctx, mapping?)` | The ordered `NEW_ITEM-*[i]` field set + SAP header + shipping line. |
| `buildStartUrl(base, params)` | Build the `/api/punchout/enter?…` link. |
| `buildAutoPostForm(action, fields, opts?)` | A self-submitting HTML form (the transfer response). |
| `buildDebugPage({ mode, returnUrl, fields?, xml? })` | A readable preview of the converted cart (OCI table / cXML `<pre>`) instead of auto-posting — for local testing. |
| `normalizeUnit(unit, default?)` | Unit → ERP UOM code (`doos→CS`, `stuk→PCE`, …; default `PCE`). |

Types: `PunchoutCart`, `PunchoutCartLine`, `PunchoutProduct`, `PunchoutContext`,
`SetupRequest`, `Mapping`, `FieldRule`, `TransformName`. The cart shapes are
structurally compatible with the SDK's `Cart` / `CartMainItem` / `Product`
(`ProductCartFields`) — pass an SDK cart straight in.

## Configurable output mappings

The wire field mapping is **data, not hardcoded** — every deployment maps its
ERP's expected fields to different cart/product sources. A `Mapping` is
`outputKey → FieldRule`:

```ts
interface FieldRule {
  source?: string;        // dotted path against { line, product, cart, ctx, session }
                          //   with `a||b` fallbacks, e.g. 'product.sku||product.supplierCode'
  transform?: TransformName; // 'money2dp' | 'normalizeUnit' | 'first8' | 'localized'
                          //   | 'firstImageUrl' | 'int' | 'string'
  static?: string;        // a literal, or a ctx token: 'ctx.currency', 'session.CLASSIFICATION'
  fallback?: string;      // used when the resolved value is empty
  domain?: string;        // cXML Classification `domain` (e.g. 'UNSPSC')
  keySuffix?: string;     // OCI key suffix after the [i] index, e.g. ':132' for LONGTEXT
}
```

Named transforms (not inline functions) keep the map declarative and safe to
expose in an app's config. Override any field by deep-merging a partial over the
exported defaults; set a field to `null` to drop it:

```ts
import { DEFAULT_OCI_MAPPING, mergeMapping, buildOciFields } from '@propeller-commerce/propeller-v2-punchout';

const mapping = mergeMapping(DEFAULT_OCI_MAPPING, {
  'NEW_ITEM-VENDORMAT': { source: 'product.eanCode' }, // re-point a field
  'NEW_ITEM-MANUFACTMAT': null,                          // drop a field
  'NEW_ITEM-CUST_FIELD3': { source: 'taxCode' },         // add one
});
const fields = buildOciFields(cart, ctx, mapping);
```

`DEFAULT_OCI_MAPPING` / `DEFAULT_CXML_MAPPING` match the reference WordPress
plugin's output.

## Context

```ts
const ctx: PunchoutContext = {
  language: 'NL',          // for localized picks (names/descriptions)
  currency: 'EUR',         // ISO code emitted in <Money currency> / OCI CURRENCY
  session: { CLASSIFICATION: '44121600', OKCODE: 'ADDI', CALLER: 'CTLG' },
  // cXML echo (only for cXML transfer):
  buyerCookie: '…', from: 'BUYER', to: 'SUPPLIER', deploymentMode: 'test',
};
```

`from`/`to` are the inbound cXML identities; `buildOrderCxml` swaps them on the
outbound OrderMessage (it echoes back to the sender).

## Using it in an app

The three Propeller boilerplates (`propeller-next`, `propeller-vue`,
`propeller-nuxt`) each wire this package into three thin routes
(`/api/punchout/{cxml/setup, enter, transfer}`) plus a cart-page transfer
button. See each boilerplate's README **PunchOut** section for the exact routes,
env vars, and a local test recipe. The package itself never talks to the SDK —
the host performs the ~2 privileged SDK calls (read the buyer's
`CXML_SHARED_SECRET` contact attribute; mint the magic token with an admin key).

## Security notes

- `parseSetupRequest` disables entity expansion (XXE-safe) and only reads the
  fields it needs.
- `validateSharedSecret` is constant-time.
- Setup mints a **one-time**, **1-hour** magic token, so a leaked StartPage link
  is inert after a single sign-in or an hour.
- The shared secret lives on the backend (a `CXML_SHARED_SECRET` contact track
  attribute), never in this package or the client.

## License

MIT © Propeller Commerce
