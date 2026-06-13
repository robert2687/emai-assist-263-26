import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EmailDraft, EmailMode, Tone, ApiProvider, OverlayContextPayload, ProviderId } from './types';
import { generateEmails } from './services/geminiService';
import { generateEmailsWithPerplexity } from './services/perplexityService';
import { analyzeThreadContext } from './services/contextEngine';
import { TONES } from './constants';
import ToneSelector from './components/ToneSelector';
import EmailCard from './components/EmailCard';
import Loader from './components/Loader';
import { SparklesIcon, FeatherIcon } from './components/icons';

const EMAIL_MODES: EmailMode[] = ['Formal', 'Friendly', 'Concise', 'Grant Ready'];

const DEFAULT_CAPABILITIES = {
  smartReply: true,
  templates: true,
  signature: true,
  summaryInsert: true,
  subjectSuggestions: true,
  scheduleSend: false,
  calendarAdd: false,
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  zoho: 'Zoho Mail',
  fallback: 'Webmail',
};

const TEMPLATE_LIBRARY = [
  {
    name: 'Status update',
    prompt: 'Write a concise project status update with current progress, blockers, and next steps.',
  },
  {
    name: 'Grant response',
    prompt: 'Draft a grant-ready response that addresses proposal scope, milestones, and compliance expectations.',
  },
  {
    name: 'Meeting follow-up',
    prompt: 'Draft a polite follow-up email with action items, owners, and proposed next meeting times.',
  },
];

const buildGenerationContext = (
  overlayContext: OverlayContextPayload | null,
  manualContext: string,
  summary: string,
  nextSteps: string[],
  subjects: string[],
  classification: string,
  sentiment: string,
): string => {
  const sections = [
    manualContext.trim(),
    overlayContext ? `Provider: ${PROVIDER_LABELS[overlayContext.provider]}` : '',
    overlayContext?.threadContext.subject ? `Detected subject: ${overlayContext.threadContext.subject}` : '',
    overlayContext?.threadContext.composeMode ? `Compose mode: ${overlayContext.threadContext.composeMode}` : '',
    overlayContext && overlayContext.threadContext.participants.length > 0
      ? `Participants: ${overlayContext.threadContext.participants.map((participant) => participant.name).join(', ')}`
      : '',
    `Context summary: ${summary}`,
    `Detected sentiment: ${sentiment}`,
    `Grant classification: ${classification}`,
    nextSteps.length > 0 ? `Suggested next steps:\n- ${nextSteps.join('\n- ')}` : '',
    subjects.length > 0 ? `Suggested subject lines:\n- ${subjects.join('\n- ')}` : '',
  ];

  return sections.filter(Boolean).join('\n\n').trim();
};

const App: React.FC = () => {
  const [userInput, setUserInput] = useState<string>('');
  const [emailContext, setEmailContext] = useState<string>('');
  const [writingStyleSample, setWritingStyleSample] = useState<string>('');
  const [emailMode, setEmailMode] = useState<EmailMode>('Formal');
  const [selectedTones, setSelectedTones] = useState<Set<Tone>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<EmailDraft[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtensionMode, setIsExtensionMode] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [perplexityApiKey, setPerplexityApiKey] = useState<string>('');
  const [apiProvider, setApiProvider] = useState<ApiProvider>('gemini');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [signature, setSignature] = useState<string>('');
  const [includeSignature, setIncludeSignature] = useState<boolean>(true);
  const [overlayContext, setOverlayContext] = useState<OverlayContextPayload | null>(null);
  const [actionStatus, setActionStatus] = useState<string>('');
  const [providerHint, setProviderHint] = useState<ProviderId>('fallback');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const extensionMode = params.get('extension') === 'true';
    const providerFromQuery = params.get('provider');

    if (extensionMode) {
      setIsExtensionMode(true);
      window.parent.postMessage({ type: 'READY_FOR_CONTEXT' }, '*');
    }

    if (
      providerFromQuery === 'gmail'
      || providerFromQuery === 'outlook'
      || providerFromQuery === 'zoho'
      || providerFromQuery === 'fallback'
    ) {
      setProviderHint(providerFromQuery);
    }

    const storedProvider = localStorage.getItem('api_provider') as ApiProvider | null;
    if (storedProvider === 'perplexity' || storedProvider === 'gemini') {
      setApiProvider(storedProvider);
    }

    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      if (envKey) {
        setApiKey(envKey);
      }
    }

    const storedPerplexityKey = localStorage.getItem('perplexity_api_key');
    if (storedPerplexityKey) {
      setPerplexityApiKey(storedPerplexityKey);
    } else {
      const envPplxKey = process.env.PERPLEXITY_API_KEY || '';
      if (envPplxKey) {
        setPerplexityApiKey(envPplxKey);
      }
    }

    const resolvedProvider = storedProvider || 'gemini';
    const hasGeminiKey = !!(storedKey || process.env.GEMINI_API_KEY || process.env.API_KEY);
    const hasPerplexityKey = !!(storedPerplexityKey || process.env.PERPLEXITY_API_KEY);
    if ((resolvedProvider === 'gemini' && !hasGeminiKey) || (resolvedProvider === 'perplexity' && !hasPerplexityKey)) {
      setIsSettingsModalOpen(true);
    }

    const storedSignature = localStorage.getItem('email_signature');
    if (storedSignature) {
      setSignature(storedSignature);
    }

    const storedIncludeSignature = localStorage.getItem('include_signature');
    if (storedIncludeSignature !== null) {
      setIncludeSignature(storedIncludeSignature === 'true');
    }
  }, []);

  useEffect(() => {
    const handleOverlayMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; payload?: OverlayContextPayload } | undefined;
      if (!data?.type || !data.payload) {
        return;
      }

      if (data.type === 'INIT_CONTEXT' || data.type === 'CONTEXT_REFRESHED') {
        setOverlayContext(data.payload);
        setProviderHint(data.payload.provider);
        setEmailContext((current) => current.trim() || data.payload.threadContext.threadText || '');
      }
    };

    window.addEventListener('message', handleOverlayMessage);
    return () => window.removeEventListener('message', handleOverlayMessage);
  }, []);

  const derivedThreadContext = useMemo(() => ({
    provider: overlayContext?.provider ?? providerHint,
    composeMode: overlayContext?.threadContext.composeMode ?? 'unknown',
    subject: overlayContext?.threadContext.subject ?? '',
    participants: overlayContext?.threadContext.participants ?? [],
    lastMessage: overlayContext?.threadContext.lastMessage ?? '',
    threadText: emailContext.trim() || overlayContext?.threadContext.threadText || '',
  }), [emailContext, overlayContext, providerHint]);

  const contextAnalysis = useMemo(
    () => analyzeThreadContext(derivedThreadContext),
    [derivedThreadContext],
  );

  const capabilities = overlayContext?.capabilities ?? DEFAULT_CAPABILITIES;
  const activeProvider = overlayContext?.provider ?? providerHint;

  const saveSettings = (geminiKey: string, pplxKey: string, provider: ApiProvider) => {
    setApiKey(geminiKey);
    setPerplexityApiKey(pplxKey);
    setApiProvider(provider);
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('perplexity_api_key', pplxKey);
    localStorage.setItem('api_provider', provider);
    setIsSettingsModalOpen(false);
  };

  const handleSignatureChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setSignature(value);
    localStorage.setItem('email_signature', value);
  };

  const handleIncludeSignatureToggle = () => {
    const newValue = !includeSignature;
    setIncludeSignature(newValue);
    localStorage.setItem('include_signature', String(newValue));
  };

  const handleToneToggle = useCallback((tone: Tone) => {
    setSelectedTones((previous) => {
      const next = new Set(previous);
      if (next.has(tone)) {
        next.delete(tone);
      } else {
        next.add(tone);
      }

      return next;
    });
  }, []);

  const postComposerMessage = useCallback((type: string, text?: string) => {
    window.parent.postMessage(text ? { type, text } : { type }, '*');
    setActionStatus(
      type === 'OPEN_CALENDAR'
        ? 'Opened the provider calendar in a new tab.'
        : 'Sent the selected content to the active composer.',
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!userInput.trim()) {
      setError('Please enter what the email is about.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedEmails([]);

    const enrichedContext = buildGenerationContext(
      overlayContext,
      emailContext,
      contextAnalysis.summary,
      contextAnalysis.nextSteps,
      contextAnalysis.subjectSuggestions,
      contextAnalysis.classification,
      contextAnalysis.sentiment,
    );

    try {
      const result = apiProvider === 'perplexity'
        ? await generateEmailsWithPerplexity(
          userInput,
          enrichedContext,
          writingStyleSample,
          emailMode,
          Array.from(selectedTones),
          perplexityApiKey,
          signature,
          includeSignature,
        )
        : await generateEmails(
          userInput,
          enrichedContext,
          writingStyleSample,
          emailMode,
          Array.from(selectedTones),
          apiKey,
          signature,
          includeSignature,
        );

      setGeneratedEmails(result);
    } catch (generationError: unknown) {
      if (generationError instanceof Error && generationError.message === 'API Key is required') {
        setIsSettingsModalOpen(true);
      }
      setError('Failed to generate emails. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [
    apiKey,
    apiProvider,
    contextAnalysis,
    emailContext,
    emailMode,
    includeSignature,
    overlayContext,
    perplexityApiKey,
    selectedTones,
    signature,
    userInput,
    writingStyleSample,
  ]);

  return (
    <div className={`min-h-screen bg-gray-900 text-gray-200 font-sans ${isExtensionMode ? 'p-2' : ''}`}>
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-2xl md:p-8">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Settings
            </h2>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-300">AI Provider</label>
              <div className="flex rounded-lg bg-gray-700 p-1">
                <button
                  onClick={() => setApiProvider('gemini')}
                  className={`w-1/2 rounded-md py-2 text-sm font-medium transition-colors duration-300 ${apiProvider === 'gemini' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                >
                  Google Gemini
                </button>
                <button
                  onClick={() => setApiProvider('perplexity')}
                  className={`w-1/2 rounded-md py-2 text-sm font-medium transition-colors duration-300 ${apiProvider === 'perplexity' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                >
                  Perplexity
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-300">Google Gemini API Key</label>
              <p className="mb-2 text-xs leading-relaxed text-gray-400">
                Your key is stored locally in your browser and never sent to our servers.
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-lg border border-gray-600 bg-gray-900 p-3 text-white transition duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-300">Perplexity API Key</label>
              <p className="mb-2 text-xs leading-relaxed text-gray-400">
                Your key is stored locally in your browser and never sent to our servers.
              </p>
              <input
                type="password"
                value={perplexityApiKey}
                onChange={(event) => setPerplexityApiKey(event.target.value)}
                placeholder="pplx-..."
                className="w-full rounded-lg border border-gray-600 bg-gray-900 p-3 text-white transition duration-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-300">Email Signature</label>
                <label className="flex cursor-pointer items-center">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={includeSignature} onChange={handleIncludeSignatureToggle} />
                    <div className={`block h-6 w-10 rounded-full transition-colors ${includeSignature ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                    <div className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${includeSignature ? 'translate-x-4 transform' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-xs font-medium text-gray-400">Include</span>
                </label>
              </div>
              <textarea
                value={signature}
                onChange={handleSignatureChange}
                placeholder="John Doe&#10;Software Engineer&#10;+1 234 567 890"
                className="h-24 w-full resize-none rounded-lg border border-gray-600 bg-gray-900 p-3 text-white transition duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                disabled={!includeSignature}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => saveSettings(apiKey, perplexityApiKey, apiProvider)}
                disabled={apiProvider === 'gemini' ? !apiKey.trim() : !perplexityApiKey.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`${isExtensionMode ? 'w-full' : 'container mx-auto p-4 md:p-8'}`}>
        {!isExtensionMode && (
          <header className="mb-8 text-center md:mb-12">
            <h1 className="flex items-center justify-center gap-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
              <FeatherIcon className="h-10 w-10" />
              AI Email Assistant
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-gray-400">
              Provider-agnostic email drafting, context analysis, and smart composer actions across Gmail, Outlook, and Zoho.
            </p>
          </header>
        )}

        <main className={`grid ${isExtensionMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[1.1fr,0.9fr]'} gap-8`}>
          <div className={`rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-lg ${isExtensionMode ? 'max-h-[calc(100vh-1rem)] overflow-y-auto' : ''}`}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Email Intelligence Hub</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Provider: <span className="font-medium text-blue-300">{PROVIDER_LABELS[activeProvider]}</span>
                  {overlayContext?.threadContext.composeMode ? ` • Mode: ${overlayContext.threadContext.composeMode}` : ''}
                </p>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-blue-400"
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                Settings
              </button>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Context Engine v2</p>
                <h3 className="mt-1 text-sm font-semibold text-white">Thread summary</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">{contextAnalysis.summary}</p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Grant classification</p>
                <h3 className="mt-1 text-sm font-semibold capitalize text-white">{contextAnalysis.classification}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                  <span className="rounded-full border border-gray-600 px-2 py-1">Language: {contextAnalysis.language}</span>
                  <span className="rounded-full border border-gray-600 px-2 py-1">Sentiment: {contextAnalysis.sentiment}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="userInput" className="mb-2 block text-lg font-semibold text-gray-300">
                What is this email about?
              </label>
              <textarea
                id="userInput"
                value={userInput}
                onChange={(event) => setUserInput(event.target.value)}
                placeholder="e.g., Draft a response that confirms the budget review, requests missing attachments, and proposes next steps."
                className="h-32 w-full resize-none rounded-lg border border-gray-600 bg-gray-700 p-3 transition duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="emailContext" className="mb-2 block text-lg font-semibold text-gray-300">
                Email Thread Context
              </label>
              <textarea
                id="emailContext"
                value={emailContext}
                onChange={(event) => setEmailContext(event.target.value)}
                placeholder="Paste or refresh the current thread context."
                className="h-40 w-full resize-none rounded-lg border border-gray-600 bg-gray-700 p-3 transition duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="writingStyleSample" className="mb-2 block text-lg font-semibold text-gray-300">
                Your Writing Style (Optional)
              </label>
              <textarea
                id="writingStyleSample"
                value={writingStyleSample}
                onChange={(event) => setWritingStyleSample(event.target.value)}
                placeholder="Paste examples of your own emails so the AI can mirror your style."
                className="h-28 w-full resize-none rounded-lg border border-gray-600 bg-gray-700 p-3 transition duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-300">Rewrite Mode</h3>
              <div className="grid grid-cols-2 gap-2">
                {EMAIL_MODES.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setEmailMode(mode)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${emailMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-300">Template Library</h3>
              <div className="grid gap-2 md:grid-cols-3">
                {TEMPLATE_LIBRARY.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => {
                      setUserInput(template.prompt);
                      setActionStatus(`Loaded the "${template.name}" prompt.`);
                    }}
                    className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-3 text-left text-sm text-gray-200 transition hover:border-blue-500 hover:bg-gray-900"
                  >
                    <span className="block font-semibold text-white">{template.name}</span>
                    <span className="mt-1 block text-xs text-gray-400">{template.prompt}</span>
                  </button>
                ))}
              </div>
            </div>

            <ToneSelector
              tones={TONES}
              selectedTones={selectedTones}
              onToneToggle={handleToneToggle}
            />

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-bold text-white transition-all duration-300 hover:scale-105 hover:from-blue-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? 'Generating...' : 'Generate Emails'}
              {!isLoading && <SparklesIcon className="h-5 w-5" />}
            </button>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Context insights</h3>
                  <p className="text-sm text-gray-400">
                    Reusable provider-agnostic thread intelligence for the extension and future apps.
                  </p>
                </div>
                {isExtensionMode && (
                  <button
                    onClick={() => postComposerMessage('REFRESH_CONTEXT')}
                    className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 transition hover:border-blue-500 hover:text-white"
                  >
                    Refresh context
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-gray-900/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Next steps</p>
                  <ul className="mt-2 space-y-2 text-sm text-gray-300">
                    {contextAnalysis.nextSteps.map((step) => (
                      <li key={step} className="rounded-lg border border-gray-700 px-3 py-2">{step}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-gray-900/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Smart subject lines</p>
                  <div className="mt-2 space-y-2">
                    {contextAnalysis.subjectSuggestions.map((subject) => (
                      <button
                        key={subject}
                        onClick={() => {
                          if (isExtensionMode) {
                            postComposerMessage('INSERT_SUBJECT', subject);
                          } else {
                            setUserInput((current) => `${current}${current ? '\n' : ''}Subject idea: ${subject}`);
                            setActionStatus('Added the subject suggestion to your prompt.');
                          }
                        }}
                        className="w-full rounded-lg border border-gray-700 px-3 py-2 text-left text-sm text-gray-200 transition hover:border-blue-500 hover:bg-gray-900"
                        disabled={!capabilities.subjectSuggestions}
                      >
                        {subject}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-gray-900/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Smart replies</p>
                  <div className="mt-2 space-y-2">
                    {contextAnalysis.smartReplies.map((reply) => (
                      <button
                        key={reply}
                        onClick={() => {
                          setUserInput(reply);
                          setActionStatus('Loaded a smart reply into the prompt.');
                        }}
                        className="w-full rounded-lg border border-gray-700 px-3 py-2 text-left text-sm text-gray-200 transition hover:border-blue-500 hover:bg-gray-900"
                        disabled={!capabilities.smartReply}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-900/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Detected items</p>
                  <div className="mt-2 space-y-3 text-sm text-gray-300">
                    <div>
                      <p className="font-semibold text-white">Tasks</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {contextAnalysis.tasks.length > 0 ? contextAnalysis.tasks.map((task) => <li key={task}>{task}</li>) : <li>No explicit tasks detected.</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Deadlines</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {contextAnalysis.deadlines.length > 0 ? contextAnalysis.deadlines.map((deadline) => <li key={deadline}>{deadline}</li>) : <li>No deadline phrases detected.</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Commitments</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {contextAnalysis.commitments.length > 0 ? contextAnalysis.commitments.map((commitment) => <li key={commitment}>{commitment}</li>) : <li>No commitments detected.</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => postComposerMessage('INSERT_EMAIL', contextAnalysis.summary)}
                  disabled={!isExtensionMode || !capabilities.summaryInsert}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Insert summary
                </button>
                <button
                  onClick={() => postComposerMessage('OPEN_CALENDAR')}
                  disabled={!isExtensionMode || !capabilities.calendarAdd}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add to calendar
                </button>
                <button
                  disabled
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-500"
                  title="Native schedule-send automation is not available yet."
                >
                  Schedule send
                </button>
              </div>

              {actionStatus && (
                <div className="mt-4 rounded-lg border border-blue-700/40 bg-blue-900/20 px-3 py-2 text-sm text-blue-200">
                  {actionStatus}
                </div>
              )}
            </div>

            {isLoading && <Loader />}
            {error && <div className="rounded-lg border border-red-700 bg-red-900/50 p-4 text-red-300">{error}</div>}

            {generatedEmails.length > 0 && (
              <div className="space-y-6">
                {generatedEmails.map((email, index) => (
                  <div key={`${email.subject}-${index}`} className="relative group">
                    <EmailCard draft={email} index={index} />
                    {isExtensionMode && (
                      <button
                        onClick={() => postComposerMessage(
                          'INSERT_EMAIL',
                          `${email.body}${email.signature ? `\n\n${email.signature}` : ''}`,
                        )}
                        className="absolute right-16 top-4 rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white opacity-0 shadow-lg transition-colors group-hover:opacity-100 hover:bg-blue-700"
                      >
                        Insert to composer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isLoading && generatedEmails.length === 0 && !error && (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-gray-700 bg-gray-800 p-6 text-center shadow-lg">
                <FeatherIcon className="mb-4 h-16 w-16 text-gray-600" />
                <h3 className="text-xl font-semibold text-gray-300">Generated drafts will appear here</h3>
                <p className="mt-1 text-gray-500">Use the context engine, templates, and prompt builder to get started.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
