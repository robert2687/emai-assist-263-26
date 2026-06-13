import { BaseAdapter } from './BaseAdapter';
import { ComposeMode, ProviderName, SendEmailPayload, ThreadData, ThreadMessage } from './types';
import { ZohoMailApiClient } from './zoho/ZohoMailApiClient';
import { ZohoOAuthService } from './zoho/ZohoOAuthService';

const ZOHO_SELECTORS = {
  composeRoot: '[data-zcqa="zm_compose_container"], .zmCMPContainer, .Compose, .mail-compose',
  toolbar: '[data-zcqa="zm_compose_toolbar"], .zmEditorToolBar, .composeToolbar',
  editable: '[contenteditable="true"][role="textbox"], .zmEditor [contenteditable="true"]',
  subject: 'input[name="subject"], input[placeholder*="Subject"]',
  toField: 'input[name="to"], textarea[name="to"], input[placeholder^="To"]',
  sendButton: 'button[data-zcqa="zm_sendbtn"], button[aria-label*="Send"]',
  quoteBlocks: 'blockquote',
};

// ── Zoho OAuth2 configuration ─────────────────────────────────────────────────

const getZohoOAuthConfig = (): { clientId: string; redirectUri: string } => ({
  clientId:
    (typeof process !== 'undefined' && process.env?.ZOHO_CLIENT_ID) ||
    localStorage.getItem('zoho_client_id') ||
    '',
  redirectUri:
    (typeof process !== 'undefined' && process.env?.ZOHO_REDIRECT_URI) ||
    localStorage.getItem('zoho_redirect_uri') ||
    `${window.location.origin}/zoho-oauth-callback`,
});

// ── Zoho Extension SDK availability check ─────────────────────────────────────

/**
 * Returns the `ZOHO` global object when running inside Zoho's own Extension
 * platform, or `null` when running as a plain browser-extension content script.
 */
const getZohoSdk = (): typeof ZOHO | null => {
  const win = window as unknown as { ZOHO?: typeof ZOHO };
  return win.ZOHO ?? null;
};

// ── Adapter ───────────────────────────────────────────────────────────────────

export class ZohoAdapter extends BaseAdapter {
  private readonly oauthService: ZohoOAuthService;
  private readonly apiClient: ZohoMailApiClient;

  /**
   * Cached compose-event data delivered by the Zoho Extension SDK.
   * Populated when the adapter runs inside the Zoho Mail Extension platform.
   */
  private sdkComposeData: ZohoComposeEventData | null = null;

  /** Cached Zoho account ID to avoid redundant API calls. */
  private cachedAccountId: string | null = null;

  constructor() {
    super();
    const { clientId, redirectUri } = getZohoOAuthConfig();
    this.oauthService = new ZohoOAuthService(clientId, redirectUri);
    this.apiClient = new ZohoMailApiClient(this.oauthService);
    this.initExtensionHooks();
  }

  getProviderName(): ProviderName {
    return 'zoho';
  }

  // ── Zoho Extension SDK hooks ──────────────────────────────────────────────

  /**
   * Registers Zoho Mail Extension event handlers when the SDK is present.
   * Called once during construction; safe to call even when the SDK is absent.
   */
  private initExtensionHooks(): void {
    const sdk = getZohoSdk();
    if (!sdk) return;

    sdk.embeddedApp.on('PageLoad', () => {
      sdk.ZMailClient.ON('ON_COMPOSE_OPEN', (data) => {
        this.sdkComposeData = data;
        this.injectExtensionPanel(data);
      });

      sdk.ZMailClient.ON('ON_REPLY_OPEN', (data) => {
        this.sdkComposeData = { ...data, isReply: true };
        this.injectExtensionPanel(data);
      });

      sdk.ZMailClient.ON('ON_FORWARD_OPEN', (data) => {
        this.sdkComposeData = { ...data, isForward: true };
        this.injectExtensionPanel(data);
      });

      sdk.ZMailClient.ON('ON_COMPOSE_CLOSE', () => {
        this.sdkComposeData = null;
      });
    });

    sdk.embeddedApp.init();
  }

  /**
   * Uses the Zoho `ZMailInject.injectPanel` API to mount the micro-UI panel
   * next to the active composer window.
   */
  private injectExtensionPanel(data: ZohoComposeEventData): void {
    const sdk = getZohoSdk();
    if (!sdk) return;

    sdk.ZMailClient.invoke('ZMailInject.injectPanel', {
      composeId: data.composeId,
      url: `index.html?extension=true&provider=${encodeURIComponent(this.getProviderName())}`,
      width: '420px',
      title: 'AI Email Assistant',
    }).catch((err: unknown) => {
      console.error('[ZohoAdapter] Panel injection failed:', err);
    });
  }

  // ── ProviderAdapter implementation ────────────────────────────────────────

  findComposeRoots(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(ZOHO_SELECTORS.composeRoot));
  }

  getToolbarForCompose(composeRoot: HTMLElement): HTMLElement | null {
    return composeRoot.querySelector<HTMLElement>(ZOHO_SELECTORS.toolbar);
  }

  getComposeMode(): ComposeMode {
    if (this.sdkComposeData) {
      if (this.sdkComposeData.isForward) return 'forward';
      if (this.sdkComposeData.isReply) return 'reply';
      return 'new';
    }

    const composeRoot = this.requireActiveComposeRoot();
    const subject =
      composeRoot.querySelector<HTMLInputElement>(ZOHO_SELECTORS.subject)?.value?.trim() ?? '';

    if (/^fwd\s*:/i.test(subject)) return 'forward';
    if (composeRoot.querySelector(ZOHO_SELECTORS.quoteBlocks)) return 'reply';
    return 'new';
  }

  /**
   * Returns thread data from the DOM immediately.  When the Zoho Extension SDK
   * has provided a `threadId`, a background API fetch is also kicked off; the
   * richer API result will be delivered to the overlay on the next
   * `RUN_CONTEXT_ENGINE` cycle via the existing message protocol.
   */
  getThread(): ThreadData {
    if (this.sdkComposeData?.threadId) {
      void this.fetchThreadFromApi(this.sdkComposeData.threadId);
    }
    return this.getThreadFromDom();
  }

  private getThreadFromDom(): ThreadData {
    const composeRoot = this.requireActiveComposeRoot();
    const subject =
      composeRoot.querySelector<HTMLInputElement>(ZOHO_SELECTORS.subject)?.value?.trim() ?? '';

    const participants = (
      composeRoot
        .querySelector<HTMLInputElement | HTMLTextAreaElement>(ZOHO_SELECTORS.toField)
        ?.value ?? ''
    )
      .split(/[;,]/)
      .map((p) => p.trim())
      .filter(Boolean);

    const currentDraft =
      composeRoot.querySelector<HTMLElement>(ZOHO_SELECTORS.editable)?.innerText?.trim() ?? '';

    const quotedMessages: ThreadMessage[] = Array.from(
      composeRoot.querySelectorAll<HTMLElement>(ZOHO_SELECTORS.quoteBlocks),
    )
      .map((el) => ({ body: el.innerText.trim() }))
    const editableEl = composeRoot.querySelector<HTMLElement>(ZOHO_SELECTORS.editable);
    const currentDraft = (editableEl?.innerText || editableEl?.textContent || '').trim();
    const currentDraft = composeRoot.querySelector<HTMLElement>(ZOHO_SELECTORS.editable)?.innerText?.trim() ?? '';
    const quotedMessages: ThreadMessage[] = Array.from(composeRoot.querySelectorAll<HTMLElement>(ZOHO_SELECTORS.quoteBlocks))
      .map((el) => ({ body: el.innerText.trim() }))
      .filter((msg) => msg.body.length > 0);

    return {
      subject,
      participants,
      messages: [
        ...(currentDraft ? [{ body: currentDraft }] : []),
        ...quotedMessages,
      ],
    };
  }

  private async fetchThreadFromApi(threadId: string): Promise<ThreadData | null> {
    try {
      const accountId = await this.getOrFetchAccountId();
      if (!accountId) return null;
      return await this.apiClient.getThreadMessages(accountId, threadId);
    } catch (err) {
      console.error('[ZohoAdapter] API thread fetch failed:', err);
      return null;
    }
  }

  private async getOrFetchAccountId(): Promise<string | null> {
    if (this.cachedAccountId) return this.cachedAccountId;
    try {
      this.cachedAccountId = await this.apiClient.getPrimaryAccountId();
      return this.cachedAccountId;
    } catch {
      return null;
    }
  }

  insertIntoComposer(html: string): void {
    const sdk = getZohoSdk();
    if (sdk && this.sdkComposeData) {
      sdk.ZMailClient.set('mail.compose.body', {
        body: this.sanitizeInsertedHtml(html),
        composeId: this.sdkComposeData.composeId,
      }).catch((err: unknown) => {
        console.error('[ZohoAdapter] SDK set body failed, falling back to DOM:', err);
        this.insertIntoComposerDom(html);
      });
      return;
    }

    this.insertIntoComposerDom(html);
  }

  private insertIntoComposerDom(html: string): void {
    const composeRoot = this.requireActiveComposeRoot();
    const editable = composeRoot.querySelector<HTMLElement>(ZOHO_SELECTORS.editable);
    if (!editable) {
      throw new Error('Could not find Zoho compose editor.');
    }

    editable.innerHTML = this.sanitizeInsertedHtml(html);
    editable.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async sendEmail(payload?: SendEmailPayload): Promise<void> {
    if (payload?.html) {
      this.insertIntoComposer(payload.html);
    }

    if (payload?.sendImmediately === false) {
      return;
    }

    const sdk = getZohoSdk();
    if (sdk && this.sdkComposeData) {
      await sdk.ZMailClient.invoke('ZMailCompose.send', {
        composeId: this.sdkComposeData.composeId,
      });
      return;
    }

    const composeRoot = this.requireActiveComposeRoot();
    composeRoot.querySelector<HTMLButtonElement>(ZOHO_SELECTORS.sendButton)?.click();
  }
}
