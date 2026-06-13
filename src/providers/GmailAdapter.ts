import { BaseAdapter } from './BaseAdapter';
import { ComposeMode, ProviderName, SendEmailPayload, ThreadData, ThreadMessage } from './types';

const GMAIL_SELECTORS = {
  composeRoot: '.M9',
  toolbar: '.btC',
  editable: '.Am.Al.editable[contenteditable="true"]',
  subject: 'input[name="subjectbox"]',
  toField: 'textarea[name="to"], input[aria-label^="To"]',
  sendButton: '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
  quoteBlocks: 'blockquote',
};

export class GmailAdapter extends BaseAdapter {
  getProviderName(): ProviderName {
    return 'gmail';
  }

  findComposeRoots(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(GMAIL_SELECTORS.composeRoot));
  }

  getToolbarForCompose(composeRoot: HTMLElement): HTMLElement | null {
    return composeRoot.querySelector<HTMLElement>(GMAIL_SELECTORS.toolbar);
  }

  getComposeMode(): ComposeMode {
    const composeRoot = this.requireActiveComposeRoot();
    const subject = composeRoot.querySelector<HTMLInputElement>(GMAIL_SELECTORS.subject)?.value?.trim() ?? '';

    if (/^fwd\s*:/i.test(subject)) {
      return 'forward';
    }

    const hasQuotedThread = composeRoot.querySelector(GMAIL_SELECTORS.quoteBlocks);
    if (hasQuotedThread) {
      return 'reply';
    }

    return 'new';
  }

  getThread(): ThreadData {
    const composeRoot = this.requireActiveComposeRoot();
    const subject = composeRoot.querySelector<HTMLInputElement>(GMAIL_SELECTORS.subject)?.value?.trim() ?? '';

    const toText = composeRoot.querySelector<HTMLInputElement | HTMLTextAreaElement>(GMAIL_SELECTORS.toField)?.value ?? '';
    const participants = toText
      .split(/[;,]/)
      .map((p) => p.trim())
      .filter(Boolean);

    const currentDraft = composeRoot.querySelector<HTMLElement>(GMAIL_SELECTORS.editable)?.innerText?.trim() ?? '';

    const quotedMessages: ThreadMessage[] = Array.from(composeRoot.querySelectorAll<HTMLElement>(GMAIL_SELECTORS.quoteBlocks))
      .map((el) => ({ body: el.innerText.trim() }))
      .filter((m) => m.body.length > 0);

    const messages: ThreadMessage[] = [
      ...(currentDraft ? [{ body: currentDraft }] : []),
      ...quotedMessages,
    ];

    return {
      subject,
      participants,
      messages,
    };
  }

  insertIntoComposer(html: string): void {
    const composeRoot = this.requireActiveComposeRoot();
    const editable = composeRoot.querySelector<HTMLElement>(GMAIL_SELECTORS.editable);
    if (!editable) {
      throw new Error('Could not find Gmail compose editor.');
    }

    editable.innerHTML = this.sanitizeInsertedHtml(html);
    editable.dispatchEvent(new Event('input', { bubbles: true }));
  }

  setSubject(text: string): void {
    const composeRoot = this.requireActiveComposeRoot();
    const subjectInput = composeRoot.querySelector<HTMLInputElement>(GMAIL_SELECTORS.subject);
    if (!subjectInput) return;
    subjectInput.value = text;
    subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  openCalendar(title = 'Email Follow-up', startDateTime?: string): void {
    const url = new URL('https://calendar.google.com/calendar/u/0/r/eventedit');
    url.searchParams.set('text', title);
    if (startDateTime) {
      const compact = startDateTime.replace(/[-:]/g, '') + '00';
      url.searchParams.set('dates', `${compact}/${compact}`);
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
    const sendButton = composeRoot.querySelector<HTMLButtonElement>(`${GMAIL_SELECTORS.sendButton}:not([data-ai-email-assistant="true"])`);
    sendButton?.click();
  }
}
