# Changelog

All notable changes to **Mindful Coach** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-11-14

### Added

- **Weekly progress report & shareable snippet export**:
  - Added `WeeklyProgressReport`, `WeeklyProgressHighlight`, and `WeeklyScoreInsight` types (`src/types/wellness.ts`), along with `buildWeeklyProgressReport` and `buildWeeklyScoreInsights` (`src/lib/wellnessMetrics.ts`) built on the existing `computeWellnessStatistics` engine.
  - Added `WeeklyProgressReportCard` (`src/features/home/WeeklyProgressReportCard.tsx`) to `HomeView` to generate and display a 7-day progress digest (narrative summary, 6 tabular metrics, recorded highlights, next-week focus prompts, automatic stale-report refresh prompt, clipboard copy, and `.txt` export).
  - Added collapsible **Score-based wellness tips** insight cards inside the Weekly Progress section offering one-sentence wellness tips grounded in the user’s weekly wellness score tier and recorded component averages (`Energy`, `Sleep`, `Consistency`, `Movement`).
  - Added an **Export snippet** button and **Shareable text snippet** panel in `WeeklyProgressReportCard` to preview, copy to clipboard, or share via the Web Share API (`navigator.share` when available), with unit test coverage in `tests/wellnessMetrics.test.ts`.
- **Weekly wellness score summary**:
  - Added `WeeklyWellnessScore`, `WeeklyWellnessScoreComponent`, and `WellnessStatistics.weeklyWellnessScore` (`src/types/wellness.ts`), along with `scoreSleepMinutesForWellness`, `scoreStepsForWellness`, and `computeWeeklyWellnessScore` (`src/lib/wellnessMetrics.ts`).
  - Scores up to four recorded 7-day inputs—Energy (35%), Sleep relative to 7–9 hours (25%), Check-in & session consistency (25%), and Movement toward 8,000 steps per day (15%)—using weighted renormalization so unrecorded categories are omitted rather than treated as zero.
  - Added `WeeklyWellnessScoreCard` (`src/features/home/WeeklyWellnessScoreCard.tsx`) to `HomeView` with an expandable scoring explanation, per-category breakdown, and empty state, backed by unit tests in `tests/wellnessMetrics.test.ts`.
- **Daily reflective notes & chronological journal**:
  - Extended `DailyEntry` (`reflectiveNote?: string | null`) and added `ReflectiveNoteEntry` (`src/types/wellness.ts`), alongside `MAX_REFLECTIVE_NOTE_LENGTH` (`500`) and `validateReflectiveNote` (`src/lib/validation.ts`).
  - Updated `hasAnyRecordedMetric` and added `getChronologicalReflectiveNotes` (`src/lib/wellnessMetrics.ts`), and extended `WellnessStorageStore` (`src/services/storageService.ts`) to sanitize, persist, and clean up `reflectiveNote` entries in `localStorage`.
  - Extended `DailyCheckInCard` (`src/features/home/DailyCheckInCard.tsx`) with a **Reflective note** textarea, live `0 / 500` character counter, clear action, inline validation, and saved-note preview.
  - Added `ReflectiveNotesCard` (`src/features/home/ReflectiveNotesCard.tsx`) to `HomeView` to display saved reflective notes chronologically with **Newest first / Oldest first** ordering and same-day metric context, plus unit tests in `tests/dateAndValidation.test.ts`, `tests/wellnessMetrics.test.ts`, and `tests/storageService.test.ts`.
- **Weekly 7-day Recharts trend visualization**:
  - Added `recharts` (`^3.10.1`) and created `WeeklyTrendChart` (`src/features/home/WeeklyTrendChart.tsx`) inside `SevenDaySummaryCard` on `HomeView` to plot daily self-reported energy levels (`0–100` line with `connectNulls={false}` so unrecorded days remain blank gaps) alongside completed mindfulness sessions per local calendar day.
  - Extended `DaySummaryItem` and `WellnessStatistics` (`src/types/wellness.ts`) and `computeWellnessStatistics` (`src/lib/wellnessMetrics.ts`) with `completedSessionsCount`, `completedSessionsInLast7`, and `activeDaysInLast7`, and added a **Sessions** column to the accessible **Text table** view, backed by unit tests in `tests/wellnessMetrics.test.ts`.
- **Morning check-in & evening reflection reminders**:
  - Added pure local-time reminder evaluation and scheduling utilities (`src/lib/reminders.ts`) with customizable morning (`08:30` default) and evening (`20:30` default) times, completion-aware hiding, and per-day dismissal tracking.
  - Extended `WellnessStorageStore` (`STORAGE_KEYS.REMINDERS`), `useWellnessStore`, and `useEnvironmentState` (`nowMinutes`) to persist reminder schedules, prune expired dismissals across local calendar days, and trigger optional browser alerts (`src/hooks/useReminderNotifications.ts`) when permitted.
  - Added `ReminderBannerCard` on `HomeView` and a shared `ReminderScheduleEditor` available on both `HomeView` and `ProfileView` Preferences, plus unit tests in `tests/reminders.test.ts` and `tests/storageService.test.ts`.

### Fixed

- **Reminder fallback & schedule ordering**:
  - Updated `evaluateReminderState` (`src/lib/reminders.ts`) to evaluate started reminder slots in reverse chronological order so an evening session completion or dismissal still falls back to an unlogged, undismissed morning check-in.
  - Enforced `morning.time < evening.time` ordering when both slots are enabled in `sanitizeReminderSchedule` and inline validation in `ReminderScheduleEditor`, and validated `todayDateKey` in `pruneDismissalsToDate`.
- **Guided session persistence across tabs**:
  - Lifted `useSessionPlayer` (`src/hooks/useSessionPlayer.ts`) from `SessionsView` into `App.tsx` so active/paused session timers keep running across tab switches, preserved active timers when re-opening the same session via Home’s **Open guided session** shortcut, and added `resetPlayer()` on local data deletion.
- **Coach chat safety, failover & retry handling**:
  - Expanded `URGENT_HELP_PATTERNS` (`src/shared/coachSafety.ts`) for phrasing and contraction variants (such as `"cannot breathe"`, `"hurting myself"`, `"overdosed"`, `"don't want to live"`) and added immediate client-side crisis short-circuiting in `useCoachChat`.
  - Updated `useCoachChat` (`src/hooks/useCoachChat.ts`) to cancel in-flight Live AI requests (`cancelInFlightTurn`) when toggling to Demo Coach or clearing chat, clear stale error/retry state when toggling into Demo Coach mode, replace the prior error-fallback bubble instead of stacking duplicates on retries, and avoid duplicate `acknowledgeAiNotice` calls.
- **Server routing, rate limiting & AI failover hardening**:
  - Reordered `POST /api/coach/chat` (`server/routes/coachRoutes.ts`) to validate message bounds and intercept urgent safety concerns before applying rate limits, guarded non-object JSON/error payloads in `coachRoutes.ts` and `errorHandler.ts`, enabled `trust proxy`, raised Express JSON limit to `64kb`, and excluded `/assets/` from SPA HTML fallback in `server.ts`.
  - Fixed `SlidingWindowRateLimiter` (`server/middleware/rateLimiter.ts`) to refresh key recency on `allow()` for true LRU eviction when `maxTrackedKeys` (`500`) is full and clamp constructor options `>= 1`.
  - Updated `server/config.ts` and `server/services/geminiCoachService.ts` to use active Gemini candidate models (`gemini-4-hydrogen` with `ThinkingLevel.LOW`, failing over to `gemini-3.1-flash-lite`), cap cumulative failover timeout budget at `20s`, clear failed cached models, anchor HTTP status regexes with `\b`, bound fallback turn text with `trimmedCurrent`, and slice conversation history only after filtering malformed entries.
- **Storage resilience & hook state hygiene**:
  - Updated `WellnessStorageStore` (`src/services/storageService.ts`) to cache successful `localStorage` reads in `memoryFallback` (preventing mid-session `QuotaExceededError` from losing hydrated keys), reject arrays in `loadProfile`/`loadPreferences`, validate dates in `upsertDailyEntry`, and expire stale streaks in `loadMindfulStreak`.
  - Fixed `useWellnessStore` (`src/hooks/useWellnessStore.ts`) to reset `chatMessagesRef` and `saveChatHistoryRef` on data deletion, strip `?autostart=1` from the URL on reset, avoid `localStorage` writes inside `setState` updaters, and honor `env.todayDateKey` across store mutations.
- **Metrics, live score tips & export polish**:
  - Guarded invalid `todayDateKey` inputs and invalid session dates in `src/lib/wellnessMetrics.ts`, added score-based next-step guidance for `stress`, `energy`, and `weight` goals, and omitted `0-day streak` from `shareableSnippet`.
  - Kept **Score-based wellness tips** (`activeInsights`) synced with live `WeeklyWellnessScore` updates even while an older generated report is open, eliminated clipboard overwrites on opening **Export snippet**, and deferred `URL.revokeObjectURL` (`1000ms`) on `.txt` downloads in `WeeklyProgressReportCard.tsx`.
  - Clarified per-day score averaging in `WeeklyWellnessScoreCard.tsx`.
- **Accessibility, UI & documentation**:
  - Upgraded `44px` minimum touch targets, input placeholder contrast (`#5C6762`), reduced-motion support, stale-notice clearing, Onboarding disclosures, and synced `.env.example`, `metadata.json`, `index.html`, `package.json`, `README.md`, and `CHANGELOG.md`.

## [1.4.0] - 2026-11-12

### Added

- **Mindful Streaks calculation & tracking**:
  - Added `MindfulStreakState` (`src/types/wellness.ts`) and DST-safe `shiftLocalDateKey` helper (`src/lib/dateUtils.ts`).
  - Implemented `computeMindfulStreak` in `src/lib/wellnessMetrics.ts` (and embedded `mindfulStreak` in `WellnessStatistics`) to count consecutive local calendar days with at least one recorded daily metric or completed session.
  - Extended `WellnessStorageStore` (`src/services/storageService.ts`) with `STORAGE_KEYS.STREAK`, `loadMindfulStreak`, `saveMindfulStreak`, and `recalculateAndSaveStreak`, plus state synchronization for persisted streak data.
- **Home dashboard display**: Added `MindfulStreakCard` (`src/features/home/MindfulStreakCard.tsx`) and wired it into `HomeView` (`src/features/home/HomeView.tsx`) and `App.tsx` to display current streak progress on the dashboard.
- **Unit tests**: Added coverage in `tests/wellnessMetrics.test.ts` and `tests/storageService.test.ts` for mixed entry/session streaks across month boundaries, same-day deduplication, yesterday grace periods, and storage recovery paths.

## [1.3.0] - 2026-11-02

### Changed

- Reorganized the full-stack codebase into clear architectural layers:
  - **Backend (`server/` + `server.ts`)**: Split Express server concerns into `server/config.ts`, `server/middleware/` (`errorHandler.ts`, `rateLimiter.ts`), and `server/services/geminiCoachService.ts`.
  - **Shared Cross-Boundary Modules (`src/shared/`)**: Unified client/server API DTOs (`apiTypes.ts`) and crisis safety patterns, response copy, and message bounds (`coachSafety.ts`) into a single shared layer.
  - **Static Catalogs vs. Pure Domain Logic (`src/data/` & `src/lib/`)**: Decoupled static wellness goal metadata (`goals.ts`), guided session definitions (`guidedSessions.ts`), and curated Demo Coach response logic from business logic.
  - **Services & Stateful Hooks (`src/services/` & `src/hooks/`)**: Extracted local persistence (`storageService.ts`), typed `/api/coach/*` client requests (`coachApiClient.ts`), and custom React state hooks.
  - **Feature-Aligned UI Modules (`src/components/` & `src/features/`)**: Organized shared shell/UI primitives under `src/components/layout` and `src/components/ui`, and split large screens into feature-specific modules.
  - **Modular Test Suites (`tests/`)**: Split unit tests into domain-specific suites (`dateAndValidation`, `wellnessMetrics`, `sessionTimer`, `storageService`, `coachAndServer`) and added direct utility-level assertions.

## [1.2.0] - 2026-11-02

### Added

- Multi-model Live AI failover in `server.ts` across `gemini-3.1-flash-lite`, `gemini-3.8-flash`, and `gemini-flash-latest`, with in-memory caching of the most recently responsive model and per-attempt request throttling.
- Automatic, clearly labeled built-in wellness fallback replies (`isFallbackFromError`) with a one-click **Retry with Live AI** action whenever upstream AI endpoints are temporarily busy or unreachable.
- Expanded curated wellness guidance in `src/lib/coachFallback.ts` covering greetings, caffeine and midday slumps, screen/posture fatigue, walking and daily steps, sleep interruptions, stress resets, and nutrition/weight questions.
- Project documentation (`README.md` and `CHANGELOG.md`).

### Fixed

- Fixed **Ask Mindful Coach** starter prompt buttons on the Home dashboard so selecting a suggested question immediately submits and answers it in Coach chat instead of only pre-filling the compose box.
- Fixed multi-turn Gemini request formatting in `server.ts` so consecutive same-role messages are merged and conversation `contents` always start with a `user` turn and alternate strictly (`user` <-> `model`).
- Fixed initial mode detection in `CoachView` to avoid flashing the Demo Coach banner while `/api/coach/status` is resolving on mount.
- Scoped new-message auto-scrolling to the Coach conversation scroll container (`scrollTop`) so incoming replies stay fully visible without scrolling the outer window.

## [1.1.0] - 2026-11-02

### Changed

- Upgraded all runtime and development dependencies to current latest releases:
  - `@google/genai` `^2.32.0`, `express` `^5.3.0`, `dotenv` `^18.0.9`, `react` `^19.3.1`, `react-dom` `^19.3.1`, `lucide-react` `^1.66.0`, `motion` `^14.9.0`, `vite` `^8.3.5`, `@vitejs/plugin-react` `^6.2.1`.
  - `typescript` `^7.0.2`, `tsx` `^4.23.15`, `esbuild` `^0.28.2`, `autoprefixer` `^10.6.2`, `@types/express` `^5.0.6`, `@types/node` `^26.6.6`, `@types/react` `^19.3.0`, `@types/react-dom` `^19.3.0`.
- Enabled `"strict": true` and `"node"` type definitions in `tsconfig.json`.
- Migrated deprecated Lucide icon aliases (`Home`, `AlertTriangle`, `CheckCircle2`, `Loader2`) to canonical Lucide v1 icons (`House`, `TriangleAlert`, `CircleCheck`, `LoaderCircle`).

### Fixed

- Replaced Express 4 `app.get('*', ...)` catch-all route with an Express 5-compatible SPA fallback middleware and added an explicit JSON `404` handler for `/api/*`.
- Added structured JSON error middleware in `server.ts` for malformed JSON (`400 INVALID_JSON`) and oversized payloads (`413 PAYLOAD_TOO_LARGE`), and bounded the sliding-window rate-limiter map.
- Added `AbortController` request cancellation and turn-generation guards in `CoachView` so clearing chat history or unmounting mid-request cancels in-flight turns cleanly, and deduplicated failed AI requests by chat turn.
- Synced `saveChatHistory` via ref in `App.tsx` to prevent stale async closures when persisting chat replies.
- Added empty-submission validation on Home daily check-ins (clearing immediately upon user input) and updated storage/state handlers to delete all-`null` date records while preserving recorded `0` values.
- Removed impure `Date.now()` calls from `SessionsView` render logic, aligned Gentle Breathing cues with natural-breath steps, locked `document.body` scroll while `ConfirmDialog` is open, and guarded removal of temporary session state.

## [1.0.0] - 2026-11-02

### Added

- Initial release of **Mindful Coach** featuring a calm editorial warm-stone and forest-green visual system (`Fraunces`, `Plus Jakarta Sans`, `JetBrains Mono`).
- Three-step local onboarding flow with preferred name validation, wellness focus selection (`Sleep`, `Stress`, `Energy`, `Weight`), privacy overview, and `?autostart=1` direct-to-dashboard support.
- Home dashboard with time-of-day greeting, primary focus card, **Self-reported energy** (`1–10` → `10–100`) with expandable explanation, manual local-date steps and sleep tracking, and 7-day summary cards.
- Four silent text-guided timed sessions (`Mindfulness`, `Gentle breathing`, `Energy reset`, `Sleep wind-down`) with wall-clock timing, pause/resume/end controls, reduced-motion support, and single-completion tracking.
- Coach chat with server-side `/api/coach/chat` and `/api/coach/status` endpoints, urgent crisis/emergency safeguard, wellness scope notice, and curated **Demo Coach** mode.
- Profile and statistics screen with editable profile, recorded-only metrics, opt-in chat-history persistence (off by default), motion preferences, and focus-trapped **Delete all local data** confirmation flow.
- Deterministic unit test suite (`src/lib/wellness.test.ts`) covering local dates, validation, energy/statistics math, resilient storage hydration, session timers, and coach safety checks.
