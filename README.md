# Mindful Coach

Mindful Coach is a calm, mobile-first wellness app that helps people track daily energy, sleep, steps, and guided mindfulness sessions while offering supportive coaching guidance without requiring an account.

Built with React, TypeScript, Vite, and Express, the app keeps personal wellness data in local browser storage by default and routes live coach requests through a server-side AI integration when configured.

## Features

- Local onboarding with a preferred name and primary wellness goal
- Daily wellness check-ins for energy, sleep, and steps on the user’s local calendar date
- Gentle morning check-in and evening reflection reminders with customizable local scheduling
- Seven-day summary and streak tracking across recorded entries and completed sessions
- Guided sessions for mindfulness, breathing, energy resets, and sleep wind-down
- A supportive coach experience with live Gemini AI integration and a curated demo mode fallback
- Privacy controls for chat-history persistence and local data deletion

## Tech Stack

- Frontend: React 19, TypeScript 7, Vite 8, Tailwind CSS 4
- Backend: Express 5, Node.js
- AI: Google GenAI SDK
- Testing: Node’s built-in test runner (`node:test`)

## Prerequisites

- Node.js 22+ or newer
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

If `GEMINI_API_KEY` is not set, the app will continue to work in demo mode with built-in wellness guidance.

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
| `npm run dev` | Starts the Express + Vite development server |
| `npm test` | Runs the unit test suite |
| `npm run lint` | Runs TypeScript type checking |
| `npm run build` | Builds the production bundle |
| `npm start` | Starts the production server |
| `npm run clean` | Removes build artifacts |

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

Returns whether live AI is configured.

Response example:

```json
{
  "liveAiAvailable": true
}
```

### `POST /api/coach/chat`

Generates a coaching response or an urgent crisis notice.

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

- Wellness data is stored locally in the browser by default.
- Chat history persistence is disabled by default and can be toggled in app settings.
- The app does not diagnose or prescribe treatment.
- If urgent crisis or self-harm risk is detected, the app prioritizes emergency support guidance.

## License

This project is provided as-is for local wellness tooling and coaching experiments.
