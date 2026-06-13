import React, { useMemo, useState, useCallback } from 'react';
import { ComposeMode, ContextEngineOutput, EmailDraft, EmailMode, ThreadData, Tone } from './types';
import { generateEmails } from './services/geminiService';
import { TONES } from './constants';
import ToneSelector from './components/ToneSelector';
import EmailCard from './components/EmailCard';
import Loader from './components/Loader';
import ContextInsightsCard from './components/ContextInsightsCard';
import ComposerActionsPanel from './components/ComposerActionsPanel';
import { SparklesIcon, FeatherIcon } from './components/icons';

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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [signature, setSignature] = useState<string>('');
  const [includeSignature, setIncludeSignature] = useState<boolean>(true);

  const [providerName, setProviderName] = useState<string>('unknown');
  const [composeMode, setComposeMode] = useState<ComposeMode>('new');
  const [threadData, setThreadData] = useState<ThreadData | null>(null);
  const [analysis, setAnalysis] = useState<ContextEngineOutput | null>(null);
  const [selectedRewriteMode, setSelectedRewriteMode] = useState<string>('formal');
  const [scheduleAt, setScheduleAt] = useState<string>('');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const extensionMode = params.get('extension') === 'true';

    if (extensionMode) {
      setIsExtensionMode(true);
      setProviderName(params.get('provider') || 'unknown');
    }

    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      if (envKey) {
        setApiKey(envKey);
      } else {
        setIsSettingsModalOpen(true);
      }
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

  React.useEffect(() => {
    if (!isExtensionMode) return;

    window.parent.postMessage({ type: 'REQUEST_THREAD_CONTEXT' }, '*');
    window.parent.postMessage({ type: 'RUN_CONTEXT_ENGINE' }, '*');

    const onMessage = (event: MessageEvent) => {
      if (!event?.data || typeof event.data !== 'object') return;

      if (event.data.type === 'THREAD_CONTEXT_RESPONSE') {
        setProviderName(event.data.provider || 'unknown');
        setComposeMode((event.data.composeMode || 'new') as ComposeMode);
        setThreadData(event.data.thread as ThreadData);

        const threadMessages = (event.data.thread?.messages || [])
          .map((msg: { body: string }) => msg.body)
          .filter(Boolean)
          .join('\n\n');

        setEmailContext(threadMessages);
      }

      if (event.data.type === 'CONTEXT_ENGINE_RESPONSE') {
        setProviderName(event.data.provider || 'unknown');
        setComposeMode((event.data.composeMode || 'new') as ComposeMode);
        setThreadData(event.data.thread as ThreadData);
        setAnalysis(event.data.analysis as ContextEngineOutput);

        if (!userInput.trim() && event.data.analysis?.summary) {
          setUserInput(event.data.analysis.summary);
        }
      }

      if (event.data.type === 'AI_ASSISTANT_ERROR') {
        setError(event.data.message || 'Unknown extension error');
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [isExtensionMode, userInput]);

  const handleSignatureChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setSignature(val);
    localStorage.setItem('email_signature', val);
  };

  const handleIncludeSignatureToggle = () => {
    const newVal = !includeSignature;
    setIncludeSignature(newVal);
    localStorage.setItem('include_signature', String(newVal));
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setIsSettingsModalOpen(false);
  };

  const postToComposer = useCallback((payload: Record<string, unknown>) => {
    window.parent.postMessage(payload, '*');
  }, []);

  const handleInsertIntoComposer = useCallback((text: string) => {
    postToComposer({ type: 'INSERT_EMAIL', text });
  }, [postToComposer]);

  const handleSendEmail = useCallback((html?: string, sendImmediately: boolean = false) => {
    postToComposer({ type: 'SEND_EMAIL', payload: { html, sendImmediately } });
  }, [postToComposer]);

  const handleToneToggle = useCallback((tone: Tone) => {
    setSelectedTones(prev => {
      const newTones = new Set(prev);
      if (newTones.has(tone)) {
        newTones.delete(tone);
      } else {
        newTones.add(tone);
      }
      return newTones;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!userInput.trim()) {
      setError('Please enter what the email is about.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedEmails([]);

    try {
      const result = await generateEmails(
        userInput,
        emailContext,
        writingStyleSample,
        emailMode,
        Array.from(selectedTones),
        apiKey,
        signature,
        includeSignature
      );
      setGeneratedEmails(result);
    } catch (e: any) {
      console.error(e);
      if (e.message === 'API Key is required') {
        setIsSettingsModalOpen(true);
      }
      setError('Failed to generate emails. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userInput, emailContext, writingStyleSample, emailMode, selectedTones, apiKey, signature, includeSignature]);

  const smartReplies = useMemo(() => {
    if (!analysis) {
      return [
        'Thanks for the update — I will review and get back to you shortly.',
        'Sounds good to me. Please proceed.',
        'Can we schedule a quick call to align on next steps?',
      ];
    }

    return [
      `Thanks for the update on ${threadData?.subject || 'this thread'}.`,
      analysis.tasks[0] ? `Acknowledged. I will handle: ${analysis.tasks[0]}.` : 'Acknowledged. I will take this forward.',
      analysis.deadlines[0] ? `Noted on the deadline (${analysis.deadlines[0]}). I will keep this on track.` : 'I will share next steps shortly.',
    ];
  }, [analysis, threadData?.subject]);

  const applyRewriteMode = useCallback(() => {
    const baseDraft = generatedEmails[0]?.body || userInput || emailContext;
    if (!baseDraft.trim()) {
      setError('No draft content available to rewrite.');
      return;
    }

    let rewritten = baseDraft;
    switch (selectedRewriteMode) {
      case 'formal':
        rewritten = `Dear ${threadData?.participants?.[0] || 'Team'},\n\n${baseDraft}\n\nSincerely,`;
        break;
      case 'friendly':
        rewritten = `Hi ${threadData?.participants?.[0] || 'there'},\n\n${baseDraft}\n\nThanks!`;
        break;
      case 'concise':
        rewritten = baseDraft
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 4)
          .join('\n');
        break;
      case 'grant-ready':
        rewritten = [
          'Grant Update',
          '',
          `Summary: ${analysis?.summary || baseDraft}`,
          analysis?.tasks?.[0] ? `Action: ${analysis.tasks[0]}` : 'Action: Confirm deliverables and responsible owners.',
          analysis?.deadlines?.[0] ? `Deadline: ${analysis.deadlines[0]}` : 'Deadline: Confirm target submission date.',
          `Compliance Note: ${analysis?.grantClassification || 'non_grant'}`,
        ].join('\n');
        break;
      default:
        break;
    }

    handleInsertIntoComposer(rewritten);
  }, [analysis, emailContext, generatedEmails, handleInsertIntoComposer, selectedRewriteMode, threadData?.participants, userInput]);

  const handleInsertSummary = useCallback(() => {
    const summaryText = analysis?.summary || 'No summary available from context engine yet.';
    const escapedSummary = summaryText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const summaryHtml = `<p>${escapedSummary.replace(/\n/g, '<br/>')}</p>`;
    handleInsertIntoComposer(summaryHtml);
  }, [analysis?.summary, handleInsertIntoComposer]);

  const handleGenerateSubject = useCallback(() => {
    const suggestions = analysis?.subjectSuggestions || [];
    const subject = suggestions[0] || threadData?.subject || 'Follow-up';
    postToComposer({ type: 'SET_SUBJECT', text: subject });
  }, [analysis?.subjectSuggestions, postToComposer, threadData?.subject]);

  const handleInsertTemplate = useCallback((templateKey: string) => {
    const templates: Record<string, string> = {
      follow_up: 'Hi,\n\nJust following up on my previous message. Please let me know if you need anything else from my side.\n\nBest regards,',
      meeting: 'Hi,\n\nCould we schedule a 30-minute call this week to align on goals, dependencies, and timelines?\n\nThanks,',
      grant_update: 'Hello,\n\nHere is a quick grant progress update:\n- Milestone status:\n- Budget status:\n- Risks/blocks:\n- Next actions:\n\nBest,',
    };

    handleInsertIntoComposer(templates[templateKey] || templates.follow_up);
  }, [handleInsertIntoComposer]);

  const handleScheduleSend = useCallback(() => {
    const title = threadData?.subject || 'Email Follow-up';
    postToComposer({ type: 'OPEN_CALENDAR', title, startDateTime: scheduleAt || undefined });
  }, [postToComposer, scheduleAt, threadData?.subject]);

  const handleAddToCalendar = useCallback(() => {
    const title = threadData?.subject || 'Email Follow-up';
    postToComposer({ type: 'OPEN_CALENDAR', title });
  }, [postToComposer, threadData?.subject]);

  const refreshContext = useCallback(() => {
    postToComposer({ type: 'REQUEST_THREAD_CONTEXT' });
    postToComposer({ type: 'RUN_CONTEXT_ENGINE' });
  }, [postToComposer]);

  return (
    <div className={`min-h-screen bg-gray-900 text-gray-200 font-sans ${isExtensionMode ? 'p-2' : ''}`}>
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Settings</h2>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Google Gemini API Key</label>
              <p className="text-gray-400 text-xs mb-2 leading-relaxed">Your key is stored locally in your browser and never sent to our servers.</p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-300">Email Signature</label>
                <label className="flex items-center cursor-pointer">
                  <input type="checkbox" className="mr-2" checked={includeSignature} onChange={handleIncludeSignatureToggle} />
                  <span className="text-xs text-gray-400 font-medium">Include</span>
                </label>
              </div>
              <textarea
                value={signature}
                onChange={handleSignatureChange}
                placeholder="John Doe\nSoftware Engineer\n+1 234 567 890"
                className="w-full h-24 p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none"
                disabled={!includeSignature}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">Cancel</button>
              <button onClick={() => saveApiKey(apiKey)} disabled={!apiKey.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Save Settings</button>
            </div>
          </div>
        </div>
      )}

      <div className={`${isExtensionMode ? 'w-full' : 'container mx-auto p-4 md:p-8'}`}>
        {!isExtensionMode && (
          <header className="text-center mb-8 md:mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-500 flex items-center justify-center gap-3">
              <FeatherIcon className="w-10 h-10" />
              AI Email Assistant
            </h1>
            <p className="text-gray-400 mt-2 max-w-2xl mx-auto">Craft the perfect email for any situation. Describe your goal, add context, and let AI generate polished drafts for you.</p>
          </header>
        )}

        <main className={`grid ${isExtensionMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-8`}>
          <div className={`bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col gap-6 ${isExtensionMode ? 'max-h-150 overflow-y-auto' : ''}`}>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="userInput" className="block text-lg font-semibold text-gray-300">What is this email about?</label>
                <button onClick={() => setIsSettingsModalOpen(true)} className="text-xs text-gray-400 hover:text-blue-400">Settings</button>
              </div>
              <textarea
                id="userInput"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="e.g., Schedule a meeting with Jane to discuss the Q4 budget."
                className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none"
              />
            </div>

            <div>
              <label htmlFor="emailContext" className="block text-lg font-semibold mb-2 text-gray-300">Email Thread Context (Optional)</label>
              <textarea
                id="emailContext"
                value={emailContext}
                onChange={(e) => setEmailContext(e.target.value)}
                placeholder="Paste the previous email thread here for a relevant reply."
                className="w-full h-36 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none"
              />
            </div>

            <div>
              <label htmlFor="writingStyleSample" className="block text-lg font-semibold mb-2 text-gray-300">Your Writing Style (Optional)</label>
              <textarea
                id="writingStyleSample"
                value={writingStyleSample}
                onChange={(e) => setWritingStyleSample(e.target.value)}
                placeholder="Paste some of your previously sent emails here so the AI can learn your style."
                className="w-full h-28 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none"
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-300">Email Mode</h3>
              <div className="flex bg-gray-700 rounded-lg p-1">
                <button onClick={() => setEmailMode('Formal')} className={`w-1/2 py-2 rounded-md text-sm font-medium ${emailMode === 'Formal' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>Formal</button>
                <button onClick={() => setEmailMode('Friendly')} className={`w-1/2 py-2 rounded-md text-sm font-medium ${emailMode === 'Friendly' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>Friendly</button>
              </div>
            </div>

            <ToneSelector tones={TONES} selectedTones={selectedTones} onToneToggle={handleToneToggle} />

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-linear-to-r from-blue-500 to-purple-600 text-white font-bold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Generating...' : 'Generate Emails'}
              {!isLoading && <SparklesIcon className="w-5 h-5" />}
            </button>
          </div>

          <div className="space-y-6">
            {isExtensionMode && (
              <div className="bg-blue-900/30 border border-blue-700/50 p-4 rounded-xl text-sm text-blue-200">
                <p className="font-bold mb-1">{providerName.toUpperCase()} Extension Mode Active</p>
                <p>Compose mode: <span className="font-semibold">{composeMode}</span>. Use quick actions to write directly into the composer.</p>
              </div>
            )}

            {isExtensionMode && (
              <ContextInsightsCard
                providerName={providerName}
                composeMode={composeMode}
                threadData={threadData}
                analysis={analysis}
                onRefresh={refreshContext}
              />
            )}

            {isExtensionMode && (
              <ComposerActionsPanel
                smartReplies={smartReplies}
                selectedRewriteMode={selectedRewriteMode}
                onRewriteModeChange={setSelectedRewriteMode}
                onInsertSummary={handleInsertSummary}
                onGenerateSubject={handleGenerateSubject}
                onUseSmartReply={handleInsertIntoComposer}
                onApplyRewrite={applyRewriteMode}
                onInsertTemplate={handleInsertTemplate}
                onScheduleSend={handleScheduleSend}
                onAddToCalendar={handleAddToCalendar}
                onSendNow={() => handleSendEmail(undefined, true)}
                scheduleAt={scheduleAt}
                onScheduleAtChange={setScheduleAt}
                analysis={analysis}
              />
            )}

            {isLoading && <Loader />}
            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}

            {generatedEmails.length > 0 && (
              <div className="space-y-6">
                {generatedEmails.map((email, index) => (
                  <div key={index} className="relative group">
                    <EmailCard draft={email} index={index} />
                    {isExtensionMode && (
                      <button
                        onClick={() => handleInsertIntoComposer(`${email.body}${email.signature ? `\n\n${email.signature}` : ''}`)}
                        className="absolute top-4 right-16 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                      >
                        Insert to Composer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isLoading && generatedEmails.length === 0 && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center bg-gray-800 p-6 rounded-2xl shadow-lg border border-dashed border-gray-700">
                <FeatherIcon className="w-16 h-16 text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-400">Your generated emails will appear here</h3>
                <p className="text-gray-500 mt-1">Fill out the form on the left to get started.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
