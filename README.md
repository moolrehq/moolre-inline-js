# Moolre Inline JavaScript SDK

The **Moolre Inline SDK** provides an easy, secure, and seamless way to collect payments directly on your website or app without redirection.  
It powers the same payment flow as **Moolre Pay**, allowing developers to start and complete transactions in a single embedded popup.

---

## 🚀 Quickstart

### 1️⃣ Add the script directly to your website:

```html
<script src="https://js.moolre.com/v1/inline.js"></script>
```

### 2️⃣ Or install via npm:

```bash
npm install @moolre/inline-js
```

### 3️⃣ Then import and use it:

```js
import MoolrePay from "@moolre/inline-js";

const popup = new MoolrePay();

popup.checkout({{
  publicKey: "MOOLRE_PUBLIC_KEY",
  accountNumber: "MOOLRE_ACCOUNT_NUMBER",
  amount: 50,
  externalRef: "unique_ref_123",
  currency: "GHS",
  onLoad: () => console.log("💡 Checkout loaded"),
  onSuccess: (res) => console.log("✅ Payment success:", res),
  onCancel: () => console.log("❌ Cancelled"),
  onError: (err) => console.error("💥 Error:", err),
}});
```

---

## ⚙️ The MoolrePay Object

### 🔹 setup(options)

Optional. Set global defaults (e.g., public key, account number) so you don’t repeat them in every call.

```js
const popup = new MoolrePay();

popup.setup({{
  publicKey: "MOOLRE_PUBLIC_KEY",
  accountNumber: "MOOLRE_ACCOUNT_NUMBER",
}});
```

Any subsequent calls to `checkout()` or `preloadTransaction()` will use these defaults automatically.

---

### 🔹 checkout(options)

Starts a new asynchronous transaction by calling Moolre’s API to create a payment link, then automatically opens the secure inline payment modal.

```js
const popup = new MoolrePay();

popup.checkout({{
  publicKey: "MOOLRE_PUBLIC_KEY",
  accountNumber: "MOOLRE_ACCOUNT_NUMBER",
  amount: 20,
  externalRef: "MLR_123456",
  currency: "GHS",
  callbackUrl: "https://example.com/callback",
  onLoad: (info) => console.log("Loaded:", info),
  onSuccess: (res) => console.log("Payment completed:", res),
  onCancel: () => console.log("Payment cancelled"),
  onError: (err) => console.error("Error:", err),
}});
```

---

### 🔹 preloadTransaction(options)

Creates a transaction ahead of time (via Moolre API) but does not open the modal immediately.  
Instead, it returns a function that can be called later to open the payment popup instantly.

```js
const popup = new MoolrePay();

const loadPayment = await popup.preloadTransaction({{
  publicKey: "MOOLRE_PUBLIC_KEY",
  accountNumber: "MOOLRE_ACCOUNT_NUMBER",
  amount: 25,
  externalRef: "MY_ORDER_001",
  currency: "GHS",
  onLoad: () => console.log("✅ Payment preloaded"),
  onSuccess: (res) => console.log("Payment completed:", res),
  onCancel: () => console.log("Payment cancelled"),
  onError: (err) => console.error("❌ Error:", err),
}});

// Attach to a button
document.querySelector("#pay-now").onclick = loadPayment;
```

💡 **Tip:** This is great for smoother UX — preload the form while the user reviews their cart or enters details, then open instantly when they’re ready.

---

## 🔹 Supported Options

| Option | Required | Type | Description |
|:--|:--:|:--|:--|
| publicKey | ✅ | string | Your Moolre public API key |
| accountNumber | ✅ | string | Merchant account number |
| amount | ✅ | number | Payment amount (in base currency) |
| currency | ❌ | string | Currency code, e.g. `"GHS"`, `"NGN"` |
| email | ❌ | string | Customer email (optional) |
| metadata | ❌ | object | Extra information for your records |
| callbackUrl | ❌ | string | Where to redirect or send updates after success |
| redirectUrl | ❌ | string | Optional redirect for browser completion |
| mode | ❌ | string | `"payment"` (default) or `"donation"` |
| externalRef | ✅ | string | Custom reference for your transaction |

---

## 🔹 Callback Events

| Callback | Description | Example Parameters |
|:--|:--|:--|
| onLoad | Triggered when iframe is loaded | `{{ message: "Iframe loaded" }}` |
| onSuccess | Called when a transaction completes successfully | `{{ status: "success", reference: "MLR_XXXX" }}` |
| onCancel | When user closes the popup | `undefined` |
| onError | On any error (network or validation) | `{{ message: "Error message" }}` |

---

## 🔹 Example: Full Flow with Preload

```html
<button id="start-payment">Pay Now</button>

<script src="https://js.moolre.com/v1/inline.js"></script>
<script>
  const popup = new MoolrePay();

  async function init() {{
    const openPayment = await popup.preloadTransaction({{
      publicKey: "MOOLRE_PUBLIC_KEY",
      accountNumber: "MOOLRE_ACCOUNT_NUMBER",
      amount: 30,
      externalRef: "COURSE_2025_01",
      onLoad: () => console.log("Payment preloaded"),
      onSuccess: (tx) => console.log("Paid:", tx),
      onCancel: () => console.log("Payment cancelled"),
      onError: (err) => console.error(err),
    }});

    document.querySelector("#start-payment").onclick = openPayment;
  }}

  init();
</script>
```

---

## 🧩 Browser Support

✅ Chrome, Safari, Edge, Firefox  
✅ Android 5.0+ native browser  
🚫 Not supported on Opera Mini or browsers with JavaScript disabled

---

## 🔐 Security

All transactions are encrypted using **TLS 1.2+** and processed securely on Moolre’s servers.  
Your public key and account information are safe and never expose private credentials.

---

## 🧠 Developer Tips

- Use `preloadTransaction()` for fast-loading checkouts in dynamic apps.  
- Use `checkout()` for immediate modal payments.  
- Set global defaults once using `setup()` to avoid repetition.  
- Always handle `onSuccess` and `onError` callbacks gracefully.  

---

🗓️ **Last Updated:** 2025-10-28 23:28 UTC
