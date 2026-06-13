import { ComposeMode, ProviderAdapter, ProviderName, SendEmailPayload, ThreadData } from './types';

export abstract class BaseAdapter implements ProviderAdapter {
  protected activeComposeRoot: HTMLElement | null = null;

  abstract getProviderName(): ProviderName;
  abstract findComposeRoots(): HTMLElement[];
  abstract getToolbarForCompose(composeRoot: HTMLElement): HTMLElement | null;

  abstract getComposeMode(): ComposeMode;
  abstract getThread(): ThreadData;
  abstract insertIntoComposer(html: string): void;
  abstract sendEmail(payload?: SendEmailPayload): Promise<void>;

  setActiveComposeRoot(composeRoot: HTMLElement): void {
    this.activeComposeRoot = composeRoot;
  }

  protected requireActiveComposeRoot(): HTMLElement {
    if (this.activeComposeRoot) {
      return this.activeComposeRoot;
    }

    const firstCompose = this.findComposeRoots()[0];
    if (!firstCompose) {
      throw new Error('No compose window detected for current provider.');
    }

    this.activeComposeRoot = firstCompose;
    return firstCompose;
  }

  protected sanitizeInsertedHtml(raw: string): string {
    return raw
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+=(["']).*?\1/gi, '');
  }
}
