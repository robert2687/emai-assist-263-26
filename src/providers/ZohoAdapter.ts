import { BaseAdapter } from './BaseAdapter';
import { ComposeMode, ProviderName, SendEmailPayload, ThreadData, ThreadMessage } from './types';

const ZOHO_SELECTORS = {
  composeRoot: '[data-zcqa="zm_compose_container"], .zmCMPContainer, .Compose, .mail-compose',
  toolbar: '[data-zcqa="zm_compose_toolbar"], .zmEditorToolBar, .composeToolbar',
  editable: '[contenteditable="true"][role="textbox"], .zmEditor [contenteditable="true"]',
  subject: 'input[name="subject"], input[placeholder*="Subject"]',
  toField: 'input[name="to"], textarea[name="to"], input[placeholder^="To"]',
  sendButton: 'button[data-zcqa="zm_sendbtn"], button[aria-label*="Send"]',
  quoteBlocks: 'blockquote',
};

export class ZohoAdapter extends BaseAdapter {
  getProviderName(): ProviderName {
    return 'zoho';
  }

  findComposeRoots(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(ZOHO_SELECTORS.composeRoot));
  }

  getToolbarForCompose(composeRoot: HTMLElement): HTMLElement | null {
    return composeRoot.querySelector<HTMLElement>(ZOHO_SELECTORS.toolbar);
  }

  getComposeMode(): ComposeMode {
    const composeRoot = this.requireActiveComposeRoot();
    const subject = composeRoot.querySelector<HTMLInputElement>(ZOHO_SELECTORS.subject)?.value?.trim() ?? '';

    if (/^fwd\s*:/i.test(subject)) {
      return 'forward';
    }
    if (composeRoot.querySelector(ZOHO_SELECTORS.quoteBlocks)) {
      return 'reply';
    }
    return 'new';
  }

  getThread(): ThreadData {
    const composeRoot = this.requireActiveComposeRoot();
    const subject = composeRoot.querySelector<HTMLInputElement>(ZOHO_SELECTORS.subject)?.value?.trim() ?? '';

    const participants = (composeRoot.querySelector<HTMLInputElement | HTMLTextAreaElement>(ZOHO_SELECTORS.toField)?.value ?? '')
      .split(/[;,]/)
      .map((p) => p.trim())
      .filter(Boolean);

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

  insertIntoComposer(html: string): void {
    const composeRoot = this.requireActiveComposeRoot();
    const editable = composeRoot.querySelector<HTMLElement>(ZOHO_SELECTORS.editable);
    if (!editable) {
      throw new Error('Could not find Zoho compose editor.');
    }

    editable.innerHTML = this.sanitizeInsertedHtml(html);
    editable.dispatchEvent(new Event('input', { bubbles: true }));
  }

  setSubject(text: string): void {
    const composeRoot = this.requireActiveComposeRoot();
    const subjectInput = composeRoot.querySelector<HTMLInputElement>(ZOHO_SELECTORS.subject);
    if (!subjectInput) return;
    subjectInput.value = text;
    subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  openCalendar(title = 'Email Follow-up', startDateTime?: string): void {
    const url = new URL('https://calendar.zoho.com');
    if (startDateTime) {
      url.searchParams.set('title', title);
      url.searchParams.set('start', startDateTime);
    }
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  async sendEmail(payload?: SendEmailPayload): Promise<void> {
    if (payload?.html) {
      this.insertIntoComposer(payload.html);
    }

    if (payload?.sendImmediately === false) {
      return;
    }

    const composeRoot = this.requireActiveComposeRoot();
    composeRoot.querySelector<HTMLButtonElement>(ZOHO_SELECTORS.sendButton)?.click();
  }
}
