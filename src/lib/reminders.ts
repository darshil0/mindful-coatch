import type {
  ReminderDismissalsByDate,
  ReminderSchedule,
  ReminderSlotId,
} from '../types/wellness.ts';

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

  return {
    morning: {
      enabled:
        typeof morningRaw.enabled === 'boolean'
          ? morningRaw.enabled
          : DEFAULT_REMINDER_SCHEDULE.morning.enabled,
      time: isValidTimeString(morningRaw.time)
        ? morningRaw.time
        : DEFAULT_REMINDER_SCHEDULE.morning.time,
    },
    evening: {
      enabled:
        typeof eveningRaw.enabled === 'boolean'
          ? eveningRaw.enabled
          : DEFAULT_REMINDER_SCHEDULE.evening.enabled,
      time: isValidTimeString(eveningRaw.time)
        ? eveningRaw.time
        : DEFAULT_REMINDER_SCHEDULE.evening.time,
    },
    browserNotifications: rec.browserNotifications === true,
  };
}

export function pruneDismissalsToDate(
  dismissals: ReminderDismissalsByDate,
  todayDateKey: string
): ReminderDismissalsByDate {
  const current = dismissals[todayDateKey];
  if (!current) return {};
  const cleaned: Partial<Record<ReminderSlotId, boolean>> = {};
  if (current.morning === true) cleaned.morning = true;
  if (current.evening === true) cleaned.evening = true;
  return Object.keys(cleaned).length > 0 ? { [todayDateKey]: cleaned } : {};
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
  dismissals: ReminderDismissalsByDate;
}): EvaluatedReminderState {
  const {
    schedule,
    todayDateKey,
    nowMinutes,
    todayHasEntry,
    todayHasSession,
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

  enabledSlots.sort((a, b) => a.minutes - b.minutes);

  if (enabledSlots.length === 0) {
    return {
      dueReminder: null,
      statusSummary: 'Daily reminders are paused.',
    };
  }

  // Pick the latest scheduled slot that has already arrived today
  const startedSlots = enabledSlots.filter((slot) => slot.minutes <= nowMinutes);
  const activeSlot =
    startedSlots.length > 0 ? startedSlots[startedSlots.length - 1] : null;
  const nextUpcomingSlot =
    enabledSlots.find((slot) => slot.minutes > nowMinutes) ?? null;

  if (activeSlot?.id === 'morning' && !todayHasEntry && !dismissedToday.morning) {
    const scheduledLabel = formatTimeLabel(activeSlot.time);
    return {
      dueReminder: {
        slot: 'morning',
        title: 'Morning check-in',
        message:
          'Take a quiet moment to note how your energy feels today and record last night’s sleep.',
        scheduledTime: activeSlot.time,
        scheduledLabel,
        primaryActionLabel: 'Check in now',
      },
      statusSummary: `Morning check-in reminder active (scheduled ${scheduledLabel}).`,
    };
  }

  if (activeSlot?.id === 'evening' && !todayHasSession && !dismissedToday.evening) {
    const scheduledLabel = formatTimeLabel(activeSlot.time);
    return {
      dueReminder: {
        slot: 'evening',
        title: 'Evening reflection',
        message:
          'Set aside a few calm minutes for a wind-down session or reflect on how your day felt with Coach.',
        scheduledTime: activeSlot.time,
        scheduledLabel,
        primaryActionLabel: 'Open wind-down session',
        secondaryActionLabel: 'Reflect with Coach',
      },
      statusSummary: `Evening reflection reminder active (scheduled ${scheduledLabel}).`,
    };
  }

  // No active reminder due right now — build a concise, helpful status line
  const parts: string[] = [];
  if (todayHasEntry) {
    parts.push('Today’s check-in logged');
  } else if (activeSlot?.id === 'morning' && dismissedToday.morning) {
    parts.push('Morning reminder dismissed for today');
  }

  if (todayHasSession) {
    parts.push('Guided session completed');
  } else if (activeSlot?.id === 'evening' && dismissedToday.evening) {
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
