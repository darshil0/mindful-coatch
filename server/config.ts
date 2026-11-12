export const SERVER_PORT = 3000;

export const BASE_CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
] as const;

export type CandidateModelName = (typeof BASE_CANDIDATE_MODELS)[number];

export function resolveGeminiApiKey(): string {
  const rawKey = (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.API_KEY ??
    ''
  ).trim();
  if (!rawKey || rawKey === 'MY_GEMINI_API_KEY' || rawKey === 'YOUR_API_KEY') {
    return '';
  }
  return rawKey;
}

export function isLiveGeminiConfigured(): boolean {
  return resolveGeminiApiKey().length > 0;
}
