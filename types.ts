
export type EmailMode = 'Formal' | 'Friendly';

export type ApiProvider = 'gemini' | 'perplexity';

export type Tone = 'Confident' | 'Empathetic' | 'Assertive' | 'Humorous' | 'Concise' | 'Detailed';

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
