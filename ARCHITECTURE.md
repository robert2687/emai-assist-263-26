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

