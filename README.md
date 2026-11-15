# Mindful Coach

Mindful Coach is a calm, mobile-first wellness app for tracking daily energy, sleep, steps, and guided mindfulness sessions, with supportive educational coaching guidance. No account is required.

It is built with React, TypeScript, Vite, and Express. Personal wellness data stays in your browser's local storage by default. Live coach requests require explicit pre-send user consent and are routed through a server-side Gemini integration when configured; otherwise, the app uses a built-in curated Demo Coach.

## Features

- **Local onboarding** with a preferred name (validated by visual grapheme count) and a primary wellness goal (`Sleep`, `Stress`, `Energy`, or `Weight`).
- **Daily check-ins** for self-reported energy (`1–10`, displayed as `10–100`), sleep (`0–24` hours), steps (`0+`, manual entry), and an optional reflective note (up to `500` characters), stored by local calendar date.
- **Reflective notes journal** on Home, sortable newest-first or oldest-first.
- **Gentle reminders** for a morning check-in and evening reflection with customizable local times (including overnight schedules), completion checks that keep morning sessions separate from evening reflection reminders, daily dismissal pruning, and optional deduplicated browser notifications.
- **Seven-day trends**: a lazy-loaded Recharts chart of daily energy and completed mindfulness sessions, an accessible text table, and **Mindful Streaks**.
- **Weekly wellness score** calculated transparently from recorded 7-day metrics: Energy `35%`, Sleep relative to a `7–9h` target `25%`, Consistency `25%`, and Movement toward `8,000` steps `15%`. Weights are redistributed across recorded categories only, so missing entries are never counted as zero.
- **Weekly progress report** on Home, generated on demand from the local statistics engine: a narrative summary, recorded highlights, next-week focus prompts, stale-data refresh detection, clipboard copy, and `.txt` export.
- **Score-based wellness tips**: collapsible insight cards synced live to your 7-day average score and active goal.
- **Export snippet**: copy or share a concise text summary of your weekly progress.
- **Guided sessions** (`Gentle breathing`, `Sleep wind-down`, `Mindfulness`, `Energy reset`): silent, text-guided, using wall-clock timers with an abandonment grace window (`15` minutes) and exact completion-instant timestamps that persist across tab navigation.
- **AI wellness coaching** through a server-routed Gemini integration with an explicit versioned consent gate (`Review before enabling Live AI`), curated Demo Coach fallback, multi-turn crisis context suppression, persistent **Crisis resources** dialog access, and safe plain-text/limited-Markdown rendering.
- **Privacy, resilience & cross-tab sync**: opt-in local chat-history persistence (off by default), React error-boundary view recovery preserving local data, transient storage error auto-recovery with bounded corrupt-JSON backups, cross-tab `localStorage` synchronization with deletion tombstones, and full local data deletion.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Recharts 3, self-hosted `@fontsource` typography (`Fraunces`, `Plus Jakarta Sans`, `JetBrains Mono`)
- **Backend:** Express 5 on Node.js with Helmet security headers
- **AI:** `@google/genai` SDK, primary model `gemini-4-hydrogen` with `gemini-3.1-flash-lite` failover (configurable via `GEMINI_MODELS`)
- **Quality & Testing:** ESLint, Prettier, TypeScript (`tsc --noEmit`), Node's built-in test runner (`node:test`) with `tsx --test` and `@testing-library/react` + `jsdom`, and GitHub Actions CI (`.github/workflows/ci.yml`)

Exact dependency versions are defined in `package.json`.

## Prerequisites

- **Node.js 22.18 or newer** (`engines.node` in `package.json`). `npm start` runs `node server.ts` directly using Node's native TypeScript type stripping.
- npm (or Bun, if you prefer)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

To enable Live AI coaching, set a server-side Gemini API key (never commit `.env`):

```env
GEMINI_API_KEY="your_server_side_gemini_api_key"
```

| Variable | Default / Required | Purpose |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Optional | Enables live Gemini coaching (falls back to `GOOGLE_API_KEY` or `API_KEY`). |
| `TRUST_PROXY` | `false` (Optional) | Express proxy trust config (`false`, hop count `1..5`, `loopback`/`linklocal`/`uniquelocal`, or proxy IP/CIDR allowlist; blanket `"true"` is rejected). |
| `GEMINI_MODELS` | `gemini-4-hydrogen,gemini-3.1-flash-lite` | Ordered failover model IDs. |
| `GEMINI_THINKING_MODELS` | `gemini-4-hydrogen` | Comma-separated models supporting `ThinkingLevel.LOW`. |
| `ENABLE_HSTS` | `false` | Enables `Strict-Transport-Security` header in production (`NODE_ENV=production`). |
| `CSP_FRAME_ANCESTORS` | empty (`'none'`) | Optional comma-separated allowed iframe ancestor origins for Helmet CSP `frame-ancestors`. |
| `COACH_MAX_CONCURRENCY` | `4` | Max concurrent server-to-Gemini requests. |
| `COACH_MAX_QUEUE` | `12` | Max queued requests before returning HTTP `503` (`SERVICE_BUSY`). |
| `COACH_GLOBAL_RPM` | `120` | Process-wide Live AI requests-per-minute ceiling. |
| `COACH_GLOBAL_CHAR_BUDGET_PER_MIN` | `400000` | Process-wide Live AI input character budget per minute. |
| `VITE_ENABLE_TEST_AUTOSTART` | `false` | Allows `?autostart=1` onboarding bypass in production builds (`true` in dev automatically). |
| `APP_URL` | Optional | Hosting metadata supplied by deployment environments. |

If no Gemini key is set, the app runs normally in Demo Coach mode with built-in wellness guidance.

### 3. Run the app

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express + Vite development server on port `3000`. |
| `npm test` | Runs all unit and React/JSDOM integration test suites (`tsx --test tests/*.test.ts tests/*.test.tsx`). |
| `npm run typecheck` | Runs strict TypeScript checking (`tsc --noEmit` with `noUnusedLocals` & `noUnusedParameters`). |
| `npm run lint` | Runs ESLint across all TypeScript, TSX, server, and test files. |
| `npm run format` | Formats files with Prettier. |
| `npm run format:check` | Verifies Prettier formatting without modifying files. |
| `npm run build` | Builds code-split production bundles into `dist/`. |
| `npm run preview` | Previews the built client bundle with Vite only (Express `/api` routes are inactive, so Coach uses Demo Coach). |
| `npm start` | Starts the Express production server (`NODE_ENV=production node server.ts`; run `npm run build` first). |
| `npm run clean` | Removes the `dist` build directory. |

### Production

```bash
npm run build
npm start
```

In production (`NODE_ENV=production`), `server.ts` verifies that `dist/index.html` exists and serves the app with Helmet security headers (`default-src 'self'`, `script-src 'self'`, `font-src 'self' data:`, `object-src 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `frame-ancestors`). Notice that per-IP and global rate limiters are process-local in memory; multi-instance production deployments should place rate limiting at a shared gateway or Redis store and configure `TRUST_PROXY` explicitly for your reverse proxy hop topology.

## Project Structure

```text
.
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── .prettierignore
├── .prettierrc
├── CHANGELOG.md
├── LICENSE
├── README.md
├── eslint.config.mjs
├── index.html
├── metadata.json
├── package.json
├── bun.lock
├── server.ts
├── server/
│   ├── config.ts
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   └── rateLimiter.ts
│   ├── routes/
│   │   └── coachRoutes.ts
│   └── services/
│       └── geminiCoachService.ts
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── reminders/
│   │   └── ui/              # ConfirmDialog, CrisisResourcesDialog, AppErrorBoundary
│   ├── data/
│   │   ├── demoCoachResponses.ts
│   │   ├── goals.ts
│   │   └── guidedSessions.ts
│   ├── features/
│   │   ├── coach/
│   │   ├── home/
│   │   ├── onboarding/
│   │   ├── profile/
│   │   └── sessions/
│   ├── hooks/
│   │   ├── useCoachChat.ts
│   │   ├── useEnvironmentState.ts
│   │   ├── useReminderNotifications.ts
│   │   ├── useSessionPlayer.ts
│   │   └── useWellnessStore.ts
│   ├── index.css
│   ├── lib/
│   │   ├── dateUtils.ts
│   │   ├── reminders.ts
│   │   ├── sessionTimer.ts
│   │   ├── validation.ts
│   │   └── wellnessMetrics.ts
│   ├── main.tsx
│   ├── services/
│   │   ├── coachApiClient.ts
│   │   └── storageService.ts
│   ├── shared/              # Shared validation & safety logic across client and server
│   │   ├── apiTypes.ts
│   │   └── coachSafety.ts
│   └── types/
│       └── wellness.ts
├── tests/
│   ├── coachAndServer.test.ts
│   ├── dateAndValidation.test.ts
│   ├── reminders.test.ts
│   ├── sessionTimer.test.ts
│   ├── storageService.test.ts
│   ├── uiAndHooks.test.tsx
│   └── wellnessMetrics.test.ts
├── tsconfig.json
└── vite.config.ts
```

## Server API

### `GET /api/coach/status`

Reports whether live Gemini credentials are configured on the server.

```json
{
  "liveAiAvailable": true
}
```

### `POST /api/coach/chat`

Returns a coaching reply or an urgent safety resource notice.

Request body:

| Field | Type | Notes |
| :--- | :--- | :--- |
| `message` | string | Required. Non-empty, at most `1,200` characters (`64kb` max JSON body). |
| `goal` | string | Optional wellness focus (`sleep`, `stress`, `energy`, or `weight`). |
| `history` | array | Optional recent turns as `{ "role": "user" \| "assistant", "content": string }`. |

Behavior, in order of evaluation:

1. **Validation:** empty, non-JSON (`400`), oversized messages (`> 1,200` chars, `400`), and oversized request bodies (`> 64kb`, `413`) are rejected before upstream calls.
2. **Crisis & follow-up interception:** urgent self-harm, medical-emergency, and ambiguous distress phrases (normalized across Unicode NFKC, typographic punctuation, and zero-width characters) as well as short ambiguous follow-ups to recent crisis turns are answered locally with `mode: "demo"` and `isCrisisNotice: true`, bypassing rate limits and external Gemini transmission. Prior crisis turns and canned safety responses are also stripped from conversation history sent upstream.
3. **Rate limiting & resource guards:** per-IP sliding window (`15` requests / `60s`, pruning expired entries with an overflow bucket instead of evicting active clients), global request/character budget (`120 RPM`, `400k chars/min`), and bounded concurrency semaphore (`4` active, `12` queued), returning `429` or `503` with `Retry-After` headers when exceeded.
4. **Model failover:** normalizes up to `6` recent alternating turns within cumulative character bounds (`5,500` chars) and invokes configured models (`gemini-4-hydrogen`, then `gemini-3.1-flash-lite`) within a `20`-second overall deadline without retrying non-retryable `400`/`401`/`403` errors.

## Privacy and Safety

- Wellness entries, Mindful Streaks, reflective notes, weekly scores, progress reports, and shareable snippets are computed and stored locally in browser `localStorage` (falling back to session memory if storage is blocked or full). They are never sent to the server and leave the device only if you copy or share them.
- Live AI requests only happen after you explicitly acknowledge the Live AI disclosure (`Review before enabling Live AI`). Even then, only the current message, sanitized non-crisis conversation turns, and your selected wellness goal are sent to Gemini—never your preferred name, daily check-ins, or crisis turns. Demo Coach mode makes zero external AI calls.
- Chat-history persistence is off by default and can be toggled in **Profile**. You can clear chat history or delete all local data from **Profile**.
- **Educational Scope & Limitations:** Mindful Coach provides general wellness education only. It does not diagnose, treat, or prescribe, and automated safety phrase detection is a best-effort educational safeguard—not clinical triage or guaranteed crisis detection. If you are in immediate danger or experiencing a medical or mental health emergency, contact local emergency services (`911`/`988` in the US & Canada, `999`/`111` in the UK, `112` in the EU, `000` in Australia) or visit [findahelpline.com](https://findahelpline.com).

## Release History

See [CHANGELOG.md](./CHANGELOG.md) for releases and fixes.

## License

Licensed under the Apache License, Version 2.0 (`SPDX-License-Identifier: Apache-2.0`). See [LICENSE](./LICENSE) for the full text.
