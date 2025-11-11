/**
 * MoolrePay Inline SDK v1
 * - checkout(options): async - create payment link and open modal
 * - preloadTransaction(options): async - create payment link, preload hidden iframe, returns function to open modal
 *
 * Callbacks supported:
 *  - onLoad(response)
 *  - onSuccess(transaction)
 *  - onError(error)
 *  - onCancel()
 *  - onClose()
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MoolrePay = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  class MoolrePay {
    constructor(defaults = {}) {
      this.defaults = {
        apiBase: "https://api.moolre.com/embed",
        checkoutBase: "https://pos.moolre.com",
        publicKey: null,
        accountNumber: null,
        iframeHeight: "630px",
        ...defaults,
      };

      this.overlay = null;
      this.iframe = null;
      this._listener = null;
      this._preloaded = null;
      this._styleElem = null;
      this._installGlobalStyles();
    }

    /**
     * Optional: set defaults so callers don't have to pass publicKey/accountNumber everywhere
     */
    setup(opts = {}) {
      Object.assign(this.defaults, opts);
      return this.defaults;
    }

    /** ============================
     *  PUBLIC API
     *  ============================
     */

    /**
     * checkout(options): async
     * Creates payment link via API (unless options.paymentUrl provided), opens modal.
     * options must contain either options.paymentUrl OR { publicKey, accountNumber, amount, email } (email required for async)
     */
    async checkout(options = {}) {
      const opts = this._mergeOptions(options);
      try {
        this._validateForCheckout(opts);

        const url = await this._resolvePaymentUrl(opts);
        // Open modal with loading spinner
        this._createModal(url, opts);
        return; // resolves undefined on success (callbacks handle lifecycle)
      } catch (err) {
        // route to onError if available
        if (opts.onError) {
          try {
            opts.onError(err);
          } catch (e) {
            console.error("Error in onError handler:", e);
          }
        } else {
          console.error("MoolrePay.checkout error:", err);
        }
        throw err;
      }
    }

    /**
     * preloadTransaction(options): async
     * Creates payment link via API (unless options.paymentUrl provided), preloads hidden iframe,
     * returns a function that opens the modal instantly when called.
     *
     * Usage:
     *   const open = await popup.preloadTransaction(opts);
     *   // later
     *   open();
     */
    async preloadTransaction(options = {}) {
      const opts = this._mergeOptions(options);
      try {
        this._validateForPreload(opts);

        const url = await this._resolvePaymentUrl(opts);

        // If a previous preload exists, remove it
        if (this._preloaded && this._preloaded.iframe) {
          try { this._preloaded.iframe.remove(); } catch (e) {}
          this._preloaded = null;
        }

        // Create hidden iframe to preload content and cache resources
        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.style.cssText = `
          display: none;
          width: 0;
          height: 0;
          border: 0;
          visibility: hidden;
          position: absolute;
          left: -9999px;
        `;
        iframe.setAttribute("aria-hidden", "true");
        iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin allow-popups");
        document.body.appendChild(iframe);

        // wire onload to call options.onLoad when preloaded
        const preloadedPromise = new Promise((resolve, reject) => {
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              const err = new Error("Iframe preload timed out");
              if (opts.onError) opts.onError(err);
              reject(err);
            }
          }, 15000); // 15s preload timeout

          iframe.onload = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { opts.onLoad?.({ message: "Iframe preloaded", url }); } catch (e) { console.error(e); }
            resolve();
          };

          iframe.onerror = (ev) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const err = new Error("Iframe preload failed");
            try { opts.onError?.(err); } catch (e) { console.error(e); }
            reject(err);
          };
        });

        // store preloaded
        this._preloaded = { url, iframe, opts };

        // Wait for preload to finish so user gets the open function only after preload ready
        await preloadedPromise;

        // Return a callable that opens the modal instantly using the preloaded iframe
        const openFn = () => {
          // If preloaded iframe still exists, reuse it: remove hidden iframe and open modal with same url
          if (this._preloaded && this._preloaded.url === url) {
            // remove the preloaded iframe node (it was only for caching), we will create visible iframe in modal
            try {
              if (this._preloaded.iframe && this._preloaded.iframe.parentNode) {
                this._preloaded.iframe.parentNode.removeChild(this._preloaded.iframe);
              }
            } catch (e) {}
            const optsCopy = this._preloaded.opts;
            this._preloaded = null;
            this._createModal(url, optsCopy);
          } else {
            // fallback: open normally
            this._createModal(url, opts);
          }
        };

        return openFn;
      } catch (err) {
        if (opts.onError) {
          try { opts.onError(err); } catch (e) { console.error("Error in onError handler:", e); }
        } else {
          console.error("MoolrePay.preloadTransaction error:", err);
        }
        throw err;
      }
    }

    /** ============================
     *  INTERNAL HELPERS
     *  ============================
     */

    _mergeOptions(options) {
      // prefer per-call keys, fall back to defaults from setup()
      return Object.assign({}, {
        publicKey: this.defaults.publicKey,
        accountNumber: this.defaults.accountNumber,
        apiBase: this.defaults.apiBase,
        checkoutBase: this.defaults.checkoutBase,
        iframeHeight: this.defaults.iframeHeight,
      }, options);
    }

    _validateForCheckout(opts) {
      if (!opts.paymentUrl && !opts.publicKey) throw new Error("publicKey is required for checkout");
      if (!opts.paymentUrl && !opts.accountNumber) throw new Error("accountNumber is required for checkout");
      if (!opts.paymentUrl && !opts.externalRef) throw new Error("External reference is required for checkout");
      if (!opts.amount && opts.amount !== 0) throw new Error("amount is required");
    }

    _validateForPreload(opts) {
      // same validation as checkout (we need enough to create a link)
      if (!opts.paymentUrl && !opts.publicKey) throw new Error("publicKey is required for preloadTransaction");
      if (!opts.paymentUrl && !opts.accountNumber) throw new Error("accountNumber is required for preloadTransaction");
      if (!opts.paymentUrl && !opts.externalRef) throw new Error("External reference is required for preloadTransaction");
      if (!opts.amount && opts.amount !== 0) throw new Error("amount is required");
    }

    /**
     * Resolves payment URL:
     * - if options.paymentUrl provided -> returns it
     * - else POST to `${opts.apiBase}/link` with required payload and X-Api-Pubkey header -> returns data.data.authorization_url
     */
    async _resolvePaymentUrl(opts) {
      if (opts.paymentUrl) return opts.paymentUrl;

      const payload = {
        type: 1,
        accountnumber: opts.accountNumber,
        amount: opts.amount,
        currency: opts.currency || "GHS",
        email: opts.email,
        description: opts.description || "",
        metadata: opts.metadata || {},
        redirect: opts.redirectUrl,
        callback: opts.callbackUrl,
        externalref: opts.externalRef,
        mode: opts.mode || "payment",
        reusable: opts.reusable || false,
      };

      const res = await fetch(`${opts.apiBase}/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Pubkey": opts.publicKey,
        },
        body: JSON.stringify(payload),
      });

      // if not ok, throw an Error with server body
      if (!res.ok) {
        const text = await res.text();
        let err;
        try {
          const parsed = JSON.parse(text);
          err = new Error(parsed.message || JSON.stringify(parsed));
        } catch (e) {
          err = new Error(text || "Payment initiation failed");
        }
        throw err;
      }

      const json = await res.json();
      const url = json?.data?.authorization_url || json?.data?.paymentUrl || json?.authorization_url || json?.paymentUrl;
      if (!url) {
        throw new Error("Missing authorization_url in API response");
      }
      return url;
    }

    /**
     * Main modal creation method with loading spinner
     */
    _createModal(url, handlers = {}) {
      this._closeModal();

      // Create overlay
      const overlay = document.createElement("div");
      overlay.className = "moolre-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.65);
        backdrop-filter: blur(4px);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        -webkit-overflow-scrolling: touch;
        animation: moolre_fade_in 220ms ease;
      `;

      // Modal container
      const modal = document.createElement("div");
      modal.classList.add("moolre-modal");
      modal.style.cssText = `
        position: relative;
        width: 90%;
        max-width: 380px;
        height: ${handlers.iframeHeight || this.defaults.iframeHeight};
        max-height: 92vh;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 20px 48px rgba(0,0,0,0.45);
        background: #fff;
        display: flex;
        flex-direction: column;
        transform-origin: center;
        animation: moolre_slide_up 260ms cubic-bezier(.2,.9,.2,1);
      `;

      // Detect host theme for loader
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const bodyBg = getComputedStyle(document.body).backgroundColor || "#fff";
      const isDarkBg = prefersDark || this._isColorDark(bodyBg);

      // Loading spinner
      const loader = document.createElement("div");
      loader.className = `moolre-loader ${isDarkBg ? "dark" : "light"}`;
      loader.innerHTML = `
        <div class="spinner"></div>
        <p class="loader-text">Loading checkout...</p>
      `;

      // Iframe container to ensure proper sizing
      const iframeContainer = document.createElement("div");
      iframeContainer.style.cssText = `
        flex: 1;
        width: 100%;
        height: 100%;
        position: relative;
        background: #fff;
        overflow: hidden;
      `;

      // Iframe element
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.className = "moolre-iframe";
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allow", "payment; fullscreen; clipboard-write");
      iframe.setAttribute("scrolling", "no");
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        opacity: 0;
        transition: opacity 0.4s ease;
        overflow: hidden !important;
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      `;

      // Close button
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.ariaLabel = "Close Moolre Checkout";
      closeBtn.innerHTML = "&times;";
      closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 12px;
        z-index: 25;
        background: transparent;
        border: none;
        font-size: 26px;
        color: #333;
        cursor: pointer;
        line-height: 1;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
      `;

      // Hover effect for close button
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = 'rgba(0,0,0,0.1)';
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = 'transparent';
      });

      // Fade out loader and show iframe when loaded
      iframe.addEventListener("load", () => {
        loader.style.opacity = "0";
        setTimeout(() => {
          if (loader.parentNode === modal) {
            modal.removeChild(loader);
          }
        }, 400);
        iframe.style.opacity = "1";
        try { 
          handlers.onLoad?.({ message: "Checkout loaded", url }); 
        } catch (e) { 
          console.error("onLoad handler error:", e); 
        }
      }, { once: true });

      // Detect slow network
      const slowTimer = setTimeout(() => {
        const text = loader.querySelector(".loader-text");
        if (text) {
          text.textContent = "Still loading... please wait a few more seconds ⏳";
        }
      }, 3000);

      // Clear timer when iframe loads
      iframe.addEventListener("load", () => clearTimeout(slowTimer), { once: true });

      // Assemble the modal
      iframeContainer.appendChild(iframe);
      modal.appendChild(loader);
      modal.appendChild(iframeContainer);
      modal.appendChild(closeBtn);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Save references
      this.overlay = overlay;
      this.iframe = iframe;

      // Add responsive styles
      this._addResponsiveStyles();

      // Close button action
      closeBtn.addEventListener("click", () => {
        try { handlers.onCancel?.(); } catch (e) { console.error(e); }
        this._closeModal();
      });

      // Click outside to close
      overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) {
          try { handlers.onCancel?.(); } catch (e) { console.error(e); }
          this._closeModal();
        }
      });

      // Handle messages from iframe
      this._listener = (event) => {
        const allowed = handlers.allowedOrigins ?? [".moolre.com"];
        const originOk = allowed.some(o => event.origin.includes(o));
        if (!originOk) return;

        const data = event.data;
        if (!data || typeof data !== "object") return;
        const eventType = data.event || data.type;

        switch (eventType) {
          case "resize":
          case "iframe.resize":
            if (data.height) {
              const newHeight = Math.min(data.height, window.innerHeight * 0.92);
              modal.style.height = `${newHeight}px`;
              iframeContainer.style.height = `${newHeight}px`;
            }
            break;
          case "payment.success":
          case "payment_success":
            try { handlers.onSuccess?.(data.data ?? data); } catch (e) { console.error(e); }
            this._closeModal();
            break;
          case "payment.failed":
          case "payment_failed":
            try { handlers.onError?.(data.data ?? data); } catch (e) { console.error(e); }
            this._closeModal();
            break;
          case "payment.cancel":
          case "close":
            try { handlers.onCancel?.(); } catch (e) { console.error(e); }
            this._closeModal();
            break;
          default:
            break;
        }
      };

      window.addEventListener("message", this._listener, false);

      // Expose manual close
      overlay._manualClose = () => {
        try { handlers.onClose?.(); } catch (e) { console.error("onClose handler error:", e); }
        this._closeModal();
      };

      // Prevent body scroll
      document.body.classList.add("moolre-hide-scroll");
    }

    /**
     * Add responsive styles for different screen sizes
     */
    _addResponsiveStyles() {
      // Check if responsive styles already exist
      if (document.getElementById('moolre-responsive-styles')) return;

      const responsiveStyle = document.createElement("style");
      responsiveStyle.id = "moolre-responsive-styles";
      responsiveStyle.textContent = `
        @media (max-width: 768px) {
          .moolre-modal {
            width: 95% !important;
            max-width: 340px !important;
            border-radius: 10px !important;
          }
        }

        @media (max-width: 480px) {
          .moolre-modal {
            width: 100% !important;
            max-width: 100% !important;
            height: 100vh !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            animation: moolre_slide_up_mobile 280ms cubic-bezier(.2,.9,.2,1) !important;
          }
          
          .moolre-modal .moolre-iframe {
            height: 100vh !important;
          }
        }
      `;
      document.head.appendChild(responsiveStyle);
    }

    _closeModal() {
      if (!this.overlay) return;

      // Remove body scroll prevention
      document.body.classList.remove("moolre-hide-scroll");

      // trigger fade-out animation
      const overlay = this.overlay;
      overlay.style.animation = "moolre_fade_out 250ms ease forwards";

      const modal = overlay.querySelector(".moolre-modal");
      if (modal) {
        // slide down the modal during close
        modal.style.animation = window.innerWidth <= 480
          ? "moolre_slide_down_mobile 250ms cubic-bezier(.2,.9,.2,1) forwards"
          : "moolre_slide_down 220ms cubic-bezier(.2,.9,.2,1) forwards";
      }

      // remove listener
      if (this._listener) {
        window.removeEventListener("message", this._listener, false);
        this._listener = null;
      }

      // wait for animation to finish, then remove
      setTimeout(() => {
        try {
          if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        } catch (e) {}

        this.overlay = null;
        this.iframe = null;
      }, 250);
    }

    _installGlobalStyles() {
      if (this._styleElem) return;
      const style = document.createElement("style");
      style.id = "moolre-inline-styles";
      style.textContent = `
        @keyframes moolre_fade_in {
          from { opacity: 0 } to { opacity: 1 }
        }
        @keyframes moolre_pop_in {
          from { transform: scale(.98); opacity: 0 }
          to { transform: scale(1); opacity: 1 }
        }
        @keyframes moolre_slide_up {
          from { transform: translateY(30px); opacity: 0 }
          to { transform: translateY(0); opacity: 1 }
        }
        @keyframes moolre_slide_up_mobile {
          from { transform: translateY(100%); opacity: 0 }
          to { transform: translateY(0); opacity: 1 }
        }
        @keyframes moolre_fade_out {
          from { opacity: 1 }
          to { opacity: 0 }
        }
        @keyframes moolre_slide_down {
          from { transform: translateY(0); opacity: 1 }
          to { transform: translateY(40px); opacity: 0 }
        }
        @keyframes moolre_slide_down_mobile {
          from { transform: translateY(0); opacity: 1 }
          to { transform: translateY(100%); opacity: 0 }
        }

        .moolre-hide-scroll, html.moolre-hide-scroll, body.moolre-hide-scroll {
          overflow: hidden !important;
        }
        
        /* COMPREHENSIVE SCROLLBAR REMOVAL FOR ALL BROWSERS */
        .moolre-modal ::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
        
        .moolre-modal ::-webkit-scrollbar-track {
          display: none !important;
          background: transparent !important;
        }
        
        .moolre-modal ::-webkit-scrollbar-thumb {
          display: none !important;
          background: transparent !important;
        }
        
        .moolre-modal ::-webkit-scrollbar-corner {
          display: none !important;
          background: transparent !important;
        }
        
        .moolre-iframe::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        
        .moolre-iframe {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
          overflow: -moz-scrollbars-none !important;
        }
        
        .moolre-modal {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        
        ::-webkit-scrollbar { 
          display: none !important;
        }

        .moolre-loader {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 20;
          transition: opacity 0.4s ease;
          text-align: center;
          font-family: Inter, system-ui, sans-serif;
        }

        .moolre-loader.light {
          background: rgba(255,255,255,0.95);
        }

        .moolre-loader.dark {
          background: rgba(10,10,10,0.9);
        }

        .moolre-loader p {
          font-size: 14px;
          margin-top: 12px;
          transition: color 0.3s;
        }

        .moolre-loader.light p {
          color: #444;
        }

        .moolre-loader.dark p {
          color: #ccc;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #ccc;
          border-top-color: #ff6b00;
          border-radius: 50%;
          animation: moolre_spin 1s linear infinite;
        }

        .moolre-loader.dark .spinner {
          border: 3px solid #444;
          border-top-color: #ff6b00;
        }

        .moolre-iframe {
          transition: opacity 0.4s ease;
        }

        @keyframes moolre_spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      this._styleElem = style;
    }

    _isColorDark(color) {
      // Parse rgb(...) or hex colors
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.fillStyle = color;
      const rgb = ctx.fillStyle.match(/\d+/g)?.map(Number) || [255,255,255];
      const [r,g,b] = rgb;
      // Perceived brightness formula
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness < 128;
    }
  }

  return MoolrePay;
});