/**
 * Contract tests — every ProviderAdapter implementation must satisfy these.
 *
 * A "contract test" verifies structural compliance (the adapter exposes all
 * required methods with the right signatures and return shapes) without
 * depending on a real browser environment.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GmailAdapter } from '../GmailAdapter';
import { ZohoAdapter } from '../ZohoAdapter';
import { OutlookAdapter } from '../OutlookAdapter';
import type { ProviderAdapter, ComposeMode, ProviderName } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal compose-root element that satisfies each adapter's selectors. */
const buildGmailRoot = (): HTMLElement => {
  const root = document.createElement('div');
  root.className = 'M9';

  const toolbar = document.createElement('div');
  toolbar.className = 'btC';
  toolbar.setAttribute('role', 'toolbar');

  const editable = document.createElement('div');
  editable.className = 'Am Al editable';
  editable.setAttribute('contenteditable', 'true');
  editable.textContent = 'Hello, please review this.';

  const subject = document.createElement('input');
  subject.setAttribute('name', 'subjectbox');
  subject.value = 'Test subject';

  root.appendChild(toolbar);
  root.appendChild(editable);
  root.appendChild(subject);
  return root;
};

const buildZohoRoot = (): HTMLElement => {
  const root = document.createElement('div');
  root.setAttribute('data-zcqa', 'zm_compose_container');

  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-zcqa', 'zm_compose_toolbar');

  const editable = document.createElement('div');
  editable.setAttribute('contenteditable', 'true');
  editable.setAttribute('role', 'textbox');
  editable.textContent = 'Zoho draft body.';

  const subject = document.createElement('input');
  subject.setAttribute('name', 'subject');
  subject.value = 'Zoho subject';

  root.appendChild(toolbar);
  root.appendChild(editable);
  root.appendChild(subject);
  return root;
};

const buildOutlookRoot = (): HTMLElement => {
  const root = document.createElement('div');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Message');

  const toolbar = document.createElement('div');
  toolbar.setAttribute('role', 'toolbar');

  const editable = document.createElement('div');
  editable.setAttribute('contenteditable', 'true');
  editable.setAttribute('aria-label', 'Message body');
  editable.textContent = 'Outlook draft body.';

  const subject = document.createElement('input');
  subject.setAttribute('aria-label', 'Add a subject');
  subject.value = 'Outlook subject';

  root.appendChild(toolbar);
  root.appendChild(editable);
  root.appendChild(subject);
  return root;
};

// ---------------------------------------------------------------------------
// Generic contract suite — run for every adapter
// ---------------------------------------------------------------------------

const VALID_COMPOSE_MODES: ComposeMode[] = ['reply', 'forward', 'new'];
const VALID_PROVIDER_NAMES: ProviderName[] = ['gmail', 'zoho', 'outlook'];

const runContractSuite = (
  name: string,
  factory: () => ProviderAdapter,
  buildRoot: () => HTMLElement,
  expectedProvider: ProviderName,
) => {
  describe(`${name} — ProviderAdapter contract`, () => {
    let adapter: ProviderAdapter;

    beforeEach(() => {
      document.body.innerHTML = '';
      adapter = factory();
    });

    // --- getProviderName ---
    it('getProviderName() returns a valid ProviderName string', () => {
      const name = adapter.getProviderName();
      expect(VALID_PROVIDER_NAMES).toContain(name);
    });

    it(`getProviderName() returns "${expectedProvider}"`, () => {
      expect(adapter.getProviderName()).toBe(expectedProvider);
    });

    // --- findComposeRoots ---
    it('findComposeRoots() returns an array', () => {
      expect(Array.isArray(adapter.findComposeRoots())).toBe(true);
    });

    it('findComposeRoots() returns HTMLElement instances', () => {
      const root = buildRoot();
      document.body.appendChild(root);
      const roots = adapter.findComposeRoots();
      expect(roots.length).toBeGreaterThan(0);
      roots.forEach((r) => expect(r).toBeInstanceOf(HTMLElement));
    });

    // --- setActiveComposeRoot / getComposeMode ---
    it('setActiveComposeRoot() does not throw', () => {
      const root = buildRoot();
      document.body.appendChild(root);
      expect(() => adapter.setActiveComposeRoot(root)).not.toThrow();
    });

    it('getComposeMode() returns a valid ComposeMode after active root is set', () => {
      const root = buildRoot();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const mode = adapter.getComposeMode();
      expect(VALID_COMPOSE_MODES).toContain(mode);
    });

    // --- getThread ---
    it('getThread() returns a ThreadData-shaped object', () => {
      const root = buildRoot();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const thread = adapter.getThread();
      expect(typeof thread).toBe('object');
      expect(typeof thread.subject).toBe('string');
      expect(Array.isArray(thread.participants)).toBe(true);
      expect(Array.isArray(thread.messages)).toBe(true);
    });

    it('getThread().messages entries have a body field', () => {
      const root = buildRoot();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const { messages } = adapter.getThread();
      messages.forEach((msg) => {
        expect(typeof msg.body).toBe('string');
      });
    });

    // --- getToolbarForCompose ---
    it('getToolbarForCompose() returns HTMLElement or null', () => {
      const root = buildRoot();
      document.body.appendChild(root);
      const toolbar = adapter.getToolbarForCompose(root);
      expect(toolbar === null || toolbar instanceof HTMLElement).toBe(true);
    });

    // --- insertIntoComposer ---
    it('insertIntoComposer() places sanitized HTML into the editor', () => {
      const root = buildRoot();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      expect(() => adapter.insertIntoComposer('<p>Hello world</p>')).not.toThrow();
    });

    it('insertIntoComposer() strips <script> tags to prevent XSS', () => {
      const root = buildRoot();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      adapter.insertIntoComposer('<p>Safe</p><script>alert("xss")</script>');
      // The editable should NOT contain a script element
      const scripts = root.querySelectorAll('script');
      expect(scripts.length).toBe(0);
    });

    it('insertIntoComposer() strips inline event handlers', () => {
      const root = buildRoot();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      adapter.insertIntoComposer('<p onclick="evil()">Click me</p>');
      const editable = root.querySelector('[contenteditable="true"]');
      const html = editable?.innerHTML ?? '';
      expect(html).not.toMatch(/onclick/i);
    });

    // --- sendEmail ---
    it('sendEmail() is a function that returns a Promise', async () => {
      const root = buildRoot();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      const result = adapter.sendEmail({ sendImmediately: false });
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });

    it('sendEmail() with html payload calls insertIntoComposer without throwing', async () => {
      const root = buildRoot();
      document.body.appendChild(root);
      adapter.setActiveComposeRoot(root);
      await expect(
        adapter.sendEmail({ html: '<p>Draft</p>', sendImmediately: false }),
      ).resolves.toBeUndefined();
    });
  });
};

// ---------------------------------------------------------------------------
// Run contract suite for each adapter
// ---------------------------------------------------------------------------

runContractSuite('GmailAdapter', () => new GmailAdapter(), buildGmailRoot, 'gmail');
runContractSuite('ZohoAdapter', () => new ZohoAdapter(), buildZohoRoot, 'zoho');
runContractSuite('OutlookAdapter', () => new OutlookAdapter(), buildOutlookRoot, 'outlook');

// ---------------------------------------------------------------------------
// createProviderAdapter factory — hostname routing
// ---------------------------------------------------------------------------

describe('createProviderAdapter — hostname detection', () => {
  it('returns a GmailAdapter for mail.google.com', async () => {
    const { createProviderAdapter } = await import('../createProviderAdapter');
    const adapter = createProviderAdapter('mail.google.com');
    expect(adapter?.getProviderName()).toBe('gmail');
  });

  it('returns a ZohoAdapter for mail.zoho.com', async () => {
    const { createProviderAdapter } = await import('../createProviderAdapter');
    const adapter = createProviderAdapter('mail.zoho.com');
    expect(adapter?.getProviderName()).toBe('zoho');
  });

  it('returns an OutlookAdapter for outlook.office.com', async () => {
    const { createProviderAdapter } = await import('../createProviderAdapter');
    const adapter = createProviderAdapter('outlook.office.com');
    expect(adapter?.getProviderName()).toBe('outlook');
  });

  it('returns an OutlookAdapter for outlook.live.com', async () => {
    const { createProviderAdapter } = await import('../createProviderAdapter');
    const adapter = createProviderAdapter('outlook.live.com');
    expect(adapter?.getProviderName()).toBe('outlook');
  });

  it('returns null for an unrecognised host', async () => {
    const { createProviderAdapter } = await import('../createProviderAdapter');
    expect(createProviderAdapter('example.com')).toBeNull();
  });
});
