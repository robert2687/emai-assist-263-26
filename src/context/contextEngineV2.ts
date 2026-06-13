import { ThreadData } from '../providers/types';

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

const POSITIVE_WORDS = ['great', 'thanks', 'appreciate', 'happy', 'excellent', 'glad', 'good'];
const NEGATIVE_WORDS = ['issue', 'problem', 'delay', 'late', 'concern', 'blocked', 'urgent'];
const TASK_VERBS = ['please', 'review', 'send', 'confirm', 'update', 'share', 'prepare', 'submit', 'schedule'];
const GRANT_KEYWORDS = ['grant', 'proposal', 'funder', 'funding', 'budget', 'milestone', 'compliance', 'report'];

const DATE_PATTERN = /\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?)\b/gi;

const collectCorpus = (thread: ThreadData): string => {
  const subjectPart = thread.subject || '';
  const messagePart = thread.messages.map((m) => m.body).join('\n');
  return `${subjectPart}\n${messagePart}`.trim();
};

const detectLanguage = (text: string): string => {
  const normalized = text.toLowerCase();
  if (/\b(ahoj|ďakujem|prosím|dnes|zajtra)\b/.test(normalized)) return 'sk';
  if (/\b(hello|thanks|please|tomorrow|deadline)\b/.test(normalized)) return 'en';
  if (/\b(hallo|danke|bitte|morgen|frist)\b/.test(normalized)) return 'de';
  if (/\b(ahoj|děkuji|prosím|zítra|termín)\b/.test(normalized)) return 'cs';
  return 'unknown';
};

const detectSentiment = (text: string): Sentiment => {
  const normalized = text.toLowerCase();
  const positiveScore = POSITIVE_WORDS.reduce((acc, word) => acc + (normalized.includes(word) ? 1 : 0), 0);
  const negativeScore = NEGATIVE_WORDS.reduce((acc, word) => acc + (normalized.includes(word) ? 1 : 0), 0);

  if (normalized.includes('asap') || normalized.includes('urgent')) {
    return 'urgent';
  }

  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
};

const splitIntoSentences = (text: string): string[] => {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const summarize = (thread: ThreadData): string => {
  const corpus = collectCorpus(thread);
  const sentences = splitIntoSentences(corpus);
  if (sentences.length === 0) return 'No content available to summarize.';
  return sentences.slice(0, 3).join(' ');
};

const extractTasks = (thread: ThreadData): string[] => {
  const sentences = splitIntoSentences(collectCorpus(thread).toLowerCase());
  const taskSentences = sentences.filter((sentence) => TASK_VERBS.some((verb) => sentence.includes(verb)));
  return taskSentences.slice(0, 6);
};

const extractDeadlines = (thread: ThreadData): string[] => {
  const corpus = collectCorpus(thread);
  const matches = corpus.match(DATE_PATTERN) ?? [];
  return [...new Set(matches.map((m) => m.trim()))].slice(0, 6);
};

const classifyGrant = (thread: ThreadData): GrantClassification => {
  const corpus = collectCorpus(thread).toLowerCase();
  const hasGrantSignals = GRANT_KEYWORDS.some((kw) => corpus.includes(kw));
  if (!hasGrantSignals) return 'non_grant';

  if (/(report|milestone|compliance|update)/.test(corpus)) return 'grant_reporting';
  if (/(budget|cost|finance|allocation)/.test(corpus)) return 'grant_budget';
  return 'grant_application';
};

const subjectSuggestions = (thread: ThreadData, tasks: string[], sentiment: Sentiment): string[] => {
  const baseSubject = thread.subject?.trim() || 'Follow-up';
  const taskSnippet = tasks[0]?.slice(0, 50) ?? 'next steps';
  const urgencyTag = sentiment === 'urgent' ? ' [Urgent]' : '';

  return [
    `${baseSubject}${urgencyTag}`,
    `Re: ${baseSubject} — ${taskSnippet}`,
    `Next steps on ${baseSubject || 'this thread'}`,
  ];
};

const buildNextSteps = (tasks: string[], deadlines: string[]): string[] => {
  const steps = [
    ...(tasks[0] ? [`Complete: ${tasks[0]}`] : []),
    ...(tasks[1] ? [`Coordinate: ${tasks[1]}`] : []),
    ...(deadlines[0] ? [`Track deadline: ${deadlines[0]}`] : []),
  ];

  return steps.length > 0 ? steps : ['Confirm owner and due date for the next action.'];
};

export const analyzeThreadContext = (thread: ThreadData): ContextEngineOutput => {
  const summary = summarize(thread);
  const language = detectLanguage(collectCorpus(thread));
  const sentiment = detectSentiment(collectCorpus(thread));
  const tasks = extractTasks(thread);
  const deadlines = extractDeadlines(thread);
  const nextSteps = buildNextSteps(tasks, deadlines);
  const grantClassification = classifyGrant(thread);

  return {
    summary,
    language,
    sentiment,
    tasks,
    deadlines,
    nextSteps,
    subjectSuggestions: subjectSuggestions(thread, tasks, sentiment),
    grantClassification,
  };
};
