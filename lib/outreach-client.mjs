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
