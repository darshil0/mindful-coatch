import { useEffect, useRef } from 'react';
import type { DueReminder } from '../lib/reminders';

/**
 * Optionally surfaces a native browser Notification when a reminder transitions
 * to due and the user has explicitly opted into browser alerts with permission granted.
 * Silently no-ops if browser notifications are unsupported or restricted (e.g. iframes).
 */
export function useReminderNotifications(
  dueReminder: DueReminder | null,
  todayDateKey: string,
  browserNotificationsEnabled: boolean
): void {
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!browserNotificationsEnabled || !dueReminder) {
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission !== 'granted') {
      return;
    }

    const notifyKey = `${todayDateKey}:${dueReminder.slot}:${dueReminder.scheduledTime}`;
    if (notifiedKeysRef.current.has(notifyKey)) {
      return;
    }
    notifiedKeysRef.current.add(notifyKey);

    try {
      new Notification(`Mindful Coach · ${dueReminder.title}`, {
        body: dueReminder.message,
        tag: `mindful-coach-${dueReminder.slot}-${todayDateKey}`,
      });
    } catch {
      // Ignore environments that block Notification construction
    }
  }, [browserNotificationsEnabled, dueReminder, todayDateKey]);
}
