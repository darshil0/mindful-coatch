import React, { useEffect, useRef } from 'react';
import { LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import type { ChatMessage } from '../../types/wellness';
import { StructuredMessageBody } from './StructuredMessageBody';

interface CoachMessageListProps {
  messages: ChatMessage[];
  isSending: boolean;
  errorMessage: string | null;
  failedTurnText: string | null;
  preferDemoMode: boolean;
  onRetryFailed: () => void;
  onStayInDemo: () => void;
}

export function CoachMessageList({
  messages,
  isSending,
  errorMessage,
  failedTurnText,
  preferDemoMode,
  onRetryFailed,
  onStayInDemo,
}: CoachMessageListProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isSending) {
      container.scrollTop = container.scrollHeight;
      return;
    }

    const assistantItems = container.querySelectorAll<HTMLElement>(
      '[data-message-role="assistant"]'
    );
    const lastAssistant = assistantItems[assistantItems.length - 1];
    if (lastAssistant) {
      const maxScrollWithoutClippingReply = Math.max(0, lastAssistant.offsetTop - 8);
      const bottomScroll = Math.max(
        0,
        container.scrollHeight - container.clientHeight
      );
      container.scrollTop = Math.min(bottomScroll, maxScrollWithoutClippingReply);
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, isSending, errorMessage]);

  return (
    <div
      ref={messagesContainerRef}
      aria-label="Conversation messages"
      className="relative flex-1 space-y-4 overflow-y-auto pt-1 pr-1 pb-4 max-h-[65vh]"
    >
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        if (isUser) {
          return (
            <div key={msg.id} data-message-role="user" className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-[#2F5D50] px-4 py-3 text-sm leading-relaxed text-white">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          );
        }

        return (
          <div key={msg.id} data-message-role="assistant" className="flex justify-start">
            <div
              className={`max-w-[92%] sm:max-w-[85%] rounded-2xl border px-4 py-3.5 text-[#1E2421] ${
                msg.isCrisisNotice
                  ? 'border-[#C53030] bg-[#FDF2F2]'
                  : 'border-[#E6E4DD] bg-[#FAF9F6]'
              }`}
            >
              <p className="mb-1.5 text-[11px] font-medium text-[#5C6762]">
                {msg.isCrisisNotice
                  ? 'Urgent support resources'
                  : msg.mode === 'live'
                  ? 'Mindful Coach · Live AI'
                  : msg.isFallbackFromError
                  ? 'Mindful Coach · Built-in wellness guide (Live AI busy — not live AI)'
                  : 'Mindful Coach · Curated Demo (not live AI)'}
              </p>
              <StructuredMessageBody content={msg.content} />
            </div>
          </div>
        );
      })}

      {isSending && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-2xl border border-[#E6E4DD] bg-[#FAF9F6] px-4 py-3 text-sm text-[#4A5550] w-fit"
        >
          <LoaderCircle
            className="h-4 w-4 animate-spin text-[#2F5D50]"
            aria-hidden="true"
          />
          <span>Preparing response…</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-[#E5DEC9] bg-[#FBF8EF] p-4 text-sm text-[#4A3F22]"
        >
          <div className="flex items-start gap-2.5">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-[#8C6D1F]"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="font-medium leading-relaxed">{errorMessage}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {failedTurnText && (
                  <button
                    type="button"
                    onClick={onRetryFailed}
                    disabled={isSending}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#2F5D50] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#254B40] whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Retry with Live AI</span>
                  </button>
                )}
                {!preferDemoMode && (
                  <button
                    type="button"
                    onClick={onStayInDemo}
                    disabled={isSending}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D5CDB6] bg-white px-3.5 py-1.5 text-xs font-medium text-[#4A3F22] hover:bg-[#F5F2E8] whitespace-nowrap"
                  >
                    <span>Stay in Demo Coach</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
