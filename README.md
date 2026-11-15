# Mindful Coach

Mindful Coach is a calm, mobile-first wellness app that helps people track daily energy, sleep, steps, and guided mindfulness sessions while offering supportive coaching guidance without requiring an account.

Built with React, TypeScript, Vite, and Express, the app keeps personal wellness data in local browser storage by default and routes live coach requests through a server-side AI integration when configured.

## Features

- Local onboarding with a preferred name and primary wellness goal (`Sleep`, `Stress`, `Energy`, or `Weight`)
- Daily wellness check-ins for self-reported energy (`1–10`, displayed as `10–100`), sleep (`0–24h`), steps (`0+`, manual entry), and optional reflective notes (`<= 500` characters) stored by local calendar date
- Chronological **Reflective notes** journal on Home with newest-first and oldest-first sorting
- Gentle morning check-in and evening reflection reminders with customizable local scheduling (`morning < evening` when both are enabled), daily dismissal pruning, and optional browser alerts
- Seven-day Recharts trend visualization (daily energy and completed mindfulness sessions), accessible text table, and **Mindful Streaks** tracking
- **Weekly wellness score** calculated transparently from recorded 7-day metrics (Energy `35%`, Sleep relative to `7–9h` `25%`, Consistency `25%`, Movement toward `8,000` steps `15%`), reweighting only across recorded categories so missing entries are never treated as zero
- On-demand **Weekly progress report** on Home built from the local statistics engine, featuring narrative summaries, recorded highlights, next-week focus prompts, stale-data refresh detection, clipboard copy, and `.txt` export
- Collapsible **Score-based wellness tips** insight cards synced live to your 7-day average score and active wellness focus
- One-click **Export snippet** panel to copy or share a concise text summary of weekly progress
- Silent, text-guided sessions (Gentle breathing, Sleep wind-down, Mindfulness, Energy reset) using wall-clock timers that persist across tab navigation
- Supportive wellness coaching via server-routed Gemini AI with a curated Demo Coach fallback and immediate client/server urgent crisis detection
- Privacy controls for opt-in local chat-history persistence (off by default) and full local data deletion

## Tech Stack

- Frontend: React 19, TypeScript 7, Vite 8, Tailwind CSS 4, Recharts 3
- Backend: Express 5, Node.js
- AI: `@google/genai` SDK (`gemini-4-hydrogen` with `gemini-3.1-flash-lite` failover)
- Testing: Node’s built-in test runner (`node:test`) executed with `tsx --test`

## Prerequisites

- Node.js 22 or newer (with native TypeScript stripping for `npm start`)
- npm (or Bun, if preferred)

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

Then set a Gemini API key if you want live AI coaching enabled:

```env
GEMINI_API_KEY="your_server_side_gemini_api_key"
```

If `GEMINI_API_KEY` (or optional `GOOGLE_API_KEY` / `API_KEY` fallback) is not set, the app continues working cleanly in Demo Coach mode with built-in wellness guidance. (`APP_URL` in `.env.example` is optional hosting metadata provided by deployment environments.)

### 3. Run the app

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express + Vite development server on port `3000` |
| `npm test` | Runs the unit test suite (`tsx --test tests/*.test.ts`) |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |
| `npm run build` | Builds the production client bundle into `dist/` |
| `npm run preview` | Previews the built Vite client bundle locally |
| `npm start` | Starts the Express server (`node server.ts`; run `npm run build` and set `NODE_ENV=production` to serve `dist/`) |
| `npm run clean` | Removes build artifacts (`dist`, `server.js`) |

## Project Structure

```text
.
├── .env.example
├── .gitignore
├── CHANGELOG.md
├── README.md
├── index.html
├── metadata.json
├── package.json
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
│   ├── shared/
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
├── vite.config.ts
└── bun.lock
```

## Server API

### `GET /api/coach/status`

Returns whether live Gemini credentials are configured on the server.

Response example:

```json
{
  "liveAiAvailable": true
}
```

### `POST /api/coach/chat`

Generates a coaching response or an urgent safety resource notice.

- **Validation & Safety:** Rejects empty or oversized messages (`> 1,200` characters) with HTTP `400`, and intercepts urgent self-harm or medical emergency language immediately (returning `mode: "demo"`, `isCrisisNotice: true`) before rate limiting or contacting Gemini.
- **Rate Limiting:** Enforces a sliding-window per-IP limit (`15` requests per `60` seconds), returning HTTP `429` (`RATE_LIMITED`) when exceeded.
- **Model Failover:** Normalizes up to `6` recent alternating history turns and tries `gemini-4-hydrogen` then `gemini-3.1-flash-lite` within a `20`-second overall deadline (returning `502`/`503`/`504` on upstream failures so the client falls back to Demo Coach).

Request body:

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

Response example:

```json
{
  "reply": "A gentle wind-down routine can help signal that it is time to rest.",
  "mode": "live",
  "isCrisisNotice": false
}
```

## Privacy and Safety

- Wellness entries, Mindful Streaks, reflective notes, weekly wellness scores, weekly progress reports, and shareable snippets are computed and stored locally in browser `localStorage` (falling back to session memory if storage is blocked or full) and never leave the device unless explicitly copied or shared by the user.
- Chat history persistence is disabled by default and can be toggled in **Profile**.
- Mindful Coach provides general wellness education only and does not diagnose, treat, or prescribe.
- When urgent medical or self-harm language is detected, both the client and server immediately prioritize crisis support guidance (`911` / `988`) over routine coaching.

## Release History

See [CHANGELOG.md](./CHANGELOG.md) for a full summary of releases and fixes.

## License

Licensed under the **Apache License, Version 2.0** (`SPDX-License-Identifier: Apache-2.0`).

```text
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
