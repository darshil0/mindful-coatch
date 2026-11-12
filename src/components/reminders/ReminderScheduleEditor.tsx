import React, { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import type { ReminderSchedule } from '../../types/wellness';
import { isValidTimeString } from '../../lib/reminders';

interface ReminderScheduleEditorProps {
  schedule: ReminderSchedule;
  onSaveSchedule: (next: ReminderSchedule) => void;
  onCancel?: () => void;
  compact?: boolean;
  idPrefix?: string;
}

function getNotificationSupportStatus(): 'unsupported' | NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function ReminderScheduleEditor({
  schedule,
  onSaveSchedule,
  onCancel,
  compact = false,
  idPrefix = 'reminder',
}: ReminderScheduleEditorProps) {
  const [morningEnabled, setMorningEnabled] = useState(schedule.morning.enabled);
  const [morningTime, setMorningTime] = useState(schedule.morning.time);
  const [eveningEnabled, setEveningEnabled] = useState(schedule.evening.enabled);
  const [eveningTime, setEveningTime] = useState(schedule.evening.time);
  const [browserNotifications, setBrowserNotifications] = useState(
    schedule.browserNotifications
  );
  const [permissionStatus, setPermissionStatus] = useState<
    'unsupported' | NotificationPermission
  >(() => getNotificationSupportStatus());
  const [timeError, setTimeError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setMorningEnabled(schedule.morning.enabled);
    setMorningTime(schedule.morning.time);
    setEveningEnabled(schedule.evening.enabled);
    setEveningTime(schedule.evening.time);
    setBrowserNotifications(schedule.browserNotifications);
  }, [schedule]);

  const handleToggleBrowserAlerts = async (checked: boolean) => {
    setSavedNotice(null);
    if (!checked) {
      setBrowserNotifications(false);
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionStatus('unsupported');
      setBrowserNotifications(false);
      return;
    }

    if (Notification.permission === 'granted') {
      setPermissionStatus('granted');
      setBrowserNotifications(true);
      return;
    }

    if (Notification.permission === 'denied') {
      setPermissionStatus('denied');
      setBrowserNotifications(false);
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermissionStatus(result);
      setBrowserNotifications(result === 'granted');
    } catch {
      setPermissionStatus('denied');
      setBrowserNotifications(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(null);

    if (
      (morningEnabled && !isValidTimeString(morningTime)) ||
      (eveningEnabled && !isValidTimeString(eveningTime))
    ) {
      setTimeError('Please choose valid local reminder times (HH:MM).');
      return;
    }

    setTimeError(null);
    onSaveSchedule({
      morning: {
        enabled: morningEnabled,
        time: isValidTimeString(morningTime) ? morningTime : schedule.morning.time,
      },
      evening: {
        enabled: eveningEnabled,
        time: isValidTimeString(eveningTime) ? eveningTime : schedule.evening.time,
      },
      browserNotifications,
    });
    setSavedNotice('Reminder schedule updated.');
  };

  return (
    <form onSubmit={handleSubmit} noValidate className={compact ? 'space-y-4' : 'space-y-5'}>
      <div className={compact ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
        {/* Morning Check-In Slot */}
        <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`${idPrefix}-morning-enabled`}
              className="flex cursor-pointer items-center gap-2.5 min-h-[36px] text-sm font-medium text-[#1E2421]"
            >
              <input
                id={`${idPrefix}-morning-enabled`}
                type="checkbox"
                checked={morningEnabled}
                onChange={(e) => {
                  setMorningEnabled(e.target.checked);
                  setSavedNotice(null);
                }}
                className="h-4 w-4 rounded accent-[#2F5D50]"
              />
              <span>Morning check-in</span>
            </label>

            <input
              id={`${idPrefix}-morning-time`}
              aria-label="Morning check-in reminder time"
              type="time"
              value={morningTime}
              disabled={!morningEnabled}
              onChange={(e) => {
                setMorningTime(e.target.value);
                setTimeError(null);
                setSavedNotice(null);
              }}
              className="min-h-[40px] rounded-lg border border-[#CFCBC0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#1E2421] disabled:opacity-50"
            />
          </div>
          <p className="mt-1.5 text-xs text-[#5C6762]">
            Gently reminds you until today’s check-in is saved or dismissed.
          </p>
        </div>

        {/* Evening Reflection Slot */}
        <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`${idPrefix}-evening-enabled`}
              className="flex cursor-pointer items-center gap-2.5 min-h-[36px] text-sm font-medium text-[#1E2421]"
            >
              <input
                id={`${idPrefix}-evening-enabled`}
                type="checkbox"
                checked={eveningEnabled}
                onChange={(e) => {
                  setEveningEnabled(e.target.checked);
                  setSavedNotice(null);
                }}
                className="h-4 w-4 rounded accent-[#2F5D50]"
              />
              <span>Evening reflection</span>
            </label>

            <input
              id={`${idPrefix}-evening-time`}
              aria-label="Evening reflection reminder time"
              type="time"
              value={eveningTime}
              disabled={!eveningEnabled}
              onChange={(e) => {
                setEveningTime(e.target.value);
                setTimeError(null);
                setSavedNotice(null);
              }}
              className="min-h-[40px] rounded-lg border border-[#CFCBC0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#1E2421] disabled:opacity-50"
            />
          </div>
          <p className="mt-1.5 text-xs text-[#5C6762]">
            Invites a short wind-down session or quiet Coach reflection.
          </p>
        </div>
      </div>

      {/* Optional Browser Notification Toggle */}
      <div className="rounded-xl border border-[#ECEAE3] bg-[#FAF9F6] px-3.5 py-3">
        <label
          htmlFor={`${idPrefix}-browser-alerts`}
          className="flex cursor-pointer items-start gap-2.5 min-h-[36px]"
        >
          <input
            id={`${idPrefix}-browser-alerts`}
            type="checkbox"
            checked={browserNotifications}
            disabled={permissionStatus === 'unsupported'}
            onChange={(e) => void handleToggleBrowserAlerts(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-[#2F5D50]"
          />
          <span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#1E2421]">
              <Bell className="h-3.5 w-3.5 text-[#2F5D50]" aria-hidden="true" />
              Also send browser alerts when this tab is open
            </span>
            <span className="mt-0.5 block text-xs text-[#5C6762]">
              {permissionStatus === 'unsupported'
                ? 'Browser notifications are not supported here; in-app visual reminders stay active.'
                : permissionStatus === 'denied'
                  ? 'Browser notifications are blocked by your browser settings; in-app visual reminders still work.'
                  : 'Optional. In-app visual reminders on Home always work without browser permission.'}
            </span>
          </span>
        </label>
      </div>

      {timeError && (
        <p role="alert" className="text-xs font-medium text-[#9B2C2C]">
          {timeError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#2F5D50] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Save schedule</span>
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#D5D3CA] bg-white px-4 py-2 text-xs font-medium text-[#1E2421] transition-colors hover:bg-[#F2F0EA] whitespace-nowrap"
          >
            Done
          </button>
        )}

        {savedNotice && (
          <span role="status" aria-live="polite" className="text-xs font-medium text-[#2F5D50]">
            {savedNotice}
          </span>
        )}
      </div>
    </form>
  );
}
