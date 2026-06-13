# AI Email Assistant — High-Level Architecture

## 1) Provider Adapter Layer

All providers implement a shared interface in `src/providers/types.ts` (`ProviderAdapter`):

- `getProviderName()`
- `getComposeMode()` → `reply | forward | new`
- `getThread()` → `{ subject, participants, messages }`
- `insertIntoComposer(html)`
- `setSubject(text)` — writes the subject field via DOM for the active compose window
- `openCalendar(title?, startDateTime?)` — opens the provider-specific calendar deep link
- `sendEmail(payload)`

Concrete adapters:

- `src/providers/GmailAdapter.ts`
- `src/providers/ZohoAdapter.ts`
- `src/providers/OutlookAdapter.ts` — DOM-based adapter for the browser extension
- `src/providers/OutlookOfficeJsAdapter.ts` — Office.js adapter for the Outlook Web Add-in

Factory (browser extension only):

- `src/providers/createProviderAdapter.ts`

## 2) Universal Composer Overlay (Browser Extension)

- Implemented in `src/content.ts`
- Mounted once per detected provider host.
- Injects one **AI Write** action per compose toolbar.
- Opens a single React app overlay (`index.html?extension=true&provider=...`) for all features.

Message contracts from overlay to content script:

- `INSERT_EMAIL`
- `SEND_EMAIL`
- `REQUEST_THREAD_CONTEXT`
- `RUN_CONTEXT_ENGINE`
- `SET_SUBJECT` — sets the subject field via the active adapter
- `OPEN_CALENDAR` — opens the provider-specific calendar (Google, Outlook, Zoho) with optional title and startDateTime

Response events back to overlay:

- `THREAD_CONTEXT_RESPONSE`
- `CONTEXT_ENGINE_RESPONSE`
- `AI_ASSISTANT_ERROR`

## 3) Outlook Web Add-in (Office.js Taskpane)

A separate entry point that runs as an Office.js taskpane add-in inside Outlook on the Web.

### Authentication & Graph API

- `src/services/msalAuthService.ts` — Microsoft Identity Platform (MSAL) authentication using `@azure/msal-browser`.  Attempts SSO via the signed-in Office identity first, then falls back to an interactive popup.
- `src/services/graphApiService.ts` — Microsoft Graph API client for fetching conversation messages and the current user profile.

### Adapter

`src/providers/OutlookOfficeJsAdapter.ts` implements `ProviderAdapter` using:

- `Office.context.mailbox.item` events and async helpers for compose mode detection, subject, participants, and body.
- Graph API for full conversation thread extraction (falls back to the current body when unauthenticated).
- `Office.context.mailbox.item.body.setAsync` for inserting generated content into the compose window.

### Taskpane Entry Point

- `taskpane.html` — HTML entry loaded by Outlook; includes the Office.js CDN script.
- `src/taskpane.tsx` — waits for `Office.onReady`, initialises MSAL + the adapter, registers an `ItemChanged` handler, installs the same postMessage bridge used by the browser extension overlay, and renders the existing `App` component with `?extension=true&provider=outlook-officejs`.

### Add-in Manifest

- `manifest.xml` — Office Add-in XML manifest.  Registers the taskpane for both compose and read surfaces and adds an **AI Write** ribbon button.

### Build

The taskpane entry point is compiled as a separate Rollup chunk (`taskpane`) alongside the existing `main` and `content` outputs.

### Required environment variables

| Variable | Purpose |
|---|---|
| `VITE_MSAL_CLIENT_ID` | Azure AD application (client) ID |
| `VITE_MSAL_TENANT_ID` | Azure AD tenant ID (defaults to `common`) |

## 4) Context Engine v2 (Provider-agnostic)

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

## 5) Feature Surface (Overlay UI)

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

