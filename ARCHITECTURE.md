# AI Email Assistant — High-Level Architecture

## 1) Provider Adapter Layer

All providers implement a shared interface in `src/providers/types.ts` (`ProviderAdapter`):

- `getProviderName()`
- `getComposeMode()` → `reply | forward | new`
- `getThread()` → `{ subject, participants, messages }`
- `insertIntoComposer(html)`
- `sendEmail(payload)`

Concrete adapters:

- `src/providers/GmailAdapter.ts`
- `src/providers/ZohoAdapter.ts`
- `src/providers/OutlookAdapter.ts`

Factory:

- `src/providers/createProviderAdapter.ts`

## 2) Universal Composer Overlay

- Implemented in `src/content.ts`
- Mounted once per detected provider host.
- Injects one **AI Write** action per compose toolbar.
- Opens a single React app overlay (`index.html?extension=true&provider=...`) for all features.

Message contracts from overlay to content script:

- `INSERT_EMAIL`
- `SEND_EMAIL`
- `REQUEST_THREAD_CONTEXT`
- `RUN_CONTEXT_ENGINE`

Response events back to overlay:

- `THREAD_CONTEXT_RESPONSE`
- `CONTEXT_ENGINE_RESPONSE`
- `AI_ASSISTANT_ERROR`

## 3) Context Engine v2 (Provider-agnostic)

Pure, DOM-free analysis in `src/context/contextEngineV2.ts`:

Input:

- `ThreadData` from adapter

Output:

- `summary`
- `language`
- `sentiment`
- `tasks`
- `deadlines`
- `nextSteps`
- `subjectSuggestions`
- `grantClassification`

## 4) Feature Surface (Overlay UI)

The overlay is designed as a universal micro-UI where provider-specific data is delivered through adapter/context-engine events, enabling feature modules such as:

- Smart replies
- Rewrite modes (formal, friendly, concise, grant-ready)
- Signature manager
- Template library
- Insert summary
- Generate subject
- Schedule send
- Add to calendar

## 5) Zoho Mail Integration

`ZohoAdapter` supports two deployment modes that are detected automatically at runtime.

### 5a) Zoho Mail Extension platform (ZOHO.ZMailClient SDK present)

When `window.ZOHO.ZMailClient` is available the adapter uses Zoho's official
Extension SDK instead of DOM scraping:

| Concern | SDK API used |
|---------|-------------|
| Composer detection | `ZOHO.ZMailClient.ON('ON_COMPOSE_OPEN' | 'ON_REPLY_OPEN' | 'ON_FORWARD_OPEN', handler)` |
| Compose close | `ZOHO.ZMailClient.ON('ON_COMPOSE_CLOSE', handler)` |
| Insert body | `ZOHO.ZMailClient.set('mail.compose.body', { body, composeId })` |
| Send email | `ZOHO.ZMailClient.invoke('ZMailCompose.send', { composeId })` |
| Overlay mount | `ZOHO.ZMailClient.invoke('ZMailInject.injectPanel', { composeId, url, width, title })` |
| SDK init | `ZOHO.embeddedApp.on('PageLoad', …)` then `ZOHO.embeddedApp.init()` |

Thread data is enriched via the **Zoho Mail REST API** when a `threadId` is
available from the SDK event payload (see §5b).

TypeScript declarations for the Zoho SDK globals live in
`src/providers/zoho/ZohoExtensionSdk.d.ts`.

### 5b) Zoho OAuth 2.0 + Mail REST API

For thread/conversation data the adapter fetches from the Zoho Mail API using
an OAuth 2.0 PKCE flow managed by `ZohoOAuthService`.

| Component | File |
|-----------|------|
| OAuth2 PKCE service | `src/providers/zoho/ZohoOAuthService.ts` |
| Zoho Mail API client | `src/providers/zoho/ZohoMailApiClient.ts` |

**OAuth scopes required:** `ZohoMail.messages.READ,ZohoMail.accounts.READ`

**Environment variables:**

| Variable | Description |
|----------|-------------|
| `ZOHO_CLIENT_ID` | OAuth 2.0 client ID from the Zoho Developer Console |
| `ZOHO_REDIRECT_URI` | Redirect URI registered in the Zoho Developer Console |

These can also be stored at runtime via `localStorage` under the keys
`zoho_client_id` and `zoho_redirect_uri`.

**API endpoints used:**

- `GET https://mail.zoho.com/api/accounts` — resolve primary account ID
- `GET https://mail.zoho.com/api/accounts/{accountId}/messages/thread/{threadId}` — fetch thread messages

### 5c) Browser-extension fallback (DOM-only mode)

When the ZOHO SDK is absent (e.g. running as a Chrome content script on
`mail.zoho.com`), all operations fall back to the existing DOM-selector
approach using `ZOHO_SELECTORS`. The OAuth/API layer is still available for
thread enrichment as long as credentials are configured.

