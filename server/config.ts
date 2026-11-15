export interface CandidateModelConfig {
  id: string;
  supportsThinkingLow: boolean;
}

export type TrustProxyConfig = boolean | number | string | string[];

export const SERVER_PORT = parsePositiveInt(process.env.PORT, 3000, 1, 65535);

const DEFAULT_MODEL_CONFIGS: readonly CandidateModelConfig[] = [
  { id: 'gemini-4-hydrogen', supportsThinkingLow: true },
  { id: 'gemini-3.1-flash-lite', supportsThinkingLow: false },
];

const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,80}$/i;
const SAFE_TRUST_PROXY_NAMED = new Set(['loopback', 'linklocal', 'uniquelocal']);
const SAFE_IP_OR_CIDR_PATTERN =
  /^([0-9]{1,3}(\.[0-9]{1,3}){3}(\/\d{1,2})?|[0-9a-f:]+(\/\d{1,3})?)$/i;

export function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (!raw || !raw.trim()) return fallback;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

/**
 * Resolves Express `trust proxy` setting cleanly.
 * Defaults to `false` (off) so untrusted X-Forwarded-For headers cannot spoof client IPs.
 * Rejects unsafe blanket `"true"` unless explicitly overridden cleanly with hop count,
 * loopback/linklocal/uniquelocal keywords, or specific IP/CIDR allowlist.
 */
export function resolveTrustProxyConfig(
  raw: string | undefined = process.env.TRUST_PROXY
): TrustProxyConfig {
  const value = (raw ?? '').trim();
  if (!value || value.toLowerCase() === 'false' || value === '0') {
    return false;
  }
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (!Number.isInteger(hops) || hops < 1 || hops > 5) {
      throw new Error(
        `Invalid TRUST_PROXY hop count "${value}". Expected integer 1..5 or specific proxy IP/CIDR.`
      );
    }
    return hops;
  }
  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (!SAFE_TRUST_PROXY_NAMED.has(lower) && !SAFE_IP_OR_CIDR_PATTERN.test(part)) {
      throw new Error(
        `Invalid TRUST_PROXY entry "${part}". Use "false", hop count 1..5, "loopback", or explicit proxy IP/CIDR.`
      );
    }
  }
  return parts.length === 1 ? parts[0] : parts;
}

/**
 * Resolves configured candidate Gemini models and their thinking capability flags.
 * Supports `GEMINI_MODELS` (comma-separated IDs) and `GEMINI_THINKING_MODELS`.
 */
export function resolveCandidateModels(
  modelsEnv: string | undefined = process.env.GEMINI_MODELS ?? process.env.GEMINI_MODEL,
  thinkingEnv: string | undefined = process.env.GEMINI_THINKING_MODELS
): CandidateModelConfig[] {
  const thinkingSet = new Set(
    (thinkingEnv ?? 'gemini-4-hydrogen')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

  if (!modelsEnv || !modelsEnv.trim()) {
    return DEFAULT_MODEL_CONFIGS.map((m) => ({
      id: m.id,
      supportsThinkingLow: m.supportsThinkingLow || thinkingSet.has(m.id),
    }));
  }

  const rawIds = modelsEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (rawIds.length === 0) {
    throw new Error('GEMINI_MODELS was set but contained no valid model identifiers.');
  }

  const seen = new Set<string>();
  const configs: CandidateModelConfig[] = [];
  for (const id of rawIds) {
    if (!MODEL_ID_PATTERN.test(id)) {
      throw new Error(`Invalid model identifier in GEMINI_MODELS: "${id}".`);
    }
    if (seen.has(id)) continue;
    seen.add(id);
    configs.push({
      id,
      supportsThinkingLow:
        thinkingSet.has(id) ||
        DEFAULT_MODEL_CONFIGS.some((d) => d.id === id && d.supportsThinkingLow),
    });
  }
  return configs;
}

export const SERVER_LIMITS = {
  maxConcurrentGeminiRequests: parsePositiveInt(
    process.env.COACH_MAX_CONCURRENCY,
    4,
    1,
    50
  ),
  maxGeminiQueueSize: parsePositiveInt(process.env.COACH_MAX_QUEUE, 12, 0, 200),
  globalMaxRequestsPerMin: parsePositiveInt(process.env.COACH_GLOBAL_RPM, 120, 1, 10000),
  globalMaxInputCharsPerMin: parsePositiveInt(
    process.env.COACH_GLOBAL_CHAR_BUDGET_PER_MIN,
    400_000,
    1000,
    10_000_000
  ),
};

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
