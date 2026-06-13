// Type declarations for the Zoho Mail Extension SDK (ZOHO.ZMailClient).
// Reference: https://www.zoho.com/mail/help/extensions/

interface ZohoComposeEventData {
  composeId: string;
  isReply: boolean;
  isForward: boolean;
  subject: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  body: string;
  threadId?: string;
  messageId?: string;
}

interface ZohoZMailClient {
  ON(
    event: 'ON_COMPOSE_OPEN' | 'ON_REPLY_OPEN' | 'ON_FORWARD_OPEN' | 'ON_COMPOSE_CLOSE',
    handler: (data: ZohoComposeEventData) => void,
  ): void;
  get(key: string): Promise<Record<string, unknown>>;
  set(key: string, value: Record<string, unknown>): Promise<void>;
  invoke(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

interface ZohoEmbeddedApp {
  on(event: 'PageLoad', handler: (data: Record<string, unknown>) => void): void;
  init(): void;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace ZOHO {
  const ZMailClient: ZohoZMailClient;
  const embeddedApp: ZohoEmbeddedApp;
}
