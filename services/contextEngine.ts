import {
  ContextAnalysis,
  GrantClassification,
  SupportedLanguage,
  ThreadContext,
} from '../types';

const DEADLINE_PATTERN =
  /\b(?:by|before|on|due|deadline|eod|cob|tomorrow|today|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[^.!?\n]*/gi;

const TASK_PATTERN =
  /\b(?:please|kindly|need to|action item|todo|follow up|can you|could you|should|must|review|send|share|prepare|submit|confirm|schedule)\b/i;

const COMMITMENT_PATTERN =
  /\b(?:i|we)\s+(?:will|can|plan to|commit to|intend to|promise to|expect to|deliver|share|prepare|review|send)\b/i;

const LANGUAGE_RULES: Array<{ language: SupportedLanguage; pattern: RegExp }> = [
  { language: 'sk', pattern: /\b(ďakujem|prosím|termín|rozpočet|grant|zmluva|partner|príloha|ďalší|stretnutie)\b|[áäčďéíĺľňóôŕšťúýž]/i },
  { language: 'de', pattern: /\b(danke|bitte|frist|haushalt|angebot|zusammenfassung|anhang|projekt|förderung)\b|[äöüß]/i },
  { language: 'es', pattern: /\b(gracias|por favor|plazo|presupuesto|propuesta|cumplimiento|adjunto|reunión)\b|[¿¡ñáéíóú]/i },
];

const POSITIVE_WORDS = [
  'thanks',
  'thank you',
  'great',
  'happy',
  'glad',
  'appreciate',
  'excellent',
  'good',
  'pleased',
];

const NEGATIVE_WORDS = [
  'urgent',
  'issue',
  'problem',
  'delay',
  'risk',
  'blocked',
  'frustrated',
  'concern',
  'late',
  'missing',
];

const GRANT_CLASSIFIERS: Array<{ classification: GrantClassification; keywords: string[] }> = [
  { classification: 'proposal', keywords: ['proposal', 'application', 'submission', 'narrative', 'scope', 'grant'] },
  { classification: 'budget', keywords: ['budget', 'cost', 'finance', 'funding', 'expense', 'allocation'] },
  { classification: 'compliance', keywords: ['compliance', 'reporting', 'audit', 'requirement', 'regulation', 'policy'] },
  { classification: 'partner communication', keywords: ['partner', 'stakeholder', 'consortium', 'vendor', 'coordination', 'meeting'] },
];

const normalizeText = (text: string): string =>
  text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

const splitSentences = (text: string): string[] =>
  normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const dedupe = (items: string[]): string[] => [...new Set(items.map((item) => item.trim()).filter(Boolean))];

export const detectLanguage = (text: string): SupportedLanguage => {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) {
    return 'unknown';
  }

  const detectedRule = LANGUAGE_RULES.find(({ pattern }) => pattern.test(normalized));
  return detectedRule?.language ?? 'en';
};

export const detectSentiment = (text: string): string => {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) {
    return 'neutral';
  }

  const positiveScore = POSITIVE_WORDS.reduce(
    (score, word) => score + (normalized.includes(word) ? 1 : 0),
    0,
  );
  const negativeScore = NEGATIVE_WORDS.reduce(
    (score, word) => score + (normalized.includes(word) ? 1 : 0),
    0,
  );

  if (negativeScore >= 2) {
    return 'urgent';
  }

  if (negativeScore === 1 && positiveScore === 0) {
    return 'concerned';
  }

  if (positiveScore >= 2) {
    return 'positive';
  }

  if (normalized.includes('please') || normalized.includes('could you')) {
    return 'polite';
  }

  return 'neutral';
};

export const extractTasks = (text: string): string[] => {
  const sentences = splitSentences(text);
  const listItems = normalizeText(text)
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => TASK_PATTERN.test(line));

  const taskSentences = sentences.filter((sentence) => TASK_PATTERN.test(sentence));
  return dedupe([...listItems, ...taskSentences]).slice(0, 5);
};

export const extractDeadlines = (text: string): string[] =>
  dedupe(Array.from(normalizeText(text).matchAll(DEADLINE_PATTERN), (match) => match[0])).slice(0, 5);

export const extractCommitments = (text: string): string[] =>
  splitSentences(text)
    .filter((sentence) => COMMITMENT_PATTERN.test(sentence))
    .slice(0, 5);

export const classifyGrantIntent = (text: string): GrantClassification => {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) {
    return 'general correspondence';
  }

  const match = GRANT_CLASSIFIERS.find(({ keywords }) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  );

  return match?.classification ?? 'general correspondence';
};

const buildSummary = (subject: string, text: string, tasks: string[]): string => {
  const sentences = splitSentences(text);
  const leadingSentences = sentences.slice(0, 2).join(' ');

  if (tasks.length > 0) {
    return normalizeText(
      `${subject ? `${subject}. ` : ''}Key requested actions: ${tasks.slice(0, 2).join(' ')}`,
    );
  }

  if (leadingSentences) {
    return normalizeText(`${subject ? `${subject}. ` : ''}${leadingSentences}`);
  }

  return subject || 'No clear thread summary was detected.';
};

const buildNextSteps = (tasks: string[], commitments: string[], deadlines: string[]): string[] => {
  const steps = [
    ...tasks.map((task) => `Action: ${task}`),
    ...commitments.map((commitment) => `Track commitment: ${commitment}`),
    ...deadlines.map((deadline) => `Monitor deadline: ${deadline}`),
  ];

  if (steps.length === 0) {
    steps.push('Review the thread and confirm the next owner before sending.');
  }

  return dedupe(steps).slice(0, 5);
};

const buildSubjectSuggestions = (
  subject: string,
  classification: GrantClassification,
  summary: string,
  deadlines: string[],
): string[] => {
  const trimmedSubject = subject.trim();
  const fallbackTopic = summary.replace(/\.$/, '').slice(0, 70) || 'Email follow-up';
  const deadlineSuffix = deadlines[0] ? ` — ${deadlines[0]}` : '';

  return dedupe([
    trimmedSubject,
    `${classification === 'general correspondence' ? 'Follow-up' : classification.replace(/\b\w/g, (char) => char.toUpperCase())} update${deadlineSuffix}`,
    `${fallbackTopic}${deadlineSuffix}`,
  ]).slice(0, 3);
};

const buildSmartReplies = (
  sentiment: string,
  summary: string,
  nextSteps: string[],
  classification: GrantClassification,
): string[] => {
  const responsePrefix =
    sentiment === 'urgent'
      ? 'Acknowledged — I will prioritise this.'
      : sentiment === 'positive'
        ? 'Thanks for the update.'
        : 'Thanks for sharing this.';

  return dedupe([
    `${responsePrefix} ${summary}`,
    `I reviewed the thread. Proposed next steps: ${nextSteps.slice(0, 2).join(' ')}`,
    classification === 'general correspondence'
      ? 'I can take the next action and send a draft reply for review.'
      : `This appears to be ${classification}. I can prepare a focused response or summary.`,
  ]).slice(0, 3);
};

export const analyzeThreadContext = (threadContext: ThreadContext): ContextAnalysis => {
  const combinedText = normalizeText(
    [threadContext.subject, threadContext.lastMessage, threadContext.threadText].filter(Boolean).join('\n\n'),
  );
  const tasks = extractTasks(combinedText);
  const deadlines = extractDeadlines(combinedText);
  const commitments = extractCommitments(combinedText);
  const summary = buildSummary(threadContext.subject, combinedText, tasks);
  const classification = classifyGrantIntent(combinedText);
  const sentiment = detectSentiment(combinedText);
  const nextSteps = buildNextSteps(tasks, commitments, deadlines);

  return {
    language: detectLanguage(combinedText),
    sentiment,
    tasks,
    deadlines,
    commitments,
    summary,
    nextSteps,
    subjectSuggestions: buildSubjectSuggestions(
      threadContext.subject,
      classification,
      summary,
      deadlines,
    ),
    smartReplies: buildSmartReplies(sentiment, summary, nextSteps, classification),
    classification,
  };
};
