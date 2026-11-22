import { buildDeliveryCommentary } from './commentary';
import {
  calculateDlsResourcePct,
  calculateDlsTarget,
  computeRainReduction,
  computeWeatherModifiers,
  maybeShiftWeather,
  pickInitialWeather,
  RAIN_CHANCE_OPTIONS,
  shouldTriggerRainInterruption,
  WEATHER_META,
} from './dls';
import { getBowlingStyle, getTeamById } from './teams';
import {
  BatterStats,
  BowlerSpellStat,
  BowlingSide,
  BowlingStyle,
  CommentaryEntry,
  DeliveryLength,
  DeliveryResolution,
  DeliveryType,
  Difficulty,
  DlsRainPopupState,
  GameMode,
  InningsState,
  MatchFormat,
  MatchState,
  MilestoneCelebration,
  MilestoneKind,
  NextBatterPrompt,
  OverProgressPoint,
  PitchCondition,
  RainChance,
  ShotType,
  TeamFormatContext,
  WeatherCondition,
  WicketKind,
} from './types';

export { RAIN_CHANCE_OPTIONS, WEATHER_META };

export const SHOT_META: Record<
  ShotType,
  {
    label: string;
    keyHint: string;
    border: string;
    text: string;
    description: string;
  }
> = {
  drive: {
    label: 'DRIVE',
    keyHint: '1',
    border: 'border-emerald-500/70 hover:border-emerald-400',
    text: 'text-emerald-300',
    description: 'Off/On side, strong vs full balls',
  },
  pull: {
    label: 'PULL',
    keyHint: '2',
    border: 'border-amber-500/70 hover:border-amber-400',
    text: 'text-amber-300',
    description: 'Powerful cross-bat vs short balls',
  },
  sweep: {
    label: 'SWEEP',
    keyHint: '3',
    border: 'border-purple-500/70 hover:border-purple-400',
    text: 'text-purple-300',
    description: 'Effective against spin deliveries',
  },
  cut: {
    label: 'CUT',
    keyHint: '4',
    border: 'border-cyan-500/70 hover:border-cyan-400',
    text: 'text-cyan-300',
    description: 'Crisp off-side square force',
  },
  loft: {
    label: 'LOFT',
    keyHint: '5',
    border: 'border-yellow-500/70 hover:border-yellow-400',
    text: 'text-yellow-300',
    description: 'High reward, higher wicket risk',
  },
  defend: {
    label: 'DEFEND',
    keyHint: '6',
    border: 'border-slate-500/70 hover:border-slate-300',
    text: 'text-slate-200',
    description: 'Solid block, protects wicket',
  },
  flick: {
    label: 'FLICK',
    keyHint: '7',
    border: 'border-orange-500/70 hover:border-orange-400',
    text: 'text-orange-300',
    description: 'Wristy leg-side finesse',
  },
  hook: {
    label: 'HOOK',
    keyHint: '8',
    border: 'border-rose-500/70 hover:border-rose-400',
    text: 'text-rose-300',
    description: 'Aggressive counter vs bouncers',
  },
};

export const PITCH_META: Record<
  PitchCondition,
  { label: string; shortLabel: string; badgeColor: string; description: string }
> = {
  hard: {
    label: 'HARD',
    shortLabel: 'True Bounce',
    badgeColor: 'text-amber-300 border-amber-400/60',
    description: 'High pace & true bounce — favors big strokes and sharp bouncers',
  },
  green: {
    label: 'GREEN',
    shortLabel: 'Seam & Swing',
    badgeColor: 'text-emerald-300 border-emerald-400/60',
    description: 'Live grass seam & swing movement — rewards fast & seam bowlers',
  },
  dry: {
    label: 'DRY',
    shortLabel: 'Spin & Turn',
    badgeColor: 'text-orange-300 border-orange-400/60',
    description: 'Dusty turning surface — sharp grip & turn for all spin variations',
  },
};

export const SPIN_DELIVERY_TYPES: DeliveryType[] = [
  'off_spin',
  'leg_spin',
  'googly',
  'doosra',
  'arm_ball',
  'carrom',
];

export const PACE_DELIVERY_TYPES: DeliveryType[] = [
  'fast',
  'swing',
  'seam',
  'yorker',
  'bouncer',
];

export function isSpinDelivery(type: DeliveryType): boolean {
  return type === 'spin' || SPIN_DELIVERY_TYPES.includes(type);
}

export const DELIVERY_META: Record<
  DeliveryType,
  { label: string; border: string; text: string; category: 'pace' | 'spin' }
> = {
  fast: { label: 'FAST', border: 'border-amber-500/70', text: 'text-amber-300', category: 'pace' },
  swing: { label: 'SWING', border: 'border-cyan-500/70', text: 'text-cyan-300', category: 'pace' },
  seam: { label: 'SEAM', border: 'border-orange-500/70', text: 'text-orange-300', category: 'pace' },
  yorker: { label: 'YORKER', border: 'border-yellow-500/70', text: 'text-yellow-300', category: 'pace' },
  bouncer: { label: 'BOUNCER', border: 'border-rose-500/70', text: 'text-rose-300', category: 'pace' },
  spin: { label: 'SPIN', border: 'border-purple-500/70', text: 'text-purple-300', category: 'spin' },
  off_spin: { label: 'OFF SPIN', border: 'border-purple-500/70', text: 'text-purple-300', category: 'spin' },
  leg_spin: { label: 'LEG SPIN', border: 'border-fuchsia-500/70', text: 'text-fuchsia-300', category: 'spin' },
  googly: { label: 'GOOGLY', border: 'border-violet-500/70', text: 'text-violet-300', category: 'spin' },
  doosra: { label: 'DOOSRA', border: 'border-pink-500/70', text: 'text-pink-300', category: 'spin' },
  arm_ball: { label: 'ARM BALL', border: 'border-indigo-500/70', text: 'text-indigo-300', category: 'spin' },
  carrom: { label: 'CARROM', border: 'border-teal-500/70', text: 'text-teal-300', category: 'spin' },
};

export const LENGTH_META: Record<DeliveryLength, { label: string }> = {
  full: { label: 'FULL' },
  good: { label: 'GOOD' },
  short: { label: 'SHORT' },
};

export function createInningsState(
  battingTeamId: string,
  bowlingTeamId: string,
  context?: TeamFormatContext
): InningsState {
  const batTeam = getTeamById(battingTeamId, context);
  const bowlTeam = getTeamById(bowlingTeamId, context);

  const batters: BatterStats[] = batTeam.batters.map((name) => ({
    name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
  }));

  const initialBowler = bowlTeam.bowlers[0] ?? 'Bowler';

  return {
    battingTeamId,
    bowlingTeamId,
    runs: 0,
    wickets: 0,
    ballsBowled: 0,
    declared: false,
    currentOverBalls: [],
    currentOverRuns: 0,
    currentOverWickets: 0,
    overHistory: [],
    strikerIndex: 0,
    nonStrikerIndex: 1,
    nextBatterIndex: 2,
    partnershipRuns: 0,
    partnershipBalls: 0,
    batters,
    bowlerName: initialBowler,
    bowlerOversBalls: 0,
    bowlerRunsConceded: 0,
    bowlerWickets: 0,
    bowlerSpells: {},
  };
}

export function createInitialMatchState(params: {
  mode: GameMode;
  format?: MatchFormat;
  pitchCondition?: PitchCondition;
  weatherCondition?: WeatherCondition;
  rainChance?: RainChance;
  difficulty: Difficulty;
  homeTeamId: string;
  awayTeamId: string;
  totalOvers: number;
  oversPerDay?: 30 | 60 | 90;
  homeBatsFirst: boolean;
  tossWinner?: 'home' | 'away' | null;
  tossCoinResult?: 'heads' | 'tails' | null;
  activeTournamentMatchId?: string;
}): MatchState {
  const format: MatchFormat = params.format ?? 'limited';
  const pitchCondition: PitchCondition = params.pitchCondition ?? 'hard';
  const rainChance: RainChance = params.rainChance ?? 0;
  const weatherCondition: WeatherCondition =
    params.weatherCondition ?? pickInitialWeather(rainChance);
  const oversPerDay: 30 | 60 | 90 = params.oversPerDay ?? 90;
  const effectiveOvers = format === 'test' ? oversPerDay : params.totalOvers;

  const battingId = params.homeBatsFirst ? params.homeTeamId : params.awayTeamId;
  const bowlingId = params.homeBatsFirst ? params.awayTeamId : params.homeTeamId;

  const innings1 = createInningsState(battingId, bowlingId, {
    format,
    totalOvers: effectiveOvers,
  });
  const openingPair = `${innings1.batters[0]?.name ?? 'Opener'} & ${innings1.batters[1]?.name ?? 'Partner'}`;
  const pitchMeta = PITCH_META[pitchCondition];
  const weatherMeta = WEATHER_META[weatherCondition];
  const formatTag =
    format === 'test'
      ? `Test Match (Day 1 · ${oversPerDay} ov/day · ${pitchMeta.label} Pitch · ${weatherMeta.label})`
      : `${effectiveOvers}-Over Match (${pitchMeta.label} Pitch · ${weatherMeta.label}${
          rainChance > 0 ? ` · ${rainChance}% Rain` : ''
        })`;
  const introCommentary =
    params.mode === 'ai' && params.homeBatsFirst
      ? `${formatTag} underway! ${openingPair} walk out to face ${innings1.bowlerName}. Choose your shot!`
      : params.mode === 'ai'
      ? `${formatTag} underway! ${innings1.bowlerName} has the new ball against ${openingPair}. Choose your delivery!`
      : `${formatTag} (PvP) underway! ${innings1.bowlerName} to bowl to ${openingPair}.`;

  return {
    mode: params.mode,
    format,
    pitchCondition,
    weatherCondition,
    rainChance,
    originalTotalOvers: effectiveOvers,
    innings1MaxOvers: effectiveOvers,
    innings2MaxOvers: effectiveOvers,
    innings1ResourcesPct: 100,
    innings2ResourcesPct: 100,
    dlsApplied: false,
    dlsParScore: null,
    rainInterruptionsCount: 0,
    difficulty: params.difficulty,
    homeTeamId: params.homeTeamId,
    awayTeamId: params.awayTeamId,
    totalOvers: effectiveOvers,
    oversPerDay,
    currentDay: 1,
    ballsToday: 0,
    runsToday: 0,
    wicketsToday: 0,
    bowlingSide: 'over',
    pendingOverPopup: null,
    pendingDayPopup: null,
    pendingBatterPopup: null,
    pendingMilestonePopup: null,
    pendingDlsPopup: null,
    tossCaller: 'home',
    tossWinner: params.tossWinner ?? 'home',
    tossCoinResult: params.tossCoinResult ?? 'heads',
    inningsNumber: 1,
    target: null,
    innings1,
    innings2: null,
    innings3: null,
    innings4: null,
    isPaused: false,
    matchComplete: false,
    winnerTeamId: null,
    resultSummary: '',
    lastCommentary: introCommentary,
    commentaryLog: [
      {
        id: 1,
        overBall: '0.0',
        outcomeSymbol: format === 'test' ? 'D1' : '•',
        text: introCommentary,
        isWicket: false,
        isBoundary: false,
      },
    ],
    lastOutcome: null,
    pvpTurnPhase: 'bowl_select',
    pendingDeliveryType: getBowlingStyle(innings1.bowlerName) === 'spin' ? 'off_spin' : 'fast',
    pendingDeliveryLength: 'good',
    activeTournamentMatchId: params.activeTournamentMatchId,
  };
}

export function formatOvers(balls: number): string {
  const completed = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${completed}.${rem}`;
}

export function computePredictedTotal(
  runs: number,
  ballsBowled: number,
  totalOvers: number
): number {
  if (totalOvers <= 0) return runs;
  if (ballsBowled <= 0) {
    return Math.round(totalOvers * 7.5);
  }
  const runRate = (runs / ballsBowled) * 6;
  return Math.max(runs, Math.round(runRate * totalOvers));
}

export function calculateRunRate(runs: number, balls: number): string {
  if (balls <= 0) return '0.00';
  return ((runs / balls) * 6).toFixed(2);
}

export function calculateRequiredRunRate(
  target: number,
  runs: number,
  ballsBowled: number,
  totalOvers: number
): string {
  const remainingRuns = Math.max(0, target - runs);
  const remainingBalls = Math.max(1, totalOvers * 6 - ballsBowled);
  return ((remainingRuns / remainingBalls) * 6).toFixed(2);
}

export function getActiveInnings(state: MatchState): InningsState {
  if (state.inningsNumber === 4 && state.innings4) return state.innings4;
  if (state.inningsNumber === 3 && state.innings3) return state.innings3;
  if (state.inningsNumber === 2 && state.innings2) return state.innings2;
  return state.innings1;
}

export function getTeamTestTotals(state: MatchState): {
  team1Id: string;
  team1Total: number;
  team2Id: string;
  team2Total: number;
} {
  const team1Id = state.innings1.battingTeamId;
  const team2Id = state.innings1.bowlingTeamId;
  let team1Total = state.innings1.runs;
  let team2Total = 0;

  if (state.innings2) {
    if (state.innings2.battingTeamId === team1Id) team1Total += state.innings2.runs;
    else team2Total += state.innings2.runs;
  }
  if (state.innings3) {
    if (state.innings3.battingTeamId === team1Id) team1Total += state.innings3.runs;
    else team2Total += state.innings3.runs;
  }
  if (state.innings4) {
    if (state.innings4.battingTeamId === team1Id) team1Total += state.innings4.runs;
    else team2Total += state.innings4.runs;
  }

  return { team1Id, team1Total, team2Id, team2Total };
}

export function getTestLeadText(state: MatchState): string | null {
  if (state.format !== 'test') return null;
  const { team1Id, team1Total, team2Id, team2Total } = getTeamTestTotals(state);
  const active = getActiveInnings(state);
  const batCode = getTeamById(active.battingTeamId).code;

  if (state.inningsNumber === 1) {
    return `1st Inn · Day ${state.currentDay}/5`;
  }
  const batTotal = active.battingTeamId === team1Id ? team1Total : team2Total;
  const bowlTotal = active.battingTeamId === team1Id ? team2Total : team1Total;
  const diff = batTotal - bowlTotal;

  if (state.inningsNumber === 4 && state.target !== null) {
    const need = Math.max(0, state.target - active.runs);
    return `${batCode} need ${need} to win`;
  }
  if (diff > 0) return `${batCode} lead by ${diff}`;
  if (diff < 0) return `${batCode} trail by ${Math.abs(diff)}`;
  return `Scores level`;
}

export function getMaxOversPerBowler(format: MatchFormat, totalOvers: number): number | null {
  if (format === 'test') return null;
  if (totalOvers <= 0) return 1;
  return Math.max(1, Math.ceil(totalOvers / 5));
}

export function isBowlerQuotaExhausted(
  innings: InningsState,
  bowlerName: string,
  format: MatchFormat,
  totalOvers: number
): boolean {
  const maxOvers = getMaxOversPerBowler(format, totalOvers);
  if (maxOvers === null) return false;
  const spellBalls = innings.bowlerSpells?.[bowlerName]?.balls ?? 0;
  return spellBalls >= maxOvers * 6;
}

function pickNextEligibleBowler(params: {
  bowlers: string[];
  overIndex: number;
  prevBowlerName: string;
  spells: Record<string, BowlerSpellStat>;
  format: MatchFormat;
  totalOvers: number;
}): string {
  const { bowlers, overIndex, prevBowlerName, spells, format, totalOvers } = params;
  if (bowlers.length === 0) return prevBowlerName;
  const maxOvers = getMaxOversPerBowler(format, totalOvers);
  const maxBalls = maxOvers !== null ? maxOvers * 6 : Infinity;
  const startIdx = overIndex % bowlers.length;
  const rotated = bowlers.map((_, i) => bowlers[(startIdx + i) % bowlers.length]);
  const notExhausted = (name: string) => (spells[name]?.balls ?? 0) < maxBalls;

  return (
    rotated.find((name) => name !== prevBowlerName && notExhausted(name)) ??
    rotated.find((name) => notExhausted(name)) ??
    rotated.find((name) => name !== prevBowlerName) ??
    rotated[0]
  );
}

export function isPlayerBattingNow(state: MatchState): boolean {
  const active = getActiveInnings(state);
  if (state.mode === 'pvp') {
    return state.pvpTurnPhase === 'bat_select';
  }
  return active.battingTeamId === state.homeTeamId;
}

export function chooseAiDelivery(
  difficulty: Difficulty,
  rng: () => number = Math.random,
  pitchCondition: PitchCondition = 'hard',
  bowlerStyle?: BowlingStyle,
  weatherCondition: WeatherCondition = 'clear'
): { type: DeliveryType; length: DeliveryLength } {
  const lengths: DeliveryLength[] = ['full', 'good', 'short'];
  const spinPool: DeliveryType[] = ['off_spin', 'leg_spin', 'googly', 'doosra', 'arm_ball', 'carrom'];
  const pacePool: DeliveryType[] = ['fast', 'swing', 'seam', 'yorker', 'bouncer'];

  let pool: DeliveryType[];
  if (bowlerStyle === 'spin') {
    pool =
      difficulty === 'easy'
        ? ['off_spin', 'leg_spin', 'arm_ball']
        : pitchCondition === 'dry'
        ? ['off_spin', 'leg_spin', 'googly', 'doosra', 'carrom', 'googly', 'arm_ball']
        : spinPool;
  } else if (bowlerStyle === 'pace') {
    pool =
      difficulty === 'easy'
        ? ['fast', 'swing', 'seam']
        : pitchCondition === 'green' || weatherCondition === 'overcast' || weatherCondition === 'drizzle'
        ? ['swing', 'seam', 'fast', 'swing', 'seam', 'yorker']
        : pacePool;
  } else if (pitchCondition === 'dry') {
    pool =
      difficulty === 'easy'
        ? ['off_spin', 'leg_spin', 'fast', 'swing']
        : [...spinPool, ...spinPool, 'fast', 'yorker'];
  } else if (pitchCondition === 'green') {
    pool =
      difficulty === 'easy'
        ? ['swing', 'seam', 'fast', 'off_spin']
        : [...pacePool, 'swing', 'seam', 'off_spin', 'arm_ball'];
  } else {
    pool =
      difficulty === 'hard'
        ? ['yorker', 'bouncer', 'fast', 'swing', 'googly', 'leg_spin', 'carrom']
        : difficulty === 'medium'
        ? ['fast', 'swing', 'seam', 'yorker', 'bouncer', 'off_spin', 'leg_spin', 'googly', 'arm_ball']
        : ['fast', 'swing', 'seam', 'off_spin', 'leg_spin'];
  }

  const type = pool[Math.floor(rng() * pool.length)];
  const length: DeliveryLength =
    type === 'yorker'
      ? 'full'
      : type === 'bouncer'
      ? 'short'
      : lengths[Math.floor(rng() * lengths.length)];
  return { type, length };
}

export function chooseAiShot(
  difficulty: Difficulty,
  deliveryType: DeliveryType,
  deliveryLength: DeliveryLength,
  rng: () => number = Math.random
): ShotType {
  const smartChoices: ShotType[] = [];

  if (deliveryLength === 'short' || deliveryType === 'bouncer') {
    smartChoices.push('pull', 'hook', 'cut');
  } else if (isSpinDelivery(deliveryType)) {
    if (deliveryType === 'googly' || deliveryType === 'arm_ball' || deliveryType === 'doosra') {
      smartChoices.push('defend', 'drive', 'flick');
    } else {
      smartChoices.push('sweep', 'drive', 'loft');
    }
  } else if (deliveryLength === 'full' || deliveryType === 'yorker') {
    smartChoices.push('drive', 'flick', 'defend');
  } else {
    smartChoices.push('drive', 'cut', 'flick', 'loft');
  }

  const allShots: ShotType[] = [
    'drive',
    'pull',
    'sweep',
    'cut',
    'loft',
    'defend',
    'flick',
    'hook',
  ];

  if (difficulty === 'hard') {
    return smartChoices[Math.floor(rng() * smartChoices.length)];
  }
  if (difficulty === 'medium') {
    if (rng() < 0.65) {
      return smartChoices[Math.floor(rng() * smartChoices.length)];
    }
    return allShots[Math.floor(rng() * allShots.length)];
  }
  return allShots[Math.floor(rng() * allShots.length)];
}

export function resolveDelivery(params: {
  shot: ShotType;
  deliveryType: DeliveryType;
  deliveryLength: DeliveryLength;
  difficulty: Difficulty;
  playerIsBatting: boolean;
  strikerName: string;
  bowlerName: string;
  format?: MatchFormat;
  pitchCondition?: PitchCondition;
  weatherCondition?: WeatherCondition;
  bowlingSide?: BowlingSide;
  rng?: () => number;
}): DeliveryResolution {
  const rng = params.rng ?? Math.random;
  const { shot, deliveryType, deliveryLength, difficulty, playerIsBatting } = params;
  const pitchCondition: PitchCondition = params.pitchCondition ?? 'hard';
  const weatherCondition: WeatherCondition = params.weatherCondition ?? 'clear';
  const bowlingSide: BowlingSide = params.bowlingSide ?? 'over';
  const spin = isSpinDelivery(deliveryType);

  let matchup = 0;

  if (shot === 'defend') {
    matchup = deliveryType === 'yorker' || deliveryType === 'googly' ? 0 : 1;
  } else if (shot === 'drive') {
    if (deliveryLength === 'full') matchup += 1;
    if (deliveryType === 'bouncer' || deliveryLength === 'short') matchup -= 1;
    if (deliveryType === 'googly' || deliveryType === 'doosra' || deliveryType === 'carrom') {
      matchup -= 1;
    }
  } else if (shot === 'pull') {
    if (deliveryLength === 'short' || deliveryType === 'bouncer') matchup += 2;
    else if (deliveryType === 'yorker' || deliveryType === 'arm_ball') matchup -= 2;
  } else if (shot === 'sweep') {
    if (deliveryType === 'off_spin' || deliveryType === 'leg_spin' || deliveryType === 'spin') {
      matchup += 2;
    } else if (deliveryType === 'carrom' || deliveryType === 'doosra') {
      matchup += 1;
    } else if (deliveryType === 'arm_ball' || deliveryType === 'googly') {
      matchup -= 1;
    } else if (deliveryType === 'fast' || deliveryType === 'bouncer') {
      matchup -= 2;
    }
  } else if (shot === 'cut') {
    if (deliveryLength === 'short' || deliveryLength === 'good') matchup += 1;
    if (deliveryType === 'yorker' || deliveryType === 'arm_ball') matchup -= 2;
  } else if (shot === 'loft') {
    if (deliveryLength === 'full' || deliveryLength === 'good') matchup += 1;
    if (
      deliveryType === 'yorker' ||
      deliveryType === 'bouncer' ||
      deliveryType === 'googly' ||
      deliveryType === 'carrom'
    ) {
      matchup -= 1;
    }
  } else if (shot === 'flick') {
    if (deliveryLength === 'full' || deliveryLength === 'good') matchup += 1;
    if (deliveryType === 'bouncer') matchup -= 1;
  } else if (shot === 'hook') {
    if (deliveryType === 'bouncer' || deliveryLength === 'short') matchup += 2;
    else matchup -= 1;
  }

  let wicketMod = 0;
  let boundaryMod = 0;
  let dotMod = 0;
  if (playerIsBatting) {
    if (difficulty === 'easy') {
      wicketMod = -0.05;
      boundaryMod = 0.08;
    } else if (difficulty === 'hard') {
      wicketMod = 0.06;
      boundaryMod = -0.05;
    }
  } else {
    if (difficulty === 'easy') {
      wicketMod = 0.06;
      boundaryMod = -0.06;
    } else if (difficulty === 'hard') {
      wicketMod = -0.04;
      boundaryMod = 0.07;
    }
  }

  // Pitch Condition Behavior
  if (pitchCondition === 'hard') {
    boundaryMod += 0.05;
    dotMod -= 0.04;
    if (deliveryType === 'fast' || deliveryType === 'bouncer') {
      wicketMod += 0.015;
    } else if (spin) {
      wicketMod -= 0.02;
    }
  } else if (pitchCondition === 'green') {
    boundaryMod -= 0.04;
    dotMod += 0.04;
    if (deliveryType === 'swing' || deliveryType === 'seam' || deliveryType === 'fast' || deliveryType === 'yorker') {
      wicketMod += 0.05;
    }
  } else if (pitchCondition === 'dry') {
    boundaryMod -= 0.03;
    dotMod += 0.04;
    if (spin) {
      wicketMod +=
        deliveryType === 'googly' || deliveryType === 'doosra' || deliveryType === 'carrom'
          ? 0.075
          : 0.06;
      dotMod += 0.03;
    } else if (deliveryType === 'fast') {
      wicketMod -= 0.015;
    }
  }

  // Spin trickery variation bonus
  if (deliveryType === 'googly' || deliveryType === 'doosra' || deliveryType === 'carrom') {
    wicketMod += 0.015;
  } else if (deliveryType === 'arm_ball') {
    dotMod += 0.03;
  }

  // Angle variation for Around the Wicket vs Over the Wicket
  if (bowlingSide === 'round') {
    dotMod += 0.015;
    if (deliveryType === 'yorker' || deliveryType === 'arm_ball' || deliveryType === 'bouncer') {
      wicketMod += 0.012;
    }
  }

  // Weather condition behavior & visibility modifiers (overcast swing, windy drift, humid dew, drizzle)
  const weatherMods = computeWeatherModifiers(weatherCondition, deliveryType, shot);
  wicketMod += weatherMods.wicketMod;
  boundaryMod += weatherMods.boundaryMod;
  dotMod += weatherMods.dotMod;

  // In Test cricket, slightly fewer wild 6s and more patient accumulation / bowling threat
  const testMode = params.format === 'test';
  let pWicket = testMode ? 0.075 : 0.09;
  let pDot = testMode ? 0.36 : 0.25;
  let pOne = testMode ? 0.25 : 0.28;
  let pTwo = testMode ? 0.13 : 0.14;
  let pThree = testMode ? 0.04 : 0.03;
  let pFour = testMode ? 0.12 : 0.14;
  let pSix = testMode ? 0.025 : 0.07;

  if (shot === 'defend') {
    pWicket = 0.025;
    pDot = 0.74;
    pOne = 0.19;
    pTwo = 0.045;
    pThree = 0;
    pFour = 0;
    pSix = 0;
  } else if (shot === 'loft' || shot === 'hook') {
    pWicket = testMode ? 0.18 : 0.16;
    pDot = 0.15;
    pOne = 0.16;
    pTwo = 0.10;
    pThree = 0.02;
    pFour = 0.20;
    pSix = testMode ? 0.14 : 0.22;
  } else if (shot === 'pull' || shot === 'cut' || shot === 'sweep') {
    pWicket = 0.10;
    pDot = 0.22;
    pOne = 0.25;
    pTwo = 0.14;
    pThree = 0.04;
    pFour = 0.18;
    pSix = testMode ? 0.05 : 0.08;
  }

  pWicket = Math.max(0.015, pWicket - matchup * 0.035 + wicketMod);
  pFour = Math.max(0.02, pFour + matchup * 0.045 + boundaryMod * 0.6);
  pSix = Math.max(0.0, pSix + matchup * 0.035 + boundaryMod * 0.4);
  pDot = Math.max(0.08, pDot - matchup * 0.04 + dotMod);

  const sum = pWicket + pDot + pOne + pTwo + pThree + pFour + pSix;
  const roll = rng() * sum;

  let runs = 0;
  let isWicket = false;
  let cursor = pWicket;

  if (roll < cursor) {
    isWicket = true;
  } else if (roll < (cursor += pDot)) {
    runs = 0;
  } else if (roll < (cursor += pOne)) {
    runs = 1;
  } else if (roll < (cursor += pTwo)) {
    runs = 2;
  } else if (roll < (cursor += pThree)) {
    runs = 3;
  } else if (roll < (cursor += pFour)) {
    runs = 4;
  } else {
    runs = 6;
  }

  const wicketKinds: WicketKind[] =
    deliveryType === 'yorker' || deliveryType === 'fast' || deliveryType === 'arm_ball'
      ? ['Bowled', 'LBW', 'Caught']
      : spin
      ? ['Caught', 'Stumped', 'Bowled', 'LBW']
      : ['Caught', 'Bowled', 'Hit Wicket'];
  const wicketKind = isWicket
    ? wicketKinds[Math.floor(rng() * wicketKinds.length)]
    : undefined;

  const angleByShot: Record<ShotType, [number, number]> = {
    drive: [-0.65, 0.45],
    pull: [0.85, 1.85],
    sweep: [1.0, 2.1],
    cut: [-1.75, -0.85],
    loft: [-0.8, 0.8],
    defend: [-0.5, 0.5],
    flick: [0.65, 1.55],
    hook: [1.5, 2.55],
  };
  const [minA, maxA] = angleByShot[shot];
  const hitAngleRad = minA + rng() * (maxA - minA);
  const hitDistanceFactor = isWicket
    ? 0.08
    : runs === 6
    ? 1.12
    : runs === 4
    ? 0.96
    : runs === 3
    ? 0.72
    : runs === 2
    ? 0.56
    : runs === 1
    ? 0.42
    : 0.14;

  const isBoundaryFour = !isWicket && runs === 4;
  const isBoundarySix = !isWicket && runs === 6;

  let outcomeLabel = 'DOT BALL';
  let ballSymbol = '0';
  if (isWicket) {
    outcomeLabel = `OUT! ${wicketKind?.toUpperCase()}`;
    ballSymbol = 'W';
  } else if (isBoundarySix) {
    outcomeLabel = 'SIX! 6';
    ballSymbol = '6';
  } else if (isBoundaryFour) {
    outcomeLabel = 'FOUR! 4';
    ballSymbol = '4';
  } else if (runs > 0) {
    outcomeLabel = runs === 1 ? '1 RUN' : `${runs} RUNS`;
    ballSymbol = String(runs);
  }

  const commentary = buildDeliveryCommentary({
    bowlerName: params.bowlerName,
    strikerName: params.strikerName,
    deliveryType,
    deliveryLength,
    shot,
    runs,
    isWicket,
    wicketKind,
    pitchCondition,
    weatherCondition,
    bowlingSide,
  });

  return {
    runs,
    isWicket,
    wicketKind,
    isBoundaryFour,
    isBoundarySix,
    outcomeLabel,
    ballSymbol,
    commentary,
    hitAngleRad,
    hitDistanceFactor,
    shotUsed: shot,
    deliveryUsed: deliveryType,
    lengthUsed: deliveryLength,
  };
}

function updateMatchWithInnings(
  state: MatchState,
  updatedInnings: InningsState
): MatchState {
  if (state.inningsNumber === 4) return { ...state, innings4: updatedInnings };
  if (state.inningsNumber === 3) return { ...state, innings3: updatedInnings };
  if (state.inningsNumber === 2) return { ...state, innings2: updatedInnings };
  return { ...state, innings1: updatedInnings };
}

function evaluateTestAfterInningsEnds(state: MatchState): {
  nextState: MatchState;
  enteredInningsBreak: boolean;
  matchFinished: boolean;
} {
  const { team1Id, team1Total, team2Id, team2Total } = getTeamTestTotals(state);
  const team1 = getTeamById(team1Id);
  const team2 = getTeamById(team2Id);

  if (state.inningsNumber === 1 || state.inningsNumber === 2) {
    // Check innings defeat if team2 batted 2nd and trails by >= 200 (or after 3rd innings)
    return {
      nextState: state,
      enteredInningsBreak: true,
      matchFinished: false,
    };
  }

  if (state.inningsNumber === 3) {
    const active = getActiveInnings(state);
    // If team batting 3rd failed to surpass opponent's lead (innings victory!)
    if (active.battingTeamId === team2Id && team2Total < team1Total) {
      const margin = team1Total - team2Total;
      return {
        nextState: {
          ...state,
          matchComplete: true,
          winnerTeamId: team1Id,
          resultSummary: `${team1.name} won by an innings & ${margin} ${margin === 1 ? 'run' : 'runs'}!`,
        },
        enteredInningsBreak: false,
        matchFinished: true,
      };
    }
    if (active.battingTeamId === team1Id && team1Total < team2Total) {
      const margin = team2Total - team1Total;
      return {
        nextState: {
          ...state,
          matchComplete: true,
          winnerTeamId: team2Id,
          resultSummary: `${team2.name} won by an innings & ${margin} ${margin === 1 ? 'run' : 'runs'}!`,
        },
        enteredInningsBreak: false,
        matchFinished: true,
      };
    }

    const batting4thId = active.bowlingTeamId;
    const batting4thTotal = batting4thId === team1Id ? team1Total : team2Total;
    const otherTotal = batting4thId === team1Id ? team2Total : team1Total;
    const target = otherTotal - batting4thTotal + 1;

    return {
      nextState: {
        ...state,
        target,
      },
      enteredInningsBreak: true,
      matchFinished: false,
    };
  }

  // Innings 4 finished (all out or declared)
  const target = state.target ?? 1;
  const inn4 = state.innings4!;
  const chasingTeam = getTeamById(inn4.battingTeamId);
  const defendingTeam = getTeamById(inn4.bowlingTeamId);

  if (inn4.runs >= target) {
    const wktsRemaining = 10 - inn4.wickets;
    return {
      nextState: {
        ...state,
        matchComplete: true,
        winnerTeamId: chasingTeam.id,
        resultSummary: `${chasingTeam.name} won by ${wktsRemaining} ${wktsRemaining === 1 ? 'wicket' : 'wickets'}!`,
      },
      enteredInningsBreak: false,
      matchFinished: true,
    };
  }

  if (inn4.runs === target - 1) {
    return {
      nextState: {
        ...state,
        matchComplete: true,
        winnerTeamId: 'tie',
        resultSummary: 'Test Match Tied! An unforgettable finish!',
      },
      enteredInningsBreak: false,
      matchFinished: true,
    };
  }

  const margin = target - 1 - inn4.runs;
  return {
    nextState: {
      ...state,
      matchComplete: true,
      winnerTeamId: defendingTeam.id,
      resultSummary: `${defendingTeam.name} won by ${margin} ${margin === 1 ? 'run' : 'runs'}!`,
    },
    enteredInningsBreak: false,
    matchFinished: true,
  };
}

export function applyDeliveryToMatch(
  state: MatchState,
  resolution: DeliveryResolution
): { nextState: MatchState; enteredInningsBreak: boolean; matchFinished: boolean } {
  const active = getActiveInnings(state);
  const bowlTeam = getTeamById(active.bowlingTeamId, {
    format: state.format,
    totalOvers: state.totalOvers,
  });

  const nextBatters = active.batters.map((b) => ({ ...b }));
  const striker = nextBatters[active.strikerIndex];
  const prevBatterRuns = striker.runs;
  const dismissedBatterName = striker.name;
  striker.balls += 1;

  let runs = active.runs;
  let wickets = active.wickets;
  let partnershipRuns = active.partnershipRuns;
  let partnershipBalls = active.partnershipBalls + 1;
  let strikerIndex = active.strikerIndex;
  let nonStrikerIndex = active.nonStrikerIndex;
  let nextBatterIndex = active.nextBatterIndex;
  let bowlerRunsConceded = active.bowlerRunsConceded;
  let bowlerWickets = active.bowlerWickets;
  let wicketFellWithNextNeeded = false;

  if (resolution.isWicket) {
    wickets += 1;
    bowlerWickets += 1;
    striker.out = true;
    striker.dismissal = resolution.wicketKind;
    partnershipRuns = 0;
    partnershipBalls = 0;
    if (wickets < 10) {
      const nextUnusedIdx = nextBatters.findIndex(
        (b, idx) => !b.out && idx !== nonStrikerIndex
      );
      if (nextUnusedIdx !== -1) {
        strikerIndex = nextUnusedIdx;
        nextBatterIndex = Math.min(nextBatters.length, nextUnusedIdx + 1);
        wicketFellWithNextNeeded = true;
      }
    }
  } else {
    runs += resolution.runs;
    bowlerRunsConceded += resolution.runs;
    partnershipRuns += resolution.runs;
    striker.runs += resolution.runs;
    if (resolution.runs === 4) striker.fours += 1;
    if (resolution.runs === 6) striker.sixes += 1;

    if (resolution.runs % 2 === 1) {
      const tmp = strikerIndex;
      strikerIndex = nonStrikerIndex;
      nonStrikerIndex = tmp;
    }
  }

  const ballsBowled = active.ballsBowled + 1;
  const overCompleted = ballsBowled % 6 === 0;
  const currentOverBalls =
    active.currentOverBalls.length >= 6
      ? [resolution.ballSymbol]
      : [...active.currentOverBalls, resolution.ballSymbol];

  const ballRuns = resolution.isWicket ? 0 : resolution.runs;
  const ballWicket = resolution.isWicket ? 1 : 0;
  const nextOverRuns =
    (active.currentOverBalls.length >= 6 ? 0 : active.currentOverRuns ?? 0) + ballRuns;
  const nextOverWickets =
    (active.currentOverBalls.length >= 6 ? 0 : active.currentOverWickets ?? 0) + ballWicket;

  const overBowlerName = active.bowlerName;
  let bowlerName = active.bowlerName;
  let bowlerOversBalls = active.bowlerOversBalls + 1;

  // Persist spell statistics for the bowler who delivered this ball
  const prevSpell: BowlerSpellStat = active.bowlerSpells?.[active.bowlerName] ?? {
    balls: 0,
    runs: 0,
    wickets: 0,
  };
  const nextSpellForActiveBowler: BowlerSpellStat = {
    balls: prevSpell.balls + 1,
    runs: prevSpell.runs + ballRuns,
    wickets: prevSpell.wickets + ballWicket,
  };
  const bowlerSpells: Record<string, BowlerSpellStat> = {
    ...(active.bowlerSpells ?? {}),
    [active.bowlerName]: nextSpellForActiveBowler,
  };

  // Detect Batting Milestones (50, 100, 150, 200) or Bowler 5-Wicket Haul
  let milestonePopup: MilestoneCelebration | null = null;
  if (!resolution.isWicket) {
    let crossed: MilestoneKind | null = null;
    if (prevBatterRuns < 200 && striker.runs >= 200) crossed = '200';
    else if (prevBatterRuns < 150 && striker.runs >= 150) crossed = '150';
    else if (prevBatterRuns < 100 && striker.runs >= 100) crossed = '100';
    else if (prevBatterRuns < 50 && striker.runs >= 50) crossed = '50';

    if (crossed) {
      const titleMap: Record<Exclude<MilestoneKind, '5fer'>, string> = {
        '50': 'BRILLIANT HALF-CENTURY!',
        '100': 'SENSATIONAL CENTURY!',
        '150': 'MAGNIFICENT 150!',
        '200': 'HISTORIC DOUBLE CENTURY!',
      };
      milestonePopup = {
        kind: crossed,
        playerName: striker.name,
        teamId: active.battingTeamId,
        title: titleMap[crossed],
        subtitle: `${striker.runs}* (${striker.balls} balls · ${striker.fours}×4 · ${striker.sixes}×6)`,
        runs: striker.runs,
        balls: striker.balls,
        fours: striker.fours,
        sixes: striker.sixes,
      };
    }
  } else if (prevSpell.wickets < 5 && nextSpellForActiveBowler.wickets >= 5) {
    milestonePopup = {
      kind: '5fer',
      playerName: overBowlerName,
      teamId: active.bowlingTeamId,
      title: '5-WICKET HAUL!',
      subtitle: `${nextSpellForActiveBowler.wickets}-${nextSpellForActiveBowler.runs} (${formatOvers(
        nextSpellForActiveBowler.balls
      )} ov)`,
      wickets: nextSpellForActiveBowler.wickets,
      runsConceded: nextSpellForActiveBowler.runs,
      oversText: formatOvers(nextSpellForActiveBowler.balls),
    };
  }

  let overHistory: OverProgressPoint[] = active.overHistory ?? [];
  let currentOverRuns = nextOverRuns;
  let currentOverWickets = nextOverWickets;
  let completedOverSummary: MatchState['pendingOverPopup'] = null;

  if (overCompleted) {
    const tmp = strikerIndex;
    strikerIndex = nonStrikerIndex;
    nonStrikerIndex = tmp;

    const overIndex = Math.floor(ballsBowled / 6);
    const rrVal = Number(((runs / ballsBowled) * 6).toFixed(2));
    const projTotal = computePredictedTotal(runs, ballsBowled, state.totalOvers);
    overHistory = [
      ...overHistory,
      {
        over: overIndex,
        runsInOver: nextOverRuns,
        wicketsInOver: nextOverWickets,
        cumulativeRuns: runs,
        cumulativeWickets: wickets,
        runRate: rrVal,
        predictedTotal: projTotal,
      },
    ];

    const activeMaxOversForQuota =
      state.format === 'test'
        ? state.oversPerDay
        : state.inningsNumber === 1
        ? state.innings1MaxOvers ?? state.totalOvers
        : state.innings2MaxOvers ?? state.totalOvers;

    bowlerName = pickNextEligibleBowler({
      bowlers: bowlTeam.bowlers,
      overIndex,
      prevBowlerName: overBowlerName,
      spells: bowlerSpells,
      format: state.format,
      totalOvers: activeMaxOversForQuota,
    });
    bowlerOversBalls = 0;
    const nextSpell = bowlerSpells[bowlerName];
    bowlerRunsConceded = nextSpell?.runs ?? 0;
    bowlerWickets = nextSpell?.wickets ?? 0;

    completedOverSummary = {
      overNumber: overIndex,
      bowlerName: overBowlerName,
      bowlerStyle: getBowlingStyle(overBowlerName),
      nextBowlerName: bowlerName,
      nextBowlerStyle: getBowlingStyle(bowlerName),
      balls: currentOverBalls,
      runsConceded: nextOverRuns,
      wicketsTaken: nextOverWickets,
      teamRuns: runs,
      teamWickets: wickets,
    };

    currentOverRuns = 0;
    currentOverWickets = 0;
  }

  const updatedInnings: InningsState = {
    ...active,
    runs,
    wickets,
    ballsBowled,
    currentOverBalls,
    currentOverRuns,
    currentOverWickets,
    overHistory,
    strikerIndex,
    nonStrikerIndex,
    nextBatterIndex,
    partnershipRuns,
    partnershipBalls,
    batters: nextBatters,
    bowlerName,
    bowlerOversBalls,
    bowlerRunsConceded,
    bowlerWickets,
    bowlerSpells,
  };

  const overBallLabel = formatOvers(ballsBowled);
  const newEntry: CommentaryEntry = {
    id: (state.commentaryLog[0]?.id ?? 0) + 1,
    overBall: overBallLabel,
    outcomeSymbol: resolution.ballSymbol,
    text: resolution.commentary,
    isWicket: resolution.isWicket,
    isBoundary: resolution.isBoundaryFour || resolution.isBoundarySix,
  };
  const nextLog = [newEntry, ...state.commentaryLog].slice(0, 30);

  const userControlsBatting = state.mode === 'pvp' || active.battingTeamId === state.homeTeamId;
  const pendingBatterPrompt: NextBatterPrompt | null =
    wicketFellWithNextNeeded && userControlsBatting
      ? {
          dismissedBatterName,
          dismissedKind: resolution.wicketKind,
          teamId: active.battingTeamId,
          wickets,
          replacingSlot: overCompleted ? 'nonStriker' : 'striker',
          selectedBatterIndex: overCompleted ? nonStrikerIndex : strikerIndex,
        }
      : null;

  let nextState = updateMatchWithInnings(
    {
      ...state,
      lastCommentary: resolution.commentary,
      commentaryLog: nextLog,
      lastOutcome: resolution,
      pvpTurnPhase: 'bowl_select',
      pendingOverPopup: null,
      pendingDayPopup: null,
      pendingBatterPopup: pendingBatterPrompt,
      pendingMilestonePopup: milestonePopup,
    },
    updatedInnings
  );

  // TEST MODE BRANCH
  if (state.format === 'test') {
    const ballsToday = state.ballsToday + 1;
    const runsToday = (state.runsToday ?? 0) + ballRuns;
    const wicketsToday = (state.wicketsToday ?? 0) + ballWicket;
    const maxBallsPerDay = state.oversPerDay * 6;
    const dayQuotaReached = ballsToday >= maxBallsPerDay;
    const matchDayLimitReached = dayQuotaReached && state.currentDay >= 5;

    nextState = {
      ...nextState,
      ballsToday,
      runsToday,
      wicketsToday,
    };

    // Check immediate 4th-innings chase victory
    if (state.inningsNumber === 4 && state.target !== null && runs >= state.target) {
      const chasingTeam = getTeamById(updatedInnings.battingTeamId);
      const wktsRemaining = 10 - wickets;
      return {
        nextState: {
          ...nextState,
          pendingOverPopup: null,
          pendingDayPopup: null,
          pendingBatterPopup: null,
          matchComplete: true,
          winnerTeamId: chasingTeam.id,
          resultSummary: `${chasingTeam.name} won by ${wktsRemaining} ${wktsRemaining === 1 ? 'wicket' : 'wickets'}!`,
        },
        enteredInningsBreak: false,
        matchFinished: true,
      };
    }

    // Check if Day 5 overs exhausted -> Draw!
    if (matchDayLimitReached) {
      return {
        nextState: {
          ...nextState,
          pendingOverPopup: null,
          pendingDayPopup: null,
          pendingBatterPopup: null,
          matchComplete: true,
          winnerTeamId: 'draw',
          resultSummary: `Match Drawn! Time ran out at the end of Day 5 (${state.oversPerDay} ov/day).`,
        },
        enteredInningsBreak: false,
        matchFinished: true,
      };
    }

    if (wickets >= 10) {
      const evalRes = evaluateTestAfterInningsEnds(nextState);
      if (dayQuotaReached && state.currentDay < 5 && !evalRes.matchFinished) {
        return {
          ...evalRes,
          nextState: {
            ...evalRes.nextState,
            currentDay: state.currentDay + 1,
            ballsToday: 0,
            runsToday: 0,
            wicketsToday: 0,
            pendingOverPopup: null,
            pendingDayPopup: null,
            pendingBatterPopup: null,
          },
        };
      }
      return {
        ...evalRes,
        nextState: {
          ...evalRes.nextState,
          pendingOverPopup: null,
          pendingDayPopup: null,
          pendingBatterPopup: null,
        },
      };
    }

    // End of Test Day (Days 1-4): trigger Day Completed Scorecard popup -> New Day flow
    if (dayQuotaReached && state.currentDay < 5) {
      const stumpsEntry: CommentaryEntry = {
        id: newEntry.id + 1,
        overBall: overBallLabel,
        outcomeSymbol: 'STP',
        text: `Stumps on Day ${state.currentDay}! ${runsToday} runs & ${wicketsToday} wickets today.`,
        isWicket: false,
        isBoundary: false,
      };
      return {
        nextState: {
          ...nextState,
          pendingOverPopup: null,
          pendingDayPopup: {
            completedDay: state.currentDay,
            nextDay: state.currentDay + 1,
            runsToday,
            wicketsToday,
            lastBowlerName: overBowlerName,
            phase: 'day_completed',
          },
          commentaryLog: [stumpsEntry, ...nextState.commentaryLog].slice(0, 30),
        },
        enteredInningsBreak: false,
        matchFinished: false,
      };
    }

    return {
      nextState: (() => {
        if (overCompleted && !wickets) {
          const wShift = maybeShiftWeather({
            currentWeather: nextState.weatherCondition ?? 'clear',
            rainChance: nextState.rainChance ?? 0,
            format: nextState.format,
          });
          if (wShift.changed && wShift.commentary) {
            const wEntry: CommentaryEntry = {
              id: (nextState.commentaryLog[0]?.id ?? 0) + 1,
              overBall: overBallLabel,
              outcomeSymbol: 'WTH',
              text: wShift.commentary,
              isWicket: false,
              isBoundary: false,
            };
            return {
              ...nextState,
              weatherCondition: wShift.nextWeather,
              lastCommentary: wShift.commentary,
              commentaryLog: [wEntry, ...nextState.commentaryLog].slice(0, 30),
              pendingOverPopup: completedOverSummary,
            };
          }
        }
        return {
          ...nextState,
          pendingOverPopup: completedOverSummary,
        };
      })(),
      enteredInningsBreak: false,
      matchFinished: false,
    };
  }

  // LIMITED OVERS BRANCH
  const origOvers = state.originalTotalOvers ?? state.totalOvers;
  const activeMaxOvers =
    state.inningsNumber === 1
      ? state.innings1MaxOvers ?? state.totalOvers
      : state.innings2MaxOvers ?? state.totalOvers;
  const maxBalls = activeMaxOvers * 6;
  const allOut = wickets >= 10;
  const oversDone = ballsBowled >= maxBalls;

  // Dynamic weather shift on completed over (before checking rain interruption)
  if (overCompleted && !allOut && !oversDone) {
    const wShift = maybeShiftWeather({
      currentWeather: nextState.weatherCondition ?? 'clear',
      rainChance: nextState.rainChance ?? 0,
      format: nextState.format,
    });
    if (wShift.changed && wShift.commentary) {
      const wEntry: CommentaryEntry = {
        id: (nextState.commentaryLog[0]?.id ?? 0) + 1,
        overBall: overBallLabel,
        outcomeSymbol: 'WTH',
        text: wShift.commentary,
        isWicket: false,
        isBoundary: false,
      };
      nextState = {
        ...nextState,
        weatherCondition: wShift.nextWeather,
        lastCommentary: wShift.commentary,
        commentaryLog: [wEntry, ...nextState.commentaryLog].slice(0, 30),
      };
    }
  }

  if (state.inningsNumber === 1) {
    let inningsDone = allOut || oversDone;
    let rainPopup: DlsRainPopupState | null = null;
    const completedOversCount = Math.floor(ballsBowled / 6);
    const inn1WasReduced = (state.innings1MaxOvers ?? state.totalOvers) < origOvers;

    if (
      overCompleted &&
      !inningsDone &&
      shouldTriggerRainInterruption({
        format: state.format,
        rainChance: state.rainChance ?? 0,
        inningsNumber: 1,
        completedOvers: completedOversCount,
        maxOvers: activeMaxOvers,
        rainInterruptionsInMatch: state.rainInterruptionsCount ?? 0,
        rainInterruptionsInInnings: inn1WasReduced ? 1 : 0,
      })
    ) {
      const reduction = computeRainReduction({
        originalMaxOvers: origOvers,
        maxOvers: activeMaxOvers,
        completedOvers: completedOversCount,
        wicketsLost: wickets,
        currentResourcesPct: state.innings1ResourcesPct ?? 100,
        rainChance: state.rainChance ?? 0,
      });

      const inn2Resources = calculateDlsResourcePct(origOvers, reduction.revisedOvers, 0);
      const inningsEndedByRain = ballsBowled >= reduction.revisedOvers * 6;
      const dlsPreview = calculateDlsTarget({
        team1Score: runs,
        team1ResourcesPct: reduction.newResourcesPct,
        team2ResourcesPct: inn2Resources,
        originalMaxOvers: origOvers,
      });

      const batTeam = getTeamById(updatedInnings.battingTeamId);
      const rainMsg = inningsEndedByRain
        ? `RAIN ENDS 1ST INNINGS! ${batTeam.code} finish on ${runs}/${wickets} (${reduction.revisedOvers} ov). DLS Target set to ${dlsPreview.target}!`
        : `RAIN DELAY! ${reduction.oversLost} ${reduction.oversLost === 1 ? 'over' : 'overs'} lost — match reduced to ${reduction.revisedOvers} overs per side (DLS Method).`;

      rainPopup = {
        inningsNumber: 1,
        rainChance: state.rainChance ?? 0,
        weatherCondition: 'drizzle',
        previousOvers: reduction.previousOvers,
        revisedOvers: reduction.revisedOvers,
        oversLost: reduction.oversLost,
        team1ResourcesPct: reduction.newResourcesPct,
        team2ResourcesPct: inn2Resources,
        previousTarget: null,
        revisedTarget: inningsEndedByRain ? dlsPreview.target : null,
        parScore: inningsEndedByRain ? dlsPreview.parScore : null,
        matchEndedByRain: false,
        inningsEndedByRain,
        headline: inningsEndedByRain ? 'RAIN ENDS INNINGS · DLS APPLIED' : 'RAIN DELAY · OVERS REDUCED',
        details: rainMsg,
      };

      const dlsEntry: CommentaryEntry = {
        id: (nextState.commentaryLog[0]?.id ?? 0) + 1,
        overBall: overBallLabel,
        outcomeSymbol: 'DLS',
        text: rainMsg,
        isWicket: false,
        isBoundary: false,
      };

      inningsDone = inningsEndedByRain;
      nextState = {
        ...nextState,
        weatherCondition: 'drizzle',
        totalOvers: reduction.revisedOvers,
        innings1MaxOvers: reduction.revisedOvers,
        innings2MaxOvers: reduction.revisedOvers,
        innings1ResourcesPct: reduction.newResourcesPct,
        innings2ResourcesPct: inn2Resources,
        dlsApplied: true,
        rainInterruptionsCount: (state.rainInterruptionsCount ?? 0) + 1,
        lastCommentary: rainMsg,
        commentaryLog: [dlsEntry, ...nextState.commentaryLog].slice(0, 30),
      };

      if (!inningsDone && overCompleted) {
        const adjustedBowler = pickNextEligibleBowler({
          bowlers: bowlTeam.bowlers,
          overIndex: completedOversCount,
          prevBowlerName: overBowlerName,
          spells: bowlerSpells,
          format: state.format,
          totalOvers: reduction.revisedOvers,
        });
        if (adjustedBowler !== bowlerName) {
          const adjSpell = bowlerSpells[adjustedBowler];
          nextState = updateMatchWithInnings(nextState, {
            ...getActiveInnings(nextState),
            bowlerName: adjustedBowler,
            bowlerOversBalls: 0,
            bowlerRunsConceded: adjSpell?.runs ?? 0,
            bowlerWickets: adjSpell?.wickets ?? 0,
          });
          if (completedOverSummary) {
            completedOverSummary = {
              ...completedOverSummary,
              nextBowlerName: adjustedBowler,
              nextBowlerStyle: getBowlingStyle(adjustedBowler),
            };
          }
        }
      }
    }

    const r1 = nextState.innings1ResourcesPct ?? 100;
    const r2 = nextState.innings2ResourcesPct ?? 100;
    const inn1Target = inningsDone
      ? Math.abs(r2 - r1) >= 0.05
        ? calculateDlsTarget({
            team1Score: runs,
            team1ResourcesPct: r1,
            team2ResourcesPct: r2,
            originalMaxOvers: origOvers,
          }).target
        : runs + 1
      : nextState.target;

    return {
      nextState: {
        ...nextState,
        target: inn1Target,
        pendingDlsPopup: rainPopup,
        pendingOverPopup: inningsDone ? null : completedOverSummary,
        pendingBatterPopup: inningsDone ? null : nextState.pendingBatterPopup,
      },
      enteredInningsBreak: inningsDone,
      matchFinished: false,
    };
  }

  let target = state.target ?? state.innings1.runs + 1;
  const chasedDownBeforeRain = runs >= target;
  let innings2Done = chasedDownBeforeRain || allOut || oversDone;
  let rainPopup: DlsRainPopupState | null = null;
  let dlsParScore = state.dlsParScore ?? null;
  let dlsApplied = Boolean(state.dlsApplied);

  const completedOversCount = Math.floor(ballsBowled / 6);
  const inn1WasReduced = (state.innings1MaxOvers ?? state.totalOvers) < origOvers;
  const inn2RainUsed = (state.rainInterruptionsCount ?? 0) > (inn1WasReduced ? 1 : 0);

  if (
    overCompleted &&
    !innings2Done &&
    shouldTriggerRainInterruption({
      format: state.format,
      rainChance: state.rainChance ?? 0,
      inningsNumber: 2,
      completedOvers: completedOversCount,
      maxOvers: activeMaxOvers,
      rainInterruptionsInMatch: state.rainInterruptionsCount ?? 0,
      rainInterruptionsInInnings: inn2RainUsed ? 1 : 0,
    })
  ) {
    const reduction = computeRainReduction({
      originalMaxOvers: origOvers,
      maxOvers: activeMaxOvers,
      completedOvers: completedOversCount,
      wicketsLost: wickets,
      currentResourcesPct: state.innings2ResourcesPct ?? 100,
      rainChance: state.rainChance ?? 0,
    });

    const dls = calculateDlsTarget({
      team1Score: state.innings1.runs,
      team1ResourcesPct: state.innings1ResourcesPct ?? 100,
      team2ResourcesPct: reduction.newResourcesPct,
      originalMaxOvers: origOvers,
    });

    const previousTarget = target;
    target = dls.target;
    dlsParScore = dls.parScore;
    dlsApplied = true;
    const noOversLeft = ballsBowled >= reduction.revisedOvers * 6;
    const passedRevisedTarget = runs >= dls.target;
    const matchEndedByRain = noOversLeft || passedRevisedTarget;
    innings2Done = matchEndedByRain;

    const rainMsg = noOversLeft
      ? `RAIN ENDS PLAY! DLS Par Score is ${dls.parScore} (Target ${dls.target}); ${getTeamById(updatedInnings.battingTeamId).code} are on ${runs}/${wickets}.`
      : passedRevisedTarget
      ? `RAIN & DLS TARGET REVISED! Target cut from ${previousTarget} to ${dls.target} in ${reduction.revisedOvers} overs — ${getTeamById(updatedInnings.battingTeamId).code} are already past the target!`
      : `RAIN DELAY! ${reduction.oversLost} ${reduction.oversLost === 1 ? 'over' : 'overs'} lost (${reduction.revisedOvers} ov innings). DLS Target revised from ${previousTarget} to ${dls.target} (Par: ${dls.parScore}).`;

    rainPopup = {
      inningsNumber: 2,
      rainChance: state.rainChance ?? 0,
      weatherCondition: 'drizzle',
      previousOvers: reduction.previousOvers,
      revisedOvers: reduction.revisedOvers,
      oversLost: reduction.oversLost,
      team1ResourcesPct: state.innings1ResourcesPct ?? 100,
      team2ResourcesPct: reduction.newResourcesPct,
      previousTarget,
      revisedTarget: dls.target,
      parScore: dls.parScore,
      matchEndedByRain,
      inningsEndedByRain: false,
      headline: matchEndedByRain ? 'RAIN ENDS PLAY · DLS RESULT' : 'RAIN DELAY · DLS TARGET REVISED',
      details: rainMsg,
    };

    const dlsEntry: CommentaryEntry = {
      id: (nextState.commentaryLog[0]?.id ?? 0) + 1,
      overBall: overBallLabel,
      outcomeSymbol: 'DLS',
      text: rainMsg,
      isWicket: false,
      isBoundary: false,
    };

    nextState = {
      ...nextState,
      weatherCondition: 'drizzle',
      totalOvers: reduction.revisedOvers,
      innings2MaxOvers: reduction.revisedOvers,
      innings2ResourcesPct: reduction.newResourcesPct,
      target: dls.target,
      dlsApplied: true,
      dlsParScore: dls.parScore,
      rainInterruptionsCount: (state.rainInterruptionsCount ?? 0) + 1,
      lastCommentary: rainMsg,
      commentaryLog: [dlsEntry, ...nextState.commentaryLog].slice(0, 30),
    };

    if (!innings2Done && overCompleted) {
      const adjustedBowler = pickNextEligibleBowler({
        bowlers: bowlTeam.bowlers,
        overIndex: completedOversCount,
        prevBowlerName: overBowlerName,
        spells: bowlerSpells,
        format: state.format,
        totalOvers: reduction.revisedOvers,
      });
      if (adjustedBowler !== bowlerName) {
        const adjSpell = bowlerSpells[adjustedBowler];
        nextState = updateMatchWithInnings(nextState, {
          ...getActiveInnings(nextState),
          bowlerName: adjustedBowler,
          bowlerOversBalls: 0,
          bowlerRunsConceded: adjSpell?.runs ?? 0,
          bowlerWickets: adjSpell?.wickets ?? 0,
        });
        if (completedOverSummary) {
          completedOverSummary = {
            ...completedOverSummary,
            nextBowlerName: adjustedBowler,
            nextBowlerStyle: getBowlingStyle(adjustedBowler),
          };
        }
      }
    }
  }

  let matchComplete = false;
  let winnerTeamId: string | 'tie' | null = null;
  let resultSummary = '';

  if (innings2Done) {
    matchComplete = true;
    const chasingTeam = getTeamById(updatedInnings.battingTeamId);
    const defendingTeam = getTeamById(updatedInnings.bowlingTeamId);
    const dlsSuffix = dlsApplied ? ' (DLS Method)' : '';

    if (dlsApplied && dlsParScore !== null && rainPopup?.matchEndedByRain) {
      if (runs > dlsParScore) {
        winnerTeamId = chasingTeam.id;
        const margin = runs - dlsParScore;
        resultSummary = `${chasingTeam.name} won by ${margin} ${margin === 1 ? 'run' : 'runs'} (DLS Method)!`;
      } else if (runs === dlsParScore) {
        winnerTeamId = 'tie';
        resultSummary = `Match Tied on ${runs} runs (DLS Method)!`;
      } else {
        winnerTeamId = defendingTeam.id;
        const margin = dlsParScore - runs;
        resultSummary = `${defendingTeam.name} won by ${margin} ${margin === 1 ? 'run' : 'runs'} (DLS Method)!`;
      }
    } else if (runs >= target) {
      winnerTeamId = chasingTeam.id;
      const wktsRemaining = 10 - wickets;
      resultSummary = `${chasingTeam.name} won by ${wktsRemaining} ${wktsRemaining === 1 ? 'wicket' : 'wickets'}${dlsSuffix}!`;
    } else if (runs === target - 1) {
      winnerTeamId = 'tie';
      resultSummary = `Match Tied! Both sides level on ${runs} runs${dlsSuffix}.`;
    } else {
      winnerTeamId = defendingTeam.id;
      const margin = target - 1 - runs;
      resultSummary = `${defendingTeam.name} won by ${margin} ${margin === 1 ? 'run' : 'runs'}${dlsSuffix}!`;
    }
  }

  return {
    nextState: {
      ...nextState,
      target,
      dlsApplied,
      dlsParScore,
      matchComplete,
      winnerTeamId,
      resultSummary,
      pendingDlsPopup: rainPopup,
      pendingOverPopup: innings2Done ? null : completedOverSummary,
      pendingBatterPopup: innings2Done ? null : nextState.pendingBatterPopup,
    },
    enteredInningsBreak: false,
    matchFinished: innings2Done,
  };
}

export function selectNextBatter(state: MatchState, batterIndex: number): MatchState {
  const prompt = state.pendingBatterPopup;
  if (!prompt) return state;

  const active = getActiveInnings(state);
  const candidate = active.batters[batterIndex];
  const survivingIndex =
    prompt.replacingSlot === 'nonStriker' ? active.strikerIndex : active.nonStrikerIndex;

  if (!candidate || candidate.out || batterIndex === survivingIndex) {
    return { ...state, pendingBatterPopup: null };
  }

  const updatedInnings: InningsState = {
    ...active,
    strikerIndex: prompt.replacingSlot === 'striker' ? batterIndex : active.strikerIndex,
    nonStrikerIndex: prompt.replacingSlot === 'nonStriker' ? batterIndex : active.nonStrikerIndex,
  };

  return updateMatchWithInnings(
    {
      ...state,
      pendingBatterPopup: null,
      lastCommentary: `${candidate.name} walks out to join ${active.batters[survivingIndex]?.name ?? 'partner'} at the crease.`,
    },
    updatedInnings
  );
}

export function selectNextBowler(state: MatchState, bowlerName: string): MatchState {
  const active = getActiveInnings(state);
  const bowlTeam = getTeamById(active.bowlingTeamId, {
    format: state.format,
    totalOvers: state.totalOvers,
  });
  if (!bowlTeam.bowlers.includes(bowlerName)) return state;

  const activeMaxOvers =
    state.format === 'test'
      ? state.oversPerDay
      : state.inningsNumber === 1
      ? state.innings1MaxOvers ?? state.totalOvers
      : state.innings2MaxOvers ?? state.totalOvers;

  // Enforce limited-overs per-bowler quota (e.g., 4 overs in T20, 10 overs in ODI)
  if (isBowlerQuotaExhausted(active, bowlerName, state.format, activeMaxOvers)) {
    return state;
  }

  // Enforce cricket rule: cannot bowl consecutive overs unless no other non-exhausted bowler exists
  if (bowlTeam.bowlers.length > 1) {
    const hasAlternative = (prevBowler: string) =>
      bowlTeam.bowlers.some(
        (b) =>
          b !== prevBowler &&
          !isBowlerQuotaExhausted(active, b, state.format, activeMaxOvers)
      );
    if (
      state.pendingOverPopup &&
      state.pendingOverPopup.bowlerName === bowlerName &&
      hasAlternative(state.pendingOverPopup.bowlerName)
    ) {
      return state;
    }
    if (
      state.pendingDayPopup?.phase === 'new_day' &&
      state.pendingDayPopup.lastBowlerName === bowlerName
    ) {
      return state;
    }
  }

  // Only allow changing bowler between overs (or before first ball of an over)
  if (!state.pendingOverPopup && state.pendingDayPopup?.phase !== 'new_day' && active.bowlerOversBalls > 0) {
    return state;
  }

  const spell = active.bowlerSpells?.[bowlerName];
  const nextStyle = getBowlingStyle(bowlerName);
  const updatedInnings: InningsState = {
    ...active,
    bowlerName,
    bowlerOversBalls: 0,
    bowlerRunsConceded: spell?.runs ?? 0,
    bowlerWickets: spell?.wickets ?? 0,
  };

  const nextPendingDeliveryType: DeliveryType =
    nextStyle === 'spin'
      ? isSpinDelivery(state.pendingDeliveryType)
        ? state.pendingDeliveryType
        : 'off_spin'
      : isSpinDelivery(state.pendingDeliveryType)
      ? 'fast'
      : state.pendingDeliveryType;

  return updateMatchWithInnings(
    {
      ...state,
      pendingDeliveryType: nextPendingDeliveryType,
      pendingOverPopup: state.pendingOverPopup
        ? {
            ...state.pendingOverPopup,
            nextBowlerName: bowlerName,
            nextBowlerStyle: nextStyle,
          }
        : null,
    },
    updatedInnings
  );
}

export function dismissOverPopup(state: MatchState): MatchState {
  if (!state.pendingOverPopup) return state;
  return {
    ...state,
    pendingOverPopup: null,
  };
}

export function dismissMilestonePopup(state: MatchState): MatchState {
  if (!state.pendingMilestonePopup) return state;
  return {
    ...state,
    pendingMilestonePopup: null,
  };
}

export function dismissDlsPopup(state: MatchState): MatchState {
  if (!state.pendingDlsPopup) return state;
  return {
    ...state,
    pendingDlsPopup: null,
  };
}

export function advanceTestDayPopupToNewDay(state: MatchState): MatchState {
  if (!state.pendingDayPopup || state.pendingDayPopup.phase !== 'day_completed') {
    return state;
  }
  return {
    ...state,
    pendingDayPopup: {
      ...state.pendingDayPopup,
      phase: 'new_day',
    },
  };
}

export function startTestNewDay(state: MatchState): MatchState {
  if (!state.pendingDayPopup) return state;
  const nextDay = state.pendingDayPopup.nextDay;
  const newDayMsg = `Day ${nextDay} begins! ${state.oversPerDay} overs scheduled today.`;
  return {
    ...state,
    currentDay: nextDay,
    ballsToday: 0,
    runsToday: 0,
    wicketsToday: 0,
    pendingDayPopup: null,
    lastCommentary: newDayMsg,
    commentaryLog: [
      {
        id: (state.commentaryLog[0]?.id ?? 0) + 1,
        overBall: formatOvers(getActiveInnings(state).ballsBowled),
        outcomeSymbol: `D${nextDay}`,
        text: newDayMsg,
        isWicket: false,
        isBoundary: false,
      },
      ...state.commentaryLog,
    ].slice(0, 30),
  };
}

export function declareTestInnings(state: MatchState): {
  nextState: MatchState;
  enteredInningsBreak: boolean;
  matchFinished: boolean;
} {
  if (state.format !== 'test' || state.inningsNumber >= 4) {
    return { nextState: state, enteredInningsBreak: false, matchFinished: false };
  }
  const active = getActiveInnings(state);
  const declaredInnings: InningsState = { ...active, declared: true };
  const batCode = getTeamById(active.battingTeamId).code;
  const msg = `${batCode} declare their innings closed at ${active.runs}/${active.wickets}!`;

  const updated = updateMatchWithInnings(
    {
      ...state,
      lastCommentary: msg,
      commentaryLog: [
        {
          id: (state.commentaryLog[0]?.id ?? 0) + 1,
          overBall: formatOvers(active.ballsBowled),
          outcomeSymbol: 'DEC',
          text: msg,
          isWicket: false,
          isBoundary: false,
        },
        ...state.commentaryLog,
      ].slice(0, 30),
    },
    declaredInnings
  );

  return evaluateTestAfterInningsEnds(updated);
}

export function startNextInnings(state: MatchState): MatchState {
  if (state.format === 'limited') {
    const origOvers = state.originalTotalOvers ?? state.totalOvers;
    const inn2Overs = state.innings2MaxOvers ?? state.totalOvers;
    const r1 = state.innings1ResourcesPct ?? 100;
    const r2 =
      state.innings2ResourcesPct ?? calculateDlsResourcePct(origOvers, inn2Overs, 0);
    const dlsNeeded = Boolean(state.dlsApplied) || Math.abs(r2 - r1) >= 0.05;
    const dls = calculateDlsTarget({
      team1Score: state.innings1.runs,
      team1ResourcesPct: r1,
      team2ResourcesPct: r2,
      originalMaxOvers: origOvers,
    });
    const target = dlsNeeded ? dls.target : state.innings1.runs + 1;
    const innings2 = createInningsState(
      state.innings1.bowlingTeamId,
      state.innings1.battingTeamId,
      { format: state.format, totalOvers: inn2Overs }
    );
    const playerBatting2nd =
      state.mode === 'ai' && innings2.battingTeamId === state.homeTeamId;
    const openingPair = `${innings2.batters[0]?.name ?? 'Opener'} & ${innings2.batters[1]?.name ?? 'Partner'}`;
    const dlsLabel = dlsNeeded ? ' (DLS Target)' : '';
    const startMsg =
      state.mode === 'ai'
        ? playerBatting2nd
          ? `Chase ${target} runs${dlsLabel} in ${inn2Overs} overs! ${openingPair} face ${innings2.bowlerName}.`
          : `Defend ${target - 1} runs${dlsLabel} in ${inn2Overs} overs! ${innings2.bowlerName} opens against ${openingPair}.`
        : `2nd Innings underway! Target ${target} runs${dlsLabel} in ${inn2Overs} overs — ${innings2.bowlerName} to ${openingPair}.`;

    return {
      ...state,
      inningsNumber: 2,
      totalOvers: inn2Overs,
      target,
      dlsApplied: dlsNeeded,
      dlsParScore: dlsNeeded ? dls.parScore : null,
      innings2,
      pendingBatterPopup: null,
      pendingOverPopup: null,
      pendingDayPopup: null,
      pendingMilestonePopup: null,
      pendingDlsPopup: null,
      pvpTurnPhase: 'bowl_select',
      lastOutcome: null,
      lastCommentary: startMsg,
      commentaryLog: [
        {
          id: (state.commentaryLog[0]?.id ?? 0) + 1,
          overBall: '0.0',
          outcomeSymbol: '2ND',
          text: startMsg,
          isWicket: false,
          isBoundary: false,
        },
        ...state.commentaryLog,
      ].slice(0, 30),
    };
  }

  // Test Match: Innings 2, 3, or 4
  const nextInnNum = (state.inningsNumber + 1) as 2 | 3 | 4;
  const prevInn = getActiveInnings(state);
  // Standard alternating order (1: A, 2: B, 3: A, 4: B)
  const nextBatId = prevInn.bowlingTeamId;
  const nextBowlId = prevInn.battingTeamId;
  const newInn = createInningsState(nextBatId, nextBowlId, {
    format: state.format,
    totalOvers: state.totalOvers,
  });
  const batCode = getTeamById(nextBatId).code;
  const openingPair = `${newInn.batters[0]?.name ?? 'Opener'} & ${newInn.batters[1]?.name ?? 'Partner'}`;

  let target = state.target;
  if (nextInnNum === 4 && target === null) {
    const totals = getTeamTestTotals(state);
    const chasingPrevTotal = nextBatId === totals.team1Id ? totals.team1Total : totals.team2Total;
    const otherTotal = nextBatId === totals.team1Id ? totals.team2Total : totals.team1Total;
    target = Math.max(1, otherTotal - chasingPrevTotal + 1);
  }

  const startMsg =
    nextInnNum === 4 && target !== null
      ? `4th Innings! ${batCode} need ${target} runs to win. ${openingPair} vs ${newInn.bowlerName}.`
      : `Innings ${nextInnNum} underway! ${batCode} (${openingPair}) face ${newInn.bowlerName}.`;

  return {
    ...state,
    inningsNumber: nextInnNum,
    target,
    innings2: nextInnNum === 2 ? newInn : state.innings2,
    innings3: nextInnNum === 3 ? newInn : state.innings3,
    innings4: nextInnNum === 4 ? newInn : state.innings4,
    pendingBatterPopup: null,
    pendingOverPopup: null,
    pendingDayPopup: null,
    pendingMilestonePopup: null,
    pvpTurnPhase: 'bowl_select',
    lastOutcome: null,
    lastCommentary: startMsg,
    commentaryLog: [
      {
        id: (state.commentaryLog[0]?.id ?? 0) + 1,
        overBall: '0.0',
        outcomeSymbol: `${nextInnNum}I`,
        text: startMsg,
        isWicket: false,
        isBoundary: false,
      },
      ...state.commentaryLog,
    ].slice(0, 30),
  };
}

// Backwards-compatible alias
export const startSecondInnings = startNextInnings;

/**
 * Simulates an entire match instantly (used for AI-vs-AI tournament & series fixtures or fast-sim).
 */
export function simulateFullMatch(params: {
  format: MatchFormat;
  pitchCondition?: PitchCondition;
  rainChance?: RainChance;
  difficulty: Difficulty;
  homeTeamId: string;
  awayTeamId: string;
  totalOvers: number;
  oversPerDay?: 30 | 60 | 90;
  rng?: () => number;
}): MatchState {
  const rng = params.rng ?? Math.random;
  const pitchCondition: PitchCondition = params.pitchCondition ?? 'hard';
  const rainChance: RainChance = params.rainChance ?? 0;
  let state = createInitialMatchState({
    mode: 'ai',
    format: params.format,
    pitchCondition,
    rainChance,
    difficulty: params.difficulty,
    homeTeamId: params.homeTeamId,
    awayTeamId: params.awayTeamId,
    totalOvers: params.totalOvers,
    oversPerDay: params.oversPerDay ?? 90,
    homeBatsFirst: rng() < 0.5,
  });

  let guard = 0;
  while (!state.matchComplete && guard < 3200) {
    guard += 1;
    const active = getActiveInnings(state);
    const striker = active.batters[active.strikerIndex];
    const bowlerStyle = getBowlingStyle(active.bowlerName);
    const del = chooseAiDelivery(
      params.difficulty,
      rng,
      pitchCondition,
      bowlerStyle,
      state.weatherCondition ?? 'clear'
    );
    const shot = chooseAiShot(params.difficulty, del.type, del.length, rng);
    const res = resolveDelivery({
      shot,
      deliveryType: del.type,
      deliveryLength: del.length,
      difficulty: params.difficulty,
      playerIsBatting: false,
      strikerName: striker?.name ?? 'Batter',
      bowlerName: active.bowlerName,
      format: params.format,
      pitchCondition,
      weatherCondition: state.weatherCondition ?? 'clear',
      rng,
    });

    const applied = applyDeliveryToMatch(state, res);
    state = applied.nextState;
    if (state.pendingMilestonePopup) {
      state = dismissMilestonePopup(state);
    }
    if (state.pendingBatterPopup) {
      state = selectNextBatter(state, state.pendingBatterPopup.selectedBatterIndex);
    }
    if (state.pendingDlsPopup) {
      state = dismissDlsPopup(state);
    }
    if (state.pendingOverPopup) {
      state = dismissOverPopup(state);
    }
    if (state.pendingDayPopup) {
      state = startTestNewDay(state);
    }

    // Strategic declaration in Test Mode if lead >= 280 in 3rd innings or score >= 400 in 1st
    if (
      state.format === 'test' &&
      !applied.enteredInningsBreak &&
      !applied.matchFinished &&
      ((state.inningsNumber === 1 && getActiveInnings(state).runs >= 380) ||
        (state.inningsNumber === 3 &&
          getTeamTestTotals(state).team1Total - getTeamTestTotals(state).team2Total >= 280))
    ) {
      const dec = declareTestInnings(state);
      state = dec.nextState;
      if (dec.enteredInningsBreak && !state.matchComplete) {
        state = startNextInnings(state);
      }
      continue;
    }

    if (applied.enteredInningsBreak && !state.matchComplete) {
      state = startNextInnings(state);
    }
  }

  return state;
}
