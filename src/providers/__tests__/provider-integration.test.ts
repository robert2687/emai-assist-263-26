/**
 * Per-provider integration tests.
 *
 * These verify the full adapter → thread extraction → compose insertion →
 * send flow for each supported provider against a realistic DOM fixture.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GmailAdapter } from '../GmailAdapter';
import { ZohoAdapter } from '../ZohoAdapter';
import { OutlookAdapter } from '../OutlookAdapter';

// ---------------------------------------------------------------------------
// DOM fixture builders
// ---------------------------------------------------------------------------

const buildGmailDom = ({
  subject = '',
  to = '',
  body = '',
  isReply = false,
  isForward = false,
} = {}): HTMLElement => {
  const root = document.createElement('div');
  root.className = 'M9';

  const toolbar = document.createElement('div');
  toolbar.className = 'btC';
  toolbar.setAttribute('role', 'toolbar');

  const editable = document.createElement('div');
  editable.className = 'Am Al editable';
  editable.setAttribute('contenteditable', 'true');
  editable.textContent = body;

  const subjectEl = document.createElement('input');
  subjectEl.setAttribute('name', 'subjectbox');
  const subjectValue = isForward ? `Fwd: ${subject}` : subject;
  subjectEl.value = subjectValue;

  if (isReply && !isForward) {
    const blockquote = document.createElement('blockquote');
    blockquote.textContent = 'Original message content.';
    root.appendChild(blockquote);
  }

  const toEl = document.createElement('textarea');
  toEl.setAttribute('name', 'to');
  toEl.value = to;

  const sendBtn = document.createElement('button');
  sendBtn.className = 'T-I J-J5-Ji aoO v7 T-I-atl L3';

  root.appendChild(toolbar);
  root.appendChild(editable);
  root.appendChild(subjectEl);
  root.appendChild(toEl);
  root.appendChild(sendBtn);
  return root;
};

const buildZohoDom = ({
  subject = '',
  to = '',
  body = '',
  isReply = false,
  isForward = false,
} = {}): HTMLElement => {
  const root = document.createElement('div');
  root.setAttribute('data-zcqa', 'zm_compose_container');

  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-zcqa', 'zm_compose_toolbar');

  const editable = document.createElement('div');
  editable.setAttribute('contenteditable', 'true');
  editable.setAttribute('role', 'textbox');
  editable.textContent = body;

  const subjectEl = document.createElement('input');
  subjectEl.setAttribute('name', 'subject');
  subjectEl.value = isForward ? `Fwd: ${subject}` : subject;

  if (isReply && !isForward) {
    const bq = document.createElement('blockquote');
    bq.textContent = 'Quoted text.';
    root.appendChild(bq);
  }

  const toEl = document.createElement('input');
  toEl.setAttribute('name', 'to');
  toEl.value = to;

  const sendBtn = document.createElement('button');
  sendBtn.setAttribute('data-zcqa', 'zm_sendbtn');

  root.appendChild(toolbar);
  root.appendChild(editable);
  root.appendChild(subjectEl);
  root.appendChild(toEl);
  root.appendChild(sendBtn);
  return root;
};

const buildOutlookDom = ({
  subject = '',
  to = '',
  body = '',
  isReply = false,
  isForward = false,
} = {}): HTMLElement => {
  const root = document.createElement('div');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Message');

  const toolbar = document.createElement('div');
  toolbar.setAttribute('role', 'toolbar');

  const editable = document.createElement('div');
  editable.setAttribute('contenteditable', 'true');
  editable.setAttribute('aria-label', 'Message body');
  editable.textContent = body;

  const subjectEl = document.createElement('input');
  subjectEl.setAttribute('aria-label', 'Add a subject');
  subjectEl.value = isForward ? `Fw: ${subject}` : subject;

  if (isReply && !isForward) {
    const bq = document.createElement('blockquote');
    bq.textContent = 'Quoted message.';
    root.appendChild(bq);
  }

  const toEl = document.createElement('input');
  toEl.setAttribute('aria-label', 'To');
  toEl.value = to;

  const sendBtn = document.createElement('button');
  sendBtn.setAttribute('aria-label', 'Send');

  root.appendChild(toolbar);
  root.appendChild(editable);
  root.appendChild(subjectEl);
  root.appendChild(toEl);
  root.appendChild(sendBtn);
  return root;
};

// ---------------------------------------------------------------------------
// Gmail integration
// ---------------------------------------------------------------------------

describe('GmailAdapter — integration', () => {
  let adapter: GmailAdapter;

  beforeEach(() => {
    document.body.innerHTML = '';
    adapter = new GmailAdapter();
  });

  describe('compose mode detection', () => {
    it('returns "new" for a blank compose window', () => {
      const root = buildGmailDom({ subject: 'Hello' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getComposeMode()).toBe('new');
    });

    it('returns "forward" when subject starts with "Fwd:"', () => {
      const root = buildGmailDom({ subject: 'Meeting', isForward: true });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getComposeMode()).toBe('forward');
    });

    it('returns "reply" when a blockquote (quoted message) is present', () => {
      const root = buildGmailDom({ subject: 'Re: Meeting', isReply: true });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getComposeMode()).toBe('reply');
    });
  });

  describe('thread data extraction', () => {
    it('extracts subject correctly', () => {
      const root = buildGmailDom({ subject: 'Project update' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getThread().subject).toBe('Project update');
    });

    it('extracts participants from the To field', () => {
      const root = buildGmailDom({ to: 'alice@example.com, bob@example.com' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const { participants } = adapter.getThread();
      expect(participants).toContain('alice@example.com');
      expect(participants).toContain('bob@example.com');
    });

    it('includes the current draft body in messages', () => {
      const root = buildGmailDom({ body: 'Draft body content' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const { messages } = adapter.getThread();
      expect(messages.some((m) => m.body.includes('Draft body content'))).toBe(true);
    });

    it('includes quoted messages from blockquotes', () => {
      const root = buildGmailDom({ isReply: true });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const { messages } = adapter.getThread();
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('compose insertion', () => {
    it('sets innerHTML of the editable area', () => {
      const root = buildGmailDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      adapter.insertIntoComposer('<p>Inserted text</p>');
      const editable = root.querySelector('.Am.Al.editable');
      expect(editable?.innerHTML).toContain('Inserted text');
    });

    it('strips script tags from inserted HTML', () => {
      const root = buildGmailDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      adapter.insertIntoComposer('<p>OK</p><script>evil()</script>');
      const editable = root.querySelector('.Am.Al.editable');
      expect(editable?.querySelector('script')).toBeNull();
    });
  });

  describe('send flow', () => {
    it('sendEmail with sendImmediately=false does not click send button', async () => {
      const root = buildGmailDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const sendBtn = root.querySelector<HTMLButtonElement>('.T-I.J-J5-Ji.aoO');
      const clickSpy = vi.spyOn(sendBtn!, 'click');
      await adapter.sendEmail({ sendImmediately: false });
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('sendEmail with html payload inserts the content', async () => {
      const root = buildGmailDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      await adapter.sendEmail({ html: '<p>Sent body</p>', sendImmediately: false });
      const editable = root.querySelector('.Am.Al.editable');
      expect(editable?.innerHTML).toContain('Sent body');
    });
  });
});

// ---------------------------------------------------------------------------
// ZohoAdapter — integration
// ---------------------------------------------------------------------------

describe('ZohoAdapter — integration', () => {
  let adapter: ZohoAdapter;

  beforeEach(() => {
    document.body.innerHTML = '';
    adapter = new ZohoAdapter();
  });

  describe('compose mode detection', () => {
    it('returns "new" for a blank compose window', () => {
      const root = buildZohoDom({ subject: 'Hello' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getComposeMode()).toBe('new');
    });

    it('returns "forward" when subject starts with "Fwd:"', () => {
      const root = buildZohoDom({ subject: 'Proposal', isForward: true });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getComposeMode()).toBe('forward');
    });

    it('returns "reply" when a blockquote is present', () => {
      const root = buildZohoDom({ isReply: true });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getComposeMode()).toBe('reply');
    });
  });

  describe('thread data extraction', () => {
    it('extracts subject correctly', () => {
      const root = buildZohoDom({ subject: 'Zoho project' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getThread().subject).toBe('Zoho project');
    });

    it('extracts participants from the To field', () => {
      const root = buildZohoDom({ to: 'a@zoho.com; b@zoho.com' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const { participants } = adapter.getThread();
      expect(participants).toContain('a@zoho.com');
      expect(participants).toContain('b@zoho.com');
    });

    it('includes current draft body in messages', () => {
      const root = buildZohoDom({ body: 'Zoho draft content' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const { messages } = adapter.getThread();
      expect(messages.some((m) => m.body.includes('Zoho draft content'))).toBe(true);
    });
  });

  describe('compose insertion', () => {
    it('sets innerHTML of the editable area', () => {
      const root = buildZohoDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      adapter.insertIntoComposer('<p>Zoho inserted</p>');
      const editable = root.querySelector('[contenteditable="true"]');
      expect(editable?.innerHTML).toContain('Zoho inserted');
    });

    it('strips script tags from inserted HTML', () => {
      const root = buildZohoDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      adapter.insertIntoComposer('<b>Safe</b><script>evil()</script>');
      const editable = root.querySelector('[contenteditable="true"]');
      expect(editable?.querySelector('script')).toBeNull();
    });
  });

  describe('send flow', () => {
    it('sendEmail with sendImmediately=false resolves without clicking send', async () => {
      const root = buildZohoDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const sendBtn = root.querySelector<HTMLButtonElement>('[data-zcqa="zm_sendbtn"]');
      const clickSpy = vi.spyOn(sendBtn!, 'click');
      await adapter.sendEmail({ sendImmediately: false });
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// OutlookAdapter — integration
// ---------------------------------------------------------------------------

describe('OutlookAdapter — integration', () => {
  let adapter: OutlookAdapter;

  beforeEach(() => {
    document.body.innerHTML = '';
    adapter = new OutlookAdapter();
  });

  describe('compose mode detection', () => {
    it('returns "new" for a blank compose window', () => {
      const root = buildOutlookDom({ subject: 'Hello' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getComposeMode()).toBe('new');
    });

    it('returns "forward" when subject starts with "Fw:"', () => {
      const root = buildOutlookDom({ subject: 'Budget', isForward: true });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getComposeMode()).toBe('forward');
    });

    it('returns "reply" when a blockquote is present', () => {
      const root = buildOutlookDom({ isReply: true });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getComposeMode()).toBe('reply');
    });
  });

  describe('thread data extraction', () => {
    it('extracts subject correctly', () => {
      const root = buildOutlookDom({ subject: 'Outlook project' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(adapter.getThread().subject).toBe('Outlook project');
    });

    it('extracts participants from the To field', () => {
      const root = buildOutlookDom({ to: 'x@outlook.com; y@outlook.com' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const { participants } = adapter.getThread();
      expect(participants).toContain('x@outlook.com');
      expect(participants).toContain('y@outlook.com');
    });

    it('includes current draft body in messages', () => {
      const root = buildOutlookDom({ body: 'Outlook draft body' });
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const { messages } = adapter.getThread();
      expect(messages.some((m) => m.body.includes('Outlook draft body'))).toBe(true);
    });
  });

  describe('compose insertion', () => {
    it('sets innerHTML of the editable area', () => {
      const root = buildOutlookDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      adapter.insertIntoComposer('<p>Outlook inserted</p>');
      const editable = root.querySelector('[contenteditable="true"]');
      expect(editable?.innerHTML).toContain('Outlook inserted');
    });

    it('strips script tags from inserted HTML', () => {
      const root = buildOutlookDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      adapter.insertIntoComposer('<em>OK</em><script>evil()</script>');
      const editable = root.querySelector('[contenteditable="true"]');
      expect(editable?.querySelector('script')).toBeNull();
    });
  });

  describe('send flow', () => {
    it('sendEmail with sendImmediately=false resolves without clicking send', async () => {
      const root = buildOutlookDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const sendBtn = root.querySelector<HTMLButtonElement>('[aria-label="Send"]');
      const clickSpy = vi.spyOn(sendBtn!, 'click');
      await adapter.sendEmail({ sendImmediately: false });
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('sendEmail with html payload inserts before send', async () => {
      const root = buildOutlookDom();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      await adapter.sendEmail({ html: '<p>Outlook sent body</p>', sendImmediately: false });
      const editable = root.querySelector('[contenteditable="true"]');
      expect(editable?.innerHTML).toContain('Outlook sent body');
    });
  });
});
