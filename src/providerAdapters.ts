import {
  ComposeMode,
  ProviderCapabilities,
  ProviderId,
  ThreadContext,
  ThreadParticipant,
} from '../types';

export interface ComposeSurface {
  root: HTMLElement;
  toolbar: HTMLElement;
}

export interface MailProviderAdapter {
  id: ProviderId;
  label: string;
  capabilities: ProviderCapabilities;
  findComposeSurfaces(): ComposeSurface[];
  extractThreadContext(root: HTMLElement): ThreadContext;
  insertBodyText(root: HTMLElement, text: string): void;
  insertSubject(root: HTMLElement, text: string): void;
  openCalendar(): void;
}

interface ProviderDomConfig {
  id: ProviderId;
  label: string;
  hostPatterns: RegExp[];
  composeRootSelectors: string[];
  toolbarSelectors: string[];
  bodySelectors: string[];
  subjectSelectors: string[];
  replyIndicators: string[];
  forwardIndicators: string[];
  participantsSelector?: string[];
  calendarUrl: string;
  capabilities: ProviderCapabilities;
}

const PROVIDER_CONFIGS: ProviderDomConfig[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    hostPatterns: [/mail\.google\.com$/i],
    composeRootSelectors: ['.M9', '[role="dialog"][aria-label*="New Message"]'],
    toolbarSelectors: ['.btC', '[role="toolbar"]'],
    bodySelectors: ['.Am.Al.editable', '[contenteditable="true"][g_editable="true"]'],
    subjectSelectors: ['input[name="subjectbox"]'],
    replyIndicators: ['reply'],
    forwardIndicators: ['forward'],
    participantsSelector: ['.gD', '.go span[email]'],
    calendarUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit',
    capabilities: {
      smartReply: true,
      templates: true,
      signature: true,
      summaryInsert: true,
      subjectSuggestions: true,
      scheduleSend: false,
      calendarAdd: true,
    },
  },
  {
    id: 'outlook',
    label: 'Outlook',
    hostPatterns: [/outlook\.office\.com$/i, /outlook\.live\.com$/i],
    composeRootSelectors: ['[role="dialog"]', '[data-app-section="MailCompose"]'],
    toolbarSelectors: ['[role="toolbar"]'],
    bodySelectors: [
      '[contenteditable="true"][aria-label*="Message body"]',
      'div[role="textbox"][contenteditable="true"]',
    ],
    subjectSelectors: [
      'input[aria-label*="Add a subject"]',
      'input[placeholder*="Add a subject"]',
    ],
    replyIndicators: ['reply'],
    forwardIndicators: ['forward'],
    participantsSelector: ['[data-email-address]', '.wellItemText'],
    calendarUrl: 'https://outlook.office.com/calendar/0/deeplink/compose',
    capabilities: {
      smartReply: true,
      templates: true,
      signature: true,
      summaryInsert: true,
      subjectSuggestions: true,
      scheduleSend: false,
      calendarAdd: true,
    },
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    hostPatterns: [/mail\.zoho\.com$/i],
    composeRootSelectors: ['.zmail-compose', '[data-zcqa="composePopup"]', '[role="dialog"]'],
    toolbarSelectors: ['[data-zcqa="composer_toolbar"]', '[role="toolbar"]'],
    bodySelectors: ['[contenteditable="true"]', 'textarea'],
    subjectSelectors: ['input[name="subject"]', 'input[placeholder*="Subject"]'],
    replyIndicators: ['reply'],
    forwardIndicators: ['forward'],
    participantsSelector: ['[email]', '.zbfield'],
    calendarUrl: 'https://calendar.zoho.com',
    capabilities: {
      smartReply: true,
      templates: true,
      signature: true,
      summaryInsert: true,
      subjectSuggestions: true,
      scheduleSend: false,
      calendarAdd: true,
    },
  },
];

const FALLBACK_CONFIG: ProviderDomConfig = {
  id: 'fallback',
  label: 'Webmail',
  hostPatterns: [/.*/],
  composeRootSelectors: ['[role="dialog"]', 'form', 'body'],
  toolbarSelectors: ['[role="toolbar"]', 'body'],
  bodySelectors: ['[contenteditable="true"]', 'textarea'],
  subjectSelectors: ['input[name*="subject" i]', 'input[placeholder*="subject" i]'],
  replyIndicators: ['reply'],
  forwardIndicators: ['forward'],
  participantsSelector: ['[email]', '[data-email-address]'],
  calendarUrl: 'https://calendar.google.com/calendar/u/0/r/eventedit',
  capabilities: {
    smartReply: true,
    templates: true,
    signature: true,
    summaryInsert: true,
    subjectSuggestions: true,
    scheduleSend: false,
    calendarAdd: true,
  },
};

const queryFirst = (root: ParentNode, selectors: string[]): HTMLElement | null => {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }

  return null;
};

const queryAllUnique = (root: ParentNode, selectors: string[]): HTMLElement[] => {
  const results = new Set<HTMLElement>();

  selectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((element) => {
      if (element instanceof HTMLElement) {
        results.add(element);
      }
    });
  });

  return Array.from(results);
};

const getEditableText = (element: HTMLElement | null): string => {
  if (!element) {
    return '';
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value.trim();
  }

  return element.innerText.trim();
};

const dispatchTextInput = (element: HTMLElement): void => {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

const setEditableText = (element: HTMLElement | null, text: string): void => {
  if (!element) {
    return;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = text;
    dispatchTextInput(element);
    return;
  }

  element.textContent = '';
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    element.appendChild(document.createTextNode(line));
    if (index < lines.length - 1) {
      element.appendChild(document.createElement('br'));
    }
  });
  dispatchTextInput(element);
};

const getComposeMode = (root: HTMLElement, config: ProviderDomConfig): ComposeMode => {
  const contextText = `${root.getAttribute('aria-label') ?? ''} ${root.innerText}`.toLowerCase();

  if (config.forwardIndicators.some((indicator) => contextText.includes(indicator))) {
    return 'forward';
  }

  if (config.replyIndicators.some((indicator) => contextText.includes(indicator))) {
    return 'reply';
  }

  return 'new';
};

const extractParticipants = (root: HTMLElement, config: ProviderDomConfig): ThreadParticipant[] => {
  const selectors = config.participantsSelector ?? [];
  const participants = queryAllUnique(root, selectors)
    .map((element) => {
      const name = (
        element.getAttribute('name')
        || element.getAttribute('data-email-address')
        || element.getAttribute('email')
        || element.textContent
        || ''
      ).trim();
      const email = element.getAttribute('email') || element.getAttribute('data-email-address') || undefined;

      return name ? { name, email } : null;
    })
    .filter((participant): participant is ThreadParticipant => participant !== null);

  return participants.slice(0, 5);
};

const extractLastMessage = (threadText: string): string => {
  const paragraphs = threadText
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs[paragraphs.length - 1] ?? '';
};

const createAdapter = (config: ProviderDomConfig): MailProviderAdapter => ({
  id: config.id,
  label: config.label,
  capabilities: config.capabilities,
  findComposeSurfaces(): ComposeSurface[] {
    const roots = queryAllUnique(document, config.composeRootSelectors);
    const surfaces = roots
      .map((root) => {
        const toolbar = queryFirst(root, config.toolbarSelectors) ?? queryFirst(document, config.toolbarSelectors);
        if (!toolbar) {
          return null;
        }

        return { root, toolbar };
      })
      .filter((surface): surface is ComposeSurface => surface !== null);

    if (surfaces.length > 0) {
      return surfaces;
    }

    const fallbackToolbar = queryFirst(document, config.toolbarSelectors) ?? document.body;
    return [{ root: document.body, toolbar: fallbackToolbar }];
  },
  extractThreadContext(root: HTMLElement): ThreadContext {
    const body = queryFirst(root, config.bodySelectors) ?? queryFirst(document, config.bodySelectors);
    const subject = getEditableText(queryFirst(root, config.subjectSelectors) ?? queryFirst(document, config.subjectSelectors));
    const threadText = getEditableText(body) || root.innerText.trim();

    return {
      provider: config.id,
      composeMode: getComposeMode(root, config),
      subject,
      participants: extractParticipants(root, config),
      lastMessage: extractLastMessage(threadText),
      threadText,
    };
  },
  insertBodyText(root: HTMLElement, text: string): void {
    const body = queryFirst(root, config.bodySelectors) ?? queryFirst(document, config.bodySelectors);
    setEditableText(body, text);
  },
  insertSubject(root: HTMLElement, text: string): void {
    const subject = queryFirst(root, config.subjectSelectors) ?? queryFirst(document, config.subjectSelectors);
    setEditableText(subject, text);
  },
  openCalendar(): void {
    window.open(config.calendarUrl, '_blank', 'noopener,noreferrer');
  },
});

export const getMailProviderAdapter = (hostname: string): MailProviderAdapter => {
  const config = PROVIDER_CONFIGS.find(({ hostPatterns }) =>
    hostPatterns.some((pattern) => pattern.test(hostname)),
  );

  return createAdapter(config ?? FALLBACK_CONFIG);
};
