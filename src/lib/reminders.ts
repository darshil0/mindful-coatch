import type {
  CompletedSessionRecord,
  ReminderDismissalsByDate,
  ReminderSchedule,
  ReminderSlotId,
} from '../types/wellness.ts';
import { isValidDateKey } from './dateUtils.ts';

export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = {
  morning: {
    enabled: true,
    time: '08:30',
  },
  evening: {
    enabled: true,
    time: '20:30',
  },
  browserNotifications: false,
};

export interface DueReminder {
  slot: ReminderSlotId;
  title: string;
  message: string;
  scheduledTime: string;
  scheduledLabel: string;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
}

export interface EvaluatedReminderState {
  dueReminder: DueReminder | null;
  statusSummary: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatClockString(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function isValidTimeString(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function parseTimeToMinutes(timeStr: string): number | null {
  const match = TIME_PATTERN.exec(timeStr);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

export function getLocalTimeMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatTimeLabel(timeStr: string): string {
  const totalMinutes = parseTimeToMinutes(timeStr);
  if (totalMinutes === null) return timeStr;
  const hours24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
}

/**
 * Sanitizes reminder schedule while allowing night-shift / overnight schedules
 * (for example, morning wake check-in at 18:00 and evening wind-down at 06:00).
 */
export function sanitizeReminderSchedule(raw: unknown): ReminderSchedule {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      morning: { ...DEFAULT_REMINDER_SCHEDULE.morning },
      evening: { ...DEFAULT_REMINDER_SCHEDULE.evening },
      browserNotifications: false,
    };
  }

  const rec = raw as Record<string, unknown>;
  const morningRaw =
    rec.morning && typeof rec.morning === 'object'
      ? (rec.morning as Record<string, unknown>)
      : {};
  const eveningRaw =
    rec.evening && typeof rec.evening === 'object'
      ? (rec.evening as Record<string, unknown>)
      : {};

  const morningEnabled =
    typeof morningRaw.enabled === 'boolean'
      ? morningRaw.enabled
      : DEFAULT_REMINDER_SCHEDULE.morning.enabled;
  const morningTime = isValidTimeString(morningRaw.time)
    ? morningRaw.time
    : DEFAULT_REMINDER_SCHEDULE.morning.time;

  const eveningEnabled =
    typeof eveningRaw.enabled === 'boolean'
      ? eveningRaw.enabled
      : DEFAULT_REMINDER_SCHEDULE.evening.enabled;
  let eveningTime = isValidTimeString(eveningRaw.time)
    ? eveningRaw.time
    : DEFAULT_REMINDER_SCHEDULE.evening.time;

  if (morningEnabled && eveningEnabled && morningTime === eveningTime) {
    const eveningMinutes = parseTimeToMinutes(eveningTime);
    if (eveningMinutes !== null) {
      const adjustedMinutes = Math.min(23 * 60 + 59, eveningMinutes + 30);
      eveningTime = formatClockString(adjustedMinutes);
    }
  }

  return {
    morning: {
      enabled: morningEnabled,
      time: morningTime,
    },
    evening: {
      enabled: eveningEnabled,
      time: eveningTime,
    },
    browserNotifications: rec.browserNotifications === true,
  };
}

export function pruneDismissalsToDate(
  dismissals: ReminderDismissalsByDate,
  todayDateKey: string
): ReminderDismissalsByDate {
  if (!isValidDateKey(todayDateKey)) return {};
  const current = dismissals[todayDateKey];
  if (!current) return {};
  const cleaned: Partial<Record<ReminderSlotId, boolean>> = {};
  if (current.morning === true) cleaned.morning = true;
  if (current.evening === true) cleaned.evening = true;
  return Object.keys(cleaned).length > 0 ? { [todayDateKey]: cleaned } : {};
}

/**
 * Determines whether today's completed guided sessions include one within the
 * evening reminder window (at least within 90 minutes before `eveningMinutes` or after it),
 * so a morning breathing session does not suppress an evening wind-down prompt.
 */
export function hasCompletedEveningWindowSession(
  completedSessions: CompletedSessionRecord[],
  todayDateKey: string,
  eveningMinutes: number
): boolean {
  const windowStartMinutes = Math.max(0, eveningMinutes - 90);
  for (const session of completedSessions) {
    if (session.date !== todayDateKey) continue;
    const completedAtDate = new Date(session.completedAt);
    if (Number.isNaN(completedAtDate.getTime())) continue;
    const sessionMins = completedAtDate.getHours() * 60 + completedAtDate.getMinutes();
    if (sessionMins >= windowStartMinutes) {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether a gentle morning check-in or evening reflection reminder
 * should currently surface on the Home dashboard, and provides a calm status summary
 * when neither reminder needs attention.
 */
export function evaluateReminderState(params: {
  schedule: ReminderSchedule;
  todayDateKey: string;
  nowMinutes: number;
  todayHasEntry: boolean;
  todayHasSession: boolean;
  completedSessions?: CompletedSessionRecord[];
  dismissals: ReminderDismissalsByDate;
}): EvaluatedReminderState {
  const {
    schedule,
    todayDateKey,
    nowMinutes,
    todayHasEntry,
    todayHasSession,
    completedSessions,
    dismissals,
  } = params;

  const dismissedToday = dismissals[todayDateKey] ?? {};

  const enabledSlots: { id: ReminderSlotId; minutes: number; time: string }[] = [];
  if (schedule.morning.enabled) {
    const mins = parseTimeToMinutes(schedule.morning.time);
    if (mins !== null) {
      enabledSlots.push({ id: 'morning', minutes: mins, time: schedule.morning.time });
    }
  }
  if (schedule.evening.enabled) {
    const mins = parseTimeToMinutes(schedule.evening.time);
    if (mins !== null) {
      enabledSlots.push({ id: 'evening', minutes: mins, time: schedule.evening.time });
    }
  }

  // Sort chronologically by minute-of-day (break exact ties with morning before evening)
  enabledSlots.sort((a, b) => {
    if (a.minutes !== b.minutes) return a.minutes - b.minutes;
    return a.id === 'morning' ? -1 : 1;
  });

  if (enabledSlots.length === 0) {
    return {
      dueReminder: null,
      statusSummary: 'Daily reminders are paused.',
    };
  }

  const eveningSlot = enabledSlots.find((s) => s.id === 'evening');
  const todayHasEveningSession =
    completedSessions !== undefined && eveningSlot
      ? hasCompletedEveningWindowSession(
          completedSessions,
          todayDateKey,
          eveningSlot.minutes
        )
      : todayHasSession;

  // Evaluate started slots in reverse chronological order so the most recent due slot takes priority,
  // falling back to an earlier uncompleted slot if the later one was done or dismissed.
  const startedSlots = enabledSlots.filter((slot) => slot.minutes <= nowMinutes);
  const nextUpcomingSlot = enabledSlots.find((slot) => slot.minutes > nowMinutes) ?? null;

  for (let i = startedSlots.length - 1; i >= 0; i -= 1) {
    const slot = startedSlots[i];
    if (slot.id === 'evening' && !todayHasEveningSession && !dismissedToday.evening) {
      const scheduledLabel = formatTimeLabel(slot.time);
      return {
        dueReminder: {
          slot: 'evening',
          title: 'Evening reflection',
          message:
            'Set aside a few calm minutes for a wind-down session or reflect on how your day felt with Coach.',
          scheduledTime: slot.time,
          scheduledLabel,
          primaryActionLabel: 'Open wind-down session',
          secondaryActionLabel: 'Reflect with Coach',
        },
        statusSummary: `Evening reflection reminder active (scheduled ${scheduledLabel}).`,
      };
    }

    if (slot.id === 'morning' && !todayHasEntry && !dismissedToday.morning) {
      const scheduledLabel = formatTimeLabel(slot.time);
      return {
        dueReminder: {
          slot: 'morning',
          title: 'Morning check-in',
          message:
            'Take a quiet moment to note how your energy feels today and record last night’s sleep.',
          scheduledTime: slot.time,
          scheduledLabel,
          primaryActionLabel: 'Check in now',
        },
        statusSummary: `Morning check-in reminder active (scheduled ${scheduledLabel}).`,
      };
    }
  }

  // No active reminder due right now — build a concise, helpful status line
  const morningStarted = startedSlots.some((slot) => slot.id === 'morning');
  const eveningStarted = startedSlots.some((slot) => slot.id === 'evening');

  const parts: string[] = [];
  if (todayHasEntry) {
    parts.push('Today’s check-in logged');
  } else if (morningStarted && dismissedToday.morning) {
    parts.push('Morning reminder dismissed for today');
  }

  if (todayHasEveningSession) {
    parts.push('Evening reflection session completed');
  } else if (eveningStarted && dismissedToday.evening) {
    parts.push('Evening reminder dismissed for today');
  }

  if (nextUpcomingSlot) {
    const nextLabel =
      nextUpcomingSlot.id === 'morning' ? 'Morning check-in' : 'Evening reflection';
    parts.push(`Next: ${nextLabel} at ${formatTimeLabel(nextUpcomingSlot.time)}`);
  } else {
    const firstTomorrow = enabledSlots[0];
    const tomorrowLabel =
      firstTomorrow.id === 'morning' ? 'Morning check-in' : 'Evening reflection';
    parts.push(
      `Next: ${tomorrowLabel} tomorrow at ${formatTimeLabel(firstTomorrow.time)}`
    );
  }

  return {
    dueReminder: null,
    statusSummary: parts.join(' · '),
  };
}
