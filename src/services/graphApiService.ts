import type { ThreadMessage } from '../providers/types';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

interface GraphMessage {
  from?: { emailAddress?: { address?: string; name?: string } };
  body?: { content?: string };
  receivedDateTime?: string;
}

interface GraphUserProfile {
  mail?: string;
  displayName?: string;
}

export class GraphApiService {
  /**
   * Fetches all messages belonging to the given Outlook conversationId,
   * ordered by received date ascending.
   */
  async getConversationMessages(conversationId: string, accessToken: string): Promise<ThreadMessage[]> {
    const filter = `conversationId eq '${conversationId}'`;
    const select = 'from,body,receivedDateTime';
    const orderby = 'receivedDateTime asc';
    const top = '20';
    const url = `${GRAPH_BASE_URL}/me/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=${encodeURIComponent(orderby)}&$top=${top}`;

    const response = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
    }

    const data: { value?: GraphMessage[] } = await response.json();
    return (data.value ?? []).map((msg) => ({
      from: msg.from?.emailAddress?.address ?? msg.from?.emailAddress?.name ?? '',
      body: msg.body?.content ?? '',
      timestamp: msg.receivedDateTime,
    }));
  }

  /**
   * Fetches the current signed-in user's display name and email.
   */
  async getCurrentUserProfile(accessToken: string): Promise<{ email: string; displayName: string }> {
    const response = await fetch(`${GRAPH_BASE_URL}/me?$select=mail,displayName`, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
    }

    const data: GraphUserProfile = await response.json();
    return {
      email: data.mail ?? '',
      displayName: data.displayName ?? '',
    };
  }
}
