import { BaseAdapter } from './BaseAdapter';
import { ComposeMode, ProviderName, SendEmailPayload, ThreadData, ThreadMessage } from './types';
import { MsalAuthService } from '../services/msalAuthService';
import { GraphApiService } from '../services/graphApiService';

/**
 * Office.js Outlook Web Add-in adapter.
 *
 * Runs inside the taskpane (a separate browsing context from the mail client),
 * so DOM manipulation of the mail client is not possible.  Instead, all data
 * access and mutations go through the Office JavaScript API and the Microsoft
 * Graph API.
 */
export class OutlookOfficeJsAdapter extends BaseAdapter {
  private cachedThread: ThreadData = { subject: '', participants: [], messages: [] };
  private cachedComposeMode: ComposeMode = 'new';

  private readonly authService: MsalAuthService;
  private readonly graphService: GraphApiService;

  constructor(authService: MsalAuthService, graphService: GraphApiService) {
    super();
    this.authService = authService;
    this.graphService = graphService;
  }

  // ── ProviderAdapter identity ───────────────────────────────────────────────

  getProviderName(): ProviderName {
    return 'outlook-officejs';
  }

  // ── DOM surface — not applicable inside a taskpane ─────────────────────────

  /** Not used in the taskpane context. */
  findComposeRoots(): HTMLElement[] {
    return [];
  }

  /** Not used in the taskpane context. */
  getToolbarForCompose(_composeRoot: HTMLElement): HTMLElement | null {
    return null;
  }

  // ── Synchronous accessors (backed by cached async data) ────────────────────

  getComposeMode(): ComposeMode {
    return this.cachedComposeMode;
  }

  getThread(): ThreadData {
    return this.cachedThread;
  }

  // ── Composer mutations via Office.js API ───────────────────────────────────

  insertIntoComposer(html: string): void {
    const item = Office.context.mailbox.item as Office.MessageCompose | null;
    item?.body.setAsync(this.sanitizeInsertedHtml(html), {
      coercionType: Office.CoercionType.Html,
    });
  }

  async sendEmail(payload?: SendEmailPayload): Promise<void> {
    if (payload?.html) {
      await new Promise<void>((resolve, reject) => {
        const item = Office.context.mailbox.item as Office.MessageCompose | null;
        if (!item) {
          reject(new Error('No active compose item.'));
          return;
        }
        item.body.setAsync(
          this.sanitizeInsertedHtml(payload.html),
          { coercionType: Office.CoercionType.Html },
          (result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
              resolve();
            } else {
              reject(new Error(result.error?.message ?? 'Failed to set body.'));
            }
          },
        );
      });
    }
    // Office.js does not expose a programmatic send for compose items.
  }

  // ── Async context loading ──────────────────────────────────────────────────

  /**
   * Populates the internal cache from Office.js and, where available, the
   * Graph API.  Call this once after `Office.onReady` and again whenever the
   * `Office.EventType.ItemChanged` event fires.
   */
  async loadThreadContext(): Promise<void> {
    await Promise.all([this.detectComposeMode(), this.fetchThreadData()]);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async detectComposeMode(): Promise<void> {
    const subject = await this.getSubjectAsync();

    if (/^fw[d]?\s*:/i.test(subject)) {
      this.cachedComposeMode = 'forward';
    } else if (/^re\s*:/i.test(subject)) {
      this.cachedComposeMode = 'reply';
    } else {
      this.cachedComposeMode = 'new';
    }
  }

  private async fetchThreadData(): Promise<void> {
    const [subject, participants, conversationId] = await Promise.all([
      this.getSubjectAsync(),
      this.getParticipantsAsync(),
      this.getConversationIdAsync(),
    ]);

    let messages: ThreadMessage[] = [];

    // Prefer full thread via Graph API; fall back to current body only.
    try {
      const token = await this.authService.getAccessToken();
      if (token && conversationId) {
        messages = await this.graphService.getConversationMessages(conversationId, token);
      }
    } catch {
      const body = await this.getBodyAsync();
      if (body) messages = [{ body }];
    }

    this.cachedThread = { subject, participants, messages };
  }

  private getSubjectAsync(): Promise<string> {
    return new Promise((resolve) => {
      const item = Office.context.mailbox.item;
      if (!item) { resolve(''); return; }

      // In compose mode, subject is a Subject object with getAsync.
      // In read mode, subject is a plain string.
      if (item.itemType === Office.MailboxEnums.ItemType.Message && 'subject' in item) {
        const subjectField = (item as Office.MessageCompose).subject;
        if (typeof subjectField === 'object' && typeof subjectField.getAsync === 'function') {
          subjectField.getAsync((result) => {
            resolve(result.status === Office.AsyncResultStatus.Succeeded ? result.value : '');
          });
          return;
        }
        if (typeof subjectField === 'string') {
          resolve(subjectField);
          return;
        }
      }
      resolve('');
    });
  }

  private getConversationIdAsync(): Promise<string> {
    return new Promise((resolve) => {
      const item = Office.context.mailbox.item;
      resolve((item as Office.MessageCompose & { conversationId?: string })?.conversationId ?? '');
    });
  }

  private getParticipantsAsync(): Promise<string[]> {
    return new Promise((resolve) => {
      const item = Office.context.mailbox.item as Office.MessageCompose | null;
      if (!item?.to) { resolve([]); return; }

      item.to.getAsync((result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) { resolve([]); return; }
        resolve(
          result.value
            .map((r) => r.emailAddress || r.displayName || '')
            .filter(Boolean),
        );
      });
    });
  }

  private getBodyAsync(): Promise<string> {
    return new Promise((resolve) => {
      const item = Office.context.mailbox.item;
      if (!item) { resolve(''); return; }

      item.body.getAsync(Office.CoercionType.Text, (result) => {
        resolve(result.status === Office.AsyncResultStatus.Succeeded ? result.value : '');
      });
    });
  }
}
