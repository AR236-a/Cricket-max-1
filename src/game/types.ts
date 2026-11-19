export type ScreenId =
  | 'menu'
  | 'mode'
  | 'difficulty'
  | 'teams'
  | 'overs'
  | 'toss'
  | 'playing'
  | 'inningsBreak'
  | 'result'
  | 'rules'
  | 'tournamentSelect'
  | 'tournamentSetup'
  | 'tournamentHub';

export type GameMode = 'ai' | 'pvp';
export type MatchFormat = 'limited' | 'test';
export type PitchCondition = 'hard' | 'green' | 'dry';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type LeagueId = 'international' | 'ipl';

export type TournamentType =
  | 't20_wc'
  | 'odi_wc'
  | 'ipl'
  | 'ashes'
  | 'bgt';

export type ShotType =
  | 'drive'
  | 'pull'
  | 'sweep'
  | 'cut'
  | 'loft'
  | 'defend'
  | 'flick'
  | 'hook';

export type DeliveryType =
  | 'fast'
  | 'spin'
  | 'off_spin'
  | 'leg_spin'
  | 'googly'
  | 'doosra'
  | 'arm_ball'
  | 'carrom'
  | 'swing'
  | 'seam'
  | 'yorker'
  | 'bouncer';

export type DeliveryLength = 'full' | 'good' | 'short';

export type WicketKind = 'Bowled' | 'Caught' | 'LBW' | 'Stumped' | 'Hit Wicket';

export type BattingHand = 'right' | 'left';
export type BowlingStyle = 'pace' | 'spin';

export interface PlayerProfile {
  name: string;
  battingHand: BattingHand;
  bowlingStyle: BowlingStyle;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  league: LeagueId;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  batters: string[];
  bowlers: string[];
}

export interface BatterStats {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal?: string;
}

export interface BowlerSpellStat {
  balls: number;
  runs: number;
  wickets: number;
}

export interface OverProgressPoint {
  over: number;
  runsInOver: number;
  wicketsInOver: number;
  cumulativeRuns: number;
  cumulativeWickets: number;
  runRate: number;
  predictedTotal: number;
}

export interface OverCompletedSummary {
  overNumber: number;
  bowlerName: string;
  bowlerStyle: BowlingStyle;
  nextBowlerName: string;
  nextBowlerStyle: BowlingStyle;
  balls: string[];
  runsConceded: number;
  wicketsTaken: number;
  teamRuns: number;
  teamWickets: number;
}

export interface TestDaySummary {
  completedDay: number;
  nextDay: number;
  runsToday: number;
  wicketsToday: number;
  phase: 'day_completed' | 'new_day';
}

export interface InningsState {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  ballsBowled: number;
  declared?: boolean;
  currentOverBalls: string[];
  currentOverRuns: number;
  currentOverWickets: number;
  overHistory: OverProgressPoint[];
  strikerIndex: number;
  nonStrikerIndex: number;
  nextBatterIndex: number;
  partnershipRuns: number;
  partnershipBalls: number;
  batters: BatterStats[];
  bowlerName: string;
  bowlerOversBalls: number;
  bowlerRunsConceded: number;
  bowlerWickets: number;
  bowlerSpells: Record<string, BowlerSpellStat>;
}

export interface DeliveryResolution {
  runs: number;
  isWicket: boolean;
  wicketKind?: WicketKind;
  isBoundaryFour: boolean;
  isBoundarySix: boolean;
  outcomeLabel: string;
  ballSymbol: string;
  commentary: string;
  hitAngleRad: number;
  hitDistanceFactor: number;
  shotUsed: ShotType;
  deliveryUsed: DeliveryType;
  lengthUsed: DeliveryLength;
}

export interface CommentaryEntry {
  id: number;
  overBall: string;
  outcomeSymbol: string;
  text: string;
  isWicket: boolean;
  isBoundary: boolean;
}

export interface MatchState {
  mode: GameMode;
  format: MatchFormat;
  pitchCondition: PitchCondition;
  difficulty: Difficulty;
  homeTeamId: string;
  awayTeamId: string;
  totalOvers: number; // Overs per innings in limited overs; overs per day in test mode
  oversPerDay: 30 | 60 | 90;
  currentDay: number; // 1..5 in test mode
  ballsToday: number;
  runsToday: number;
  wicketsToday: number;
  pendingOverPopup: OverCompletedSummary | null;
  pendingDayPopup: TestDaySummary | null;
  tossCaller: 'home' | 'away';
  tossWinner: 'home' | 'away' | null;
  tossCoinResult: 'heads' | 'tails' | null;
  inningsNumber: 1 | 2 | 3 | 4;
  target: number | null;
  innings1: InningsState;
  innings2: InningsState | null;
  innings3: InningsState | null;
  innings4: InningsState | null;
  isPaused: boolean;
  matchComplete: boolean;
  winnerTeamId: string | 'tie' | 'draw' | null;
  resultSummary: string;
  lastCommentary: string;
  commentaryLog: CommentaryEntry[];
  lastOutcome: DeliveryResolution | null;
  pvpTurnPhase: 'bowl_select' | 'bat_select';
  pendingDeliveryType: DeliveryType;
  pendingDeliveryLength: DeliveryLength;
  activeTournamentMatchId?: string;
}

export interface StandingRow {
  teamId: string;
  group?: 'A' | 'B';
  played: number;
  won: number;
  lost: number;
  tied: number;
  drawn: number;
  points: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
  nrr: number;
}

export type FixtureRound =
  | 'group'
  | 'sf1'
  | 'sf2'
  | 'q1'
  | 'eliminator'
  | 'q2'
  | 'final'
  | 'test_match';

export interface TournamentFixture {
  id: string;
  round: FixtureRound;
  label: string;
  venue?: string;
  group?: 'A' | 'B';
  homeTeamId: string;
  awayTeamId: string;
  completed: boolean;
  winnerTeamId: string | 'tie' | 'draw' | null;
  summary: string;
  homeScoreText?: string;
  awayScoreText?: string;
}

export interface TournamentPlayerStat {
  playerName: string;
  teamId: string;
  matches: number;
  inningsBatted: number;
  notOuts: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  highScore: number;
  highScoreNotOut: boolean;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
}

export interface TournamentState {
  id: string;
  type: TournamentType;
  title: string;
  format: MatchFormat;
  pitchCondition: PitchCondition;
  oversPerInningsOrDay: number; // 20 for T20/IPL, 50 for ODI, 30/60/90 for Test Series
  userTeamId: string;
  difficulty: Difficulty;
  stage: 'league' | 'knockouts' | 'series' | 'complete';
  standings: StandingRow[];
  fixtures: TournamentFixture[];
  playerStats: Record<string, TournamentPlayerStat>;
  championTeamId: string | 'draw' | null;
}
