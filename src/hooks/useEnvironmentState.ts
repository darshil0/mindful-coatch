import { useEffect, useState } from 'react';
import type { ReduceMotionSetting } from '../types/wellness';
import { getLocalDateKey } from '../lib/dateUtils';
import { getLocalTimeMinutes } from '../lib/reminders';

export interface EnvironmentState {
  todayDateKey: string;
  nowMinutes: number;
  isOnline: boolean;
  osPrefersReducedMotion: boolean;
  effectiveReducedMotion: boolean;
}

export function useEnvironmentState(
  reduceMotionPreference: ReduceMotionSetting
): EnvironmentState {
  const [todayDateKey, setTodayDateKey] = useState<string>(() => getLocalDateKey());
  const [nowMinutes, setNowMinutes] = useState<number>(() => getLocalTimeMinutes());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [osPrefersReducedMotion, setOsPrefersReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  // Keep local calendar date and wall-clock minutes fresh across midnight or tab wakeups
  useEffect(() => {
    const refreshClock = () => {
      const now = new Date();
      const nextKey = getLocalDateKey(now);
      const nextMinutes = getLocalTimeMinutes(now);
      setTodayDateKey((prev) => (prev === nextKey ? prev : nextKey));
      setNowMinutes((prev) => (prev === nextMinutes ? prev : nextMinutes));
    };
    const interval = window.setInterval(refreshClock, 30_000);
    window.addEventListener('focus', refreshClock);
    document.addEventListener('visibilitychange', refreshClock);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshClock);
      document.removeEventListener('visibilitychange', refreshClock);
    };
  }, []);

  // Online / offline status listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // OS reduced-motion media query listener
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setOsPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const effectiveReducedMotion =
    reduceMotionPreference === 'on' ||
    (reduceMotionPreference === 'system' && osPrefersReducedMotion);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-reduce-motion',
      effectiveReducedMotion ? 'true' : 'false'
    );
  }, [effectiveReducedMotion]);

  return {
    todayDateKey,
    nowMinutes,
    isOnline,
    osPrefersReducedMotion,
    effectiveReducedMotion,
  };
}
