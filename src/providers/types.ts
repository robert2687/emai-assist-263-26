export type ComposeMode = 'reply' | 'forward' | 'new';

export type ProviderName = 'gmail' | 'zoho' | 'outlook';

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
  /**
   * Optional async thread fetch that uses a provider's native API when
   * available (e.g. Gmail API via OAuth2). Falls back to DOM extraction
   * via getThread() if the provider does not implement this method or if
   * the API call fails.
   */
  getThreadAsync?(): Promise<ThreadData>;
  insertIntoComposer(html: string): void;
  setSubject(text: string): void;
  openCalendar(title?: string, startDateTime?: string): void;
  sendEmail(payload?: SendEmailPayload): Promise<void>;

  /**
   * Internal helper methods for binding adapter actions to a concrete composer.
   */
  findComposeRoots(): HTMLElement[];
  getToolbarForCompose(composeRoot: HTMLElement): HTMLElement | null;
  setActiveComposeRoot(composeRoot: HTMLElement): void;
}
