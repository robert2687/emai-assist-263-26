
import { EmailDraft, EmailMode, Tone } from '../types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const NEMOTRON_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

const constructPrompt = (
  userInput: string,
  emailContext: string,
  writingStyleSample: string,
  emailMode: EmailMode,
  selectedTones: Tone[],
  signature: string,
  includeSignature: boolean
): string => {
  let basePrompt = `You are Email Assistant — an advanced AI system specialized in drafting, rewriting, optimizing, and managing email communication with professional, context-aware, and human-like quality.

CORE CAPABILITIES & RULES:
- Use clear, concise, human-like language. Avoid unnecessary jargon.
- Keep paragraphs short and readable.
- Maintain a polite, respectful tone by default. Adapt tone dynamically based on user instructions.
- Never invent facts, dates, names, or commitments.
- Every drafted email should follow this structure unless specified otherwise: 1. Greeting, 2. Short contextual introduction, 3. Main message, 4. Action items/next steps, 5. Polite closing line.
- Translate emails between SK/EN/CZ/DE while preserving tone and intent if requested.

EXTENDED CAPABILITIES & BEHAVIOR:
1. Multi-Agent Workflow: Simulate a multi-agent architecture internally:
   - Email Drafting Agent: Generate initial content.
   - Tone Refinement Agent: Adjust tone and sentiment.
   - Subject Line Agent: Generate subject lines.
   - Proofreading Agent: Check grammar and clarity.
2. Sentiment Detection & Tone Adjustment: Analyze the emotional tone of the user instructions and email context. Include the detected sentiment in the JSON output.
3. Automatic Subject Line Generation: Generate a clear, concise, professional subject line. Provide 1-3 alternative options in the 'alternatives' object.
`;

  if (emailMode === 'Formal') {
    basePrompt += "\nMODE: Formal. The tone should be respectful, clear, and concise. Avoid slang, contractions, and overly casual language.";
  } else if (emailMode === 'Friendly') {
    basePrompt += "\nMODE: Friendly. The tone should be warm, engaging, and conversational. You can use contractions and more relaxed language, but maintain grammatical correctness.";
  } else if (emailMode === 'Concise') {
    basePrompt += "\nMODE: Concise. Keep the email brief, direct, and action-oriented while preserving clarity and professionalism.";
  } else {
    basePrompt += "\nMODE: Grant Ready. Optimise for proposal, budget, compliance, or partner communication workflows. Highlight commitments, deadlines, and next actions with precise wording.";
  }

  if (selectedTones.length > 0) {
    basePrompt += `\n\nAdditionally, please adjust the tone of the emails to be: ${selectedTones.join(', ')}.`;
  }

  if (writingStyleSample.trim()) {
    basePrompt += `\n\nThe following is a sample of the user's writing style. Please analyze it and adapt the generated email drafts to mimic this style:\n\n---\n${writingStyleSample}\n---`;
  }

  if (emailContext.trim()) {
    basePrompt += `\n\nThe following is the previous email thread for context:\n\n---\n${emailContext}\n---`;
  }

  if (includeSignature) {
    if (signature.trim()) {
      basePrompt += `\n\nAppend the following signature block to the end of every drafted email body:\n---\n${signature}\n---`;
    } else {
      basePrompt += `\n\nAppend a default signature block using placeholders like [Full Name], [Role / Company], [Phone Number].`;
    }
  }

  basePrompt += `\n\nUSER INSTRUCTION:\n"${userInput}"`;
  basePrompt += `\n\nProvide the output as a JSON object with an "emails" array containing THREE separate versions. Each item must have: "subject" (string), "body" (string), "sentiment" (string), and "alternatives" (object with "subject_lines" array of 1-3 strings). Output valid JSON only.`;

  return basePrompt;
};

export const generateEmailsWithNemotron = async (
  userInput: string,
  emailContext: string,
  writingStyleSample: string,
  emailMode: EmailMode,
  selectedTones: Tone[],
  apiKey: string,
  signature: string = "",
  includeSignature: boolean = true
): Promise<EmailDraft[]> => {
  if (!apiKey) {
    throw new Error("API Key is required");
  }

  const prompt = constructPrompt(userInput, emailContext, writingStyleSample, emailMode, selectedTones, signature, includeSignature);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NEMOTRON_MODEL,
        messages: [
          { role: 'system', content: 'You are an expert email writing assistant. Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as any)?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenRouter API.");
    }

    const parsed = JSON.parse(content);
    if (parsed.emails && Array.isArray(parsed.emails) && parsed.emails.length > 0) {
      return parsed.emails as EmailDraft[];
    }
    throw new Error("Invalid response format from OpenRouter API.");
  } catch (error) {
    console.error("Error calling Nemotron API:", error);
    throw new Error(`Failed to generate emails from the Nemotron API: ${error instanceof Error ? error.message : String(error)}`);
  }
};
