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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_GMAIL_THREAD") {
    return undefined;
  }

  void (async () => {
    try {
      const token = await getGmailAuthToken();
      const thread = await fetchGmailThread(message.threadId, token);
      sendResponse({ thread });
    } catch (error) {
      sendResponse({
        error: error instanceof Error ? error.message : "Unknown Gmail API error.",
      });
    }
  })();

  return true;
});
