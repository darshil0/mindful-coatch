# Mindful Coach

Mindful Coach is a calm, mobile-first wellness app for tracking daily energy, sleep, steps, and guided mindfulness sessions, with supportive educational coaching guidance. No account is required.

It is built with React, TypeScript, Vite, and Express. Personal wellness data stays in your browser's local storage by default. Live coach requests require explicit pre-send user consent and are routed through the app server for safety checks.

## Features

- **Local onboarding** with a preferred name and wellness goal.
- **Daily check-ins** for energy, sleep, steps, and reflective notes.
- **Reminders** for morning check-ins and evening reflection with overnight-safe scheduling.
- **Seven-day trends** and weekly wellness scoring.
- **Guided sessions** with timer accuracy and grace-window handling.
- **AI wellness coaching** through a server-routed Gemini integration with explicit consent and crisis safeguards.
- **Privacy and resilience** with local-first data storage and recovery behaviors.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4
- **Backend:** Express 5 on Node.js
- **AI:** `@google/genai` SDK with configurable model failover
- **Quality & Testing:** ESLint, Prettier, TypeScript, Node test runner, and CI checks

Exact dependency versions are defined in `package.json`.

## Prerequisites

- **Node.js 22.18 or newer** (`engines.node` in `package.json`)
- **Bun 1.x** (preferred and matches the checked-in `bun.lock`)
- npm is also supported as an alternative if needed

## Getting Started

### 1. Install dependencies

```bash
bun install
```

If you prefer npm, `npm install` also works, but the repository lockfile and CI use Bun.

### 2. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

To enable Live AI coaching, set a server-side Gemini API key (never commit `.env`):

```env
GEMINI_API_KEY="your_server_side_gemini_api_key"
```

### 3. Run the app

```bash
bun run dev
```

Then open `http://localhost:3000`.

## Available Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` | Starts the Express + Vite development server on port `3000`. |
| `bun test` | Runs all unit and React/JSDOM integration tests. |
| `bun run typecheck` | Runs strict TypeScript checking. |
| `bun run lint` | Runs ESLint across the project. |
| `bun run format` | Formats files with Prettier. |
| `bun run format:check` | Verifies Prettier formatting. |
| `bun run build` | Builds production bundles into `dist/`. |
| `bun run preview` | Previews the built client bundle. |
| `bun run start` | Starts the Express production server (`NODE_ENV=production`); run `bun run build` first. |
| `bun run clean` | Removes the `dist` build directory. |

## Project Structure

The project includes the app frontend, Express server, shared safety logic, and unit/integration tests.

## Privacy and Safety

- Wellness entries and chat history are kept local by default.
- Live AI requests happen only after explicit consent is recorded.
- Crisis safety checks run before upstream model requests.

## Release History

See [CHANGELOG.md](./CHANGELOG.md) for release details.

## License

Licensed under the Apache License, Version 2.0 (`SPDX-License-Identifier: Apache-2.0`). See [LICENSE](./LICENSE) for the full text.
