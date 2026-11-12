# Mindful Coach

Mindful Coach is a calm, minimalist, mobile-first wellness coaching web application built with React, TypeScript, Tailwind CSS, Vite, and Express. It helps users check in on daily self-reported energy, sleep, and steps, practice short text-guided sessions, and explore practical everyday wellness ideas—all without requiring accounts, passwords, or external databases.

---

## Key Features

### 1. Local Profile & Transparent Onboarding
- **Three-step setup**: Collects only a preferred name and one primary wellness focus (`Sleep`, `Stress`, `Energy`, or `Weight`), followed by a plain-language summary of what stays in local browser storage versus what is sent during Live AI Coach chats.
- **No account lock-in**: Runs locally in the browser without email addresses, passwords, or personal health identifiers. Profile settings can be updated anytime in **Profile**.

### 2. Home Dashboard & Honest Daily Tracking
- **Self-reported energy**: Asks *"How is your energy today?"* on a `1–10` scale and displays it as `10–100` (`rating × 10`) labeled **Self-reported energy**, accompanied by an expandable explanation. Missing days are never estimated or fabricated.
- **Manual daily check-ins**: Supports nonnegative whole-number steps (`0` or higher) and sleep duration (`0–24` total hours), keyed by local calendar date (`YYYY-MM-DD`).
- **Zero vs. missing values**: Explicitly distinguishes unrecorded fields (`Not recorded`) from recorded zero values (`0 steps`, `0h 0m`). Clearing all fields on a previously logged day removes the empty date record cleanly.
- **Mindful Streaks**: Tracks consecutive local calendar days with a saved daily check-in and/or completed guided session—deduplicating same-day activities, preserving an active streak from yesterday until today ends, and displaying the current count, best streak, and today's contributor status directly on the Home dashboard.
- **Seven-day summary**: Displays actual recorded entries across the past 7 local calendar days with both a visual bar summary and an accessible `<table>` view.

### 3. Silent Text-Guided Sessions
- **Four built-in practices**:
  - **Mindfulness** (1, 3, or 5 min)
  - **Gentle breathing** (1, 2, or 4 min)
  - **Energy reset** (1, 3, or 5 min)
  - **Sleep wind-down** (1, 4, or 6 min)
- **Drift-free wall-clock timers**: Calculates elapsed time from timestamps with `visibilitychange` and window `focus` synchronization so timers stay accurate even when background tabs are throttled.
- **Comfortable pacing & reduced motion**: Optional gentle breathing cues avoid breath-holding or rapid pacing, match the active step's instructions, and respect both system `prefers-reduced-motion` and the in-app motion setting.
- **Accurate completion counting**: Records completed runs once per unique `runId`; ending or leaving a session early never increments completion counts.

### 4. Supportive Wellness Coach Chat
- **Server-routed Live AI**: Routes chat requests through `/api/coach/chat` using `@google/genai` on the Express server so API credentials remain strictly server-side, with automatic multi-model failover (`gemini-3.1-flash-lite`, `gemini-3.8-flash`, `gemini-flash-latest`) and working-model caching.
- **Structured, practical answers**: Replies provide a direct plain-language answer, `1–3` realistic **Next steps**, and a brief **Why this may help** rationale without invented statistics or academic citations.
- **Safety & wellness boundaries**: Prioritizes immediate crisis/emergency resources for urgent self-harm or medical emergency signals, declines diagnosis or medication advice, and approaches weight/nourishment topics without shame or restrictive targets.
- **Explicit Demo Coach & offline fallback**: Includes a toggleable **Demo Coach** mode (and clearly labeled automatic fallback if Live AI is unconfigured or temporarily busy) so questions are always answered without ever pretending curated guidance came from Live AI.

### 5. Profile, Recorded Statistics & Privacy Controls
- **Recorded-only statistics**: Displays total completed sessions, total days with a check-in, 7-day average sleep, and 7-day average self-reported energy along with exact included entry counts (never fabricated when unrecorded).
- **Local data controls**: Chat-history persistence is **off** by default (toggling it off immediately purges saved chat messages from storage). Includes **Clear chat history** and a focus-trapped **Delete all local data** confirmation dialog.

---

## Tech Stack

- **Frontend**: React 19, TypeScript 7 (`strict: true`), Tailwind CSS 4, Lucide React
- **Build & Tooling**: Vite 8, `tsx`, Node.js built-in test runner (`node:test`)
- **Backend**: Express 5 (`server.ts`), `@google/genai`, `dotenv`

---

## Project Structure

```text
├── index.html                           # App entry HTML & typography links
├── metadata.json                        # Application metadata & capabilities
├── package.json                         # Scripts and dependencies
├── server.ts                            # Express 5 bootstrapper + Vite / static SPA serving
├── tsconfig.json                        # Strict TypeScript configuration
├── vite.config.ts                       # Vite + React + Tailwind CSS v4 configuration
├── server/
│   ├── config.ts                        # Server port, API key resolution & model priority list
│   ├── middleware/
│   │   ├── errorHandler.ts              # JSON payload/syntax error & /api 404 handlers
│   │   └── rateLimiter.ts               # Bounded sliding-window per-IP rate limiter
│   ├── routes/
│   │   └── coachRoutes.ts               # /api/coach/status & /api/coach/chat Express router
│   └── services/
│       └── geminiCoachService.ts        # Gemini client, prompt builder, turn normalizer & failover
├── src/
│   ├── App.tsx                          # Top-level view composition & routing
│   ├── index.css                        # Tailwind CSS v4 theme tokens & reduced-motion rules
│   ├── main.tsx                         # React DOM root mount
│   ├── shared/
│   │   ├── apiTypes.ts                  # Shared client-server API request/response contracts
│   │   └── coachSafety.ts               # Shared urgent crisis detection, copy & message limits
│   ├── types/
│   │   └── wellness.ts                  # Core domain TypeScript interfaces
│   ├── data/
│   │   ├── demoCoachResponses.ts        # Curated non-AI wellness guidance by topic & goal
│   │   ├── goals.ts                     # Wellness goal catalog, metadata & starter prompts
│   │   └── guidedSessions.ts            # Guided session definitions & step scripts
│   ├── lib/
│   │   ├── dateUtils.ts                 # Local calendar YYYY-MM-DD helpers, DST-safe day shifts & formatters
│   │   ├── sessionTimer.ts              # Pure wall-clock timer state machine & completion dedup
│   │   ├── validation.ts                # Pure validators for name, energy, sleep, and steps
│   │   └── wellnessMetrics.ts           # Mindful Streaks math, energy score, 7-day statistics & formatters
│   ├── services/
│   │   ├── coachApiClient.ts            # Typed HTTP client for /api/coach/* endpoints
│   │   └── storageService.ts            # Resilient localStorage adapter with streak tracking & in-memory fallback
│   ├── hooks/
│   │   ├── useCoachChat.ts              # Chat turn lifecycle, AbortController, retry & Demo mode
│   │   ├── useEnvironmentState.ts       # Midnight local-date sync, online status & reduced motion
│   │   ├── useSessionPlayer.ts          # Active timed session state, visibility catch-up & completion
│   │   └── useWellnessStore.ts          # Local profile, check-ins, sessions, Mindful Streaks, preferences & chat store
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.tsx             # Responsive desktop 3-zone header & mobile bottom nav
│   │   └── ui/
│   │       └── ConfirmDialog.tsx        # Accessible focus-trapped confirmation modal
│   └── features/
│       ├── coach/                       # CoachView, CoachMessageList & StructuredMessageBody
│       ├── home/                        # HomeView, DailyCheckInCard, MindfulStreakCard, HomeQuickActions & SevenDaySummaryCard
│       ├── onboarding/                  # 3-step local profile OnboardingFlow
│       ├── profile/                     # ProfileView, RecordedStatsCard, ProfileEditorCard & PrivacyAndPreferencesPanel
│       └── sessions/                    # SessionsView, SessionCatalogCard & ActiveSessionPlayer
└── tests/
    ├── coachAndServer.test.ts           # Safety detector, Demo Coach, turn normalizer & rate limiter tests
    ├── dateAndValidation.test.ts        # Local calendar date & input validation tests
    ├── sessionTimer.test.ts             # Wall-clock timer, throttling, early exit & dedup tests
    ├── storageService.test.ts           # Storage hydration, Mindful Streak persistence, corrupt JSON recovery & privacy tests
    └── wellnessMetrics.test.ts          # Self-reported energy score, Mindful Streaks & 7-day statistics tests
```

---

## Getting Started

### Prerequisites
- **Node.js** `22.x` or newer
- **npm** (or compatible package manager)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables (Optional for Demo Mode)

Copy `.env.example` to `.env` if running locally with Live AI enabled:

```bash
cp .env.example .env
```

Set your Gemini API key on the server:

```env
GEMINI_API_KEY="your_server_side_gemini_api_key"
```

> If `GEMINI_API_KEY` is omitted, Mindful Coach remains fully functional and automatically uses its clearly labeled **Demo Coach** wellness guide.

### 3. Start the Development Server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express 5 + Vite development server on port `3000`. |
| `npm test` | Runs deterministic unit test suites (`tests/*.test.ts`) via `tsx --test`. |
| `npm run lint` | Runs strict TypeScript type-checking (`tsc --noEmit`). |
| `npm run build` | Builds the production client bundle into `dist/`. |
| `npm start` | Starts the production Express server (`NODE_ENV=production node server.ts`). |
| `npm run clean` | Removes `dist/` build artifacts. |

---

## Server API Endpoints

### `GET /api/coach/status`
Returns whether server-side Gemini credentials are configured:

```json
{
  "liveAiAvailable": true
}
```

### `POST /api/coach/chat`
Generates a supportive wellness coaching reply or urgent crisis notice.

- **Request body** (`application/json`, max `16kb`):
  ```json
  {
    "message": "What is a simple 20-minute wind-down routine?",
    "goal": "sleep",
    "history": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
  ```
- **Rate limit**: Sliding window of 15 requests per 60 seconds per IP (`429 RATE_LIMITED`).
- **Response** (`200 OK`):
  ```json
  {
    "reply": "...",
    "mode": "live",
    "isCrisisNotice": false
  }
  ```

---

## Privacy & Wellness Disclaimer

- **Local browser storage**: Your preferred name, selected wellness focus, daily check-ins, completed sessions, Mindful Streaks state, and preferences are stored in browser `localStorage` (falling back to in-memory session state if browser storage is blocked or full). Browser storage is not encrypted, does not isolate separate names on a shared device, and does not sync across devices.
- **External AI requests**: When using Live AI Coach mode, only your submitted chat prompt, recent turns in that conversation, and your selected focus topic (`sleep`, `stress`, `energy`, or `weight`) are sent to the server to request a reply from Google Gemini. Your preferred name and daily tracking logs are never sent automatically, and the server does not log user chat messages.
- **Not medical advice**: Mindful Coach provides general wellness education only and does not offer medical diagnosis, clinical advice, or treatment. For medical emergencies or self-harm risk, contact local emergency services immediately (such as `911` or `988` in the US and Canada).
