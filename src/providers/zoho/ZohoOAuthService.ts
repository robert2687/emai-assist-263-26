const TOKEN_STORAGE_KEY = 'zoho_oauth_token';
const CODE_VERIFIER_STORAGE_KEY = 'zoho_pkce_verifier';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth';
const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_SCOPES = 'ZohoMail.messages.READ,ZohoMail.accounts.READ';

export interface ZohoTokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

/**
 * Persistent data kept in localStorage.
 * The access_token is intentionally excluded to avoid storing short-lived
 * bearer credentials in clear text; it is held in memory only.
 */
interface PersistedTokenData {
  refresh_token: string;
  access_token_expires_at: number;
  token_type: string;
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────

const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
};

const sha256 = async (plain: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
};

const base64UrlEncode = (buffer: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const hash = await sha256(verifier);
  return base64UrlEncode(hash);
};

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Manages Zoho OAuth 2.0 tokens using the PKCE extension.
 *
 * Security note: the short-lived access token is held in memory only and never
 * written to localStorage.  Only the refresh token and token metadata are
 * persisted, as they are necessary for silent re-authentication across page
 * loads.
 *
 * Usage:
 *   1. Call `initiateOAuthFlow()` to redirect the user to the Zoho consent screen.
 *   2. On callback, call `handleOAuthCallback(code)` with the code from the URL.
 *   3. Use `getValidAccessToken()` to obtain a fresh bearer token for API calls.
 */
export class ZohoOAuthService {
  private readonly clientId: string;
  private readonly redirectUri: string;

  /** In-memory access token; not persisted to avoid clear-text storage. */
  private inMemoryAccessToken: string | null = null;
  /** Expiry timestamp (ms) for the in-memory access token. */
  private inMemoryExpiresAt = 0;

  constructor(clientId: string, redirectUri: string) {
    this.clientId = clientId;
    this.redirectUri = redirectUri;
  }

  /**
   * Generates a PKCE code verifier, stores it in sessionStorage, and redirects
   * the user to the Zoho authorization endpoint.
   */
  async initiateOAuthFlow(): Promise<void> {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    sessionStorage.setItem(CODE_VERIFIER_STORAGE_KEY, codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: ZOHO_SCOPES,
      access_type: 'offline',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${ZOHO_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchanges the authorization code from the OAuth callback for access and
   * refresh tokens.  Clears the PKCE verifier from sessionStorage when done.
   */
  async handleOAuthCallback(code: string): Promise<ZohoTokenData> {
    const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY);
    if (!codeVerifier) {
      throw new Error('Missing PKCE code verifier. Please restart the OAuth flow.');
    }

    const tokenData = await this.exchangeCodeForToken(code, codeVerifier);
    sessionStorage.removeItem(CODE_VERIFIER_STORAGE_KEY);
    return tokenData;
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<ZohoTokenData> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      code,
      code_verifier: codeVerifier,
    });

    const response = await fetch(ZOHO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Zoho token exchange failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    const expiresAt = Date.now() + json.expires_in * 1000;
    const tokenData: ZohoTokenData = {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: expiresAt,
      token_type: json.token_type,
    };

    this.cacheAccessToken(json.access_token, expiresAt);
    this.persistRefreshData(json.refresh_token, expiresAt, json.token_type);
    return tokenData;
  }

  /**
   * Requests a new access token using the stored refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<ZohoTokenData> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      refresh_token: refreshToken,
    });

    const response = await fetch(ZOHO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Zoho token refresh failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    const expiresAt = Date.now() + json.expires_in * 1000;
    const storedRefreshToken = this.getPersistedData()?.refresh_token ?? refreshToken;

    const tokenData: ZohoTokenData = {
      access_token: json.access_token,
      refresh_token: storedRefreshToken,
      expires_at: expiresAt,
      token_type: json.token_type,
    };

    this.cacheAccessToken(json.access_token, expiresAt);
    this.persistRefreshData(storedRefreshToken, expiresAt, json.token_type);
    return tokenData;
  }

  /**
   * Returns a valid access token, transparently refreshing it if the in-memory
   * token is within five minutes of expiry.  Returns `null` if no credentials
   * are available or if the refresh attempt fails.
   */
  async getValidAccessToken(): Promise<string | null> {
    if (
      this.inMemoryAccessToken &&
      Date.now() + EXPIRY_BUFFER_MS < this.inMemoryExpiresAt
    ) {
      return this.inMemoryAccessToken;
    }

    const persisted = this.getPersistedData();
    if (!persisted) return null;

    try {
      const refreshed = await this.refreshAccessToken(persisted.refresh_token);
      return refreshed.access_token;
    } catch {
      return null;
    }
  }

  /**
   * Returns the full token data by combining the in-memory access token with the
   * persisted refresh data.  Returns `null` if the user has not authenticated.
   */
  getStoredToken(): ZohoTokenData | null {
    const persisted = this.getPersistedData();
    if (!persisted) return null;

    return {
      access_token: this.inMemoryAccessToken ?? '',
      refresh_token: persisted.refresh_token,
      expires_at: persisted.access_token_expires_at,
      token_type: persisted.token_type,
    };
  }

  clearToken(): void {
    this.inMemoryAccessToken = null;
    this.inMemoryExpiresAt = 0;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    return this.getPersistedData() !== null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private cacheAccessToken(accessToken: string, expiresAt: number): void {
    this.inMemoryAccessToken = accessToken;
    this.inMemoryExpiresAt = expiresAt;
  }

  /**
   * Persists only the refresh token and token metadata.
   * The access token is intentionally excluded to avoid clear-text storage.
   */
  private persistRefreshData(
    refreshToken: string,
    accessTokenExpiresAt: number,
    tokenType: string,
  ): void {
    const data: PersistedTokenData = {
      refresh_token: refreshToken,
      access_token_expires_at: accessTokenExpiresAt,
      token_type: tokenType,
    };
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(data));
  }

  private getPersistedData(): PersistedTokenData | null {
    try {
      const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PersistedTokenData) : null;
    } catch {
      return null;
    }
  }
}
