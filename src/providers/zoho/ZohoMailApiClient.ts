import { ThreadData, ThreadMessage } from '../types';
import { ZohoOAuthService } from './ZohoOAuthService';

const ZOHO_MAIL_API_BASE = 'https://mail.zoho.com/api';

interface ZohoApiAccount {
  accountId: string;
  emailAddress: string;
  displayName: string;
}

interface ZohoApiMessage {
  messageId: string;
  fromAddress: string;
  subject: string;
  summary: string;
  receivedTime: string;
  content?: string;
}

interface ZohoApiAccountsResponse {
  status: { code: number };
  data: ZohoApiAccount[];
}

interface ZohoApiThreadResponse {
  status: { code: number };
  data: ZohoApiMessage[];
}

/**
 * Lightweight Zoho Mail REST API client.
 *
 * All requests are authenticated via the `ZohoOAuthService` bearer token.
 * Reference: https://www.zoho.com/mail/help/api/
 */
export class ZohoMailApiClient {
  private readonly oauthService: ZohoOAuthService;

  constructor(oauthService: ZohoOAuthService) {
    this.oauthService = oauthService;
  }

  private async fetchWithAuth<T>(url: string): Promise<T> {
    const accessToken = await this.oauthService.getValidAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated with Zoho. Please complete the OAuth flow.');
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Zoho Mail API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Returns the accountId of the authenticated user's primary Zoho Mail account.
   */
  async getPrimaryAccountId(): Promise<string> {
    const result = await this.fetchWithAuth<ZohoApiAccountsResponse>(
      `${ZOHO_MAIL_API_BASE}/accounts`,
    );

    const account = result.data?.[0];
    if (!account?.accountId) {
      throw new Error('No Zoho Mail account found.');
    }

    return account.accountId;
  }

  /**
   * Fetches all messages in a thread and converts them to the app's `ThreadData`
   * shape.
   *
   * @param accountId - Zoho account ID (from `getPrimaryAccountId`)
   * @param threadId  - Thread identifier provided by the Zoho Extension SDK event
   */
  async getThreadMessages(accountId: string, threadId: string): Promise<ThreadData> {
    const result = await this.fetchWithAuth<ZohoApiThreadResponse>(
      `${ZOHO_MAIL_API_BASE}/accounts/${encodeURIComponent(accountId)}/messages/thread/${encodeURIComponent(threadId)}`,
    );

    const apiMessages = result.data ?? [];
    const subject = apiMessages[0]?.subject ?? '';

    const participants = [
      ...new Set(apiMessages.map((msg) => msg.fromAddress).filter(Boolean)),
    ];

    const messages: ThreadMessage[] = apiMessages.map((msg) => ({
      from: msg.fromAddress,
      body: msg.content ?? msg.summary ?? '',
      // Zoho API returns receivedTime as a Unix timestamp in milliseconds (string)
      timestamp: msg.receivedTime
        ? new Date(Number(msg.receivedTime)).toISOString()
        : undefined,
    }));

    return { subject, participants, messages };
  }
}
