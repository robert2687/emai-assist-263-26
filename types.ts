export type EmailMode = 'Formal' | 'Friendly' | 'Concise' | 'Grant Ready';

export type ApiProvider = 'gemini' | 'perplexity';

export type Tone = 'Confident' | 'Empathetic' | 'Assertive' | 'Humorous' | 'Concise' | 'Detailed';

export type ProviderId = 'gmail' | 'outlook' | 'zoho' | 'fallback';

export type ComposeMode = 'new' | 'reply' | 'forward' | 'unknown';

export type SupportedLanguage = 'en' | 'sk' | 'de' | 'es' | 'unknown';

export type GrantClassification =
  | 'proposal'
  | 'budget'
  | 'compliance'
  | 'partner communication'
  | 'general correspondence';

export interface EmailDraft {
  subject: string;
  body: string;
  signature?: string;
  sentiment?: string;
  alternatives?: {
    subject_lines: string[];
    tone_variants?: string[];
  };
}

export interface GeminiResponse {
  emails: EmailDraft[];
}

export interface ThreadParticipant {
  name: string;
  email?: string;
}

export interface ThreadContext {
  provider: ProviderId;
  composeMode: ComposeMode;
  subject: string;
  participants: ThreadParticipant[];
  lastMessage: string;
  threadText: string;
}

export interface ProviderCapabilities {
  smartReply: boolean;
  templates: boolean;
  signature: boolean;
  summaryInsert: boolean;
  subjectSuggestions: boolean;
  scheduleSend: boolean;
  calendarAdd: boolean;
}

export interface ContextAnalysis {
  language: SupportedLanguage;
  sentiment: string;
  tasks: string[];
  deadlines: string[];
  commitments: string[];
  summary: string;
  nextSteps: string[];
  subjectSuggestions: string[];
  smartReplies: string[];
  classification: GrantClassification;
}

export interface OverlayContextPayload {
  provider: ProviderId;
  capabilities: ProviderCapabilities;
  threadContext: ThreadContext;
  analysis: ContextAnalysis;
}
