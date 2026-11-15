import { useEffect, useRef } from 'react';
import type { DueReminder } from '../lib/reminders';
import { STORAGE_KEYS } from '../services/storageService';

function readPersistedNotifiedKeys(todayDateKey: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.NOTIFIED_REMINDERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || parsed.date !== todayDateKey) {
      return [];
    }
    return Array.isArray(parsed.keys)
      ? parsed.keys.filter((k): k is string => typeof k === 'string')
      : [];
  } catch {
    return [];
  }
}

function persistNotifiedKeys(todayDateKey: string, keys: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.NOTIFIED_REMINDERS,
      JSON.stringify({
        date: todayDateKey,
        keys: keys.slice(-20),
      })
    );
  } catch {
    // Ignore restricted/quota errors for optional desktop notifications
  }
}

/**
 * Optionally surfaces a native browser Notification when a reminder transitions
 * to due and the user has explicitly opted into browser alerts with permission granted.
 * Deduplicates across page reloads for the current calendar day.
 */
export function useReminderNotifications(
  dueReminder: DueReminder | null,
  todayDateKey: string,
  browserNotificationsEnabled: boolean
): void {
  const notifiedKeysRef = useRef<Set<string>>(
    new Set(readPersistedNotifiedKeys(todayDateKey))
  );
  const lastDateRef = useRef<string>(todayDateKey);

  useEffect(() => {
    if (lastDateRef.current !== todayDateKey) {
      lastDateRef.current = todayDateKey;
      notifiedKeysRef.current = new Set(readPersistedNotifiedKeys(todayDateKey));
    }

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
    persistNotifiedKeys(todayDateKey, Array.from(notifiedKeysRef.current));

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
