import React from 'react';
import { House, Wind, MessageSquare, User, WifiOff, HardDrive } from 'lucide-react';
import type { NavDestination } from '../../types/wellness';

interface AppShellProps {
  activeDestination: NavDestination;
  onNavigate: (destination: NavDestination) => void;
  onQuickCheckInAction: () => void;
  storageAvailable: boolean;
  storageNotice: string | null;
  isOnline: boolean;
  children: React.ReactNode;
}

const NAV_ITEMS: {
  id: NavDestination;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'sessions', label: 'Sessions', Icon: Wind },
  { id: 'coach', label: 'Coach', Icon: MessageSquare },
  { id: 'profile', label: 'Profile', Icon: User },
];

export function AppShell({
  activeDestination,
  onNavigate,
  onQuickCheckInAction,
  storageAvailable,
  storageNotice,
  isOnline,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-[#1E2421] flex flex-col pb-20 md:pb-12">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[#2F5D50] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>

      {/* Desktop Top Navigation — Strict 3-Zone Top Bar Contract */}
      <header className="hidden md:block border-b border-[#E6E4DD] bg-[#FAF9F6]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="font-display text-xl font-medium tracking-tight text-[#1E2421] whitespace-nowrap shrink-0 min-h-[44px] flex items-center"
          >
            Mindful Coach
          </button>

          {/* Zone 2: 4 Clean Single-Line Text Navigation Links */}
          <nav aria-label="Primary" className="flex items-center gap-7">
            {NAV_ITEMS.map(({ id, label }) => {
              const isActive = activeDestination === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onNavigate(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-[44px] px-1 text-sm transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'border-[#2F5D50] font-semibold text-[#1E2421]'
                      : 'border-transparent font-medium text-[#4A5550] hover:text-[#1E2421] hover:border-[#CFCBC0]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Contextual Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onQuickCheckInAction}
              className="min-h-[44px] rounded-xl bg-[#2F5D50] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap shrink-0"
            >
              Daily check-in
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Non-Sticky Brand Bar (keeps mobile fixed height strictly to the 64px bottom nav <= 15% cap) */}
      <header className="md:hidden border-b border-[#E6E4DD] bg-[#FAF9F6] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="font-display text-lg font-medium tracking-tight text-[#1E2421] whitespace-nowrap">
            Mindful Coach
          </span>
          <span className="text-xs font-medium text-[#5C6762] capitalize whitespace-nowrap">
            {activeDestination}
          </span>
        </div>
      </header>

      {/* Nonblocking Storage / Offline Notices */}
      {((!storageAvailable && storageNotice) || !isOnline) && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 space-y-2">
          {!storageAvailable && storageNotice && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-[#D8E2EB] bg-[#EDF3F7] px-4 py-3 text-sm text-[#243B4D]"
            >
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{storageNotice}</span>
            </div>
          )}
          {!isOnline && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-[#E5DEC9] bg-[#FBF8EF] px-4 py-3 text-sm text-[#4A3F22]"
            >
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Your browser is currently offline. Daily tracking, timed sessions, and
                curated Demo Coach responses still work in this open tab; Live AI requires
                an internet connection.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:py-8 focus:outline-none"
      >
        {children}
      </main>

      {/* Mobile Compact Bottom Navigation (h-16 = 64px <= 15% of mobile viewport) */}
      <nav
        aria-label="Primary mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-[#E6E4DD] bg-white/95 backdrop-blur-md"
      >
        <div className="grid h-full grid-cols-4 items-stretch">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeDestination === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-1 transition-colors ${
                  isActive
                    ? 'text-[#2F5D50] font-semibold'
                    : 'text-[#5C6762] font-medium hover:text-[#1E2421]'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-4 right-4 h-0.5 rounded-b bg-[#2F5D50]"
                  />
                )}
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="mt-1 text-[11px] leading-none whitespace-nowrap">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
