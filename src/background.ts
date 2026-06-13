import {
  fetchGmailThread,
  getGmailAuthToken,
  GmailThreadRequest,
  GmailThreadResponse,
} from "./services/gmailApiService";

declare const chrome: {
  runtime: {
    onMessage: {
      addListener(
        listener: (
          message: GmailThreadRequest,
          sender: unknown,
          sendResponse: (response: GmailThreadResponse) => void,
        ) => boolean | void,
      ): void;
    };
  };
};

async function handleGmailThreadRequest(threadId: string): Promise<GmailThreadResponse> {
  try {
    const token = await getGmailAuthToken();
    const thread = await fetchGmailThread(threadId, token);
    return { thread };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown Gmail API error.",
    };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_GMAIL_THREAD") {
    return false;
  }

  void handleGmailThreadRequest(message.threadId).then(sendResponse);

  return true;
});
