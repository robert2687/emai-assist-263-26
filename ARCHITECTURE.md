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
