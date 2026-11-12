import { useEffect, useState } from 'react';
import type { ReduceMotionSetting } from '../types/wellness';
import { getLocalDateKey } from '../lib/dateUtils';

export interface EnvironmentState {
  todayDateKey: string;
  isOnline: boolean;
  osPrefersReducedMotion: boolean;
  effectiveReducedMotion: boolean;
}

export function useEnvironmentState(
  reduceMotionPreference: ReduceMotionSetting
): EnvironmentState {
  const [todayDateKey, setTodayDateKey] = useState<string>(() => getLocalDateKey());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [osPrefersReducedMotion, setOsPrefersReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  // Keep local calendar date fresh across midnight or tab wakeups
  useEffect(() => {
    const refreshDate = () => {
      const nextKey = getLocalDateKey();
      setTodayDateKey((prev) => (prev === nextKey ? prev : nextKey));
    };
    const interval = window.setInterval(refreshDate, 30_000);
    window.addEventListener('focus', refreshDate);
    document.addEventListener('visibilitychange', refreshDate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshDate);
      document.removeEventListener('visibilitychange', refreshDate);
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
    isOnline,
    osPrefersReducedMotion,
    effectiveReducedMotion,
  };
}
