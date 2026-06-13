import { BaseAdapter } from './BaseAdapter';
import { ComposeMode, ProviderName, SendEmailPayload, ThreadData, ThreadMessage } from './types';

const OUTLOOK_SELECTORS = {
  composeRoot: '[role="dialog"][aria-label*="Message"]',
  fallbackComposeRoot: '[data-app-section="MailReadCompose"]',
  toolbar: '[role="toolbar"]',
  editable: 'div[aria-label*="Message body"][contenteditable="true"], div[role="textbox"][contenteditable="true"]',
  subject: 'input[aria-label*="Add a subject"], input[placeholder*="Add a subject"]',
  toField: 'input[aria-label^="To"], textarea[aria-label^="To"]',
  sendButton: 'button[aria-label="Send"], button[title="Send"]',
  quoteBlocks: 'blockquote',
};

export class OutlookAdapter extends BaseAdapter {
  getProviderName(): ProviderName {
    return 'outlook';
  }

  findComposeRoots(): HTMLElement[] {
    const roots = Array.from(document.querySelectorAll<HTMLElement>(OUTLOOK_SELECTORS.composeRoot));
    if (roots.length > 0) {
      return roots;
    }

    return Array.from(document.querySelectorAll<HTMLElement>(OUTLOOK_SELECTORS.fallbackComposeRoot));
  }

  getToolbarForCompose(composeRoot: HTMLElement): HTMLElement | null {
    return composeRoot.querySelector<HTMLElement>(OUTLOOK_SELECTORS.toolbar);
  }

  getComposeMode(): ComposeMode {
    const composeRoot = this.requireActiveComposeRoot();
    const subject = composeRoot.querySelector<HTMLInputElement>(OUTLOOK_SELECTORS.subject)?.value?.trim() ?? '';

    if (/^fw\s*:/i.test(subject) || /^fwd\s*:/i.test(subject)) {
      return 'forward';
    }
    if (composeRoot.querySelector(OUTLOOK_SELECTORS.quoteBlocks)) {
      return 'reply';
    }
    return 'new';
  }

  getThread(): ThreadData {
    const composeRoot = this.requireActiveComposeRoot();
    const subject = composeRoot.querySelector<HTMLInputElement>(OUTLOOK_SELECTORS.subject)?.value?.trim() ?? '';

    const participants = (composeRoot.querySelector<HTMLInputElement | HTMLTextAreaElement>(OUTLOOK_SELECTORS.toField)?.value ?? '')
      .split(/[;,]/)
      .map((p) => p.trim())
      .filter(Boolean);

    const currentDraft = composeRoot.querySelector<HTMLElement>(OUTLOOK_SELECTORS.editable)?.innerText?.trim() ?? '';
    const quotedMessages: ThreadMessage[] = Array.from(composeRoot.querySelectorAll<HTMLElement>(OUTLOOK_SELECTORS.quoteBlocks))
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
    const editable = composeRoot.querySelector<HTMLElement>(OUTLOOK_SELECTORS.editable);
    if (!editable) {
      throw new Error('Could not find Outlook compose editor.');
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

    const composeRoot = this.requireActiveComposeRoot();
    composeRoot.querySelector<HTMLButtonElement>(OUTLOOK_SELECTORS.sendButton)?.click();
  }
}
