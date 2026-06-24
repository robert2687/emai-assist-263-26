/**
 * Taskpane entry point for the Outlook Web Add-in.
 *
 * This module:
 *  1. Waits for `Office.onReady` before touching any Office.js API.
 *  2. Initialises MSAL and the Graph API service.
 *  3. Creates an `OutlookOfficeJsAdapter` and loads the first thread context.
 *  4. Registers an `ItemChanged` handler so context refreshes when the user
 *     switches items.
 *  5. Renders the existing `App` component in "extension mode", passing
 *     `?extension=true&provider=outlook-officejs` as synthetic query params so
 *     the App's postMessage contract works without any App-side changes.
 *  6. Bridges the App's `window.parent.postMessage` calls — which resolve to
 *     `window.postMessage` when there is no parent frame — back to the adapter.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import App from '../App';
import { MsalAuthService } from './services/msalAuthService';
import { GraphApiService } from './services/graphApiService';
import { OutlookOfficeJsAdapter } from './providers/OutlookOfficeJsAdapter';
import { analyzeThreadContext } from './context/contextEngineV2';

// These env vars must be set at build time via `VITE_MSAL_CLIENT_ID` and
// `VITE_MSAL_TENANT_ID` in the project's .env file.
const env = import.meta.env as Record<string, string>;
const MSAL_CLIENT_ID = env.VITE_MSAL_CLIENT_ID ?? '';
const MSAL_TENANT_ID = env.VITE_MSAL_TENANT_ID ?? 'common';

// Inject synthetic query params so App initialises in extension mode.
(function patchSearchParams() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('extension')) {
    url.searchParams.set('extension', 'true');
    url.searchParams.set('provider', 'outlook-officejs');
    window.history.replaceState(null, '', url.toString());
  }
})();

type OverlayMessage =
  | { type: 'INSERT_EMAIL'; text: string }
  | { type: 'SEND_EMAIL'; payload?: { html?: string; sendImmediately?: boolean } }
  | { type: 'REQUEST_THREAD_CONTEXT' }
  | { type: 'RUN_CONTEXT_ENGINE' }
  | { type: 'SET_SUBJECT'; text: string }
  | { type: 'OPEN_CALENDAR'; title?: string; startDateTime?: string };

/** Installs the message bridge between App's postMessage calls and the adapter. */
function installMessageBridge(adapter: OutlookOfficeJsAdapter): void {
  window.addEventListener('message', async (event: MessageEvent<OverlayMessage>) => {
    if (!event?.data || typeof event.data !== 'object') return;

    const reply = (payload: unknown) => {
      // When window.parent === window, event.source is also window.
      if (event.source && 'postMessage' in event.source) {
        (event.source as WindowProxy).postMessage(payload, { targetOrigin: '*' });
        return;
      }

      window.postMessage(payload, { targetOrigin: '*' });
    };

    try {
      switch (event.data.type) {
        case 'INSERT_EMAIL': {
          adapter.insertIntoComposer(event.data.text);
          break;
        }
        case 'SEND_EMAIL': {
          await adapter.sendEmail(event.data.payload);
          break;
        }
        case 'REQUEST_THREAD_CONTEXT': {
          await adapter.loadThreadContext();
          reply({
            type: 'THREAD_CONTEXT_RESPONSE',
            provider: adapter.getProviderName(),
            composeMode: adapter.getComposeMode(),
            thread: adapter.getThread(),
          });
          break;
        }
        case 'RUN_CONTEXT_ENGINE': {
          await adapter.loadThreadContext();
          const thread = adapter.getThread();
          const analysis = analyzeThreadContext(thread);
          reply({
            type: 'CONTEXT_ENGINE_RESPONSE',
            provider: adapter.getProviderName(),
            composeMode: adapter.getComposeMode(),
            thread,
            analysis,
          });
          break;
        }
        case 'SET_SUBJECT': {
          adapter.setSubject(event.data.text);
          break;
        }
        case 'OPEN_CALENDAR': {
          adapter.openCalendar(event.data.title, event.data.startDateTime);
          break;
        }
        default:
          break;
      }
    } catch (error) {
      reply({
        type: 'AI_ASSISTANT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown taskpane error.',
      });
    }
  });
}

Office.onReady(async () => {
  const authService = new MsalAuthService(MSAL_CLIENT_ID, MSAL_TENANT_ID);
  const graphService = new GraphApiService();
  const adapter = new OutlookOfficeJsAdapter(authService, graphService);

  await authService.initialize();

  // Refresh context whenever the user selects a different item.
  Office.context.mailbox.addHandlerAsync(
    Office.EventType.ItemChanged,
    async () => {
      await adapter.loadThreadContext();
    },
  );

  // Pre-load context for the currently open item.
  await adapter.loadThreadContext();

  installMessageBridge(adapter);

  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
