import { analyzeThreadContext } from '../services/contextEngine';
import { OverlayContextPayload } from '../types';
import { ComposeSurface, getMailProviderAdapter, MailProviderAdapter } from './providerAdapters';

const TRIGGER_ATTRIBUTE = 'data-ai-email-assistant-trigger';
const SIDEBAR_ID = 'ai-email-assistant-sidebar';
const extensionOrigin = new URL(chrome.runtime.getURL('')).origin;

let activeAdapter: MailProviderAdapter = getMailProviderAdapter(window.location.hostname);
let activeSurface: ComposeSurface | null = null;
let sidebar: HTMLDivElement | null = null;
let iframe: HTMLIFrameElement | null = null;

type OverlayMessage =
  | { type: 'READY_FOR_CONTEXT' | 'REFRESH_CONTEXT' | 'OPEN_CALENDAR' }
  | { type: 'INSERT_EMAIL' | 'INSERT_SUBJECT'; text: string };

const buildOverlayPayload = (): OverlayContextPayload => {
  const fallbackSurface = activeAdapter.findComposeSurfaces()[0] ?? { root: document.body, toolbar: document.body };
  const surface = activeSurface ?? fallbackSurface;
  const threadContext = activeAdapter.extractThreadContext(surface.root);

  return {
    provider: activeAdapter.id,
    capabilities: activeAdapter.capabilities,
    threadContext,
    analysis: analyzeThreadContext(threadContext),
  };
};

const postContextToOverlay = (type: 'INIT_CONTEXT' | 'CONTEXT_REFRESHED'): void => {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage({ type, payload: buildOverlayPayload() }, extensionOrigin);
};

const ensureSidebar = (): void => {
  if (sidebar && iframe) {
    sidebar.style.display = 'block';
    postContextToOverlay('CONTEXT_REFRESHED');
    return;
  }

  sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;
  sidebar.style.position = 'fixed';
  sidebar.style.right = '0';
  sidebar.style.top = '0';
  sidebar.style.width = '420px';
  sidebar.style.height = '100%';
  sidebar.style.backgroundColor = '#111827';
  sidebar.style.boxShadow = '-2px 0 10px rgba(0,0,0,0.45)';
  sidebar.style.zIndex = '9999';
  sidebar.style.borderLeft = '1px solid #374151';
  sidebar.style.display = 'block';

  const header = document.createElement('div');
  header.style.padding = '16px';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.borderBottom = '1px solid #374151';
  const titleGroup = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = 'Email Intelligence Hub';
  title.style.color = '#60a5fa';
  title.style.margin = '0';
  title.style.fontSize = '18px';

  const subtitle = document.createElement('p');
  subtitle.textContent = `${activeAdapter.label} context engine`;
  subtitle.style.color = '#9ca3af';
  subtitle.style.margin = '4px 0 0';
  subtitle.style.fontSize = '12px';

  const closeButton = document.createElement('button');
  closeButton.id = 'close-ai-sidebar';
  closeButton.setAttribute('aria-label', 'Close assistant sidebar');
  closeButton.textContent = '×';
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.color = '#9ca3af';
  closeButton.style.cursor = 'pointer';
  closeButton.style.fontSize = '20px';

  titleGroup.appendChild(title);
  titleGroup.appendChild(subtitle);
  header.appendChild(titleGroup);
  header.appendChild(closeButton);
  sidebar.appendChild(header);

  iframe = document.createElement('iframe');
  iframe.src = `${chrome.runtime.getURL('index.html')}?extension=true&provider=${activeAdapter.id}`;
  iframe.style.width = '100%';
  iframe.style.height = 'calc(100% - 74px)';
  iframe.style.border = 'none';
  iframe.addEventListener('load', () => postContextToOverlay('INIT_CONTEXT'));
  sidebar.appendChild(iframe);

  document.body.appendChild(sidebar);

  header.querySelector('#close-ai-sidebar')?.addEventListener('click', () => {
    if (sidebar) {
      sidebar.style.display = 'none';
    }
  });
};

const createTrigger = (surface: ComposeSurface): HTMLDivElement => {
  const trigger = document.createElement('div');
  trigger.setAttribute(TRIGGER_ATTRIBUTE, 'true');
  trigger.className = 'wG J-Z-I';
  trigger.style.display = 'inline-flex';
  trigger.style.alignItems = 'center';
  trigger.style.marginLeft = '8px';
  trigger.style.cursor = 'pointer';
  trigger.title = 'Open Email Intelligence Hub';
  trigger.innerHTML = `
    <div role="button" aria-label="Open AI email assistant" class="T-I J-J5-Ji aoO v7 T-I-atl L3" style="background-color: #2563eb; color: white; border-radius: 6px; padding: 0 12px; height: 36px; display: flex; align-items: center;">
      <span style="font-weight: 700;">AI Hub</span>
    </div>
  `;

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    activeSurface = surface;
    ensureSidebar();
    postContextToOverlay('CONTEXT_REFRESHED');
  });

  return trigger;
};

const injectButtons = (): void => {
  activeAdapter = getMailProviderAdapter(window.location.hostname);

  activeAdapter.findComposeSurfaces().forEach((surface) => {
    if (surface.toolbar.querySelector(`[${TRIGGER_ATTRIBUTE}="true"]`)) {
      return;
    }

    surface.toolbar.appendChild(createTrigger(surface));
  });
};

window.addEventListener('message', (event) => {
  if (event.origin !== extensionOrigin) {
    return;
  }

  const data = event.data as OverlayMessage | undefined;
  if (!data?.type) {
    return;
  }

  const fallbackSurface = activeAdapter.findComposeSurfaces()[0] ?? { root: document.body, toolbar: document.body };
  const surface = activeSurface ?? fallbackSurface;

  switch (data.type) {
    case 'READY_FOR_CONTEXT':
    case 'REFRESH_CONTEXT':
      postContextToOverlay('CONTEXT_REFRESHED');
      break;
    case 'INSERT_EMAIL':
      if (typeof data.text === 'string') {
        activeAdapter.insertBodyText(surface.root, data.text);
      }
      break;
    case 'INSERT_SUBJECT':
      if (typeof data.text === 'string') {
        activeAdapter.insertSubject(surface.root, data.text);
      }
      break;
    case 'OPEN_CALENDAR':
      activeAdapter.openCalendar();
      break;
    default:
      break;
  }
});

const observer = new MutationObserver(() => {
  injectButtons();
});

observer.observe(document.body, { childList: true, subtree: true });
injectButtons();
