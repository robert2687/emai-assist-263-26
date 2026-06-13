import { GmailAdapter } from './GmailAdapter';
import { OutlookAdapter } from './OutlookAdapter';
import { ZohoAdapter } from './ZohoAdapter';
import { ProviderAdapter } from './types';

export const createProviderAdapter = (hostname: string = window.location.hostname): ProviderAdapter | null => {
  if (hostname.includes('mail.google.com')) {
    return new GmailAdapter();
  }

  if (hostname.includes('mail.zoho.com') || hostname.includes('zohomail.com')) {
    return new ZohoAdapter();
  }

  if (hostname.includes('outlook.office.com') || hostname.includes('outlook.live.com') || hostname.includes('outlook.com')) {
    return new OutlookAdapter();
  }

  return null;
};
