
import { analyzeThreadContext } from './context/contextEngineV2';
import { createProviderAdapter } from './providers/createProviderAdapter';
import { ProviderAdapter } from './providers/types';

const AI_BUTTON_ATTR = 'data-ai-email-assistant';
const SIDEBAR_ID = 'ai-email-assistant-sidebar';

declare const chrome: {
  runtime: {
    getURL(path: string): string;
  };
};

type OverlayMessage =
  | { type: 'INSERT_EMAIL'; text: string }
  | { type: 'SEND_EMAIL'; payload?: { html?: string; sendImmediately?: boolean } }
  | { type: 'REQUEST_THREAD_CONTEXT' }
  | { type: 'RUN_CONTEXT_ENGINE' }
  | { type: 'SET_SUBJECT'; text: string }
  | { type: 'OPEN_CALENDAR'; title?: string; startDateTime?: string };

const postMessageToSource = (source: MessageEventSource | null, payload: unknown): void => {
  if (source && 'postMessage' in source) {
    (source as WindowProxy).postMessage(payload, { targetOrigin: '*' });
    return;
  }

  window.postMessage(payload, { targetOrigin: '*' });
};

class UniversalComposerOverlay {
  private readonly adapter: ProviderAdapter;
  private sidebar: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private iframeReady = false;

  constructor(adapter: ProviderAdapter) {
    this.adapter = adapter;
    window.addEventListener('message', this.handleWindowMessage);
  }

  mountForProvider(): void {
    this.injectAssistantButtons();
  }

  private async getActiveThread() {
    return this.adapter.getThreadAsync
      ? this.adapter.getThreadAsync()
      : this.adapter.getThread();
  }

  private getSidebarTargetOrigin(): string | null {
    if (!this.iframe?.src) return null;
    try {
      return new URL(this.iframe.src).origin;
    } catch {
      return null;
    }
  }

  private async pushInitialContextToSidebar(): Promise<void> {
    if (!this.iframe?.contentWindow) return;
    const thread = await this.getActiveThread();
    const provider = this.adapter.getProviderName();
    const composeMode = this.adapter.getComposeMode();
    const analysis = analyzeThreadContext(thread);
    const targetOrigin = this.getSidebarTargetOrigin();
    if (!targetOrigin) return;

    this.iframe.contentWindow.postMessage({
      type: 'THREAD_CONTEXT_RESPONSE',
      provider,
      composeMode,
      thread,
    }, targetOrigin);

    this.iframe.contentWindow.postMessage({
      type: 'CONTEXT_ENGINE_RESPONSE',
      provider,
      composeMode,
      thread,
      analysis,
    }, targetOrigin);
  }

  private pushInitialContextToSidebarSafely(): void {
    void this.pushInitialContextToSidebar().catch((error) => {
      console.error('[UniversalComposerOverlay] Failed to push initial context:', error);
    });
  }

  private injectAssistantButtons(): void {
    this.adapter.findComposeRoots().forEach((composeRoot, index) => {
      const toolbar = this.adapter.getToolbarForCompose(composeRoot);
      if (!toolbar) return;

      const existing = toolbar.querySelector<HTMLElement>(`[${AI_BUTTON_ATTR}="true"]`);
      if (existing) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute(AI_BUTTON_ATTR, 'true');
      button.dataset.composeIndex = String(index);
      button.title = 'AI Email Assistant';
      button.textContent = 'AI Write';
      button.style.marginLeft = '8px';
      button.style.padding = '0 12px';
      button.style.height = '32px';
      button.style.border = 'none';
      button.style.borderRadius = '6px';
      button.style.cursor = 'pointer';
      button.style.background = '#2563eb';
      button.style.color = '#fff';
      button.style.fontWeight = '700';

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.adapter.setActiveComposeRoot(composeRoot);
        this.showSidebar();
      });

      toolbar.appendChild(button);
    });
  }

  private showSidebar(): void {
    if (!this.sidebar) {
      this.sidebar = document.createElement('div');
      this.sidebar.id = SIDEBAR_ID;
      this.sidebar.style.position = 'fixed';
      this.sidebar.style.right = '0';
      this.sidebar.style.top = '0';
      this.sidebar.style.width = '420px';
      this.sidebar.style.height = '100%';
      this.sidebar.style.backgroundColor = '#111827';
      this.sidebar.style.boxShadow = '-2px 0 10px rgba(0,0,0,0.5)';
      this.sidebar.style.zIndex = '9999';
      this.sidebar.style.borderLeft = '1px solid #374151';

      const header = document.createElement('div');
      header.style.padding = '14px 16px';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.borderBottom = '1px solid #374151';
      header.innerHTML = `
        <h2 style="color: #60a5fa; margin: 0; font-size: 18px;">AI Email Assistant (${this.adapter.getProviderName()})</h2>
        <button id="close-ai-sidebar" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 20px;">&times;</button>
      `;

      this.iframe = document.createElement('iframe');
      this.iframe.src = `${chrome.runtime.getURL('index.html')}?extension=true&provider=${encodeURIComponent(this.adapter.getProviderName())}`;
      this.iframe.style.width = '100%';
      this.iframe.style.height = 'calc(100% - 54px)';
      this.iframe.style.border = 'none';
      this.iframe.addEventListener('load', () => {
        this.iframeReady = true;
        this.pushInitialContextToSidebarSafely();
      });

      this.sidebar.appendChild(header);
      this.sidebar.appendChild(this.iframe);
      document.body.appendChild(this.sidebar);

      header.querySelector('#close-ai-sidebar')?.addEventListener('click', () => {
        if (this.sidebar) {
          this.sidebar.style.display = 'none';
        }
      });
    }

    this.sidebar.style.display = 'block';
    if (this.iframeReady) {
      this.pushInitialContextToSidebarSafely();
    }
  }

  private readonly handleWindowMessage = async (event: MessageEvent<OverlayMessage>) => {
    if (!event?.data || typeof event.data !== 'object') return;

    try {
      switch (event.data.type) {
        case 'INSERT_EMAIL': {
          this.adapter.insertIntoComposer(event.data.text);
          break;
        }
        case 'SEND_EMAIL': {
          await this.adapter.sendEmail(event.data.payload);
          break;
        }
        case 'REQUEST_THREAD_CONTEXT': {
          const thread = await this.getActiveThread();
          postMessageToSource(event.source, {
            type: 'THREAD_CONTEXT_RESPONSE',
            provider: this.adapter.getProviderName(),
            composeMode: this.adapter.getComposeMode(),
            thread,
          });
          break;
        }
        case 'RUN_CONTEXT_ENGINE': {
          const thread = await this.getActiveThread();
          const analysis = analyzeThreadContext(thread);
          postMessageToSource(event.source, {
            type: 'CONTEXT_ENGINE_RESPONSE',
            provider: this.adapter.getProviderName(),
            composeMode: this.adapter.getComposeMode(),
            thread,
            analysis,
          });
          break;
        }
        case 'SET_SUBJECT': {
          this.adapter.setSubject(event.data.text);
          break;
        }
        case 'OPEN_CALENDAR': {
          this.adapter.openCalendar(event.data.title, event.data.startDateTime);
          break;
        }
        default:
          break;
      }
    } catch (error) {
      postMessageToSource(event.source, {
        type: 'AI_ASSISTANT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown overlay error.',
      });
    }
  };
}

const adapter = createProviderAdapter();

if (adapter) {
  const overlay = new UniversalComposerOverlay(adapter);
  const observer = new MutationObserver(() => {
    overlay.mountForProvider();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  overlay.mountForProvider();
}
