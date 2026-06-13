
export type EmailMode = 'Formal' | 'Friendly';

export type Tone = 'Confident' | 'Empathetic' | 'Assertive' | 'Humorous' | 'Concise' | 'Detailed';

export type ComposeMode = 'reply' | 'forward' | 'new';

export interface ThreadMessage {
  from?: string;
  body: string;
  timestamp?: string;
}

export interface ThreadData {
  subject: string;
  participants: string[];
  messages: ThreadMessage[];
}

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'urgent';
export type GrantClassification = 'grant_application' | 'grant_reporting' | 'grant_budget' | 'non_grant';

export interface ContextEngineOutput {
  summary: string;
  language: string;
  sentiment: Sentiment;
  tasks: string[];
  deadlines: string[];
  nextSteps: string[];
  subjectSuggestions: string[];
  grantClassification: GrantClassification;
}

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
