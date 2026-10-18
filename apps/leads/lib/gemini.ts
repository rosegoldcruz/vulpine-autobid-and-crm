import { GoogleGenAI } from '@google/genai';

type GenerateContentArgs = {
  model: string;
  contents: string;
  config?: {
    responseMimeType?: string;
  };
};

type GenerateContentResult = {
  text?: string;
};

type LlmClient = {
  models: {
    generateContent: (args: GenerateContentArgs) => Promise<GenerateContentResult>;
  };
};

function normalizeOpenAiText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function buildOpenAiCompatClient(): LlmClient {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  if (!apiKey || !baseUrl) {
    throw new Error('LLM_API_KEY and LLM_BASE_URL are required for openai-compatible provider.');
  }

  return {
    models: {
      async generateContent(args: GenerateContentArgs) {
        const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: args.model,
            messages: [{ role: 'user', content: args.contents }],
          }),
          cache: 'no-store',
        });

        if (!response.ok) {
          const raw = await response.text();
          throw new Error(`openai-compatible request failed (${response.status}): ${raw.slice(0, 400)}`);
        }

        const json: any = await response.json();
        const text = normalizeOpenAiText(json?.choices?.[0]?.message?.content);
        return { text };
      },
    },
  };
}

function buildGeminiClient(): LlmClient {
  const key = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Missing LLM_API_KEY (or GEMINI_API_KEY) for gemini provider.');
  }

  const client = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return {
    models: {
      async generateContent(args: GenerateContentArgs) {
        const response = await client.models.generateContent({
          model: args.model,
          contents: args.contents,
          config: args.config,
        });
        return { text: response.text };
      },
    },
  };
}

let clientCache: LlmClient | null = null;

export function getGeminiClient(): LlmClient {
  if (clientCache) {
    return clientCache;
  }

  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  clientCache = provider === 'openai-compatible' ? buildOpenAiCompatClient() : buildGeminiClient();
  return clientCache;
}

export const GEMINI_TEXT_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';

export function parseMarkdownJson(markdownText: string): any {
  try {
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/i;
    const match = markdownText.match(jsonBlockRegex);
    const rawJson = match ? match[1] : markdownText;
    return JSON.parse(rawJson.trim());
  } catch (error) {
    console.error('Failed to parse JSON from LLM response:', error, markdownText);
    throw new Error('Invalid structured AI output');
  }
}
