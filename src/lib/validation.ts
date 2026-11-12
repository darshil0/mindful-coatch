import type { WellnessGoal } from '../types/wellness.ts';
import { WELLNESS_GOALS } from '../data/goals.ts';

export type ValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; error: string };

export function isValidWellnessGoal(value: unknown): value is WellnessGoal {
  return typeof value === 'string' && (WELLNESS_GOALS as readonly string[]).includes(value);
}

/**
 * Validates and trims the user's preferred name.
 * Strips ASCII control characters and collapses repeated whitespace.
 */
export function validatePreferredName(raw: string): ValidationResult<string> {
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) {
    return {
      valid: false,
      error: 'Please enter the name you would like us to call you.',
    };
  }
  if (cleaned.length > 50) {
    return {
      valid: false,
      error: 'Preferred name must be 50 characters or fewer.',
    };
  }
  return { valid: true, value: cleaned };
}

/**
 * Validates optional energy rating (1..10 integer, or null when left blank).
 */
export function validateEnergyRating(
  raw: number | string | null | undefined
): ValidationResult<number | null> {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { valid: true, value: null };
  }
  const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(num) || num < 1 || num > 10) {
    return {
      valid: false,
      error: 'Choose a whole-number energy rating between 1 and 10.',
    };
  }
  return { valid: true, value: num };
}

/**
 * Validates optional steps count.
 * Blank string -> `null` (not recorded).
 * `"0"` -> `0` (valid recorded zero).
 */
export function validateStepsInput(raw: string): ValidationResult<number | null> {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { valid: true, value: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Steps must be a nonnegative whole number (for example, 0 or 6500).',
    };
  }
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num) || num < 0 || num > 250000) {
    return {
      valid: false,
      error: 'Enter a realistic step count between 0 and 250,000.',
    };
  }
  return { valid: true, value: num };
}

/**
 * Validates optional sleep hours and minutes.
 * Both blank -> `null` (not recorded).
 * `0` hours and `0` (or blank) minutes -> `0` total minutes (valid recorded zero).
 * Constrained to 0..24 total hours (0..1440 minutes).
 */
export function validateSleepInputs(
  hoursRaw: string,
  minutesRaw: string
): ValidationResult<number | null> {
  const hTrim = hoursRaw.trim();
  const mTrim = minutesRaw.trim();

  if (hTrim === '' && mTrim === '') {
    return { valid: true, value: null };
  }

  const effectiveHoursStr = hTrim === '' ? '0' : hTrim;
  const effectiveMinutesStr = mTrim === '' ? '0' : mTrim;

  if (!/^\d+$/.test(effectiveHoursStr) || !/^\d+$/.test(effectiveMinutesStr)) {
    return {
      valid: false,
      error: 'Sleep hours and minutes must be nonnegative whole numbers.',
    };
  }

  const hours = Number(effectiveHoursStr);
  const minutes = Number(effectiveMinutesStr);

  if (hours < 0 || hours > 24) {
    return {
      valid: false,
      error: 'Sleep hours must be between 0 and 24.',
    };
  }

  if (minutes < 0 || minutes > 59) {
    return {
      valid: false,
      error: 'Sleep minutes must be between 0 and 59.',
    };
  }

  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes > 24 * 60) {
    return {
      valid: false,
      error: 'Total sleep cannot exceed 24 hours (24h 0m).',
    };
  }

  return { valid: true, value: totalMinutes };
}

export const MAX_REFLECTIVE_NOTE_LENGTH = 500;

/**
 * Validates and sanitizes an optional daily reflective note.
 * Blank text -> `null` (not recorded). Strips unsafe ASCII control chars while preserving newlines.
 */
export function validateReflectiveNote(raw: string): ValidationResult<string | null> {
  const normalized = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();

  if (normalized.length === 0) {
    return { valid: true, value: null };
  }

  if (normalized.length > MAX_REFLECTIVE_NOTE_LENGTH) {
    return {
      valid: false,
      error: `Reflective note must be ${MAX_REFLECTIVE_NOTE_LENGTH} characters or fewer.`,
    };
  }

  return { valid: true, value: normalized };
}

