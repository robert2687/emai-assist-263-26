export type ComposeMode = 'reply' | 'forward' | 'new';

export type ProviderName = 'gmail' | 'zoho' | 'outlook' | 'outlook-officejs';

export interface ThreadMessage {
  from?: string;
  body: string;
  timestamp?: string;
}

export interface ThreadData {
  subject: string;
  participants: string[];
  messages: ThreadMessage[];
}

export interface SendEmailPayload {
  html?: string;
  sendImmediately?: boolean;
}

export interface ProviderAdapter {
  getProviderName(): ProviderName;
  getComposeMode(): ComposeMode;
  getThread(): ThreadData;
  insertIntoComposer(html: string): void;
  sendEmail(payload?: SendEmailPayload): Promise<void>;

  /**
   * Internal helper methods for binding adapter actions to a concrete composer.
   */
  findComposeRoots(): HTMLElement[];
  getToolbarForCompose(composeRoot: HTMLElement): HTMLElement | null;
  setActiveComposeRoot(composeRoot: HTMLElement): void;
}
