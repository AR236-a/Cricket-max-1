import { formatOvers } from './cricketEngine';
import { getTeamById } from './teams';
import { DeliveryLength, DeliveryType, MatchState } from './types';

export const ACTIVE_MATCH_STORAGE_KEY = 'cricket_max_active_match_v1';

export interface SavedMatchSession {
  version: 1;
  screen: 'playing' | 'inningsBreak';
  autoResumeOnLoad: boolean;
  savedAt: number;
  selectedDeliveryType: DeliveryType;
  selectedDeliveryLength: DeliveryLength;
  match: MatchState;
}

export function isValidMatchState(candidate: unknown): candidate is MatchState {
  if (!candidate || typeof candidate !== 'object') return false;
  const m = candidate as Partial<MatchState>;
  return (
    typeof m.homeTeamId === 'string' &&
    typeof m.awayTeamId === 'string' &&
    (m.mode === 'ai' || m.mode === 'pvp') &&
    (m.format === 'limited' || m.format === 'test') &&
    (m.inningsNumber === 1 || m.inningsNumber === 2 || m.inningsNumber === 3 || m.inningsNumber === 4) &&
    Boolean(m.innings1) &&
    Array.isArray(m.innings1?.batters) &&
    Array.isArray(m.commentaryLog) &&
    !m.matchComplete
  );
}

export function serializeMatchSession(session: SavedMatchSession): string {
  return JSON.stringify(session);
}

export function parseMatchSession(raw: string | null): SavedMatchSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedMatchSession>;
    if (!parsed || parsed.version !== 1) return null;
    if (parsed.screen !== 'playing' && parsed.screen !== 'inningsBreak') return null;
    if (!isValidMatchState(parsed.match)) return null;

    return {
      version: 1,
      screen: parsed.screen,
      autoResumeOnLoad: Boolean(parsed.autoResumeOnLoad),
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      selectedDeliveryType: parsed.selectedDeliveryType ?? 'fast',
      selectedDeliveryLength: parsed.selectedDeliveryLength ?? 'good',
      match: {
        ...parsed.match,
        isPaused: false,
      },
    };
  } catch {
    return null;
  }
}

export function loadSavedMatchSession(): SavedMatchSession | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return parseMatchSession(window.localStorage.getItem(ACTIVE_MATCH_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveMatchSession(session: SavedMatchSession): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, serializeMatchSession(session));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function clearSavedMatchSession(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getSavedMatchActiveInnings(match: MatchState) {
  if (match.inningsNumber === 4 && match.innings4) return match.innings4;
  if (match.inningsNumber === 3 && match.innings3) return match.innings3;
  if (match.inningsNumber === 2 && match.innings2) return match.innings2;
  return match.innings1;
}

export function formatSavedMatchSummary(session: SavedMatchSession): {
  title: string;
  subtitle: string;
} {
  const { match, screen } = session;
  const active = getSavedMatchActiveInnings(match);
  const batTeam = getTeamById(active.battingTeamId);
  const bowlTeam = getTeamById(active.bowlingTeamId);

  const scorePart = `${batTeam.code} ${active.runs}/${active.wickets} (${formatOvers(active.ballsBowled)} ov)`;
  const formatPart =
    match.format === 'test'
      ? `Test Day ${match.currentDay}/5 · Inn ${match.inningsNumber}`
      : `${match.totalOvers} Ov · Inn ${match.inningsNumber}`;

  const statusPart =
    screen === 'inningsBreak'
      ? 'Innings Break'
      : match.pendingDayPopup
      ? `Day ${match.pendingDayPopup.completedDay} Summary`
      : match.pendingOverPopup
      ? `End of Over ${match.pendingOverPopup.overNumber}`
      : `vs ${bowlTeam.code}`;

  return {
    title: `${scorePart} ${statusPart}`,
    subtitle: `${formatPart} · ${match.mode === 'ai' ? 'vs AI' : 'PvP'}`,
  };
}
