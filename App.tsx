
import React, { useState, useCallback } from 'react';
import { EmailDraft, EmailMode, Tone, ApiProvider } from './types';
import { generateEmails } from './services/geminiService';
import { generateEmailsWithPerplexity } from './services/perplexityService';
import { TONES } from './constants';
import ToneSelector from './components/ToneSelector';
import EmailCard from './components/EmailCard';
import Loader from './components/Loader';
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
  const [perplexityApiKey, setPerplexityApiKey] = useState<string>('');
  const [apiProvider, setApiProvider] = useState<ApiProvider>('gemini');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [signature, setSignature] = useState<string>('');
  const [includeSignature, setIncludeSignature] = useState<boolean>(true);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('extension') === 'true') {
      setIsExtensionMode(true);
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

  const saveSettings = (geminiKey: string, pplxKey: string, provider: ApiProvider) => {
    setApiKey(geminiKey);
    setPerplexityApiKey(pplxKey);
    setApiProvider(provider);
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('perplexity_api_key', pplxKey);
    localStorage.setItem('api_provider', provider);
    setIsSettingsModalOpen(false);
  };

  const handleInsertToGmail = useCallback((text: string) => {
    window.parent.postMessage({ type: 'INSERT_EMAIL', text }, '*');
  }, []);

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
      let result: EmailDraft[];
      if (apiProvider === 'perplexity') {
        result = await generateEmailsWithPerplexity(userInput, emailContext, writingStyleSample, emailMode, Array.from(selectedTones), perplexityApiKey, signature, includeSignature);
      } else {
        result = await generateEmails(userInput, emailContext, writingStyleSample, emailMode, Array.from(selectedTones), apiKey, signature, includeSignature);
      }
      setGeneratedEmails(result);
    } catch (e: any) {
      console.error(e);
      if (e.message === "API Key is required") {
        setIsSettingsModalOpen(true);
      }
      setError('Failed to generate emails. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userInput, emailContext, writingStyleSample, emailMode, selectedTones, apiKey, perplexityApiKey, apiProvider, signature, includeSignature]);

  return (
    <div className={`min-h-screen bg-gray-900 text-gray-200 font-sans ${isExtensionMode ? 'p-2' : ''}`}>
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Settings
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">AI Provider</label>
              <div className="flex bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setApiProvider('gemini')}
                  className={`w-1/2 py-2 rounded-md transition-colors duration-300 text-sm font-medium ${apiProvider === 'gemini' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                >
                  Google Gemini
                </button>
                <button
                  onClick={() => setApiProvider('perplexity')}
                  className={`w-1/2 py-2 rounded-md transition-colors duration-300 text-sm font-medium ${apiProvider === 'perplexity' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                >
                  Perplexity
                </button>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Google Gemini API Key</label>
              <p className="text-gray-400 text-xs mb-2 leading-relaxed">
                Your key is stored locally in your browser and never sent to our servers.
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Perplexity API Key</label>
              <p className="text-gray-400 text-xs mb-2 leading-relaxed">
                Your key is stored locally in your browser and never sent to our servers.
              </p>
              <input
                type="password"
                value={perplexityApiKey}
                onChange={(e) => setPerplexityApiKey(e.target.value)}
                placeholder="pplx-..."
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-300">Email Signature</label>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={includeSignature} onChange={handleIncludeSignatureToggle} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${includeSignature ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${includeSignature ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-xs text-gray-400 font-medium">Include</span>
                </label>
              </div>
              <p className="text-gray-400 text-xs mb-2 leading-relaxed">
                This signature will be automatically appended to your generated emails.
              </p>
              <textarea
                value={signature}
                onChange={handleSignatureChange}
                placeholder="John Doe&#10;Software Engineer&#10;+1 234 567 890"
                className="w-full h-24 p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none"
                disabled={!includeSignature}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsSettingsModalOpen(false)} 
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => saveSettings(apiKey, perplexityApiKey, apiProvider)} 
                disabled={apiProvider === 'gemini' ? !apiKey.trim() : !perplexityApiKey.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`${isExtensionMode ? 'w-full' : 'container mx-auto p-4 md:p-8'}`}>
        {!isExtensionMode && (
          <header className="text-center mb-8 md:mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center gap-3">
              <FeatherIcon className="w-10 h-10" />
              AI Email Assistant
            </h1>
            <p className="text-gray-400 mt-2 max-w-2xl mx-auto">
              Craft the perfect email for any situation. Describe your goal, add context, and let AI generate polished drafts for you.
            </p>
          </header>
        )}

        <main className={`grid ${isExtensionMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-8`}>
          <div className={`bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col gap-6 ${isExtensionMode ? 'max-h-[600px] overflow-y-auto' : ''}`}>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="userInput" className="block text-lg font-semibold text-gray-300">
                  What is this email about?
                </label>
                <button 
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="text-xs text-gray-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
                  title="Settings"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  Settings
                </button>
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
              <label htmlFor="emailContext" className="block text-lg font-semibold mb-2 text-gray-300">
                Email Thread Context (Optional)
              </label>
              <textarea
                id="emailContext"
                value={emailContext}
                onChange={(e) => setEmailContext(e.target.value)}
                placeholder="Paste the previous email thread here for a relevant reply."
                className="w-full h-40 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none"
              />
            </div>
            
            <div>
              <label htmlFor="writingStyleSample" className="block text-lg font-semibold mb-2 text-gray-300">
                Your Writing Style (Optional)
              </label>
              <textarea
                id="writingStyleSample"
                value={writingStyleSample}
                onChange={(e) => setWritingStyleSample(e.target.value)}
                placeholder="Paste some of your previously sent emails here so the AI can learn your style."
                className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none"
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-300">Email Mode</h3>
              <div className="flex bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setEmailMode('Formal')}
                  className={`w-1/2 py-2 rounded-md transition-colors duration-300 text-sm font-medium ${emailMode === 'Formal' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                >
                  Formal
                </button>
                <button
                  onClick={() => setEmailMode('Friendly')}
                  className={`w-1/2 py-2 rounded-md transition-colors duration-300 text-sm font-medium ${emailMode === 'Friendly' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                >
                  Friendly
                </button>
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
              className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
              {isLoading ? 'Generating...' : 'Generate Emails'}
              {!isLoading && <SparklesIcon className="w-5 h-5" />}
            </button>
          </div>

          <div className="space-y-6">
            {isExtensionMode && (
              <div className="bg-blue-900/30 border border-blue-700/50 p-4 rounded-xl text-sm text-blue-200">
                <p className="font-bold mb-1">Gmail Extension Mode Active</p>
                <p>Generate drafts and click "Insert to Gmail" to populate your compose window.</p>
              </div>
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
                        onClick={() => handleInsertToGmail(`${email.body}${email.signature ? `\n\n${email.signature}` : ''}`)}
                        className="absolute top-4 right-16 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                      >
                        Insert to Gmail
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
