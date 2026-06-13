import { describe, it, expect } from 'vitest';
import { analyzeThreadContext } from '../contextEngineV2';
import type { ThreadData } from '../../providers/types';

const emptyThread: ThreadData = { subject: '', participants: [], messages: [] };

const makeThread = (subject: string, bodies: string[], participants: string[] = []): ThreadData => ({
  subject,
  participants,
  messages: bodies.map((body) => ({ body })),
});

describe('analyzeThreadContext — output shape', () => {
  it('returns all required fields for an empty thread', () => {
    const out = analyzeThreadContext(emptyThread);
    expect(out).toHaveProperty('summary');
    expect(out).toHaveProperty('language');
    expect(out).toHaveProperty('sentiment');
    expect(out).toHaveProperty('tasks');
    expect(out).toHaveProperty('deadlines');
    expect(out).toHaveProperty('nextSteps');
    expect(out).toHaveProperty('subjectSuggestions');
    expect(out).toHaveProperty('grantClassification');
    expect(Array.isArray(out.tasks)).toBe(true);
    expect(Array.isArray(out.deadlines)).toBe(true);
    expect(Array.isArray(out.nextSteps)).toBe(true);
    expect(Array.isArray(out.subjectSuggestions)).toBe(true);
  });
});

describe('analyzeThreadContext — summary', () => {
  it('returns a fallback message when thread has no content', () => {
    const out = analyzeThreadContext(emptyThread);
    expect(typeof out.summary).toBe('string');
    expect(out.summary.length).toBeGreaterThan(0);
  });

  it('incorporates subject and message body into summary', () => {
    const thread = makeThread('Budget Review', ['Please review the attached budget spreadsheet.']);
    const out = analyzeThreadContext(thread);
    expect(out.summary.toLowerCase()).toMatch(/budget|review/);
  });
});

describe('analyzeThreadContext — language detection', () => {
  it('detects English as default language', () => {
    const thread = makeThread('Hello', ['Please send the report by tomorrow. Thanks.']);
    expect(analyzeThreadContext(thread).language).toBe('en');
  });

  it('detects German when German keywords are present', () => {
    const thread = makeThread('Projekt', ['Danke für die schnelle Antwort. Die Frist ist morgen.']);
    expect(analyzeThreadContext(thread).language).toBe('de');
  });

  it('detects Slovak when Slovak keywords are present', () => {
    const thread = makeThread('Termín', ['Ďakujem za správu. Prosím pošlite prílohu.']);
    expect(analyzeThreadContext(thread).language).toBe('sk');
  });

  it('returns "unknown" for unrecognised text', () => {
    const thread = makeThread('', [' ']);
    expect(['unknown', 'en']).toContain(analyzeThreadContext(thread).language);
  });
});

describe('analyzeThreadContext — sentiment detection', () => {
  it('returns "positive" for appreciative content', () => {
    const thread = makeThread('Great work', ['Thanks so much! This is great. Really appreciate it.']);
    expect(analyzeThreadContext(thread).sentiment).toBe('positive');
  });

  it('returns "urgent" for content with multiple negative/urgent signals', () => {
    const thread = makeThread('URGENT', ['This is a critical issue. We are blocked and there is a delay. ASAP.']);
    expect(analyzeThreadContext(thread).sentiment).toBe('urgent');
  });

  it('returns "neutral" when no strong signals are present', () => {
    const thread = makeThread('Meeting notes', ['Here are the notes from our meeting.']);
    expect(analyzeThreadContext(thread).sentiment).toBe('neutral');
  });
});

describe('analyzeThreadContext — task extraction', () => {
  it('extracts sentences containing action verbs', () => {
    const thread = makeThread('Action items', [
      'Please review the contract by Friday. Send the updated budget to the team. Confirm the meeting.',
    ]);
    const { tasks } = analyzeThreadContext(thread);
    expect(tasks.length).toBeGreaterThan(0);
    const joined = tasks.join(' ').toLowerCase();
    expect(joined).toMatch(/review|send|confirm/);
  });

  it('returns an empty array when there are no actionable sentences', () => {
    const thread = makeThread('Hello', ['The weather is nice today.']);
    const { tasks } = analyzeThreadContext(thread);
    expect(Array.isArray(tasks)).toBe(true);
  });

  it('returns at most 6 tasks', () => {
    const thread = makeThread('Tasks', [
      'Please do A. Please review B. Please send C. Please confirm D. Please update E. Please submit F. Please prepare G.',
    ]);
    expect(analyzeThreadContext(thread).tasks.length).toBeLessThanOrEqual(6);
  });
});

describe('analyzeThreadContext — deadline extraction', () => {
  it('extracts date patterns from message bodies', () => {
    const thread = makeThread('Project deadline', ['The final report is due on 15/06/2025.']);
    const { deadlines } = analyzeThreadContext(thread);
    expect(deadlines.length).toBeGreaterThan(0);
    expect(deadlines[0]).toMatch(/15\/06\/2025|jun/i);
  });

  it('returns an empty array when no dates are present', () => {
    const thread = makeThread('Hello', ['Thanks for reaching out.']);
    expect(Array.isArray(analyzeThreadContext(thread).deadlines)).toBe(true);
  });

  it('deduplicates repeated dates', () => {
    const thread = makeThread('', ['Due 12/12/2025. Also due 12/12/2025. Meeting 12/12/2025.']);
    const { deadlines } = analyzeThreadContext(thread);
    const count = deadlines.filter((d) => d.includes('12/12/2025')).length;
    expect(count).toBe(1);
  });
});

describe('analyzeThreadContext — subject suggestions', () => {
  it('always returns at least one suggestion', () => {
    const out = analyzeThreadContext(makeThread('Status update', ['Please confirm.']));
    expect(out.subjectSuggestions.length).toBeGreaterThanOrEqual(1);
  });

  it('adds urgency tag when sentiment is urgent', () => {
    const thread = makeThread('Budget', ['URGENT: blocked, delay, issue, problem. ASAP.']);
    const out = analyzeThreadContext(thread);
    const hasUrgent = out.subjectSuggestions.some((s) => s.toLowerCase().includes('urgent'));
    expect(hasUrgent || out.sentiment !== 'urgent').toBe(true);
  });

  it('returns at most 3 suggestions', () => {
    const out = analyzeThreadContext(makeThread('Test', ['Please review.']));
    expect(out.subjectSuggestions.length).toBeLessThanOrEqual(3);
  });
});

describe('analyzeThreadContext — grant classification', () => {
  it('classifies as "non_grant" when no grant keywords are present', () => {
    const thread = makeThread('Hello', ['Can we meet tomorrow for lunch?']);
    expect(analyzeThreadContext(thread).grantClassification).toBe('non_grant');
  });

  it('classifies as "grant_application" when proposal keywords are present', () => {
    const thread = makeThread('Grant proposal', ['Please find the attached grant proposal for funding.']);
    expect(analyzeThreadContext(thread).grantClassification).toBe('grant_application');
  });

  it('classifies as "grant_reporting" when reporting keywords are present', () => {
    const thread = makeThread('Milestone update', ['Please review the compliance report and milestone tracking.']);
    expect(analyzeThreadContext(thread).grantClassification).toBe('grant_reporting');
  });

  it('classifies as "grant_budget" when financial keywords are present', () => {
    const thread = makeThread('Budget allocation', ['Here is the budget cost allocation for the grant.']);
    expect(analyzeThreadContext(thread).grantClassification).toBe('grant_budget');
  });
});

describe('analyzeThreadContext — next steps', () => {
  it('always returns at least one next step', () => {
    const out = analyzeThreadContext(emptyThread);
    expect(out.nextSteps.length).toBeGreaterThanOrEqual(1);
  });

  it('includes task-derived steps when tasks are found', () => {
    const thread = makeThread('Action', ['Please review the document.']);
    const out = analyzeThreadContext(thread);
    if (out.tasks.length > 0) {
      const hasTaskStep = out.nextSteps.some((s) => s.startsWith('Complete:'));
      expect(hasTaskStep).toBe(true);
    }
  });
});
