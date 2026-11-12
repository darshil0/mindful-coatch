# Changelog

All notable changes to **Mindful Coach** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-11-12

### Added
- **Mindful Streaks calculation & tracking**:
  - Added `MindfulStreakState` (`src/types/wellness.ts`) and DST-safe `shiftLocalDateKey` helper (`src/lib/dateUtils.ts`).
  - Implemented `computeMindfulStreak` in `src/lib/wellnessMetrics.ts` (and embedded `mindfulStreak` in `WellnessStatistics`) to count consecutive local calendar days with at least one recorded daily check-in and/or completed guided session, deduplicate same-day activities, preserve ongoing streaks from yesterday until today ends, and track `longestStreak`, `totalActiveDays`, and today's entry/session status.
  - Extended `WellnessStorageStore` (`src/services/storageService.ts`) with `STORAGE_KEYS.STREAK`, `loadMindfulStreak`, `saveMindfulStreak`, and `recalculateAndSaveStreak`, plus state synchronization across check-in edits, session completions, hydration, and data resets in `useWellnessStore` (`src/hooks/useWellnessStore.ts`).
- **Home dashboard display**: Added `MindfulStreakCard` (`src/features/home/MindfulStreakCard.tsx`) and wired it into `HomeView` (`src/features/home/HomeView.tsx`) and `App.tsx` to display current consecutive days, best streak, gentle status copy, and today's check-in and guided session status.
- **Unit tests**: Added coverage in `tests/wellnessMetrics.test.ts` and `tests/storageService.test.ts` for mixed entry/session streaks across month boundaries, same-day deduplication, yesterday grace, broken streak resets, corrupt JSON recovery, and data deletion cleanup.

## [1.3.0] - 2026-11-02

### Changed
- Reorganized the full-stack codebase into clear architectural layers:
  - **Backend (`server/` + `server.ts`)**: Split Express server concerns into `server/config.ts`, `server/middleware/` (`errorHandler.ts`, `rateLimiter.ts`), `server/services/geminiCoachService.ts`, and `server/routes/coachRoutes.ts`, keeping `server.ts` as a concise server entry point compatible with both `tsx` and native Node TypeScript execution.
  - **Shared Cross-Boundary Modules (`src/shared/`)**: Unified client/server API DTOs (`apiTypes.ts`) and crisis safety patterns, response copy, and message bounds (`coachSafety.ts`) into a single source of truth.
  - **Static Catalogs vs. Pure Domain Logic (`src/data/` & `src/lib/`)**: Decoupled static wellness goal metadata (`goals.ts`), guided session definitions (`guidedSessions.ts`), and curated Demo Coach responses (`demoCoachResponses.ts`) from pure calculation and state-machine utilities (`dateUtils.ts`, `validation.ts`, `wellnessMetrics.ts`, `sessionTimer.ts`).
  - **Services & Stateful Hooks (`src/services/` & `src/hooks/`)**: Extracted local persistence (`storageService.ts`), typed `/api/coach/*` client requests (`coachApiClient.ts`), and custom React hooks (`useWellnessStore`, `useEnvironmentState`, `useSessionPlayer`, `useCoachChat`).
  - **Feature-Aligned UI Modules (`src/components/` & `src/features/`)**: Organized shared shell/UI primitives under `src/components/layout` and `src/components/ui`, and split large screens into focused subcomponents under `src/features/{onboarding,home,sessions,coach,profile}`.
  - **Modular Test Suites (`tests/`)**: Split unit tests into domain-specific suites (`dateAndValidation`, `wellnessMetrics`, `sessionTimer`, `storageService`, `coachAndServer`) and added direct unit coverage for server conversation turn normalization and sliding-window rate limiting.

## [1.2.0] - 2026-11-02

### Added
- Multi-model Live AI failover in `server.ts` across `gemini-3.1-flash-lite`, `gemini-3.8-flash`, and `gemini-flash-latest`, with in-memory caching of the most recently responsive model and per-attempt `AbortSignal.timeout` protection.
- Automatic, clearly labeled built-in wellness fallback replies (`isFallbackFromError`) with a one-click **Retry with Live AI** action whenever upstream AI endpoints are temporarily busy or unreachable.
- Expanded curated wellness guidance in `src/lib/coachFallback.ts` covering greetings, caffeine and midday slumps, screen/posture fatigue, walking and daily steps, sleep interruptions, stress resets, and sustainable nourishment, plus additional unit tests.
- Project documentation (`README.md` and `CHANGELOG.md`).

### Fixed
- Fixed **Ask Mindful Coach** starter prompt buttons on the Home dashboard so selecting a suggested question immediately submits and answers it in Coach chat instead of only pre-filling the composer textarea.
- Fixed multi-turn Gemini request formatting in `server.ts` so consecutive same-role messages are merged and conversation `contents` always start with a `user` turn and alternate strictly (`user` ↔ `model`).
- Fixed initial mode detection in `CoachView` to avoid flashing the Demo Coach banner while `/api/coach/status` is resolving on mount.
- Scoped new-message auto-scrolling to the Coach conversation scroll container (`scrollTop`) so incoming replies stay fully visible without scrolling the outer window.

## [1.1.0] - 2026-11-02

### Changed
- Upgraded all runtime and development dependencies to current latest releases:
  - `@google/genai` `^2.32.0`, `express` `^5.3.0`, `dotenv` `^18.0.9`, `react` `^19.3.1`, `react-dom` `^19.3.1`, `lucide-react` `^1.66.0`, `motion` `^14.9.0`, `vite` `^8.3.5`, `@vitejs/plugin-react` `^6.2.1`, `@tailwindcss/vite` `^4.3.3`
  - `typescript` `^7.0.2`, `tsx` `^4.23.15`, `esbuild` `^0.28.2`, `autoprefixer` `^10.6.2`, `@types/express` `^5.0.6`, `@types/node` `^26.6.6`, `@types/react` `^19.3.0`, `@types/react-dom` `^19.3.0`
- Enabled `"strict": true` and `"node"` type definitions in `tsconfig.json`.
- Migrated deprecated Lucide icon aliases (`Home`, `AlertTriangle`, `CheckCircle2`, `Loader2`) to canonical Lucide v1 icons (`House`, `TriangleAlert`, `CircleCheck`, `LoaderCircle`).

### Fixed
- Replaced Express 4 `app.get('*', ...)` catch-all route with an Express 5-compatible SPA fallback middleware and added an explicit JSON `404` handler for `/api/*`.
- Added structured JSON error middleware in `server.ts` for malformed JSON (`400 INVALID_JSON`) and oversized payloads (`413 PAYLOAD_TOO_LARGE`), and bounded the sliding-window rate-limiter map.
- Added `AbortController` request cancellation and turn-generation guards in `CoachView` so clearing chat history or unmounting mid-request cancels in-flight turns cleanly, and deduplicated failed prompts when retrying.
- Synced `saveChatHistory` via ref in `App.tsx` to prevent stale async closures when persisting chat replies.
- Added empty-submission validation on Home daily check-ins (clearing immediately upon user input) and updated storage/state handlers to delete all-`null` date records while preserving recorded `0` values.
- Removed impure `Date.now()` calls from `SessionsView` render logic, aligned Gentle Breathing cues with natural-breath steps, locked `document.body` scroll while `ConfirmDialog` is open, guarded focus restoration on unmounted nodes, and focused the preferred-name input on initial onboarding mount.

## [1.0.0] - 2026-11-02

### Added
- Initial release of **Mindful Coach** featuring a calm editorial warm-stone and forest-green visual system (`Fraunces`, `Plus Jakarta Sans`, `JetBrains Mono`).
- Three-step local onboarding flow with preferred name validation, wellness focus selection (`Sleep`, `Stress`, `Energy`, `Weight`), privacy overview, and `?autostart=1` direct-to-dashboard support.
- Home dashboard with time-of-day greeting, primary focus card, **Self-reported energy** (`1–10` → `10–100`) with expandable explanation, manual local-date steps and sleep tracking, and 7-day visual + accessible table summary.
- Four silent text-guided timed sessions (`Mindfulness`, `Gentle breathing`, `Energy reset`, `Sleep wind-down`) with wall-clock timing, pause/resume/end controls, reduced-motion support, and single-count completion tracking.
- Coach chat with server-side `/api/coach/chat` and `/api/coach/status` endpoints, urgent crisis/emergency safeguard, wellness scope notice, and curated **Demo Coach** mode.
- Profile and statistics screen with editable profile, recorded-only metrics, opt-in chat-history persistence (off by default), motion preferences, and focus-trapped **Delete all local data** confirmation dialog.
- Deterministic unit test suite (`src/lib/wellness.test.ts`) covering local dates, validation, energy/statistics math, resilient storage hydration, session timers, and coach safety checks.
