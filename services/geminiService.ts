
import { GoogleGenAI, Type } from "@google/genai";
import { EmailDraft, EmailMode, Tone, GeminiResponse } from '../types';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    emails: {
      type: Type.ARRAY,
      description: "An array of 3 distinct email drafts.",
      items: {
        type: Type.OBJECT,
        properties: {
          subject: {
            type: Type.STRING,
            description: "A suitable subject line for the email.",
          },
          body: {
            type: Type.STRING,
            description: "The full body of the email, including salutation and closing.",
          },
          signature: {
            type: Type.STRING,
            description: "The signature block appended to the email.",
          },
          sentiment: {
            type: Type.STRING,
            description: "The detected sentiment of the email context or user instruction (e.g., neutral, positive, negative, frustrated, urgent, apologetic, enthusiastic, formal, informal).",
          },
          alternatives: {
            type: Type.OBJECT,
            properties: {
              subject_lines: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "1-3 alternative subject line options.",
              },
              tone_variants: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Optional tone variants.",
              }
            },
            required: ["subject_lines"]
          }
        },
        required: ["subject", "body", "sentiment", "alternatives"],
      },
    },
  },
  required: ["emails"],
};

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
2. Sentiment Detection & Tone Adjustment: Analyze the emotional tone of the user instructions and email context (e.g., neutral, positive, negative, frustrated, urgent, apologetic, enthusiastic). Soften harsh language, increase clarity, and maintain professionalism. Include the detected sentiment in the JSON output.
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

  let toneInstructions = "";
  if (selectedTones.length > 0) {
    toneInstructions = `\n\nAdditionally, please adjust the tone of the emails to be: ${selectedTones.join(', ')}.`;
  }
  
  let styleInstructions = "";
  if (writingStyleSample.trim()) {
    styleInstructions = `\n\nThe following is a sample of the user's writing style. Please analyze it and adapt the generated email drafts to mimic this style for greater authenticity:\n\n---\n${writingStyleSample}\n---`;
  }

  let contextInstructions = "";
  if (emailContext.trim()) {
    contextInstructions = `\n\nThe following is the previous email thread for context. Please generate a relevant reply or summary based on this thread:\n\n---\n${emailContext}\n---`;
  }

  let signatureInstructions = "";
  if (includeSignature) {
    if (signature.trim()) {
      signatureInstructions = `\n\nPlease append the following signature block to the end of every drafted email body:\n---\n${signature}\n---`;
    } else {
      signatureInstructions = `\n\nPlease append a default signature block to the end of every drafted email body using placeholders like [Full Name], [Role / Company], [Phone Number].`;
    }
  }

  const userRequest = `\n\nUSER INSTRUCTION:\n"${userInput}"`;
  const finalInstruction = "\n\nProvide the output as THREE separate versions in the requested JSON format, ensuring each has a unique 'subject' and 'body'. Do not include any other text or explanations outside of the JSON structure.";

  return basePrompt + toneInstructions + styleInstructions + contextInstructions + signatureInstructions + userRequest + finalInstruction;
};

export const generateEmails = async (
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
  
  const ai = new GoogleGenAI({ apiKey });
  const prompt = constructPrompt(userInput, emailContext, writingStyleSample, emailMode, selectedTones, signature, includeSignature);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.8,
      },
    });

    const jsonText = response.text.trim();
    const parsedResponse: GeminiResponse = JSON.parse(jsonText);
    
    if (parsedResponse.emails && Array.isArray(parsedResponse.emails) && parsedResponse.emails.length > 0) {
      return parsedResponse.emails;
    } else {
      throw new Error("Invalid response format from API.");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate emails from the API.");
  }
};
