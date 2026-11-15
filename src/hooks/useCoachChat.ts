import { useEffect, useRef, useState } from 'react';
import type {
  ChatMessage,
  UserPreferences,
  WellnessGoal,
} from '../types/wellness';
import { buildCuratedDemoResponse } from '../data/demoCoachResponses';
import {
  detectUrgentSafetyConcern,
  MAX_COACH_HISTORY_TURNS,
  MAX_COACH_MESSAGE_LENGTH,
  URGENT_SAFETY_RESPONSE,
} from '../shared/coachSafety';
import {
  fetchCoachStatus,
  sendCoachChatMessage,
} from '../services/coachApiClient';

interface UseCoachChatOptions {
  primaryGoal: WellnessGoal;
  messages: ChatMessage[];
  preferences: UserPreferences;
  isOnline: boolean;
  draftPrompt: string | null;
  onClearDraftPrompt: () => void;
  onAppendMessages: (newMessages: ChatMessage[]) => void;
  onReplaceLastFallbackMessage: (replacement: ChatMessage) => void;
  onClearChatHistory: () => void;
  onAcknowledgeAiNotice: () => void;
}

export function useCoachChat({
  primaryGoal,
  messages,
  preferences,
  isOnline,
  draftPrompt,
  onClearDraftPrompt,
  onAppendMessages,
  onReplaceLastFallbackMessage,
  onClearChatHistory,
  onAcknowledgeAiNotice,
}: UseCoachChatOptions) {
  const [inputValue, setInputValue] = useState('');
  const [serverLiveAiAvailable, setServerLiveAiAvailable] = useState<boolean | null>(
    null
  );
  const [preferDemoMode, setPreferDemoMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [failedTurnText, setFailedTurnText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const submittingLockRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Check server AI configuration status on mount and when online status changes
  useEffect(() => {
    if (!isOnline) {
      setServerLiveAiAvailable(false);
      return;
    }
    const statusController = new AbortController();
    fetchCoachStatus(statusController.signal).then((available) => {
      if (!statusController.signal.aborted) {
        setServerLiveAiAvailable(available);
      }
    });
    return () => {
      statusController.abort();
    };
  }, [isOnline]);

  const effectiveMode: 'live' | 'demo' =
    isOnline && serverLiveAiAvailable !== false && !preferDemoMode ? 'live' : 'demo';

  const sendTurn = async (rawText: string, appendUserBubble: boolean) => {
    const trimmed = rawText.trim();
    if (!trimmed || submittingLockRef.current) return;

    if (trimmed.length > MAX_COACH_MESSAGE_LENGTH) {
      setErrorMessage('Please keep your message under 1,200 characters.');
      return;
    }

    generationRef.current += 1;
    const turnGen = generationRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    submittingLockRef.current = true;
    setIsSending(true);
    setErrorMessage(null);
    setStatusNotice(null);

    const nowIso = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: trimmed,
      createdAt: nowIso,
      mode: effectiveMode,
    };

    try {
      if (appendUserBubble) {
        setFailedTurnText(null);
        onAppendMessages([userMsg]);
        setInputValue('');
      }

      if (detectUrgentSafetyConcern(trimmed)) {
        const crisisMsg: ChatMessage = {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: URGENT_SAFETY_RESPONSE,
          createdAt: new Date().toISOString(),
          mode: 'demo',
          isCrisisNotice: true,
        };
        if (appendUserBubble) {
          onAppendMessages([crisisMsg]);
        } else {
          onReplaceLastFallbackMessage(crisisMsg);
        }
        setFailedTurnText(null);
        return;
      }

      if (effectiveMode === 'demo') {
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(() => {
            controller.signal.removeEventListener('abort', onAbort);
            resolve();
          }, 260);
          const onAbort = () => {
            window.clearTimeout(timer);
            resolve();
          };
          if (controller.signal.aborted) {
            onAbort();
          } else {
            controller.signal.addEventListener('abort', onAbort, { once: true });
          }
        });
        if (controller.signal.aborted || turnGen !== generationRef.current) return;
        const demo = buildCuratedDemoResponse(trimmed, primaryGoal);
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: demo.content,
          createdAt: new Date().toISOString(),
          mode: 'demo',
          isCrisisNotice: demo.isCrisisNotice,
        };
        if (appendUserBubble) {
          onAppendMessages([assistantMsg]);
        } else {
          onReplaceLastFallbackMessage(assistantMsg);
        }
        setFailedTurnText(null);
        return;
      }

      let didAcknowledgeThisTurn = preferences.acknowledgedAiNotice;
      if (serverLiveAiAvailable === true && !didAcknowledgeThisTurn) {
        onAcknowledgeAiNotice();
        didAcknowledgeThisTurn = true;
      }

      let historySource = messages;
      if (!appendUserBubble) {
        let endIdx = messages.length;
        if (endIdx > 0 && messages[endIdx - 1]?.isFallbackFromError) {
          endIdx -= 1;
        }
        if (
          endIdx > 0 &&
          messages[endIdx - 1]?.role === 'user' &&
          messages[endIdx - 1]?.content === trimmed
        ) {
          endIdx -= 1;
        }
        historySource = messages.slice(0, endIdx);
      }

      const recentHistory = historySource
        .slice(-MAX_COACH_HISTORY_TURNS)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const result = await sendCoachChatMessage(
        {
          message: trimmed,
          goal: primaryGoal,
          history: recentHistory,
        },
        controller.signal
      );

      if (turnGen !== generationRef.current) return;

      if (!result.ok) {
        if (result.unconfigured) {
          setServerLiveAiAvailable(false);
        }

        if (appendUserBubble) {
          const fallback = buildCuratedDemoResponse(trimmed, primaryGoal);
          onAppendMessages([
            {
              id: `a-${Date.now()}-fallback`,
              role: 'assistant',
              content: fallback.content,
              createdAt: new Date().toISOString(),
              mode: 'demo',
              isCrisisNotice: fallback.isCrisisNotice,
              isFallbackFromError: true,
            },
          ]);
        }

        setErrorMessage(
          result.unconfigured
            ? 'Live AI credentials are not configured on the server, so this question was answered using Mindful Coach’s built-in wellness guide (not live AI).'
            : `${result.error} Answered above using Mindful Coach’s built-in wellness guide (not live AI)—you can also retry Live AI below.`
        );
        setFailedTurnText(result.unconfigured ? null : trimmed);
        return;
      }

      setServerLiveAiAvailable(true);
      if (!didAcknowledgeThisTurn) {
        onAcknowledgeAiNotice();
      }
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: result.data.reply,
        createdAt: new Date().toISOString(),
        mode: result.data.mode,
        isCrisisNotice: result.data.isCrisisNotice,
      };
      if (appendUserBubble) {
        onAppendMessages([assistantMsg]);
      } else {
        onReplaceLastFallbackMessage(assistantMsg);
      }
      setFailedTurnText(null);
    } catch (err: unknown) {
      if (
        turnGen !== generationRef.current ||
        (err instanceof DOMException && err.name === 'AbortError')
      ) {
        return;
      }
      if (appendUserBubble) {
        const fallback = buildCuratedDemoResponse(trimmed, primaryGoal);
        onAppendMessages([
          {
            id: `a-${Date.now()}-fallback`,
            role: 'assistant',
            content: fallback.content,
            createdAt: new Date().toISOString(),
            mode: 'demo',
            isCrisisNotice: fallback.isCrisisNotice,
            isFallbackFromError: true,
          },
        ]);
      }
      setErrorMessage(
        'Could not reach Live AI over the network, so this question was answered using Mindful Coach’s built-in wellness guide (not live AI). You can retry Live AI when ready.'
      );
      setFailedTurnText(trimmed);
    } finally {
      if (turnGen === generationRef.current) {
        setIsSending(false);
        submittingLockRef.current = false;
      }
    }
  };

  const sendTurnRef = useRef(sendTurn);
  sendTurnRef.current = sendTurn;

  // Submit starter question selected from the Home dashboard once mode status resolves
  useEffect(() => {
    if (!draftPrompt) return;
    if (isOnline && serverLiveAiAvailable === null && !preferDemoMode) {
      return;
    }
    const promptToSend = draftPrompt;
    onClearDraftPrompt();
    void sendTurnRef.current(promptToSend, true);
  }, [draftPrompt, isOnline, serverLiveAiAvailable, preferDemoMode, onClearDraftPrompt]);

  const retryFailedTurn = () => {
    if (!failedTurnText || isSending) return;
    void sendTurn(failedTurnText, false);
  };

  const cancelInFlightTurn = () => {
    generationRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    submittingLockRef.current = false;
    setIsSending(false);
  };

  const switchToDemoCoach = () => {
    cancelInFlightTurn();
    setPreferDemoMode(true);
    setErrorMessage(null);
    setFailedTurnText(null);
  };

  const toggleDemoPreference = () => {
    cancelInFlightTurn();
    setPreferDemoMode((prev) => {
      const next = !prev;
      if (next) {
        setErrorMessage(null);
        setFailedTurnText(null);
      }
      return next;
    });
  };

  const clearChat = () => {
    cancelInFlightTurn();
    onClearChatHistory();
    setFailedTurnText(null);
    setErrorMessage(null);
    setStatusNotice('Chat history cleared.');
  };

  return {
    inputValue,
    setInputValue,
    serverLiveAiAvailable,
    preferDemoMode,
    effectiveMode,
    isSending,
    failedTurnText,
    errorMessage,
    statusNotice,
    sendTurn,
    retryFailedTurn,
    switchToDemoCoach,
    toggleDemoPreference,
    clearChat,
  };
}
