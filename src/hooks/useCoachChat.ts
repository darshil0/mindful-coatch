import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CURRENT_AI_CONSENT_VERSION,
  type ChatMessage,
  type UserPreferences,
  type WellnessGoal,
} from '../types/wellness';
import { buildCuratedDemoResponse } from '../data/demoCoachResponses';
import {
  evaluateSafetySignal,
  isCannedSafetyResponse,
  MAX_COACH_HISTORY_TURNS,
  MAX_COACH_MESSAGE_LENGTH,
  URGENT_SELF_HARM_RESPONSE,
} from '../shared/coachSafety';
import { fetchCoachStatus, sendCoachChatMessage } from '../services/coachApiClient';

export function hasValidAiConsent(preferences: UserPreferences): boolean {
  return (
    preferences.acknowledgedAiNotice === true &&
    preferences.aiConsentVersion === CURRENT_AI_CONSENT_VERSION
  );
}

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
  const [rawServerLiveAiAvailable, setRawServerLiveAiAvailable] = useState<
    boolean | null
  >(null);
  const [preferDemoMode, setPreferDemoMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [failedTurnText, setFailedTurnText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [pendingConsentPrompt, setPendingConsentPrompt] = useState<string | null>(null);

  const submittingLockRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  const aiConsentGranted = hasValidAiConsent(preferences);
  const serverLiveAiAvailable = isOnline ? rawServerLiveAiAvailable : false;

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Check server AI configuration status on mount and when online status changes
  useEffect(() => {
    if (!isOnline) {
      return;
    }
    const statusController = new AbortController();
    fetchCoachStatus(statusController.signal).then((available) => {
      if (!statusController.signal.aborted) {
        setRawServerLiveAiAvailable(available);
      }
    });
    return () => {
      statusController.abort();
    };
  }, [isOnline]);

  // Live AI can only be active when online, configured, user hasn't picked Demo, AND status is known
  const liveAiEligible = isOnline && serverLiveAiAvailable === true && !preferDemoMode;
  const needsLiveConsent = liveAiEligible && !aiConsentGranted;

  const effectiveMode: 'live' | 'demo' =
    liveAiEligible && aiConsentGranted ? 'live' : 'demo';

  const sendTurn = useCallback(
    async (
      rawText: string,
      appendUserBubble: boolean,
      options?: { bypassConsentCheck?: boolean; forceDemo?: boolean }
    ) => {
      const trimmed = rawText.trim();
      if (!trimmed || submittingLockRef.current) return;

      if (trimmed.length > MAX_COACH_MESSAGE_LENGTH) {
        setErrorMessage('Please keep your message under 1,200 characters.');
        return;
      }

      // Immediate safety check FIRST — never requires consent or upstream AI
      const immediateSafety = evaluateSafetySignal(trimmed);
      const useDemo =
        options?.forceDemo === true ||
        preferDemoMode ||
        !isOnline ||
        serverLiveAiAvailable === false;

      if (
        !useDemo &&
        !immediateSafety.requiresUpstreamSuppression &&
        !aiConsentGranted &&
        !options?.bypassConsentCheck
      ) {
        setPendingConsentPrompt(trimmed);
        setStatusNotice(
          'Please acknowledge the external Live AI notice above before sending messages to Google Gemini, or switch to Demo Coach.'
        );
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

      const activeSendMode: 'live' | 'demo' = useDemo ? 'demo' : 'live';
      const nowIso = new Date().toISOString();
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: trimmed,
        createdAt: nowIso,
        mode: activeSendMode,
      };

      try {
        if (appendUserBubble) {
          setFailedTurnText(null);
          onAppendMessages([userMsg]);
          setInputValue('');
        }

        if (immediateSafety.requiresUpstreamSuppression && immediateSafety.response) {
          const crisisMsg: ChatMessage = {
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            content: immediateSafety.response,
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

        if (activeSendMode === 'demo' || serverLiveAiAvailable === null) {
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

        // M2: Strip any prior urgent safety turns & canned crisis responses before leaving the browser
        const slicedHistory = historySource.slice(-MAX_COACH_HISTORY_TURNS);
        const sanitizedClientHistory: { role: 'user' | 'assistant'; content: string }[] =
          [];
        let skipNextCrisisNotice = false;
        for (const m of slicedHistory) {
          if (m.role === 'user') {
            if (evaluateSafetySignal(m.content).requiresUpstreamSuppression) {
              skipNextCrisisNotice = true;
              continue;
            }
            skipNextCrisisNotice = false;
            sanitizedClientHistory.push({ role: 'user', content: m.content });
          } else {
            if (
              m.isCrisisNotice ||
              isCannedSafetyResponse(m.content) ||
              skipNextCrisisNotice
            ) {
              skipNextCrisisNotice = false;
              continue;
            }
            sanitizedClientHistory.push({ role: 'assistant', content: m.content });
          }
        }

        // If the most recent exchange before a short ambiguous prompt was a crisis notice, handle locally
        const latestMessage = slicedHistory[slicedHistory.length - 1];
        if (
          latestMessage?.isCrisisNotice &&
          trimmed.split(/\s+/).length <= 8 &&
          trimmed.length <= 90
        ) {
          const crisisMsg: ChatMessage = {
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            content: URGENT_SELF_HARM_RESPONSE,
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

        const result = await sendCoachChatMessage(
          {
            message: trimmed,
            goal: primaryGoal,
            history: sanitizedClientHistory,
          },
          controller.signal
        );

        if (turnGen !== generationRef.current) return;

        if (!result.ok) {
          if (result.unconfigured) {
            setRawServerLiveAiAvailable(false);
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

        setRawServerLiveAiAvailable(true);
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
    },
    [
      preferDemoMode,
      isOnline,
      serverLiveAiAvailable,
      aiConsentGranted,
      onAppendMessages,
      onReplaceLastFallbackMessage,
      primaryGoal,
      messages,
    ]
  );

  const sendTurnRef = useRef(sendTurn);
  useEffect(() => {
    sendTurnRef.current = sendTurn;
  }, [sendTurn]);

  // Handle Home starter question cleanly without bypassing Live AI consent
  useEffect(() => {
    if (!draftPrompt) return;
    if (isOnline && serverLiveAiAvailable === null && !preferDemoMode) {
      return;
    }
    const promptToHandle = draftPrompt;
    const timer = window.setTimeout(() => {
      onClearDraftPrompt();

      const safety = evaluateSafetySignal(promptToHandle);
      if (
        !safety.requiresUpstreamSuppression &&
        isOnline &&
        serverLiveAiAvailable === true &&
        !preferDemoMode &&
        !aiConsentGranted
      ) {
        setPendingConsentPrompt(promptToHandle);
        setInputValue(promptToHandle);
        setStatusNotice(
          'Review the external Live AI notice above before sending your selected question, or choose Demo Coach.'
        );
        return;
      }

      void sendTurnRef.current(promptToHandle, true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    draftPrompt,
    isOnline,
    serverLiveAiAvailable,
    preferDemoMode,
    aiConsentGranted,
    onClearDraftPrompt,
  ]);

  const acknowledgeAndEnableLiveAi = () => {
    onAcknowledgeAiNotice();
    setPreferDemoMode(false);
    setStatusNotice('Live AI enabled. Your upcoming messages will route through Gemini.');
    if (pendingConsentPrompt) {
      const queued = pendingConsentPrompt;
      setPendingConsentPrompt(null);
      void sendTurnRef.current(queued, true, { bypassConsentCheck: true });
    }
  };

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
    if (pendingConsentPrompt) {
      const queued = pendingConsentPrompt;
      setPendingConsentPrompt(null);
      void sendTurnRef.current(queued, true, { forceDemo: true });
    }
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
    setPendingConsentPrompt(null);
    setErrorMessage(null);
    setStatusNotice('Chat history cleared.');
  };

  return {
    inputValue,
    setInputValue,
    serverLiveAiAvailable,
    preferDemoMode,
    liveAiEligible,
    needsLiveConsent,
    aiConsentGranted,
    pendingConsentPrompt,
    effectiveMode,
    isSending,
    failedTurnText,
    errorMessage,
    statusNotice,
    acknowledgeAndEnableLiveAi,
    sendTurn,
    retryFailedTurn,
    switchToDemoCoach,
    toggleDemoPreference,
    clearChat,
  };
}
