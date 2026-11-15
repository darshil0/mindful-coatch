import React from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level error boundary that catches unexpected render exceptions without
 * clearing user wellness data or exposing internal stack traces / personal records.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // Log only high-level error name/message, never user wellness state
    console.error('[ui-error-boundary]', error.name, error.message);
  }

  private handleResetView = () => {
    this.setState({ hasError: false });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-dvh bg-[#FAF9F6] text-[#1E2421] flex items-center justify-center p-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-8 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FDF2F2] text-[#9B2C2C]"
            >
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-medium text-[#1E2421]">
                Something interrupted this view
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#4A5550]">
                Your saved local check-ins, profile preferences, and completed sessions
                were not deleted. Try restoring this view or reloading the page.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleResetView}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#254B40]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Try again</span>
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#D5D3CA] bg-white px-4 py-2 text-sm font-medium text-[#1E2421] transition-colors hover:bg-[#F2F0EA]"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
