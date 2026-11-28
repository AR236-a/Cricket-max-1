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
export type WeatherCondition = 'clear' | 'overcast' | 'windy' | 'humid' | 'drizzle';
export type RainChance = 0 | 25 | 50 | 75 | 100;
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

export type WicketKind = 'Bowled' | 'Caught' | 'LBW' | 'Stumped';

export type BattingHand = 'right' | 'left';
export type BowlingStyle = 'pace' | 'spin';
export type BowlingSide = 'over' | 'round';

export type MilestoneKind = '50' | '100' | '150' | '200' | '5fer';

export interface MilestoneCelebration {
  kind: MilestoneKind;
  playerName: string;
  teamId: string;
  title: string;
  subtitle: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  wickets?: number;
  runsConceded?: number;
  oversText?: string;
}

export interface PlayerMatchStatLine {
  playerName: string;
  teamId: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  notOut: boolean;
  strikeRate: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  oversBowled: string;
  economy: number | null;
  points: number;
  summary: string;
}

export interface PlayerOfMatchAward {
  playerName: string;
  teamId: string;
  points: number;
  summary: string;
  runs?: number;
  ballsFaced?: number;
  fours?: number;
  sixes?: number;
  notOut?: boolean;
  strikeRate?: number;
  wickets?: number;
  ballsBowled?: number;
  runsConceded?: number;
  oversBowled?: string;
  economy?: number | null;
  roleTag?: 'All-Rounder' | 'Batter' | 'Bowler';
}

export interface PostMatchAwardsSummary {
  playerOfTheMatch: PlayerOfMatchAward;
  bestBatter: PlayerMatchStatLine | null;
  bestBowler: PlayerMatchStatLine | null;
  topPerformers: PlayerMatchStatLine[];
}

export interface PlayerOfTournamentAward {
  playerName: string;
  teamId: string;
  matches: number;
  runs: number;
  battingAverage: string;
  strikeRate: string;
  wickets: number;
  economy: string;
  points: number;
}

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
  odiBatters?: string[];
  odiBowlers?: string[];
}

export interface TeamFormatContext {
  format?: MatchFormat;
  totalOvers?: number;
  tournamentType?: TournamentType;
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

export interface NextBatterPrompt {
  dismissedBatterName: string;
  dismissedKind?: WicketKind;
  teamId: string;
  wickets: number;
  replacingSlot: 'striker' | 'nonStriker';
  selectedBatterIndex: number;
}

export interface TestDaySummary {
  completedDay: number;
  nextDay: number;
  runsToday: number;
  wicketsToday: number;
  lastBowlerName?: string;
  phase: 'day_completed' | 'new_day';
}

export interface DlsRainPopupState {
  inningsNumber: 1 | 2;
  rainChance: RainChance;
  weatherCondition: WeatherCondition;
  previousOvers: number;
  revisedOvers: number;
  oversLost: number;
  team1ResourcesPct: number;
  team2ResourcesPct: number;
  previousTarget: number | null;
  revisedTarget: number | null;
  parScore: number | null;
  matchEndedByRain: boolean;
  inningsEndedByRain: boolean;
  headline: string;
  details: string;
}

export type DrsAppealType = 'LBW' | 'Stumped';
export type DrsOnFieldDecision = 'OUT' | 'NOT_OUT';
export type DrsThirdUmpireOutcome = 'OUT' | 'NOT_OUT' | 'UMPIRES_CALL';
export type DrsRequestingSide = 'batting' | 'bowling';

export interface DrsAppealTrigger {
  appealType: DrsAppealType;
  onFieldDecision: DrsOnFieldDecision;
}

export interface DrsBallTrackingData {
  pitching: 'In Line' | 'Outside Off' | 'Outside Leg';
  impact: 'In Line' | 'Outside Off' | "Umpire's Call";
  wickets: 'Hitting' | 'Missing' | "Umpire's Call";
  ultraEdge: 'Flat Line (No Bat)' | 'Spike Near Bat';
  pitchXNorm: number; // -1 (leg) .. 0 (middle) .. +1 (off)
  impactXNorm: number;
  wicketXNorm: number;
  wicketHeightNorm: number; // 0 (base) .. 1 (bails) .. >1 (over stumps)
}

export interface DrsStumpingData {
  backFootPosition:
    | 'Behind Crease (Grounded)'
    | 'On Line (Nothing Behind)'
    | 'In Air (Out of Crease)';
  bailsLit: boolean;
  ultraEdge: 'No Bat Involved' | 'Spike on Glove/Bat';
  footOffsetMm: number; // positive = behind crease (safe), <= 0 = on/in front of line (out)
}

export type DrsReferralKind = 'drs' | 'umpire_stumping';

export interface DrsProbabilityEstimate {
  overturnPct: number;
  umpiresCallPct: number;
  retainReviewPct: number;
  loseReviewPct: number;
  confidenceTier: 'high' | 'medium' | 'low';
  confidenceLabel: 'STRONG REVIEW' | 'CLOSE CALL' | 'RISKY — LIKELY WASTED';
  hint: string;
}

export interface BowlerDrsChallenge {
  id: number;
  resolution: DeliveryResolution;
  strikerIndex: number;
  strikerName: string;
  bowlerName: string;
  overCompleted: boolean;
  isSpin: boolean;
  timeLimitSec: number;
  lbwProbability?: DrsProbabilityEstimate;
  stumpingOutPct?: number;
}

export interface DrsPromptState {
  id: number;
  resolution: DeliveryResolution;
  appealType: DrsAppealType;
  onFieldDecision: DrsOnFieldDecision;
  requestingSide: DrsRequestingSide;
  requestingTeamId: string;
  requestingPlayerName: string;
  reviewsRemaining: number;
  maxReviews: number;
  timeLimitSec: number;
  triggeredByUser: boolean;
  referralKind?: DrsReferralKind;
  isPostBallChallenge?: boolean;
  challengeTargetBatterIndex?: number;
  challengeBowlerName?: string;
  challengeOverCompleted?: boolean;
  probabilityEstimate?: DrsProbabilityEstimate;
  phase: 'signal' | 'third_umpire' | 'verdict';
  tracking?: DrsBallTrackingData;
  stumpingCheck?: DrsStumpingData;
  thirdUmpireOutcome?: DrsThirdUmpireOutcome;
  finalDecisionIsOut?: boolean;
  reviewRetained?: boolean;
  verdictSummary?: string;
}

export interface PitchBallRecord {
  id: number;
  overBall: string;
  length: DeliveryLength;
  deliveryType: DeliveryType;
  pitchDistanceM: number; // 0m (batter stumps) to 20.12m (bowler stumps)
  lineOffsetCm: number; // -65cm (leg/left) .. 0 (middle) .. +65cm (off/right)
  runs: number;
  isWicket: boolean;
  ballSymbol: string;
  bowlerName: string;
  paceSpeedKph?: number;
  spinDegree?: number;
}

export interface InningsState {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  ballsBowled: number;
  declared?: boolean;
  battingReviewsRemaining: number;
  bowlingReviewsRemaining: number;
  currentOverBalls: string[];
  currentOverRuns: number;
  currentOverWickets: number;
  overHistory: OverProgressPoint[];
  recentPitchBalls?: PitchBallRecord[];
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
  paceSpeedKph?: number;
  spinDegree?: number;
  pitchDistanceM?: number;
  lineOffsetCm?: number;
  drsAppeal?: DrsAppealTrigger;
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
  weatherCondition?: WeatherCondition;
  rainChance?: RainChance;
  originalTotalOvers?: number;
  innings1MaxOvers?: number;
  innings2MaxOvers?: number;
  innings1ResourcesPct?: number;
  innings2ResourcesPct?: number;
  dlsApplied?: boolean;
  dlsParScore?: number | null;
  rainInterruptionsCount?: number;
  difficulty: Difficulty;
  homeTeamId: string;
  awayTeamId: string;
  totalOvers: number; // Overs per innings in limited overs; overs per day in test mode
  oversPerDay: 30 | 60 | 90;
  currentDay: number; // 1..5 in test mode
  ballsToday: number;
  runsToday: number;
  wicketsToday: number;
  bowlingSide?: BowlingSide;
  pendingOverPopup: OverCompletedSummary | null;
  pendingDayPopup: TestDaySummary | null;
  pendingBatterPopup?: NextBatterPrompt | null;
  pendingMilestonePopup?: MilestoneCelebration | null;
  pendingDlsPopup?: DlsRainPopupState | null;
  pendingDrsPopup?: DrsPromptState | null;
  pendingBowlerChallenge?: BowlerDrsChallenge | null;
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
  pendingPaceSpeedKph?: number;
  pendingSpinDegree?: number;
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
  potm?: PlayerOfMatchAward;
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
  rainChance?: RainChance;
  oversPerInningsOrDay: number; // 20 for T20/IPL, 50 for ODI, 30/60/90 for Test Series
  testMatchCount?: 3 | 5;
  userTeamId: string;
  difficulty: Difficulty;
  stage: 'league' | 'knockouts' | 'series' | 'complete';
  standings: StandingRow[];
  fixtures: TournamentFixture[];
  playerStats: Record<string, TournamentPlayerStat>;
  championTeamId: string | 'draw' | null;
}
