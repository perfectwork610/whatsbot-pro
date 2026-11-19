import pkg from 'whatsapp-web.js';

// whatsapp-web.js registers an async navigation listener without handling its
// rejection. A redirect during injection must not terminate the entire worker.
export class OutreachClient extends pkg.Client {
  constructor(options) {
    super(options);
    const afterBrowserInitialized = this.authStrategy.afterBrowserInitialized.bind(
      this.authStrategy,
    );
    this.authStrategy.afterBrowserInitialized = async () => {
      await afterBrowserInitialized();
      const navigate = this.pupPage.goto.bind(this.pupPage);
      // The connector waits for WhatsApp's own readiness in inject(). Waiting
      // for every subresource's load event first can hang forever on this page.
      this.pupPage.goto = (url, navigationOptions = {}) =>
        navigate(url, {
          ...navigationOptions,
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
    };
  }
  async initialize() {
    try {
      return await super.initialize();
    } catch (error) {
      // A redirect also interrupts the initial injection; the registered main
      // frame listener performs the fresh injection in that case.
      if (!/Execution context was destroyed|Cannot find context/.test(String(error))) throw error;
    }
  }
  /**
   * Pairing must be enabled with pairWithPhoneNumber in the Client constructor.
   * Calling this from a QR handler is unsupported by whatsapp-web.js.
   * initialize() does not await this call — never rethrow.
   */
  async requestPairingCode(phoneNumber, showNotification = true, intervalMs = 180000) {
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    if (!/^[1-9]\d{7,14}$/.test(digits)) {
      this.emit(
        'pairing_failed',
        new Error('Informe o telefone do WhatsApp com código do país.'),
      );
      return '';
    }
    try {
      if (this.pupPage) {
        await this.pupPage
          .waitForFunction(
            () => {
              try {
                const api = window.require?.('WAWebAltDeviceLinkingApi');
                const state = window.require?.('WAWebSocketModel')?.Socket?.state;
                return (
                  !!api?.startAltLinkingFlow &&
                  (!state || state === 'UNPAIRED' || state === 'UNPAIRED_IDLE')
                );
              } catch {
                return false;
              }
            },
            { timeout: 60000 },
          )
          .catch(() => {});
      }
      const code = await super.requestPairingCode(digits, showNotification, intervalMs);
      if (code) return String(code);
      this.emit(
        'pairing_failed',
        new Error(
          'Não foi possível gerar o código de telefone. Escolha tentar de novo ou conectar por QR.',
        ),
      );
      return '';
    } catch (error) {
      const raw = String(error?.message || error || '');
      console.error('Pairing code request failed:', raw);
      let detail = raw;
      try {
        detail =
          (await this.pupPage?.evaluate(() => {
            try {
              return String(window.__PAIRING_LAST_ERROR || '');
            } catch {
              return '';
            }
          })) || raw;
      } catch {
        /* ignore */
      }
      const friendly = new Error(
        /rate|overlimit|429/i.test(`${raw} ${detail}`)
          ? 'WhatsApp limitou tentativas de código. Aguarde alguns minutos ou conecte por QR.'
          : 'Não foi possível gerar o código de telefone. Escolha tentar de novo ou conectar por QR.',
      );
      this.emit('pairing_failed', friendly);
      return '';
    }
  }
  _registerFramenavigatedHandler() {
    if (this._framenavigatedRegistered) return;
    this._framenavigatedRegistered = true;
    let navigation = Promise.resolve();
    this.pupPage.on('framenavigated', (frame) => {
      if (frame.parentFrame() !== null) return;
      navigation = navigation
        .then(async () => {
          const logout = frame.url().includes('post_logout=1') || this.lastLoggedOut;
          if (logout) {
            this.emit('disconnected', 'LOGOUT');
            this.lastLoggedOut = false;
            // The worker closes the browser before clearing LocalAuth. Windows
            // keeps the profile locked while Chromium is running.
            return;
          }
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const available = await this.pupPage.evaluate(
                () => typeof window.WWebJS !== 'undefined',
              );
              if (!logout && available) return;
              await this.inject();
              return;
            } catch (error) {
              if (
                !/Execution context was destroyed|Cannot find context/.test(String(error)) ||
                attempt === 2
              )
                throw error;
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        })
        .catch((error) => this.emit('connector_error', error));
    });
  }
}
