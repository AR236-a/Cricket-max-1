import React, { useEffect, useState } from 'react';
import {
  calculateRequiredRunRate,
  calculateRunRate,
  DELIVERY_META,
  formatOvers,
  getActiveInnings,
  getTestLeadText,
  isPlayerBattingNow,
  isSpinDelivery,
  LENGTH_META,
  PACE_DELIVERY_TYPES,
  PITCH_META,
  SHOT_META,
  SPIN_DELIVERY_TYPES,
} from '../game/cricketEngine';
import { computePlayerOfTheMatch } from '../game/awards';
import { getBattingHand, getBowlingStyle, getTeamById } from '../game/teams';
import {
  BowlingSide,
  DeliveryLength,
  DeliveryResolution,
  DeliveryType,
  InningsState,
  MatchState,
  ScreenId,
  ShotType,
} from '../game/types';
import { RunRateChart } from './RunRateChart';
import { TeamBadge } from './TeamBadge';
import {
  Award,
  Calendar,
  Flag,
  Flame,
  Home,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface GameHudProps {
  screen: ScreenId;
  match: MatchState | null;
  isAnimatingBall: boolean;
  aiThinking: boolean;
  muted: boolean;
  selectedDeliveryType: DeliveryType;
  selectedDeliveryLength: DeliveryLength;
  lastOutcomeBanner: { id: number; resolution: DeliveryResolution } | null;
  onSelectShot: (shot: ShotType) => void;
  onSelectDeliveryType: (type: DeliveryType) => void;
  onSelectDeliveryLength: (len: DeliveryLength) => void;
  onSelectBowlingSide: (side: BowlingSide) => void;
  onBowl: () => void;
  onDeclareInnings: () => void;
  onSelectNextBatter: (batterIndex: number) => void;
  onSelectNextBowler: (bowlerName: string) => void;
  onDismissOverPopup: () => void;
  onDismissMilestonePopup: () => void;
  onProceedToNewDay: () => void;
  onContinueNewDay: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onStartNextInnings: () => void;
  onPlayAgain: () => void;
  onReturnToTournament: () => void;
  onExitToMenu: () => void;
}

const SHOTS_ORDER: ShotType[] = [
  'drive',
  'pull',
  'sweep',
  'cut',
  'loft',
  'defend',
  'flick',
  'hook',
];

const LENGTHS_ORDER: DeliveryLength[] = ['full', 'good', 'short'];

export const GameHud: React.FC<GameHudProps> = ({
  screen,
  match,
  isAnimatingBall,
  aiThinking,
  muted,
  selectedDeliveryType,
  selectedDeliveryLength,
  lastOutcomeBanner,
  onSelectShot,
  onSelectDeliveryType,
  onSelectDeliveryLength,
  onSelectBowlingSide,
  onBowl,
  onDeclareInnings,
  onSelectNextBatter,
  onSelectNextBowler,
  onDismissOverPopup,
  onDismissMilestonePopup,
  onProceedToNewDay,
  onContinueNewDay,
  onToggleMute,
  onTogglePause,
  onStartNextInnings,
  onPlayAgain,
  onReturnToTournament,
  onExitToMenu,
}) => {
  const [showScorecard, setShowScorecard] = useState(false);
  const [showOpeningBowlerPicker, setShowOpeningBowlerPicker] = useState(false);

  const active = match ? getActiveInnings(match) : null;
  const activeBowlerStyle = active ? getBowlingStyle(active.bowlerName) : 'pace';

  // Sync selected delivery automatically when bowler changes between pacer & spinner
  useEffect(() => {
    if (!active) return;
    if (activeBowlerStyle === 'pace' && isSpinDelivery(selectedDeliveryType)) {
      onSelectDeliveryType('fast');
    } else if (activeBowlerStyle === 'spin' && !isSpinDelivery(selectedDeliveryType)) {
      onSelectDeliveryType('off_spin');
    }
  }, [active?.bowlerName, activeBowlerStyle, selectedDeliveryType, onSelectDeliveryType]);

  useEffect(() => {
    if (!active || active.bowlerOversBalls > 0 || screen !== 'playing') {
      setShowOpeningBowlerPicker(false);
    }
  }, [active?.bowlerOversBalls, screen]);

  if (!match || !active || (screen !== 'playing' && screen !== 'inningsBreak' && screen !== 'result')) {
    return null;
  }

  const batTeam = getTeamById(active.battingTeamId);
  const bowlTeam = getTeamById(active.bowlingTeamId);
  const striker = active.batters[active.strikerIndex];
  const nonStriker = active.batters[active.nonStrikerIndex];
  const strikerHand = striker ? getBattingHand(striker.name) : 'right';
  const nonStrikerHand = nonStriker ? getBattingHand(nonStriker.name) : 'right';
  const playerBatting = isPlayerBattingNow(match);
  const userControlsBowling = match.mode === 'pvp' || active.bowlingTeamId === match.homeTeamId;
  const currentBowlingSide: BowlingSide = match.bowlingSide ?? 'over';
  const hasBlockingPopup =
    Boolean(match.pendingMilestonePopup) ||
    Boolean(match.pendingBatterPopup) ||
    Boolean(match.pendingOverPopup) ||
    Boolean(match.pendingDayPopup);
  const controlsLocked =
    isAnimatingBall ||
    aiThinking ||
    match.isPaused ||
    screen !== 'playing' ||
    hasBlockingPopup ||
    showOpeningBowlerPicker;
  const isTest = match.format === 'test';
  const testLeadText = getTestLeadText(match);
  const canDeclare = isTest && match.inningsNumber < 4 && playerBatting && !controlsLocked;
  const canSwapOpeningBowler =
    userControlsBowling && active.ballsBowled === 0 && active.bowlerOversBalls === 0 && !controlsLocked;
  const effectiveBowlingTab: 'pace' | 'spin' = activeBowlerStyle;

  const rr = calculateRunRate(active.runs, active.ballsBowled);
  const isChase = match.inningsNumber === 2 && !isTest && match.target !== null;
  const runsNeeded = isChase ? Math.max(0, (match.target ?? 0) - active.runs) : null;
  const ballsRemaining = !isTest ? Math.max(0, match.totalOvers * 6 - active.ballsBowled) : null;
  const rrr = isChase
    ? calculateRequiredRunRate(match.target!, active.runs, active.ballsBowled, match.totalOvers)
    : null;

  const playedInningsList: Array<{ num: number; inn: InningsState }> = [
    { num: 1, inn: match.innings1 },
    ...(match.innings2 ? [{ num: 2, inn: match.innings2 }] : []),
    ...(match.innings3 ? [{ num: 3, inn: match.innings3 }] : []),
    ...(match.innings4 ? [{ num: 4, inn: match.innings4 }] : []),
  ];

  // Top performers & Player of the Match for modals
  const topScorer = playedInningsList
    .flatMap((item) => item.inn.batters)
    .sort((a, b) => b.runs - a.runs)[0];
  const playerOfTheMatch = screen === 'result' ? computePlayerOfTheMatch(match) : null;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
      {/* TOP SCOREBOARD HUD */}
      <header className="pointer-events-auto w-full bg-[#060f24]/92 border-b border-cyan-500/35 px-3 sm:px-6 py-2">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Batting Team Score */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <TeamBadge team={batTeam} size="sm" />
              <div className="flex items-baseline gap-1.5 sm:gap-2.5">
                <span className="hidden sm:inline text-xs font-semibold tracking-wider text-slate-300 uppercase">
                  {batTeam.code}
                </span>
                <span className="font-display font-mono-num text-2xl sm:text-3xl font-bold text-amber-400 leading-none whitespace-nowrap">
                  {active.runs}/{active.wickets}
                </span>
                <span
                  className={`text-[11px] text-slate-400 font-mono-num whitespace-nowrap ${
                    isTest ? 'inline' : 'hidden md:inline'
                  }`}
                >
                  {isTest ? `(Inn ${match.inningsNumber})` : `(${active.wickets} wkts)`}
                </span>
              </div>
            </div>

            {/* Center: Overs & Run Rate / Test Day + Pitch (Desktop / Tablet) */}
            <div className="hidden sm:flex flex-col items-center text-center shrink-0">
              {isTest ? (
                <>
                  <div className="font-mono-num text-base font-bold text-cyan-300 tracking-wide whitespace-nowrap">
                    Day {match.currentDay}/5 · {formatOvers(active.ballsBowled)} ov
                  </div>
                  <div className="text-[11px] font-mono-num text-slate-300 whitespace-nowrap">
                    Today {formatOvers(match.ballsToday)}/{match.oversPerDay} · RR: {rr} ·{' '}
                    {PITCH_META[match.pitchCondition ?? 'hard'].label} Pitch
                  </div>
                </>
              ) : (
                <>
                  <div className="font-mono-num text-base font-bold text-cyan-300 tracking-wide whitespace-nowrap">
                    {formatOvers(active.ballsBowled)} / {match.totalOvers}
                  </div>
                  <div className="text-[11px] font-mono-num text-slate-400 whitespace-nowrap">
                    RR: {rr}
                    {rrr ? ` · RRR: ${rrr}` : ''} · {PITCH_META[match.pitchCondition ?? 'hard'].label} Pitch
                  </div>
                </>
              )}
            </div>

            {/* Right: Bowling / Target / Lead + Utility buttons */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <TeamBadge team={bowlTeam} size="sm" />
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-300">{bowlTeam.code}</div>
                  <div className="text-xs font-mono-num text-amber-300 whitespace-nowrap">
                    {isTest
                      ? testLeadText
                      : isChase && runsNeeded !== null && ballsRemaining !== null
                      ? `Need ${runsNeeded} in ${ballsRemaining}b (T:${match.target})`
                      : 'Bowling'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:ml-2">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="View squads and scorecard"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setShowScorecard((s) => !s);
                  }}
                  className="w-8 h-8 rounded-md bg-[#0d1936] border border-cyan-500/35 hover:border-cyan-300 flex items-center justify-center text-cyan-200 cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleMute();
                  }}
                  className="w-8 h-8 rounded-md bg-[#0d1936] border border-cyan-500/35 hover:border-cyan-300 flex items-center justify-center text-cyan-200 cursor-pointer"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Pause match"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTogglePause();
                  }}
                  className="w-8 h-8 rounded-md bg-[#0d1936] border border-cyan-500/35 hover:border-amber-300 flex items-center justify-center text-amber-300 cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Secondary Strip: Day / Overs / RR / Lead or Target (prevents score/day collision) */}
          <div
            data-testid="mobile-match-strip"
            className="sm:hidden mt-1.5 pt-1.5 border-t border-cyan-500/20 flex items-center justify-between gap-2 text-[11px] font-mono-num"
          >
            {isTest ? (
              <>
                <span className="font-bold text-cyan-300 whitespace-nowrap shrink-0">
                  Day {match.currentDay}/5 · {formatOvers(active.ballsBowled)} ov
                </span>
                <span className="text-slate-300 whitespace-nowrap shrink-0">
                  Today {formatOvers(match.ballsToday)}/{match.oversPerDay}
                </span>
                <span className="text-amber-300 font-semibold truncate text-right">
                  {match.inningsNumber === 1 ? `RR ${rr}` : testLeadText}
                </span>
              </>
            ) : (
              <>
                <span className="font-bold text-cyan-300 whitespace-nowrap shrink-0">
                  {formatOvers(active.ballsBowled)}/{match.totalOvers} ov
                </span>
                <span className="text-slate-300 whitespace-nowrap shrink-0">
                  RR {rr}
                  {rrr ? ` · RRR ${rrr}` : ''}
                </span>
                <span className="text-amber-300 font-semibold whitespace-nowrap shrink-0">
                  {isChase && runsNeeded !== null && ballsRemaining !== null
                    ? `Need ${runsNeeded} in ${ballsRemaining}b`
                    : `${PITCH_META[match.pitchCondition ?? 'hard'].label} Pitch`}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* OVER BALL TRACKER & ON-FIELD BATTER CARDS */}
      <div className="relative flex-1 w-full">
        {/* Top Row: 6-Ball Over Tracker + Declare + Bowler Chip */}
        <div className="w-full px-3 sm:px-4 pt-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 gap-y-1.5">
          <div
            aria-label="Current over balls"
            className="flex items-center gap-1 sm:gap-1.5 shrink-0"
          >
            {Array.from({ length: 6 }).map((_, idx) => {
              const sym = active.currentOverBalls[idx];
              const isW = sym === 'W';
              const isSix = sym === '6';
              const isFour = sym === '4';
              return (
                <span
                  key={idx}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border flex items-center justify-center text-[11px] sm:text-xs font-mono-num font-bold ${
                    !sym
                      ? 'border-slate-500/45 text-slate-500 bg-[#060f24]/60'
                      : isW
                      ? 'border-rose-400 bg-rose-600 text-white'
                      : isSix
                      ? 'border-amber-300 bg-amber-400 text-slate-950'
                      : isFour
                      ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                      : 'border-emerald-400/70 bg-[#0d1b38] text-slate-100'
                  }`}
                >
                  {sym ?? '·'}
                </span>
              );
            })}
          </div>

          <div className="flex items-center gap-2 min-w-0 max-w-full ml-auto">
            {canDeclare && (
              <button
                type="button"
                onClick={onDeclareInnings}
                className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-400/20 border border-amber-400 text-amber-300 hover:bg-amber-400 hover:text-slate-950 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Flag className="w-3 h-3" aria-hidden="true" />
                Declare
              </button>
            )}
            {canSwapOpeningBowler && (
              <button
                type="button"
                data-testid="opening-bowler-change-btn"
                onClick={() => setShowOpeningBowlerPicker(true)}
                className="pointer-events-auto px-2 py-1 rounded-md bg-cyan-500/20 border border-cyan-400/70 text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Change
              </button>
            )}
            <div
              className={`px-2.5 sm:px-3 py-1 rounded-md bg-[#060f24]/85 border border-cyan-500/30 text-[11px] sm:text-xs text-slate-200 font-mono-num flex items-center gap-1.5 min-w-0 ${
                canDeclare || canSwapOpeningBowler ? '' : 'max-w-[162px] sm:max-w-none'
              }`}
            >
              <span className="hidden sm:inline shrink-0">Bowler: </span>
              <span className="text-cyan-300 font-semibold truncate">{active.bowlerName}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                  activeBowlerStyle === 'spin'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50'
                    : 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                }`}
              >
                {activeBowlerStyle.toUpperCase()}
              </span>
              <span className="shrink-0">({active.bowlerWickets}-{active.bowlerRunsConceded})</span>
            </div>
          </div>
        </div>

        {/* Dynamic D3 Run Rate & Predicted Total Progress Chart (Limited Overs) */}
        {!isTest && screen === 'playing' && (
          <RunRateChart
            innings={active}
            inningsNumber={match.inningsNumber}
            totalOvers={match.totalOvers}
            target={match.target}
          />
        )}

        {/* Striker & Non-Striker Cards (Left & Right flanks) */}
        <div className="hidden sm:flex absolute left-3 top-[64%] -translate-y-1/2 items-center gap-2 px-3 py-2 rounded-lg bg-[#060f24]/90 border border-cyan-500/35">
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold ${
              strikerHand === 'left'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
            }`}
          >
            {strikerHand === 'left' ? 'LHB' : 'RHB'}
          </span>
          <span className="text-xs font-semibold text-white">{striker?.name}*</span>
          <span className="font-mono-num text-xs font-bold text-amber-400">
            {striker?.runs ?? 0}({striker?.balls ?? 0})
          </span>
        </div>

        <div className="hidden sm:flex absolute right-3 top-[64%] -translate-y-1/2 items-center gap-2 px-3 py-2 rounded-lg bg-[#060f24]/90 border border-cyan-500/35">
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold ${
              nonStrikerHand === 'left'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
            }`}
          >
            {nonStrikerHand === 'left' ? 'LHB' : 'RHB'}
          </span>
          <span className="text-xs font-semibold text-slate-200">{nonStriker?.name}</span>
          <span className="font-mono-num text-xs font-bold text-amber-400">
            {nonStriker?.runs ?? 0}({nonStriker?.balls ?? 0})
          </span>
        </div>

        {/* Mobile Live Striker & Non-Striker Strip */}
        <div className="sm:hidden absolute bottom-11 left-2 right-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#060f24]/92 border border-cyan-500/35 min-w-0">
            <span
              className={`px-1 py-0.5 rounded text-[8px] font-mono-num font-bold shrink-0 ${
                strikerHand === 'left'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                  : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
              }`}
            >
              {strikerHand === 'left' ? 'LHB' : 'RHB'}
            </span>
            <span className="text-[11px] font-semibold text-white truncate">{striker?.name}*</span>
            <span className="font-mono-num text-[11px] font-bold text-amber-400 shrink-0">
              {striker?.runs ?? 0}({striker?.balls ?? 0})
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#060f24]/92 border border-cyan-500/35 min-w-0">
            <span
              className={`px-1 py-0.5 rounded text-[8px] font-mono-num font-bold shrink-0 ${
                nonStrikerHand === 'left'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                  : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
              }`}
            >
              {nonStrikerHand === 'left' ? 'LHB' : 'RHB'}
            </span>
            <span className="text-[11px] font-semibold text-slate-200 truncate">{nonStriker?.name}</span>
            <span className="font-mono-num text-[11px] font-bold text-amber-400 shrink-0">
              {nonStriker?.runs ?? 0}({nonStriker?.balls ?? 0})
            </span>
          </div>
        </div>

        {/* Partnership badge centered below pitch */}
        <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 px-3 sm:px-3.5 py-1 rounded-md bg-[#060f24]/88 border border-slate-500/40 text-[11px] sm:text-xs font-mono-num text-slate-200 whitespace-nowrap">
          Partnership: {active.partnershipRuns}({active.partnershipBalls})
        </div>

        {/* AI Thinking indicator */}
        {aiThinking && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-md bg-[#060f24]/95 border border-amber-400/60 text-xs font-semibold tracking-widest text-amber-300 uppercase">
            AI THINKING...
          </div>
        )}

        {/* Animated Ball Outcome Callout */}
        {lastOutcomeBanner && (
          <div
            key={lastOutcomeBanner.id}
            className="animate-outcome-pop absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 px-7 py-3 rounded-xl bg-[#071128]/95 border-2 border-amber-400 shadow-[0_0_32px_rgba(250,204,21,0.35)] text-center"
          >
            <div
              className={`font-display text-4xl sm:text-5xl font-bold tracking-wider ${
                lastOutcomeBanner.resolution.isWicket
                  ? 'text-rose-400'
                  : lastOutcomeBanner.resolution.isBoundarySix
                  ? 'text-amber-300'
                  : lastOutcomeBanner.resolution.isBoundaryFour
                  ? 'text-cyan-300'
                  : 'text-white'
              }`}
            >
              {lastOutcomeBanner.resolution.outcomeLabel}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM REAL-TIME COMMENTARY BOX & CONTROL DECK */}
      <footer className="pointer-events-auto w-full bg-[#050d20]/96 border-t border-cyan-500/30 px-2.5 sm:px-5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] space-y-2">
        {/* Real-Time Ball-by-Ball Commentary Box */}
        <div
          data-testid="commentary-box"
          role="log"
          aria-live="polite"
          aria-label="Live match commentary"
          className="max-w-6xl mx-auto rounded-md bg-[#08132d] border border-cyan-500/30 px-3 py-1.5 max-h-[68px] sm:max-h-[76px] overflow-y-auto space-y-1"
        >
          {match.mode === 'pvp' && (match.pvpTurnPhase === 'bowl_select' || match.pvpTurnPhase === 'bat_select') && (
            <div className="flex items-start gap-2 text-xs text-cyan-200 font-semibold border-b border-cyan-500/20 pb-1">
              <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 shrink-0">
                TURN
              </span>
              <span>
                {match.pvpTurnPhase === 'bowl_select'
                  ? `P1 Bowling (${active.bowlerName}): Select delivery type & length, then click BOWL.`
                  : `P2 Batting (${striker?.name}): ${DELIVERY_META[match.pendingDeliveryType].label} · ${LENGTH_META[match.pendingDeliveryLength].label} incoming — choose your shot!`}
              </span>
            </div>
          )}

          {match.commentaryLog.map((entry, idx) => (
            <div
              key={entry.id}
              className={`flex items-start gap-2 text-xs leading-snug ${
                idx === 0 ? 'text-slate-100 font-medium' : 'text-slate-400'
              }`}
            >
              <span className="font-mono-num text-[10px] text-cyan-300/90 shrink-0 pt-0.5 w-8">
                {entry.overBall}
              </span>
              <span
                className={`font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 min-w-[22px] text-center ${
                  entry.isWicket
                    ? 'bg-rose-600 text-white'
                    : entry.outcomeSymbol === '6'
                    ? 'bg-amber-400 text-slate-950'
                    : entry.outcomeSymbol === '4'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-[#102046] text-slate-200'
                }`}
              >
                {entry.outcomeSymbol}
              </span>
              <span className="flex-1">{entry.text}</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="max-w-6xl mx-auto">
          {playerBatting ? (
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {SHOTS_ORDER.map((shot) => {
                const meta = SHOT_META[shot];
                return (
                  <button
                    key={shot}
                    type="button"
                    disabled={controlsLocked}
                    onClick={() => onSelectShot(shot)}
                    title={meta.description}
                    className={`min-h-[42px] py-2 px-1.5 sm:py-2.5 sm:px-3 rounded-lg bg-[#08132b] border ${meta.border} ${meta.text} font-semibold tracking-wider text-[11px] sm:text-sm transition-colors flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-amber-400`}
                  >
                    <span>{meta.label}</span>
                    <span className="hidden md:inline text-[10px] text-slate-400 font-mono-num">
                      [{meta.keyHint}]
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Auto-Detected Bowler Style Control Lock (Pacer vs Spinner) + Side Switch (Over/Around) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#08132b] border border-cyan-500/35">
                    <button
                      type="button"
                      disabled={controlsLocked || activeBowlerStyle !== 'pace'}
                      onClick={() => onSelectDeliveryType('fast')}
                      title={
                        activeBowlerStyle !== 'pace'
                          ? 'Locked: Current bowler is a Spinner'
                          : 'Pace & Seam deliveries enabled'
                      }
                      className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                        effectiveBowlingTab === 'pace'
                          ? 'bg-amber-400 text-slate-950 cursor-pointer'
                          : 'text-slate-500 opacity-45 cursor-not-allowed'
                      }`}
                    >
                      {activeBowlerStyle !== 'pace' && <Lock className="w-3 h-3" aria-hidden="true" />}
                      Pace (5)
                    </button>
                    <button
                      type="button"
                      disabled={controlsLocked || activeBowlerStyle !== 'spin'}
                      onClick={() => onSelectDeliveryType('off_spin')}
                      title={
                        activeBowlerStyle !== 'spin'
                          ? 'Locked: Current bowler is a Pacer'
                          : 'Spin Variations enabled'
                      }
                      className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                        effectiveBowlingTab === 'spin'
                          ? 'bg-purple-400 text-slate-950 cursor-pointer'
                          : 'text-slate-500 opacity-45 cursor-not-allowed'
                      }`}
                    >
                      {activeBowlerStyle !== 'spin' && <Lock className="w-3 h-3" aria-hidden="true" />}
                      Spin (6)
                    </button>
                  </div>

                  {/* Bowler Side Selector (Over vs Around the Wicket) */}
                  <div
                    data-testid="bowling-side-toggle"
                    role="group"
                    aria-label="Bowling side"
                    className="inline-flex items-center p-0.5 rounded-lg bg-[#08132b] border border-cyan-500/35"
                  >
                    <button
                      type="button"
                      disabled={controlsLocked}
                      aria-pressed={currentBowlingSide === 'over'}
                      onClick={() => onSelectBowlingSide('over')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 ${
                        currentBowlingSide === 'over'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Over Wkt
                    </button>
                    <button
                      type="button"
                      disabled={controlsLocked}
                      aria-pressed={currentBowlingSide === 'round'}
                      onClick={() => onSelectBowlingSide('round')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 ${
                        currentBowlingSide === 'round'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Around Wkt
                    </button>
                  </div>

                  <span className="hidden lg:inline text-[10px] font-mono-num text-cyan-200/85">
                    {activeBowlerStyle === 'pace'
                      ? `${active.bowlerName} (Pacer)`
                      : `${active.bowlerName} (Spinner)`}
                  </span>
                </div>

                <span
                  className={`hidden sm:inline-block text-[10px] font-mono-num font-semibold px-2 py-0.5 rounded border ${
                    PITCH_META[match.pitchCondition ?? 'hard'].badgeColor
                  }`}
                >
                  {PITCH_META[match.pitchCondition ?? 'hard'].label} ·{' '}
                  {PITCH_META[match.pitchCondition ?? 'hard'].shortLabel}
                </span>
              </div>

              <div
                className={`grid gap-2 ${
                  effectiveBowlingTab === 'spin'
                    ? 'grid-cols-3 sm:grid-cols-6'
                    : 'grid-cols-3 sm:grid-cols-5'
                }`}
              >
                {(effectiveBowlingTab === 'spin' ? SPIN_DELIVERY_TYPES : PACE_DELIVERY_TYPES).map(
                  (del) => {
                    const meta = DELIVERY_META[del];
                    const activeSel = selectedDeliveryType === del;
                    return (
                      <button
                        key={del}
                        type="button"
                        disabled={controlsLocked}
                        onClick={() => onSelectDeliveryType(del)}
                        className={`py-2 px-2 rounded-lg border text-xs font-semibold tracking-wider transition-colors cursor-pointer whitespace-nowrap disabled:opacity-45 ${
                          activeSel
                            ? 'bg-cyan-400/20 border-cyan-300 text-white'
                            : `bg-[#08132b] ${meta.border} ${meta.text} hover:bg-[#0e1f45]`
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  }
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {LENGTHS_ORDER.map((len) => {
                  const activeLen = selectedDeliveryLength === len;
                  return (
                    <button
                      key={len}
                      type="button"
                      disabled={controlsLocked}
                      onClick={() => onSelectDeliveryLength(len)}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-semibold tracking-wider transition-colors cursor-pointer whitespace-nowrap disabled:opacity-45 ${
                        activeLen
                          ? 'bg-cyan-500/25 border-cyan-300 text-cyan-200'
                          : 'bg-[#08132b] border-slate-600/60 text-slate-300 hover:border-cyan-400/60'
                      }`}
                    >
                      {LENGTH_META[len].label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={controlsLocked}
                onClick={onBowl}
                className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-display text-lg tracking-widest uppercase transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                BOWL
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* SQUADS & LIVE SCORECARD MODAL */}
      {showScorecard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Squads and Live Scorecard"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#020612]/88 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-2xl max-h-[84vh] rounded-xl bg-[#0b1530] border border-cyan-400/50 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-amber-400">
                PLAYING XI & SCORECARD
              </h2>
              <button
                type="button"
                aria-label="Close squads and scorecard"
                onClick={() => setShowScorecard(false)}
                className="w-8 h-8 rounded-md bg-[#101e42] border border-cyan-500/35 text-slate-200 hover:border-cyan-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-1">
              {/* Batting XI + Live Runs */}
              <div className="rounded-lg bg-[#070f24] border border-cyan-500/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <TeamBadge team={batTeam} size="sm" />
                    <span className="text-sm font-semibold text-white">{batTeam.name} (Batting)</span>
                  </div>
                  <span className="font-mono-num text-sm font-bold text-amber-400">
                    {active.runs}/{active.wickets}
                  </span>
                </div>
                <div className="space-y-1">
                  {active.batters.map((b, i) => {
                    const isStriker = i === active.strikerIndex && !b.out;
                    const isNonStriker = i === active.nonStrikerIndex && !b.out;
                    return (
                      <div
                        key={b.name}
                        className={`flex items-center justify-between text-xs py-1 px-2 rounded ${
                          isStriker
                            ? 'bg-emerald-950/60 text-emerald-200'
                            : isNonStriker
                            ? 'bg-cyan-950/40 text-cyan-100'
                            : b.out
                            ? 'text-slate-500'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="truncate">
                          <span className="font-mono-num text-slate-500 mr-1.5">{i + 1}.</span>
                          {b.name}
                          {isStriker ? '*' : ''}
                          {b.out && b.dismissal ? ` (${b.dismissal})` : ''}
                        </span>
                        <span className="font-mono-num font-semibold shrink-0 ml-2">
                          {b.runs}({b.balls})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bowling XI */}
              <div className="rounded-lg bg-[#070f24] border border-cyan-500/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <TeamBadge team={bowlTeam} size="sm" />
                    <span className="text-sm font-semibold text-white">{bowlTeam.name} (Bowling XI)</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {bowlTeam.batters.map((playerName, i) => {
                    const isCurrentBowler = playerName === active.bowlerName;
                    const isAttackOption = bowlTeam.bowlers.includes(playerName);
                    const spell = active.bowlerSpells?.[playerName];
                    return (
                      <div
                        key={playerName}
                        className={`flex items-center justify-between text-xs py-1 px-2 rounded ${
                          isCurrentBowler
                            ? 'bg-amber-950/50 text-amber-200 font-semibold'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="truncate">
                          <span className="font-mono-num text-slate-500 mr-1.5">{i + 1}.</span>
                          {playerName}
                          <span className="ml-1.5 text-[9px] font-mono-num text-slate-400">
                            ({getBowlingStyle(playerName).toUpperCase()})
                          </span>
                        </span>
                        <span className="text-[10px] font-mono-num text-cyan-300/90 shrink-0 ml-2">
                          {spell && spell.balls > 0
                            ? `${isCurrentBowler ? 'LIVE ' : ''}${spell.wickets}-${spell.runs} (${formatOvers(spell.balls)} ov)`
                            : isCurrentBowler
                            ? `BOWLING (${active.bowlerWickets}-${active.bowlerRunsConceded})`
                            : isAttackOption
                            ? 'Bowler'
                            : 'Fielder'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MILESTONE CELEBRATION POPUP (50 / 100 / 150 / 200 / 5-FER) */}
      {match.pendingMilestonePopup && screen === 'playing' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Player Milestone Celebration"
          data-testid="milestone-celebration-popup"
          className="pointer-events-auto fixed inset-0 z-40 bg-[#020612]/85 flex items-center justify-center p-4"
        >
          {(() => {
            const ms = match.pendingMilestonePopup;
            const msTeam = getTeamById(ms.teamId);
            const isFiveFer = ms.kind === '5fer';
            const badgeText = isFiveFer ? '5W' : ms.kind;
            return (
              <div className="animate-modal-pop w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-[#0b1530] border-2 border-amber-400 p-6 text-center space-y-4 shadow-[0_0_44px_rgba(250,204,21,0.38)]">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-amber-400/15 border-2 border-amber-400 flex items-center justify-center">
                    <span className="font-display text-3xl font-bold text-amber-300">
                      {badgeText}
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-[11px] font-mono-num font-bold uppercase tracking-widest text-amber-300">
                  <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  {isFiveFer ? 'Bowling Milestone' : 'Batting Milestone'}
                </div>

                <div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-amber-300">
                    {ms.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-cyan-200 mt-1">{ms.subtitle}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-[#070f24] border border-cyan-500/35 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 text-left">
                    <TeamBadge team={msTeam} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{ms.playerName}</div>
                      <div className="text-[11px] font-mono-num text-cyan-300">{msTeam.name}</div>
                    </div>
                  </div>
                  {isFiveFer ? (
                    <div className="text-right font-mono-num shrink-0">
                      <div className="text-xl font-bold text-rose-300">
                        {ms.wickets}-{ms.runsConceded}
                      </div>
                      <div className="text-[10px] text-slate-400">{ms.oversText} ov</div>
                    </div>
                  ) : (
                    <div className="text-right font-mono-num shrink-0">
                      <div className="text-xl font-bold text-amber-300">
                        {ms.runs}* ({ms.balls})
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {ms.fours ?? 0}x4 · {ms.sixes ?? 0}x6
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onDismissMilestonePopup}
                  className="w-full py-2.5 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-lg font-bold tracking-wider uppercase cursor-pointer"
                >
                  {isFiveFer ? 'CELEBRATE 5-FER & CONTINUE ▶' : 'RAISE THE BAT & CONTINUE ▶'}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* NEXT BATTER SELECTION POPUP (ON WICKET DOWN) */}
      {match.pendingBatterPopup &&
        !match.pendingMilestonePopup &&
        screen === 'playing' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select Next Batter"
          data-testid="next-batter-popup"
          className="pointer-events-auto fixed inset-0 z-35 bg-[#020612]/85 flex items-center justify-center p-4"
        >
          {(() => {
            const prompt = match.pendingBatterPopup;
            const survivingIndex =
              prompt.replacingSlot === 'nonStriker' ? active.strikerIndex : active.nonStrikerIndex;
            const survivingBatter = active.batters[survivingIndex];
            const availableBatters = active.batters
              .map((b, idx) => ({ batter: b, idx }))
              .filter(({ batter, idx }) => !batter.out && idx !== survivingIndex);

            return (
              <div className="animate-modal-pop w-full max-w-md max-h-[88vh] rounded-xl bg-[#0b1530] border-2 border-amber-400/80 p-5 flex flex-col gap-4 shadow-[0_0_36px_rgba(250,204,21,0.28)]">
                <div className="text-center space-y-1 border-b border-slate-700/60 pb-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-[10px] font-mono-num font-bold uppercase tracking-widest text-rose-300">
                    Wicket #{prompt.wickets} · {batTeam.code} {active.runs}/{active.wickets}
                  </div>
                  <h2 className="font-display text-3xl font-bold tracking-wider text-amber-400">
                    CHOOSE NEXT BATTER
                  </h2>
                  <p className="text-xs text-slate-300">
                    <span className="text-rose-300 font-semibold">{prompt.dismissedBatterName}</span>{' '}
                    ({prompt.dismissedKind ?? 'Out'}) · Partner:{' '}
                    <span className="text-cyan-300 font-semibold">
                      {survivingBatter?.name} {survivingBatter?.runs ?? 0}({survivingBatter?.balls ?? 0})
                    </span>
                  </p>
                </div>

                <div
                  data-testid="next-batter-list"
                  className="overflow-y-auto space-y-1.5 pr-1"
                >
                  {availableBatters.map(({ batter, idx }) => {
                    const hand = getBattingHand(batter.name);
                    const isRecommended = idx === prompt.selectedBatterIndex;
                    const isBowler = batTeam.bowlers.includes(batter.name);
                    return (
                      <button
                        key={batter.name}
                        type="button"
                        data-testid={`select-batter-${idx}`}
                        onClick={() => onSelectNextBatter(idx)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          isRecommended
                            ? 'bg-amber-400/15 border-amber-400 text-white hover:bg-amber-400/25'
                            : 'bg-[#070f24] border-cyan-500/30 text-slate-200 hover:border-cyan-300 hover:bg-[#0e1f45]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono-num text-[11px] text-slate-400 w-5 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-semibold truncate">{batter.name}</span>
                          {isRecommended && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[9px] font-mono-num font-bold uppercase shrink-0">
                              Next
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isBowler && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-mono-num uppercase">
                              {getBowlingStyle(batter.name) === 'spin' ? 'SPIN' : 'PACE'}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold ${
                              hand === 'left'
                                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                                : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                            }`}
                          >
                            {hand === 'left' ? 'LHB' : 'RHB'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* OPENING OVER BOWLER PICKER (AT 0.0 WHEN USER BOWLS) */}
      {showOpeningBowlerPicker && !hasBlockingPopup && screen === 'playing' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose Opening Bowler"
          data-testid="opening-bowler-popup"
          className="pointer-events-auto fixed inset-0 z-35 bg-[#020612]/85 flex items-center justify-center p-4"
        >
          <div className="animate-modal-pop w-full max-w-md max-h-[86vh] rounded-xl bg-[#0b1530] border-2 border-cyan-400/80 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-wider text-amber-400">
                  SELECT OPENING BOWLER
                </h2>
                <p className="text-xs text-cyan-300">{bowlTeam.name} Bowling Attack</p>
              </div>
              <button
                type="button"
                aria-label="Close opening bowler picker"
                onClick={() => setShowOpeningBowlerPicker(false)}
                className="w-8 h-8 rounded-md bg-[#101e42] border border-cyan-500/35 text-slate-200 hover:border-cyan-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 overflow-y-auto pr-1">
              {bowlTeam.bowlers.map((bName) => {
                const isSelected = active.bowlerName === bName;
                const style = getBowlingStyle(bName);
                return (
                  <button
                    key={bName}
                    type="button"
                    onClick={() => {
                      onSelectNextBowler(bName);
                      setShowOpeningBowlerPicker(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-400/20 border-cyan-300 text-white'
                        : 'bg-[#070f24] border-cyan-500/30 text-slate-200 hover:border-cyan-300'
                    }`}
                  >
                    <span className="text-sm font-semibold truncate">{bName}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold uppercase shrink-0 ${
                        style === 'spin'
                          ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50'
                          : 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                      }`}
                    >
                      {style.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* END OF OVER POPUP */}
      {match.pendingOverPopup &&
        !match.pendingMilestonePopup &&
        !match.pendingBatterPopup &&
        !match.pendingDayPopup &&
        screen === 'playing' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Over Completed"
          data-testid="over-complete-popup"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#020612]/80 flex items-center justify-center p-4"
        >
          <div className="animate-modal-pop w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-[#0b1530] border-2 border-cyan-400/70 p-5 sm:p-6 text-center space-y-4 shadow-[0_0_36px_rgba(56,189,248,0.25)]">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[11px] font-mono-num font-bold uppercase tracking-widest text-cyan-300">
              End of Over {match.pendingOverPopup.overNumber}
            </div>

            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-amber-400">
              OVER {match.pendingOverPopup.overNumber} COMPLETE
            </h2>

            <div className="p-3.5 rounded-lg bg-[#070f24] border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  Bowler:{' '}
                  <span className="text-white font-semibold">
                    {match.pendingOverPopup.bowlerName}
                  </span>{' '}
                  <span className="text-[10px] font-mono-num text-cyan-300">
                    ({match.pendingOverPopup.bowlerStyle.toUpperCase()})
                  </span>
                </span>
                <span className="font-mono-num font-bold text-amber-300">
                  {batTeam.code} {match.pendingOverPopup.teamRuns}/
                  {match.pendingOverPopup.teamWickets}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2">
                {match.pendingOverPopup.balls.map((sym, i) => (
                  <span
                    key={i}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-mono-num font-bold ${
                      sym === 'W'
                        ? 'border-rose-400 bg-rose-600 text-white'
                        : sym === '6'
                        ? 'border-amber-300 bg-amber-400 text-slate-950'
                        : sym === '4'
                        ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                        : 'border-emerald-400/60 bg-[#0d1b38] text-slate-100'
                    }`}
                  >
                    {sym}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-xs font-mono-num">
                <div className="p-2 rounded bg-[#0c1a3a]">
                  <div className="text-[10px] text-slate-400 uppercase">Runs in Over</div>
                  <div className="text-lg font-bold text-amber-400">
                    {match.pendingOverPopup.runsConceded}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#0c1a3a]">
                  <div className="text-[10px] text-slate-400 uppercase">Wickets in Over</div>
                  <div className="text-lg font-bold text-rose-400">
                    {match.pendingOverPopup.wicketsTaken}
                  </div>
                </div>
              </div>
            </div>

            {userControlsBowling ? (
              <div
                data-testid="next-bowler-selector"
                className="p-3 rounded-lg bg-[#070f24] border border-cyan-500/30 space-y-2 text-left"
              >
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  <span>Choose Next Bowler ({bowlTeam.code})</span>
                  <span className="font-mono-num text-amber-300 truncate ml-2">
                    {match.pendingOverPopup.nextBowlerName}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[168px] overflow-y-auto pr-0.5">
                  {bowlTeam.bowlers.map((bName) => {
                    const isSelected = match.pendingOverPopup?.nextBowlerName === bName;
                    const bowledLast =
                      bowlTeam.bowlers.length > 1 &&
                      match.pendingOverPopup?.bowlerName === bName;
                    const spell = active.bowlerSpells?.[bName];
                    const style = getBowlingStyle(bName);
                    return (
                      <button
                        key={bName}
                        type="button"
                        disabled={bowledLast}
                        onClick={() => onSelectNextBowler(bName)}
                        className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-md border text-xs transition-colors ${
                          bowledLast
                            ? 'bg-[#081129] border-slate-800 text-slate-500 opacity-55 cursor-not-allowed'
                            : isSelected
                            ? 'bg-cyan-400/20 border-cyan-300 text-white cursor-pointer'
                            : 'bg-[#0c1a3a] border-slate-700/70 text-slate-200 hover:border-cyan-400/70 cursor-pointer'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{bName}</div>
                          <div className="text-[10px] font-mono-num text-slate-400">
                            {bowledLast
                              ? 'Bowled last over'
                              : spell && spell.balls > 0
                              ? `${spell.wickets}-${spell.runs} (${formatOvers(spell.balls)} ov)`
                              : '0-0 (0.0 ov)'}
                          </div>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold uppercase shrink-0 ${
                            style === 'spin'
                              ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40'
                              : 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                          }`}
                        >
                          {style.toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {isChase && runsNeeded !== null && ballsRemaining !== null && (
                  <div className="pt-1 text-center text-xs font-mono-num text-amber-300 font-semibold">
                    Need {runsNeeded} runs in {ballsRemaining} balls
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-300 space-y-1">
                <div>
                  Next Bowler:{' '}
                  <span className="text-cyan-300 font-semibold">
                    {match.pendingOverPopup.nextBowlerName}
                  </span>{' '}
                  <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                    {match.pendingOverPopup.nextBowlerStyle.toUpperCase()}
                  </span>
                </div>
                {isChase && runsNeeded !== null && ballsRemaining !== null && (
                  <div className="font-mono-num text-amber-300 font-semibold">
                    Need {runsNeeded} runs in {ballsRemaining} balls
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onDismissOverPopup}
              className="w-full py-2.5 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-lg font-bold tracking-wider uppercase cursor-pointer"
            >
              CONTINUE NEXT OVER ▶
            </button>
          </div>
        </div>
      )}

      {/* TEST MODE: DAY COMPLETED POPUP WITH SCORECARD */}
      {match.pendingDayPopup?.phase === 'day_completed' &&
        !match.pendingMilestonePopup &&
        !match.pendingBatterPopup &&
        screen === 'playing' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Test Day Completed Scorecard"
          data-testid="day-completed-popup"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#020612]/88 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg max-h-[86vh] rounded-xl bg-[#0b1530] border-2 border-amber-400/75 p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Calendar className="w-6 h-6 text-amber-400 shrink-0" aria-hidden="true" />
                <div className="text-left min-w-0">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-amber-400 leading-none">
                    STUMPS · DAY {match.pendingDayPopup.completedDay} COMPLETED
                  </h2>
                  <p className="text-xs font-mono-num text-cyan-300 mt-1">
                    Today: {match.pendingDayPopup.runsToday} runs ·{' '}
                    {match.pendingDayPopup.wicketsToday} wickets ({match.oversPerDay} ov)
                  </p>
                </div>
              </div>
            </div>

            {/* Scorecard Summary */}
            <div className="overflow-y-auto space-y-3 pr-1">
              <div className="p-3 rounded-lg bg-[#070f24] border border-cyan-500/30 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  Match Scorecard
                </div>
                {playedInningsList.map(({ num, inn }) => {
                  const innTeam = getTeamById(inn.battingTeamId);
                  return (
                    <div
                      key={num}
                      className="flex items-center justify-between gap-2 text-xs border-b border-slate-800/70 pb-1.5 last:border-none last:pb-0"
                    >
                      <div className="flex items-center gap-2 font-semibold text-white min-w-0">
                        <TeamBadge team={innTeam} size="sm" />
                        <span className="truncate">
                          {innTeam.name} ({num}
                          {num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'} Inn)
                        </span>
                      </div>
                      <span className="font-mono-num text-amber-300 font-bold whitespace-nowrap shrink-0">
                        {inn.runs}/{inn.wickets}
                        {inn.declared ? 'd' : ''} ({formatOvers(inn.ballsBowled)} ov)
                      </span>
                    </div>
                  );
                })}
                {testLeadText && (
                  <div className="pt-1.5 text-xs font-semibold text-emerald-300">
                    {testLeadText}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#070f24] border border-cyan-500/25 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Not Out Batters ({batTeam.code})
                  </div>
                  <div className="text-xs text-slate-200 flex items-center justify-between gap-2 font-mono-num">
                    <span className="truncate">
                      {striker?.name}* ({strikerHand === 'left' ? 'LHB' : 'RHB'})
                    </span>
                    <span className="text-amber-300 font-bold shrink-0">
                      {striker?.runs ?? 0}({striker?.balls ?? 0})
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center justify-between gap-2 font-mono-num">
                    <span className="truncate">
                      {nonStriker?.name} ({nonStrikerHand === 'left' ? 'LHB' : 'RHB'})
                    </span>
                    <span className="text-amber-300 shrink-0">
                      {nonStriker?.runs ?? 0}({nonStriker?.balls ?? 0})
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#070f24] border border-cyan-500/25 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    Bowling Figures ({bowlTeam.code})
                  </div>
                  <div className="text-xs text-slate-200 flex items-center justify-between gap-2 font-mono-num">
                    <span className="truncate">{active.bowlerName}</span>
                    <span className="text-cyan-300 font-bold shrink-0">
                      {active.bowlerWickets}-{active.bowlerRunsConceded}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Overs Today: {match.oversPerDay}.0 / {match.oversPerDay}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onProceedToNewDay}
              className="w-full py-3 px-6 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-lg font-bold tracking-wider uppercase cursor-pointer"
            >
              PROCEED TO DAY {match.pendingDayPopup.nextDay} ▶
            </button>
          </div>
        </div>
      )}

      {/* TEST MODE: NEW DAY CONTINUOUS START POPUP */}
      {match.pendingDayPopup?.phase === 'new_day' &&
        !match.pendingMilestonePopup &&
        !match.pendingBatterPopup &&
        screen === 'playing' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New Test Day"
          data-testid="new-day-popup"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#020612]/88 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-[#0b1530] border-2 border-cyan-400/75 p-6 text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-400/15 border border-amber-400/50 flex items-center justify-center">
              <Sun className="w-8 h-8 text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-4xl font-bold tracking-wider text-amber-400">
                DAY {match.pendingDayPopup.nextDay} OF 5
              </h2>
              <p className="text-xs font-mono-num text-cyan-300 mt-1">
                Morning Session · {match.oversPerDay} Overs Today ·{' '}
                {PITCH_META[match.pitchCondition ?? 'hard'].label} Pitch
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#070f24] border border-cyan-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-200">
                <span>Current Score ({batTeam.code})</span>
                <span className="font-mono-num font-bold text-amber-300">
                  {active.runs}/{active.wickets} ({formatOvers(active.ballsBowled)} ov)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Opening Bowler</span>
                <span className="text-cyan-300 font-semibold">{active.bowlerName}</span>
              </div>
              {testLeadText && (
                <div className="pt-1.5 border-t border-slate-800 text-emerald-300 font-semibold">
                  {testLeadText}
                </div>
              )}
            </div>

            {userControlsBowling && (
              <div className="p-3 rounded-lg bg-[#070f24] border border-cyan-500/30 space-y-2 text-left">
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  Choose Day {match.pendingDayPopup.nextDay} Opening Bowler
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto">
                  {bowlTeam.bowlers.map((bName) => {
                    const isSelected = active.bowlerName === bName;
                    const bowledLast =
                      bowlTeam.bowlers.length > 1 &&
                      match.pendingDayPopup?.lastBowlerName === bName;
                    const style = getBowlingStyle(bName);
                    return (
                      <button
                        key={bName}
                        type="button"
                        disabled={bowledLast}
                        onClick={() => onSelectNextBowler(bName)}
                        className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-md border text-xs transition-colors ${
                          bowledLast
                            ? 'bg-[#081129] border-slate-800 text-slate-500 opacity-55 cursor-not-allowed'
                            : isSelected
                            ? 'bg-cyan-400/20 border-cyan-300 text-white cursor-pointer'
                            : 'bg-[#0c1a3a] border-slate-700/70 text-slate-200 hover:border-cyan-400/70 cursor-pointer'
                        }`}
                      >
                        <span className="font-semibold truncate">{bName}</span>
                        <span className="text-[9px] font-mono-num text-cyan-300 uppercase shrink-0">
                          {bowledLast ? 'Last Ov' : style.toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onContinueNewDay}
              className="w-full py-3 px-6 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display text-lg font-bold tracking-wider uppercase cursor-pointer"
            >
              CONTINUE TO DAY {match.pendingDayPopup.nextDay} ▶
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {match.isPaused && screen === 'playing' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Match Paused"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#020612]/85 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-xl bg-[#0b1530] border border-cyan-400/50 p-6 text-center space-y-5">
            <h2 className="font-display text-3xl font-bold tracking-wider text-amber-400">
              MATCH PAUSED
            </h2>
            <p className="text-xs font-mono-num text-slate-300">
              {batTeam.code} {active.runs}/{active.wickets} ({formatOvers(active.ballsBowled)}
              {isTest ? ` ov · Day ${match.currentDay}/5` : ` / ${match.totalOvers} ov`})
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onTogglePause}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-400 text-slate-950 font-semibold text-sm uppercase tracking-wider hover:bg-amber-300 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                Resume Match
              </button>
              {!match.activeTournamentMatchId && (
                <button
                  type="button"
                  onClick={onPlayAgain}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#101e42] border border-cyan-500/40 text-cyan-200 font-semibold text-sm uppercase tracking-wider hover:border-cyan-300 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  Restart Match
                </button>
              )}
              <button
                type="button"
                onClick={match.activeTournamentMatchId ? onReturnToTournament : onExitToMenu}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#101e42] border border-slate-600 text-slate-200 font-semibold text-sm uppercase tracking-wider hover:border-slate-400 cursor-pointer"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                {match.activeTournamentMatchId ? 'Back to Tournament' : 'Main Menu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INNINGS BREAK MODAL */}
      {screen === 'inningsBreak' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Innings Break"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#020612]/88 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-[#0b1530] border border-amber-400/60 p-7 text-center space-y-5">
            <h2 className="font-display text-4xl font-bold tracking-wider text-amber-400">
              {isTest ? `INNINGS ${match.inningsNumber} COMPLETE` : 'INNINGS BREAK'}
            </h2>
            <div className="p-4 rounded-lg bg-[#070f24] border border-cyan-500/30 space-y-2.5">
              {playedInningsList.map(({ num, inn }) => {
                const innTeam = getTeamById(inn.battingTeamId);
                return (
                  <div
                    key={num}
                    className="flex items-center justify-between gap-2 text-sm border-b border-slate-800/70 pb-1.5 last:border-none last:pb-0"
                  >
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <TeamBadge team={innTeam} size="sm" />
                      <span>
                        {innTeam.code} ({num}
                        {num === 1 ? 'st' : num === 2 ? 'nd' : 'rd'})
                      </span>
                    </div>
                    <div className="font-mono-num text-amber-400 font-bold">
                      {inn.runs}/{inn.wickets}
                      {inn.declared ? 'd' : ''} ({formatOvers(inn.ballsBowled)} ov)
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-slate-700/60 text-sm text-cyan-300 font-semibold">
                {isTest
                  ? match.inningsNumber === 3 && match.target !== null
                    ? `${getTeamById(active.bowlingTeamId).name} need ${match.target} runs to win`
                    : `${testLeadText ?? `Day ${match.currentDay}/5`}`
                  : `${getTeamById(match.innings1.bowlingTeamId).name} need ${match.innings1.runs + 1} runs to win`}
              </div>
            </div>
            <button
              type="button"
              onClick={onStartNextInnings}
              className="w-full py-3 px-6 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-lg font-bold tracking-wider uppercase cursor-pointer"
            >
              START{' '}
              {match.inningsNumber === 1
                ? '2ND'
                : match.inningsNumber === 2
                ? '3RD'
                : '4TH'}{' '}
              INNINGS ▶
            </button>
          </div>
        </div>
      )}

      {/* MATCH RESULT MODAL */}
      {screen === 'result' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Match Result"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#020612]/90 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-[#0b1530] border border-amber-400/70 p-7 text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-400/15 border border-amber-400/50 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-amber-400" aria-hidden="true" />
            </div>
            <h2 className="font-display text-4xl font-bold tracking-wider text-amber-400">
              MATCH RESULT
            </h2>
            <p className="text-base font-semibold text-cyan-300">{match.resultSummary}</p>

            <div className="grid grid-cols-2 gap-3 text-left">
              {playedInningsList.map(({ num, inn }) => (
                <div key={num} className="p-3 rounded-lg bg-[#070f24] border border-cyan-500/30">
                  <div className="text-xs text-slate-400">
                    {getTeamById(inn.battingTeamId).code} ({num}
                    {num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'} Inn)
                  </div>
                  <div className="font-display font-mono-num text-2xl font-bold text-white">
                    {inn.runs}/{inn.wickets}
                    {inn.declared ? 'd' : ''}
                  </div>
                  <div className="text-[11px] font-mono-num text-slate-400">
                    {formatOvers(inn.ballsBowled)} ov
                  </div>
                </div>
              ))}
            </div>

            {playerOfTheMatch ? (
              <div
                data-testid="potm-award-card"
                className="p-3 rounded-lg bg-[#070f24] border border-amber-400/45 flex items-center justify-between gap-2.5 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <TeamBadge team={getTeamById(playerOfTheMatch.teamId)} size="sm" />
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1 text-[10px] font-mono-num font-bold uppercase tracking-widest text-amber-300">
                      <Award className="w-3 h-3 text-amber-400" aria-hidden="true" />
                      Player of the Match
                    </div>
                    <div className="text-sm font-bold text-white truncate">
                      {playerOfTheMatch.playerName}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono-num font-semibold text-cyan-300 text-right shrink-0">
                  {playerOfTheMatch.summary}
                </div>
              </div>
            ) : (
              topScorer && (
                <div className="text-xs font-mono-num text-slate-300">
                  Top Scorer: <span className="text-amber-300 font-semibold">{topScorer.name}</span>{' '}
                  {topScorer.runs}({topScorer.balls})
                </div>
              )
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onExitToMenu}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#101e42] border border-cyan-500/40 text-cyan-200 hover:border-cyan-300 font-semibold text-xs uppercase tracking-wider cursor-pointer"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                MAIN MENU
              </button>
              {match.activeTournamentMatchId ? (
                <button
                  type="button"
                  onClick={onReturnToTournament}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs uppercase tracking-wider cursor-pointer"
                >
                  <Trophy className="w-4 h-4" aria-hidden="true" />
                  TOURNAMENT HUB
                </button>
              ) : (
                <button
                  type="button"
                  data-start="true"
                  onClick={onPlayAgain}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs uppercase tracking-wider cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  PLAY AGAIN
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
