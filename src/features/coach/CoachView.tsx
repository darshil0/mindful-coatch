import React, { useRef } from 'react';
import { Info, Send, Trash2 } from 'lucide-react';
import type {
  ChatMessage,
  NavDestination,
  UserPreferences,
  WellnessGoal,
} from '../../types/wellness';
import { getGoalMetadata } from '../../data/goals';
import { MAX_COACH_MESSAGE_LENGTH } from '../../shared/coachSafety';
import { useCoachChat } from '../../hooks/useCoachChat';
import { CoachMessageList } from './CoachMessageList';

interface CoachViewProps {
  primaryGoal: WellnessGoal;
  messages: ChatMessage[];
  preferences: UserPreferences;
  isOnline: boolean;
  draftPrompt: string | null;
  onClearDraftPrompt: () => void;
  onAppendMessages: (newMessages: ChatMessage[]) => void;
  onClearChatHistory: () => void;
  onAcknowledgeAiNotice: () => void;
  onNavigate: (destination: NavDestination) => void;
}

export function CoachView({
  primaryGoal,
  messages,
  preferences,
  isOnline,
  draftPrompt,
  onClearDraftPrompt,
  onAppendMessages,
  onClearChatHistory,
  onAcknowledgeAiNotice,
  onNavigate,
}: CoachViewProps) {
  const goalMeta = getGoalMetadata(primaryGoal);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chat = useCoachChat({
    primaryGoal,
    messages,
    preferences,
    isOnline,
    draftPrompt,
    onClearDraftPrompt,
    onAppendMessages,
    onClearChatHistory,
    onAcknowledgeAiNotice,
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void chat.sendTurn(chat.inputValue, true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header & Mode Controls */}
      <section
        aria-labelledby="coach-page-heading"
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="text-xs font-medium text-[#5C6762]">
            {chat.effectiveMode === 'live'
              ? 'Live AI mode · Server-routed Gemini'
              : 'Demo Coach mode · Curated local responses (not live AI)'}
            {' · '}
            {preferences.saveChatHistory
              ? 'Chat saving: On (local)'
              : 'Chat saving: Off (memory only)'}
          </p>
          <h1
            id="coach-page-heading"
            className="mt-1 font-display text-3xl sm:text-4xl font-medium tracking-tight text-[#1E2421]"
          >
            Wellness coach
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chat.serverLiveAiAvailable === true && isOnline && (
            <button
              type="button"
              onClick={chat.toggleDemoPreference}
              className="min-h-[44px] rounded-xl border border-[#D5D3CA] bg-white px-3.5 py-2 text-xs font-medium text-[#1E2421] hover:bg-[#F2F0EA] whitespace-nowrap"
            >
              {chat.preferDemoMode ? 'Use Live AI' : 'Use Demo Coach'}
            </button>
          )}
          <button
            type="button"
            disabled={messages.length === 0 && !chat.errorMessage && !chat.isSending}
            onClick={chat.clearChat}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#D5D3CA] bg-white px-3.5 py-2 text-xs font-medium text-[#1E2421] transition-colors hover:bg-[#F2F0EA] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear chat history</span>
          </button>
        </div>
      </section>

      {/* Unobtrusive Wellness Scope Statement */}
      <p className="border-b border-[#E6E4DD] pb-4 text-xs leading-relaxed text-[#4A5550]">
        <strong className="text-[#1E2421]">Wellness scope:</strong> Mindful Coach offers
        general wellness education, not medical diagnosis or treatment. Speak with a
        qualified clinician for persistent or concerning symptoms. For emergencies or
        self-harm risk, contact local emergency services immediately (such as 911 or 988
        in the US/Canada).
      </p>

      {/* Explicit Demo Coach Notice OR Pre-First-Message Live AI Notice */}
      {chat.effectiveMode === 'demo' && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[#D8E2EB] bg-[#EDF3F7] px-4 py-3 text-xs leading-relaxed text-[#243B4D]"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <strong>Demo Coach active:</strong>{' '}
            {chat.serverLiveAiAvailable === false
              ? 'Live AI credentials or connection are not currently available, so responses come from a curated built-in wellness guide rather than live AI.'
              : 'You selected Demo Coach. Responses come from a curated built-in wellness guide rather than live AI, and nothing is sent externally.'}
          </div>
        </div>
      )}

      {chat.effectiveMode === 'live' &&
        !preferences.acknowledgedAiNotice &&
        messages.length === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-[#D8E2EB] bg-[#EDF3F7] px-4 py-3 text-xs leading-relaxed text-[#243B4D]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <strong>Before your first Live AI message:</strong> Submitted chat messages,
              recent turns in this conversation, and your selected goal ({goalMeta.label})
              are sent through our server to an external AI provider (Google Gemini) to
              generate replies. Your preferred name and daily tracking entries are not sent
              automatically. Avoid entering sensitive personal or medical details.
            </div>
          </div>
        )}

      {chat.statusNotice && (
        <p role="status" aria-live="polite" className="text-xs font-medium text-[#2F5D50]">
          {chat.statusNotice}
        </p>
      )}

      {/* Main Chat Container */}
      <div className="rounded-2xl border border-[#E6E4DD] bg-white p-5 sm:p-6 flex flex-col min-h-[420px]">
        {messages.length === 0 ? (
          <div className="my-auto py-6 space-y-5">
            <div>
              <p className="text-xs font-medium text-[#5C6762]">
                Suggested questions · {goalMeta.label} focus
              </p>
              <h2 className="mt-1 font-display text-xl font-medium text-[#1E2421]">
                Where would you like to start?
              </h2>
              <p className="mt-1 text-sm text-[#4A5550]">
                Choose a starter prompt below or write your own question.
              </p>
            </div>

            <div className="grid gap-3">
              {goalMeta.starterQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={chat.isSending}
                  onClick={() => void chat.sendTurn(question, true)}
                  className="w-full min-h-[48px] rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-4 py-3 text-left text-sm text-[#1E2421] transition-colors hover:bg-[#F2F0EA] disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <CoachMessageList
            messages={messages}
            isSending={chat.isSending}
            errorMessage={chat.errorMessage}
            failedTurnText={chat.failedTurnText}
            preferDemoMode={chat.preferDemoMode}
            onRetryFailed={chat.retryFailedTurn}
            onStayInDemo={chat.switchToDemoCoach}
          />
        )}

        {/* Message Composer */}
        <form
          onSubmit={handleFormSubmit}
          className="mt-4 border-t border-[#ECEAE3] pt-4"
          noValidate
        >
          <label htmlFor="coach-message-input" className="sr-only">
            Ask a wellness question
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              ref={inputRef}
              id="coach-message-input"
              rows={2}
              maxLength={MAX_COACH_MESSAGE_LENGTH}
              disabled={chat.isSending}
              value={chat.inputValue}
              onChange={(e) => chat.setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void chat.sendTurn(chat.inputValue, true);
                }
              }}
              placeholder={`Ask a practical question about ${goalMeta.label.toLowerCase()} or daily routines…`}
              className="w-full flex-1 rounded-xl border border-[#CFCBC0] bg-[#FAF9F6] px-4 py-2.5 text-sm text-[#1E2421] placeholder:text-[#76827C] focus:border-[#2F5D50] focus:bg-white disabled:opacity-60 resize-y"
            />
            <button
              type="submit"
              disabled={chat.isSending || chat.inputValue.trim().length === 0}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#2F5D50] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#254B40] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>{chat.isSending ? 'Sending…' : 'Send'}</span>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5C6762]">
            <span>Press Enter to send, Shift + Enter for a new line.</span>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="underline underline-offset-4 hover:text-[#1E2421]"
            >
              Manage chat-history saving in Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
