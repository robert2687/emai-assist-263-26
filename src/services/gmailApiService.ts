import { ThreadData, ThreadMessage } from "../providers/types";

declare const chrome: {
  identity: {
    getAuthToken(
      details: { interactive: boolean },
      callback: (token: string | undefined) => void,
    ): void;
  };
  runtime: {
    lastError?: { message?: string };
    sendMessage(
      message: GmailThreadRequest,
      callback: (response?: GmailThreadResponse) => void,
    ): void;
  };
};

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1/users/me";

interface GmailApiHeader {
  name: string;
  value: string;
}

interface GmailApiMessagePart {
  mimeType: string;
  body: { data?: string; size?: number };
  parts?: GmailApiMessagePart[];
}

interface GmailApiMessage {
  id: string;
  internalDate: string;
  payload: {
    headers: GmailApiHeader[];
    body?: { data?: string };
    parts?: GmailApiMessagePart[];
  };
}

export interface GmailApiThread {
  id: string;
  messages: GmailApiMessage[];
}

export interface GmailThreadRequest {
  type: "GET_GMAIL_THREAD";
  threadId: string;
}

export interface GmailThreadResponse {
  thread?: GmailApiThread;
  error?: string;
}

function getHeader(headers: GmailApiHeader[], name: string): string {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + paddingLength, "=");

  try {
    return decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch {
    return atob(padded);
  }
}

function htmlToPlainText(html: string): string {
  const documentRoot = new DOMParser().parseFromString(html, "text/html");
  return documentRoot.body.textContent?.trim() ?? "";
}

function extractTextFromPart(part: GmailApiMessagePart): string {
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return htmlToPlainText(decodeBase64Url(part.body.data));
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      const text = extractTextFromPart(subPart);
      if (text) return text;
    }
  }
  return "";
}

function extractMessageBody(msg: GmailApiMessage): string {
  if (msg.payload.body?.data) {
    return decodeBase64Url(msg.payload.body.data);
  }
  if (msg.payload.parts) {
    for (const part of msg.payload.parts) {
      const text = extractTextFromPart(part);
      if (text) return text;
    }
  }
  return "";
}

export function parseGmailApiThread(thread: GmailApiThread): ThreadData {
  const messages = thread.messages ?? [];

  const subject =
    messages.length > 0
      ? getHeader(messages[0].payload.headers, "Subject")
      : "";

  const participantSet = new Set<string>();
  for (const msg of messages) {
    const from = getHeader(msg.payload.headers, "From");
    const to = getHeader(msg.payload.headers, "To");
    if (from) participantSet.add(from);
    if (to) {
      to.split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((p) => participantSet.add(p));
    }
  }

  const threadMessages: ThreadMessage[] = messages.map((msg) => ({
    from: getHeader(msg.payload.headers, "From") || undefined,
    timestamp: msg.internalDate
      ? new Date(parseInt(msg.internalDate, 10)).toISOString()
      : undefined,
    body: extractMessageBody(msg),
  }));

  return {
    subject,
    participants: Array.from(participantSet),
    messages: threadMessages,
  };
}

/**
 * Acquires an OAuth2 access token via the Chrome Extensions Identity API
 * (chrome.identity.getAuthToken). Prompts the user interactively if no
 * cached token is available.
 */
export function getGmailAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (token) {
        resolve(token);
      } else {
        const reason = chrome.runtime.lastError?.message ?? 'unknown reason';
        reject(new Error(`Failed to acquire Gmail auth token: ${reason}`));
      }
    });
  });
}

/**
 * Extracts the Gmail thread ID from the current page URL hash.
 * Gmail URL format: https://mail.google.com/mail/u/0/#inbox/<hexThreadId>
 */
export function getThreadIdFromUrl(): string | null {
  const match = window.location.hash.match(/#(?:[^/]+\/)*([0-9a-f]{6,})(?:$|\/)/i);
  return match ? match[1] : null;
}

export function requestGmailThread(threadId: string): Promise<GmailApiThread> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "GET_GMAIL_THREAD", threadId },
      (response) => {
        const runtimeError = chrome.runtime.lastError?.message;
        if (runtimeError) {
          reject(new Error(`Failed to fetch Gmail thread: ${runtimeError}`));
          return;
        }

        if (!response?.thread) {
          reject(new Error(response?.error ?? `Background service returned no thread data for ${threadId}.`));
          return;
        }

        resolve(response.thread);
      },
    );
  });
}

/**
 * Fetches a Gmail thread via the Gmail REST API and returns a
 * provider-agnostic ThreadData object.
 */
export async function fetchGmailThread(
  threadId: string,
  token: string,
): Promise<GmailApiThread> {
  const url = `${GMAIL_API_BASE}/threads/${encodeURIComponent(threadId)}?format=full`;
  const authScheme = "Bearer";
  const response = await fetch(url, {
    headers: { Authorization: `${authScheme} ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchGmailThreadData(
  threadId: string,
  token: string,
): Promise<ThreadData> {
  return parseGmailApiThread(await fetchGmailThread(threadId, token));
}
