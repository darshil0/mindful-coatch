import type { WellnessGoal } from '../types/wellness.ts';

export interface CoachHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachStatusResponse {
  liveAiAvailable: boolean;
}

export interface CoachChatRequest {
  message: string;
  goal?: WellnessGoal | null;
  history?: CoachHistoryItem[];
}

export interface CoachChatSuccessResponse {
  reply: string;
  mode: 'live' | 'demo';
  isCrisisNotice: boolean;
}

export interface CoachApiErrorResponse {
  error: string;
  code: string;
  liveAiAvailable?: boolean;
}
