import {
  PublicClientApplication,
  type Configuration,
  type AccountInfo,
  InteractionRequiredAuthError,
  BrowserAuthError,
} from '@azure/msal-browser';

const GRAPH_SCOPES = ['Mail.Read', 'User.Read'];

export class MsalAuthService {
  private readonly msalInstance: PublicClientApplication;
  private account: AccountInfo | null = null;
  private initialized = false;

  constructor(clientId: string, tenantId: string = 'common') {
    const config: Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    };
    this.msalInstance = new PublicClientApplication(config);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.msalInstance.initialize();
    this.initialized = true;

    try {
      const response = await this.msalInstance.handleRedirectPromise();
      if (response?.account) {
        this.account = response.account;
        return;
      }
    } catch {
      // No pending redirect — continue
    }

    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      this.account = accounts[0];
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Try SSO hint from Office identity when available
    if (!this.account && typeof Office !== 'undefined') {
      try {
        const loginHint = Office.context.mailbox?.userProfile?.emailAddress;
        const ssoRequest = { scopes: GRAPH_SCOPES, ...(loginHint ? { loginHint } : {}) };
        const response = await this.msalInstance.ssoSilent(ssoRequest);
        this.account = response.account;
        return response.accessToken;
      } catch {
        // Fall through to interactive login
      }
    }

    if (this.account) {
      try {
        const response = await this.msalInstance.acquireTokenSilent({
          scopes: GRAPH_SCOPES,
          account: this.account,
        });
        return response.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError || error instanceof BrowserAuthError) {
          const response = await this.msalInstance.acquireTokenPopup({ scopes: GRAPH_SCOPES });
          this.account = response.account;
          return response.accessToken;
        }
        throw error;
      }
    }

    const response = await this.msalInstance.loginPopup({ scopes: GRAPH_SCOPES });
    this.account = response.account;
    return response.accessToken;
  }

  isAuthenticated(): boolean {
    return this.account !== null;
  }

  getAccount(): AccountInfo | null {
    return this.account;
  }
}
