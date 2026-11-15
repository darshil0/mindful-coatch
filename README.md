# Mindful Coach

Mindful Coach is a calm, mobile-first wellness app for tracking daily energy, sleep, steps, and guided mindfulness sessions, with supportive coaching guidance. No account is required.

It is built with React, TypeScript, Vite, and Express. Personal wellness data stays in your browser's local storage by default. Live coach requests are routed through a server-side AI integration when one is configured; otherwise the app uses a built-in Demo Coach.

## Features

- **Local onboarding** with a preferred name and a primary wellness goal (Sleep, Stress, Energy, or Weight).
- **Daily check-ins** for self-reported energy (`1–10`, displayed as `10–100`), sleep (`0–24` hours), steps (`0+`, manual entry), and an optional reflective note (up to `500` characters), stored by local calendar date.
- **Reflective notes journal** on Home, sortable newest-first or oldest-first.
- **Gentle reminders** for a morning check-in and evening reflection, with customizable local times (morning must be earlier than evening when both are enabled), daily dismissal pruning, and optional browser notifications.
- **Seven-day trends**: a Recharts chart of daily energy and completed mindfulness sessions, an accessible text table, and **Mindful Streaks**.
- **Weekly wellness score** calculated transparently from recorded 7-day metrics: Energy `35%`, Sleep relative to a `7–9h` target `25%`, Consistency `25%`, and Movement toward `8,000` steps `15%`. Weights are redistributed across recorded categories only, so missing entries are never counted as zero.
- **Weekly progress report** on Home, generated on demand from the local statistics engine: a narrative summary, recorded highlights, next-week focus prompts, stale-data refresh detection, clipboard copy, and `.txt` export.
- **Score-based wellness tips**: collapsible insight cards tied to your 7-day average score and active goal.
- **Export snippet**: copy or share a concise text summary of your weekly progress.
- **Guided sessions** (Gentle breathing, Sleep wind-down, Mindfulness, Energy reset): silent, text-guided, using wall-clock timers that keep running across tab navigation.
- **AI wellness coaching** through a server-routed Gemini integration, with a curated Demo Coach fallback and immediate client- and server-side urgent-crisis detection.
- **Privacy controls**: opt-in local chat-history persistence (off by default) and full local data deletion.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Recharts 3
- **Backend:** Express 5 on Node.js
- **AI:** `@google/genai` SDK, primary model `gemini-4-hydrogen` with `gemini-3.1-flash-lite` as failover
- **Testing:** Node's built-in test runner (`node:test`), executed with `tsx --test`

Exact dependency versions are pinned in `package.json`.

## Prerequisites

- Node.js **22.18 or newer**. `npm start` runs `node server.ts` directly and relies on Node's built-in TypeScript type stripping, which is enabled by default from 22.18.
- npm (or Bun, if you prefer)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

Or with Bun:

```bash
bun install
```

### 2. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

To enable live AI coaching, set a Gemini API key. Keep it server-side only and never commit `.env`:

```env
GEMINI_API_KEY="your_server_side_gemini_api_key"
```

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | No | Enables live Gemini coaching. |
| `GOOGLE_API_KEY`, `API_KEY` | No | Fallbacks used only if `GEMINI_API_KEY` is not set. |
| `APP_URL` | No | Hosting metadata supplied by some deployment environments. |

If no key is set, the app runs normally in Demo Coach mode with built-in wellness guidance.

### 3. Run the app

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express + Vite development server on port `3000`. |
| `npm test` | Runs the unit test suite (`tsx --test tests/*.test.ts`). |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`). |
| `npm run build` | Builds the production client bundle into `dist/`. |
| `npm run preview` | Previews the built client bundle with Vite only. The Express API is not running, so the coach falls back to Demo Coach. |
| `npm start` | Starts the Express server (`node server.ts`). Run `npm run build` first and set `NODE_ENV=production` so it serves `dist/`. |
| `npm run clean` | Removes build artifacts (`dist`, `server.js`). |

### Production

```bash
npm run build
NODE_ENV=production npm start
```

## Project Structure

```text
.
├── .env.example
├── .gitignore
├── CHANGELOG.md
├── LICENSE
├── README.md
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
│   │   └── ui/
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
│   ├── shared/            # code shared by client and server
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
| `message` | string | Required. Non-empty, at most `1,200` characters. |
| `goal` | string | The user's goal as a lowercase id: `sleep`, `stress`, `energy`, or `weight`. |
| `history` | array | Optional recent turns as `{ "role": "user" \| "assistant", "content": string }`. |

```json
{
  "message": "How can I wind down before bed?",
  "goal": "sleep",
  "history": [
    { "role": "user", "content": "I am stressed" },
    { "role": "assistant", "content": "Let's slow down together." }
  ]
}
```

Response:

```json
{
  "reply": "A gentle wind-down routine can help signal that it is time to rest.",
  "mode": "live",
  "isCrisisNotice": false
}
```

`mode` is `"live"` when Gemini answered and `"demo"` for Demo Coach or crisis notices.

Behavior, in order of evaluation:

1. **Validation:** empty or oversized messages are rejected with HTTP `400`.
2. **Crisis detection:** urgent self-harm or medical-emergency language is intercepted immediately and returns `mode: "demo"` with `isCrisisNotice: true`. This happens before rate limiting and before Gemini is contacted.
3. **Rate limiting:** a sliding-window limit of `15` requests per `60` seconds per IP. Exceeding it returns HTTP `429` with code `RATE_LIMITED`.
4. **Model failover:** up to `6` recent alternating history turns are normalized, then `gemini-4-hydrogen` is tried, followed by `gemini-3.1-flash-lite`, within a `20`-second overall deadline. Upstream failures return `502`, `503`, or `504`, and the client then falls back to Demo Coach.

## Privacy and Safety

- Wellness entries, Mindful Streaks, reflective notes, weekly scores, progress reports, and shareable snippets are computed and stored locally in browser `localStorage` (falling back to session memory if storage is blocked or full). They are never sent to the server and leave the device only if you copy or share them.
- When live AI coaching is enabled, the text of your coach messages, your selected goal, and up to `6` recent chat turns are sent to the app's server and on to the Gemini API to generate a reply. Do not include information in coach messages that you would not want processed by that service. Demo Coach mode makes no external AI calls.
- Chat-history persistence is off by default and can be enabled in **Profile**. You can delete all local data from the same screen.
- Mindful Coach provides general wellness education only. It does not diagnose, treat, or prescribe, and it is not a substitute for professional medical or mental-health care.
- When urgent medical or self-harm language is detected, both client and server prioritize crisis guidance over routine coaching. The built-in resources reference `911` and `988`, which are US numbers; if you are elsewhere, contact your local emergency services or crisis line.

## Release History

See [CHANGELOG.md](./CHANGELOG.md) for releases and fixes.

## License

Licensed under the Apache License, Version 2.0 (`SPDX-License-Identifier: Apache-2.0`). See [LICENSE](./LICENSE) for the full text.
