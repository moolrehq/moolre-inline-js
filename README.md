# Moolre Inline JavaScript SDK

Use the Moolre Inline SDK to create a payment link and show the Moolre checkout in a modal.

## Install

```bash
npm install @moolre/moolrejs
```

## Quick start

```js
import MoolrePay from "@moolre/moolrejs";

const popup = new MoolrePay();

await popup.checkout({
  username: "MOOLRE_USERNAME",
  publicKey: "MOOLRE_PUBLIC_KEY",
  accountNumber: "MOOLRE_ACCOUNT_NUMBER",
  amount: 50,
  email: "customer@example.com",
  externalRef: `order_${Date.now()}`,
  currency: "GHS",
  onSuccess: (transaction) => console.log("Payment completed", transaction),
  onCancel: () => console.log("Payment cancelled"),
  onError: (error) => console.error("Payment error", error),
});
```

## Set defaults

Set merchant details once if you create more than one checkout.

```js
import MoolrePay from "@moolre/moolrejs";

const popup = new MoolrePay({
  username: "MOOLRE_USERNAME",
  publicKey: "MOOLRE_PUBLIC_KEY",
  accountNumber: "MOOLRE_ACCOUNT_NUMBER",
});

await popup.checkout({
  amount: 50,
  email: "customer@example.com",
  externalRef: "order_123",
});
```

You can also use `popup.setup({ ... })`. Values passed to `checkout()` or `preloadTransaction()` override the defaults.

## Preload checkout

```js
const openPayment = await popup.preloadTransaction({
  amount: 50,
  email: "customer@example.com",
  externalRef: "order_123",
});

document.querySelector("#pay-now").addEventListener("click", openPayment);
```

## Options

| Option | Required when creating a link | Description |
| --- | --- | --- |
| `username` | Yes | Your Moolre username. Sent as `X-API-USER`. |
| `publicKey` | Yes | Your Moolre public API key. |
| `accountNumber` | Yes | Merchant account number. |
| `amount` | Yes | Payment amount. |
| `email` | Yes | Customer email address. |
| `externalRef` | Yes | Unique transaction reference. |
| `currency` | No | Currency code. Defaults to `GHS`. |
| `metadata` | No | Extra payment metadata. |
| `callbackUrl` | No | Callback URL for payment updates. |
| `redirectUrl` | No | URL to redirect to after completion. |
| `mode` | No | Payment mode. Defaults to `payment`. |
| `reusable` | No | Whether the generated link can be reused. |
| `iframeHeight` | No | Checkout modal height. Defaults to `630px`. |
| `allowedOrigins` | No | Origins allowed to send checkout events. Defaults to Moolre subdomains. |
| `paymentUrl` | No | Existing payment URL. When supplied, the SDK does not call the link API and API credentials are not required. |

## Events

| Callback | When it runs |
| --- | --- |
| `onLoad` | The checkout iframe has loaded. |
| `onSuccess` | Payment succeeds. |
| `onError` | Validation, network, or payment errors occur. |
| `onCancel` | The customer closes or cancels the checkout. |
| `onClose` | The modal is manually closed. |

## Browser and API requirements

This package is intended for browser applications bundled with a tool such as Vite, Webpack, or Rollup. The minified browser asset is included at `public/v1/moolre.js`; copy it to your own static assets if you need to load it with a script tag.

The Moolre API must allow browser preflight requests to `POST /embed/link`, including these request headers:

```http
Access-Control-Allow-Headers: Content-Type, X-API-USER, X-Api-Pubkey
```

`username` and `publicKey` are client-side identifiers. Never include a Moolre private key in browser code.

## License

MIT. See [LICENSE](LICENSE).
