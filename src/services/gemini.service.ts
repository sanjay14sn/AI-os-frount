import { env } from '../config/env';
import { createError } from '../middleware/errorHandler';

const MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string; status?: string };
};

const cooledUntil = new Map<string, number>();
const retired = new Set<string>();

const isRetiredModel = (status: number, message: string) =>
  status === 404 || /no longer available|is not found|not supported for generateContent|deprecated/i.test(message);

const quotaWaitMs = (message: string) => {
  const hours = Number(message.match(/(\d+)h/)?.[1] || 0);
  const minutes = Number(message.match(/(\d+)m/)?.[1] || 0);
  const seconds = Number(message.match(/([\d.]+)s/)?.[1] || 0);
  const wait = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
  return wait > 0 ? wait : 60 * 60 * 1000;
};

const quotaMessage = (message: string) => {
  const wait = quotaWaitMs(message);
  const hours = Math.max(1, Math.round(wait / (60 * 60 * 1000)));
  return `Gemini's free daily quota is used up. It resets in about ${hours} hour${hours === 1 ? '' : 's'}.`;
};

const readError = (body: { error?: { message?: string; status?: string } }, status: number) => {
  const message = body?.error?.message || '';
  if (status === 401 || status === 403 || /service account|api key|unauthenticated/i.test(message)) {
    return 'Gemini rejected the API key. Create a new key in Google AI Studio and update GEMINI_API_KEY on the server.';
  }
  if (status === 429 || /quota|rate limit|resource_exhausted/i.test(message)) return quotaMessage(message);
  return message || 'Gemini request failed';
};

export const generateText = async (
  prompt: string,
  system?: string,
  history: { role: 'user' | 'model'; text: string }[] = [],
): Promise<string> => {
  if (!env.geminiApiKey) throw createError('Gemini is not configured', 503);

  const available = MODELS.filter((model) => !retired.has(model) && (cooledUntil.get(model) || 0) <= Date.now());
  if (available.length === 0) {
    throw createError('Gemini\'s free daily quota is used up. Try again in about 15 hours.', 429);
  }

  let lastMessage = 'Gemini request failed';
  for (const model of available) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: [
            ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
            { role: 'user', parts: [{ text: prompt }] },
          ],
        }),
      },
    );
    const body = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (response.ok) {
      const text = body?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim();
      if (text) return text;
      lastMessage = 'Gemini returned an empty response';
      continue;
    }
    const raw = body?.error?.message || '';
    if (isRetiredModel(response.status, raw)) {
      retired.add(model);
      lastMessage = 'No supported Gemini model is available for this API key';
      continue;
    }
    lastMessage = readError(body, response.status);
    const quotaHit = response.status === 429 || /quota|rate limit|resource_exhausted/i.test(raw);
    if (quotaHit) cooledUntil.set(model, Date.now() + quotaWaitMs(raw));
    if (quotaHit || response.status === 503 || response.status >= 500) continue;
    break;
  }
  throw createError(lastMessage, 502);
};

export const generateJson = async <T>(prompt: string, system?: string): Promise<T> => {
  const text = await generateText(`${prompt}\n\nReturn only a JSON object. Do not wrap it in markdown.`, system);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] || text).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw createError('Gemini did not return usable JSON', 502);
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    throw createError('Gemini did not return usable JSON', 502);
  }
};
