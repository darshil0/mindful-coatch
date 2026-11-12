import React, { useState } from 'react';
import { Bell, CalendarClock, ChevronDown, ChevronUp, Moon, Sun, X } from 'lucide-react';
import type { ReminderSchedule, ReminderSlotId } from '../../types/wellness';
import type { EvaluatedReminderState } from '../../lib/reminders';
import { ReminderScheduleEditor } from '../../components/reminders/ReminderScheduleEditor';

interface ReminderBannerCardProps {
  evaluatedReminder: EvaluatedReminderState;
  schedule: ReminderSchedule;
  onMorningCheckInAction: () => void;
  onEveningSessionAction: () => void;
  onEveningCoachAction: () => void;
  onDismissForToday: (slot: ReminderSlotId) => void;
  onSaveSchedule: (next: ReminderSchedule) => void;
}

export function ReminderBannerCard({
  evaluatedReminder,
  schedule,
  onMorningCheckInAction,
  onEveningSessionAction,
  onEveningCoachAction,
  onDismissForToday,
  onSaveSchedule,
}: ReminderBannerCardProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const { dueReminder, statusSummary } = evaluatedReminder;

  if (dueReminder) {
    const isMorning = dueReminder.slot === 'morning';
    const SlotIcon = isMorning ? Sun : Moon;

    return (
      <section
        aria-labelledby="active-reminder-heading"
        data-testid="active-reminder-banner"
        className="rounded-2xl border border-[#C9DED6] bg-[#F4F8F6] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#C9DED6] bg-white text-[#2F5D50]"
              aria-hidden="true"
            >
              <SlotIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-[#2F5D50]">
                Gentle reminder · Scheduled for {dueReminder.scheduledLabel}
              </p>
              <h2
                id="active-reminder-heading"
                className="mt-0.5 font-display text-lg font-medium text-[#1E2421]"
              >
                {dueReminder.title}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#3F4B46]">
                {dueReminder.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDismissForToday(dueReminder.slot)}
            aria-label={`Dismiss ${dueReminder.title.toLowerCase()} reminder for today`}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-xl border border-[#CFE0D8] bg-white px-3.5 py-2 text-xs font-medium text-[#4A5550] transition-colors hover:bg-[#FAF9F6] hover:text-[#1E2421] whitespace-nowrap"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Dismiss for today</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 sm:pl-[54px]">
          <button
            type="button"
            onClick={isMorning ? onMorningCheckInAction : onEveningSessionAction}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#2F5D50] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
          >
            {dueReminder.primaryActionLabel}
          </button>

          {!isMorning && dueReminder.secondaryActionLabel && (
            <button
              type="button"
              onClick={onEveningCoachAction}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#2F5D50] bg-white px-4 py-2 text-xs font-medium text-[#1F4238] transition-colors hover:bg-[#EBF2EF] whitespace-nowrap"
            >
              {dueReminder.secondaryActionLabel}
            </button>
          )}

          <button
            type="button"
            aria-expanded={scheduleOpen}
            aria-controls="home-reminder-schedule-panel"
            onClick={() => setScheduleOpen((prev) => !prev)}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-xs font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238] whitespace-nowrap"
          >
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Adjust schedule</span>
            {scheduleOpen ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {scheduleOpen && (
          <div
            id="home-reminder-schedule-panel"
            className="mt-5 border-t border-[#D6E6DF] pt-4 sm:pl-[54px]"
          >
            <ReminderScheduleEditor
              schedule={schedule}
              onSaveSchedule={(next) => {
                onSaveSchedule(next);
                setScheduleOpen(false);
              }}
              onCancel={() => setScheduleOpen(false)}
              compact
              idPrefix="home-reminder"
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Daily reminder rhythm"
      data-testid="reminder-status-strip"
      className="rounded-2xl border border-[#E6E4DD] bg-white px-5 py-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Bell className="h-4 w-4 shrink-0 text-[#2F5D50]" aria-hidden="true" />
          <p className="text-xs sm:text-sm text-[#4A5550]">{statusSummary}</p>
        </div>

        <button
          type="button"
          aria-expanded={scheduleOpen}
          aria-controls="home-reminder-schedule-panel"
          onClick={() => setScheduleOpen((prev) => !prev)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-3.5 py-2 text-xs font-medium text-[#1E2421] transition-colors hover:bg-[#F2F0EA] whitespace-nowrap shrink-0"
        >
          <CalendarClock className="h-3.5 w-3.5 text-[#2F5D50]" aria-hidden="true" />
          <span>Reminder schedule</span>
          {scheduleOpen ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {scheduleOpen && (
        <div
          id="home-reminder-schedule-panel"
          className="mt-4 border-t border-[#ECEAE3] pt-4"
        >
          <ReminderScheduleEditor
            schedule={schedule}
            onSaveSchedule={(next) => {
              onSaveSchedule(next);
              setScheduleOpen(false);
            }}
            onCancel={() => setScheduleOpen(false)}
            compact
            idPrefix="home-reminder"
          />
        </div>
      )}
    </section>
  );
}
