<div align="center">
<img width="1200" height="475" alt="AI Email Assistant Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# ✉️ AI Email Assistant

**Craft the perfect email for any situation — powered by Google Gemini.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-4285F4?logo=google)](https://ai.google.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-deployed-F38020?logo=cloudflare)](https://workers.cloudflare.com/)

[Live App](https://emai-assist-263-26.workers.dev)

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Gmail Extension Mode](#-gmail-extension-mode)
- [Deployment](#-deployment)
- [GitHub Copilot Prompt](#-github-copilot-prompt)
- [Project Structure](#-project-structure)

---

## ✨ Features

- **3 unique email drafts** generated from a single plain-English description
- **Formal / Friendly mode** — switch between professional and conversational registers
- **Tone selectors** — Confident, Empathetic, Assertive, Humorous, Concise, Detailed
- **Email thread context** — paste a previous thread and get a contextually accurate reply
- **Writing style mirroring** — paste your own past emails so the AI mimics your voice
- **Sentiment detection** — the AI detects and labels the emotional tone of each draft
- **Alternative subject lines** — each draft ships with 1–3 extra subject line options
- **Email signature management** — store your signature locally; toggle inclusion per session
- **Provider-aware extension mode** — embed the app inside Gmail, Outlook, and Zoho Mail compose flows
- **Context Engine v2** — extract thread text, detect language/sentiment, identify tasks and deadlines, and classify grant-related conversations
- **Email Intelligence Hub** — smart replies, subject suggestions, templates, summary insert, and calendar shortcuts from one shared overlay
- **Multi-language support** — translates and drafts in EN / SK / ES / DE
- **Session-only API key handling** — keys are kept in memory unless supplied through environment configuration

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, TypeScript 5.8 |
| Styling | Tailwind CSS 4 |
| AI | Google Gemini 2.5 Flash (`@google/genai`) |
| Build | Vite 8 |
| Deploy | Cloudflare Workers (Wrangler 4) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18 or later
- A **Google Gemini API key** — get one free at [Google AI Studio](https://aistudio.google.com/app/apikey)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/robert2687/emai-assist-263-26.git
cd emai-assist-263-26

# 2. Install dependencies
npm install

# 3. Add your API key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 4. Start the development server
npm run dev
```

The app is served at `http://localhost:5173` by default.

---

## ⚙️ Configuration

### API Key

The Gemini API key can be provided in three ways (checked in order):

1. **In-app Settings modal** — click the ⚙ Settings button; the key is used for the current browser session.
2. **Environment variable** — set `GEMINI_API_KEY` (or `API_KEY`) in `.env.local`.
3. **Prompt on first launch** — if no key is available, the Settings modal opens automatically.

> **Security note:** API keys entered in the UI stay in memory for the active session and are never persisted to browser storage by default.

### Email Signature

Open Settings → paste your signature text → toggle the **Include** switch. The signature is persisted in `localStorage` and automatically appended to every generated draft.

---

## 📖 Usage

1. **Describe your email** in the "What is this email about?" field.  
   _Example: "Schedule a follow-up meeting with the design team about the new dashboard."_

2. *(Optional)* Paste an **email thread** for context so the AI drafts a relevant reply.

3. *(Optional)* Paste **samples of your own emails** so the AI mirrors your writing style.

4. Choose an **Email Mode**: Formal or Friendly.

5. Select one or more **Tones** (Confident, Empathetic, Assertive, Humorous, Concise, Detailed).

6. Click **Generate Emails** — three distinct drafts appear on the right, each with:
   - Subject line + alternative subjects
   - Full email body
   - Detected sentiment label
   - Copy-to-clipboard button

---

## 🔌 Provider Extension Mode

The extension content script injects a shared **Email Intelligence Hub** overlay into supported providers:

- Gmail
- Outlook Web / Outlook Live
- Zoho Mail

In extension mode, the overlay:

- detects the active provider and compose mode
- pulls thread context into Context Engine v2
- offers smart replies, summary insertion, subject suggestions, and calendar shortcuts
- inserts generated drafts back into the active composer through provider adapters

---

## ☁️ Deployment

### Preview locally with Wrangler

```bash
npm run preview
```

### Deploy to Cloudflare Workers

```bash
npm run deploy
```

This runs `vite build` then `wrangler deploy`, publishing the app as a Cloudflare Workers site.  
Configuration lives in [`wrangler.jsonc`](wrangler.jsonc).

---

## 🤖 GitHub Copilot Prompt

Use the prompt below with GitHub Copilot (or any LLM) to generate clean, typed, and testable code for this project. Replace the bracketed placeholders with values specific to your task.

```
You are an expert software engineer and code reviewer. Implement the task below following
the provided context, constraints, and tests. Output only the requested code files and unit
tests; do not include extra explanation unless explicitly asked.

Task: [brief task description]

Project context:
  Language: TypeScript 5.8
  Frameworks/Libraries allowed: React 19, Tailwind CSS 4, @google/genai, Vite
  Runtime: Cloudflare Workers
  Follow existing project architecture and conventions.

Constraints:
- Follow the Airbnb style guide.
- Use TypeScript types and interfaces throughout; no implicit `any`.
- Do not add new external dependencies unless explicitly permitted.
- Keep functions small and single-responsibility.
- Add concise JSDoc comments for public functions and components.

Input: [describe inputs]
Output: [describe expected outputs]

Edge cases: handle empty inputs; invalid types; very large inputs; API/network failures.

Testing: Provide unit tests (Jest/Vitest) covering normal cases, at least three edge cases,
and error handling. Include test data and expected results.

Performance & Security:
- Prefer async/await; avoid blocking the main thread.
- Never hardcode secrets; read keys from environment variables or session-only user input.
- Validate and sanitise all user inputs before passing to the Gemini API.

Deliverables:
1) Implementation file(s) with JSDoc and type annotations.
2) Unit tests with clear assertions.
3) Optional 3–5 sentence summary of design choices
   (add "Also provide summary" to request it).

Output format: return only code and tests in plain text blocks suitable for direct
paste into files.
```

**Next steps:**
1. Copy the prompt and fill in the bracketed placeholders.
2. Run Copilot in a small PR containing the generated code and tests.
3. Execute the tests locally (`npx vitest`) to validate behaviour.
4. Iterate the prompt if tests reveal missing edge cases or style issues.

---

## 📁 Project Structure

```
.
├── components/
│   ├── EmailCard.tsx       # Renders a single email draft with copy/insert controls
│   ├── Loader.tsx          # Animated loading indicator
│   ├── ToneSelector.tsx    # Multi-select tone chip buttons
│   └── icons.tsx           # SVG icon components
├── services/
│   ├── contextEngine.ts    # Provider-agnostic thread analysis and grant classification
│   └── geminiService.ts    # Gemini API integration & prompt construction
├── App.tsx                 # Email Intelligence Hub UI and overlay workflow
├── constants.ts            # Tone list and other shared constants
├── types.ts                # Shared TypeScript types & interfaces
├── index.tsx               # React entry point
├── index.html              # HTML shell
├── vite.config.ts          # Vite + Tailwind + Cloudflare plugin config
├── src/content.ts          # Provider-aware overlay injection content script
├── src/providerAdapters.ts # Gmail / Outlook / Zoho / fallback adapter layer
└── wrangler.jsonc          # Cloudflare Workers deployment config
```
