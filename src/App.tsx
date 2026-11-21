import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { MenuFlow } from './components/MenuFlow';
import { OfflineIndicator } from './components/PWAInstallButton';
import { BallAnimTrigger, StadiumCanvas } from './components/StadiumCanvas';
import { TournamentHub } from './components/TournamentHub';
import {
  advanceTestDayPopupToNewDay,
  applyDeliveryToMatch,
  chooseAiDelivery,
  chooseAiShot,
  createInitialMatchState,
  declareTestInnings,
  dismissMilestonePopup,
  dismissOverPopup,
  getActiveInnings,
  isPlayerBattingNow,
  isSpinDelivery,
  resolveDelivery,
  selectNextBatter,
  selectNextBowler,
  startNextInnings,
  startTestNewDay,
} from './game/cricketEngine';
import {
  clearSavedMatchSession,
  loadSavedMatchSession,
  SavedMatchSession,
  saveMatchSession,
} from './game/matchStorage';
import { soundFx } from './game/soundFx';
import { getBattingHand, getBowlingStyle, getTeamById } from './game/teams';
import {
  applyMatchOutcomeToTournament,
  combinePlayerStatRecords,
  createTournament,
  simulateNextMatches,
  simulateStage,
  simulateTournamentFixture,
} from './game/tournaments';
import {
  BowlingSide,
  DeliveryLength,
  DeliveryResolution,
  DeliveryType,
  Difficulty,
  GameMode,
  MatchFormat,
  MatchState,
  PitchCondition,
  ScreenId,
  ShotType,
  TournamentFixture,
  TournamentPlayerStat,
  TournamentState,
  TournamentType,
} from './game/types';

const ACTIVE_TOURNAMENT_STORAGE_KEY = 'cricket_pro_active_tournament_v1';
const CAREER_ARCHIVE_STORAGE_KEY = 'cricket_pro_stats_archive_v1';

function safeLoadActiveTournament(): TournamentState | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(ACTIVE_TOURNAMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TournamentState;
    if (!parsed || !parsed.fixtures || !parsed.standings) return null;
    return {
      ...parsed,
      id: parsed.id || `${parsed.type}-legacy`,
      pitchCondition: parsed.pitchCondition ?? 'hard',
      playerStats: parsed.playerStats ?? {},
    };
  } catch {
    return null;
  }
}

function safeLoadStatsArchive(): Record<string, Record<string, TournamentPlayerStat>> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(CAREER_ARCHIVE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const SHOT_KEYS: Record<string, ShotType> = {
  '1': 'drive',
  '2': 'pull',
  '3': 'sweep',
  '4': 'cut',
  '5': 'loft',
  '6': 'defend',
  '7': 'flick',
  '8': 'hook',
};

export default function App() {
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const initialSavedSession = useMemo(
    () => (autostart ? null : loadSavedMatchSession()),
    [autostart]
  );
  const shouldAutoResume = Boolean(initialSavedSession?.autoResumeOnLoad);

  const [savedSession, setSavedSession] = useState<SavedMatchSession | null>(initialSavedSession);
  const [screen, setScreen] = useState<ScreenId>(() =>
    autostart ? 'playing' : shouldAutoResume && initialSavedSession ? initialSavedSession.screen : 'menu'
  );
  const [mode, setMode] = useState<GameMode>(() =>
    shouldAutoResume && initialSavedSession ? initialSavedSession.match.mode : 'ai'
  );
  const [format, setFormat] = useState<MatchFormat>(() =>
    shouldAutoResume && initialSavedSession ? initialSavedSession.match.format : 'limited'
  );
  const [pitchCondition, setPitchCondition] = useState<PitchCondition>(() =>
    shouldAutoResume && initialSavedSession ? initialSavedSession.match.pitchCondition : 'hard'
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    shouldAutoResume && initialSavedSession ? initialSavedSession.match.difficulty : 'medium'
  );
  const [homeTeamId, setHomeTeamId] = useState<string | null>(() =>
    autostart ? 'ind' : shouldAutoResume && initialSavedSession ? initialSavedSession.match.homeTeamId : null
  );
  const [awayTeamId, setAwayTeamId] = useState<string | null>(() =>
    autostart ? 'aus' : shouldAutoResume && initialSavedSession ? initialSavedSession.match.awayTeamId : null
  );
  const [totalOvers, setTotalOvers] = useState<number>(() =>
    shouldAutoResume && initialSavedSession ? initialSavedSession.match.totalOvers : 5
  );
  const [oversPerDay, setOversPerDay] = useState<30 | 60 | 90>(() =>
    shouldAutoResume && initialSavedSession ? initialSavedSession.match.oversPerDay : 90
  );

  // Tournament & Series state (hydrated from localStorage)
  const [tournament, setTournament] = useState<TournamentState | null>(() =>
    safeLoadActiveTournament()
  );
  const [statsArchive, setStatsArchive] = useState<
    Record<string, Record<string, TournamentPlayerStat>>
  >(() => safeLoadStatsArchive());
  const [activeFixtureId, setActiveFixtureId] = useState<string | null>(() =>
    shouldAutoResume && initialSavedSession
      ? initialSavedSession.match.activeTournamentMatchId ?? null
      : null
  );

  const careerPlayerStats = useMemo(
    () => combinePlayerStatRecords(Object.values(statsArchive)),
    [statsArchive]
  );

  // Toss state
  const [tossFlipping, setTossFlipping] = useState(false);
  const [tossCall, setTossCall] = useState<'heads' | 'tails' | null>(null);
  const [tossCoinResult, setTossCoinResult] = useState<'heads' | 'tails' | null>(null);
  const [tossWinner, setTossWinner] = useState<'home' | 'away' | null>(null);
  const [aiChoice, setAiChoice] = useState<'bat' | 'bowl' | null>(null);

  // Match state
  const [match, setMatch] = useState<MatchState | null>(() =>
    autostart
      ? createInitialMatchState({
          mode: 'ai',
          difficulty: 'medium',
          homeTeamId: 'ind',
          awayTeamId: 'aus',
          totalOvers: 5,
          homeBatsFirst: true,
        })
      : shouldAutoResume && initialSavedSession
      ? initialSavedSession.match
      : null
  );
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<DeliveryType>(() => {
    if (shouldAutoResume && initialSavedSession) {
      const style = getBowlingStyle(getActiveInnings(initialSavedSession.match).bowlerName);
      const savedType = initialSavedSession.selectedDeliveryType;
      if (style === 'spin') return isSpinDelivery(savedType) ? savedType : 'off_spin';
      return isSpinDelivery(savedType) ? 'fast' : savedType;
    }
    return 'fast';
  });
  const [selectedDeliveryLength, setSelectedDeliveryLength] = useState<DeliveryLength>(() =>
    shouldAutoResume && initialSavedSession ? initialSavedSession.selectedDeliveryLength : 'good'
  );
  const [isAnimatingBall, setIsAnimatingBall] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [animTrigger, setAnimTrigger] = useState<BallAnimTrigger | null>(null);
  const [lastOutcomeBanner, setLastOutcomeBanner] = useState<{
    id: number;
    resolution: DeliveryResolution;
  } | null>(null);
  const [pendingScreenAfterMilestone, setPendingScreenAfterMilestone] = useState<
    'inningsBreak' | 'result' | null
  >(null);
  const [muted, setMuted] = useState(false);

  const pendingResolutionRef = useRef<DeliveryResolution | null>(null);
  const timersRef = useRef<number[]>([]);
  const animCounterRef = useRef(0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Sync document.body.dataset.state for predictable game shell state
  useEffect(() => {
    if (screen === 'playing') {
      document.body.dataset.state = match?.isPaused ? 'paused' : 'playing';
    } else if (screen === 'inningsBreak' || screen === 'result') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'title';
    }
  }, [screen, match?.isPaused]);

  // Apply completed match results to active tournament automatically (idempotent)
  useEffect(() => {
    if (match?.matchComplete && match.activeTournamentMatchId) {
      const fixId = match.activeTournamentMatchId;
      setTournament((prev) => (prev ? applyMatchOutcomeToTournament(prev, fixId, match) : prev));
    }
  }, [match]);

  // Persist active tournament & archive player statistics across reloads
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      if (tournament) {
        window.localStorage.setItem(ACTIVE_TOURNAMENT_STORAGE_KEY, JSON.stringify(tournament));
        if (Object.keys(tournament.playerStats ?? {}).length > 0) {
          setStatsArchive((prev) => {
            if (prev[tournament.id] === tournament.playerStats) return prev;
            const next = { ...prev, [tournament.id]: tournament.playerStats };
            window.localStorage.setItem(CAREER_ARCHIVE_STORAGE_KEY, JSON.stringify(next));
            return next;
          });
        }
      }
    } catch {
      // Ignore storage quota / private mode failures
    }
  }, [tournament]);

  // Auto-save active match state across reloads & browser restarts
  useEffect(() => {
    if (autostart) return;
    if ((screen === 'playing' || screen === 'inningsBreak') && match && !match.matchComplete) {
      const nextSession: SavedMatchSession = {
        version: 1,
        screen,
        autoResumeOnLoad: true,
        savedAt: Date.now(),
        selectedDeliveryType,
        selectedDeliveryLength,
        match: {
          ...match,
          isPaused: false,
        },
      };
      saveMatchSession(nextSession);
      setSavedSession(nextSession);
    } else if (match?.matchComplete || screen === 'result') {
      clearSavedMatchSession();
      setSavedSession(null);
    }
  }, [autostart, screen, match, selectedDeliveryType, selectedDeliveryLength]);

  const handleNavigate = useCallback((next: ScreenId) => {
    soundFx.playClick();
    if (next === 'mode') {
      setActiveFixtureId(null);
    }
    setScreen(next);
  }, []);

  const handleSelectMode = useCallback((chosenMode: GameMode) => {
    soundFx.playClick();
    setActiveFixtureId(null);
    setMode(chosenMode);
    setScreen(chosenMode === 'ai' ? 'difficulty' : 'teams');
  }, []);

  const handleSelectFormat = useCallback((chosenFormat: MatchFormat) => {
    soundFx.playClick();
    setFormat(chosenFormat);
  }, []);

  const handleSelectPitch = useCallback((chosenPitch: PitchCondition) => {
    soundFx.playClick();
    setPitchCondition(chosenPitch);
  }, []);

  const handleSelectDifficulty = useCallback((chosenDiff: Difficulty) => {
    soundFx.playClick();
    setDifficulty(chosenDiff);
    setScreen('teams');
  }, []);

  const handleSelectTeam = useCallback(
    (teamId: string) => {
      soundFx.playClick();
      if (homeTeamId === teamId) {
        setHomeTeamId(null);
        return;
      }
      if (awayTeamId === teamId) {
        setAwayTeamId(null);
        return;
      }
      if (!homeTeamId) {
        setHomeTeamId(teamId);
      } else if (!awayTeamId) {
        setAwayTeamId(teamId);
      } else {
        setAwayTeamId(teamId);
      }
    },
    [homeTeamId, awayTeamId]
  );

  const handleClearTeamSlot = useCallback((slot: 'home' | 'away') => {
    soundFx.playClick();
    if (slot === 'home') setHomeTeamId(null);
    else setAwayTeamId(null);
  }, []);

  const handleSelectOvers = useCallback(
    (overs: number) => {
      soundFx.playClick();
      if (format === 'test') {
        const opd = overs === 30 || overs === 60 || overs === 90 ? overs : 90;
        setOversPerDay(opd);
        setTotalOvers(opd);
      } else {
        setTotalOvers(overs);
      }
      setTossFlipping(false);
      setTossCall(null);
      setTossCoinResult(null);
      setTossWinner(null);
      setAiChoice(null);
      setScreen('toss');
    },
    [format]
  );

  const handleCallToss = useCallback(
    (call: 'heads' | 'tails') => {
      if (tossFlipping || tossCoinResult) return;
      soundFx.playCoinFlip();
      setTossCall(call);
      setTossFlipping(true);

      const t = window.setTimeout(() => {
        const result: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
        const winner: 'home' | 'away' = result === call ? 'home' : 'away';
        setTossCoinResult(result);
        setTossWinner(winner);
        setAiChoice(winner === 'away' && mode === 'ai' ? (Math.random() < 0.5 ? 'bat' : 'bowl') : null);
        setTossFlipping(false);
      }, 1600);
      timersRef.current.push(t);
    },
    [tossFlipping, tossCoinResult, mode]
  );

  const handleStartFromToss = useCallback(
    (homeBatsFirst: boolean) => {
      if (!homeTeamId || !awayTeamId) return;
      soundFx.playClick();
      clearTimers();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const initial = createInitialMatchState({
        mode,
        format,
        pitchCondition,
        difficulty,
        homeTeamId,
        awayTeamId,
        totalOvers,
        oversPerDay,
        homeBatsFirst,
        tossWinner,
        tossCoinResult,
        activeTournamentMatchId: activeFixtureId ?? undefined,
      });
      const openingStyle = getBowlingStyle(getActiveInnings(initial).bowlerName);
      setSelectedDeliveryType(openingStyle === 'spin' ? 'off_spin' : 'fast');
      setMatch(initial);
      setIsAnimatingBall(false);
      setAiThinking(false);
      setLastOutcomeBanner(null);
      setPendingScreenAfterMilestone(null);
      setScreen('playing');
    },
    [
      homeTeamId,
      awayTeamId,
      mode,
      format,
      pitchCondition,
      difficulty,
      totalOvers,
      oversPerDay,
      tossWinner,
      tossCoinResult,
      activeFixtureId,
      clearTimers,
    ]
  );

  const triggerDeliveryAnimation = useCallback(
    (deliveryType: DeliveryType, deliveryLength: DeliveryLength, resolution: DeliveryResolution) => {
      pendingResolutionRef.current = resolution;
      setIsAnimatingBall(true);
      animCounterRef.current += 1;
      const id = animCounterRef.current;
      setAnimTrigger({ id, deliveryType, deliveryLength, resolution });

      // Bat contact sound around t=0.7s (45% of 1.55s)
      const contactTimer = window.setTimeout(() => {
        if (resolution.isWicket) {
          soundFx.playWicket();
        } else if (resolution.isBoundarySix) {
          soundFx.playBatHit('massive');
          soundFx.playBoundaryCheer(true);
        } else if (resolution.isBoundaryFour) {
          soundFx.playBatHit('crisp');
          soundFx.playBoundaryCheer(false);
        } else {
          soundFx.playBatHit('soft');
        }
        setLastOutcomeBanner({ id, resolution });
      }, 690);

      const bannerClear = window.setTimeout(() => {
        setLastOutcomeBanner((cur) => (cur?.id === id ? null : cur));
      }, 2250);

      timersRef.current.push(contactTimer, bannerClear);
    },
    []
  );

  const handleAnimationComplete = useCallback(() => {
    const res = pendingResolutionRef.current;
    pendingResolutionRef.current = null;
    setIsAnimatingBall(false);
    if (!res) return;

    setMatch((prev) => {
      if (!prev) return prev;
      const applied = applyDeliveryToMatch(prev, res);
      if (applied.nextState.pendingMilestonePopup) {
        if (applied.enteredInningsBreak) {
          setPendingScreenAfterMilestone('inningsBreak');
        } else if (applied.matchFinished) {
          setPendingScreenAfterMilestone('result');
        }
      } else if (applied.enteredInningsBreak) {
        const t = window.setTimeout(() => setScreen('inningsBreak'), 450);
        timersRef.current.push(t);
      } else if (applied.matchFinished) {
        const t = window.setTimeout(() => setScreen('result'), 550);
        timersRef.current.push(t);
      }
      return applied.nextState;
    });
  }, []);

  const handleSelectShot = useCallback(
    (shot: ShotType) => {
      if (
        !match ||
        isAnimatingBall ||
        aiThinking ||
        match.isPaused ||
        match.pendingMilestonePopup ||
        match.pendingBatterPopup ||
        match.pendingOverPopup ||
        match.pendingDayPopup ||
        screen !== 'playing'
      ) {
        return;
      }
      if (!isPlayerBattingNow(match)) return;

      soundFx.playClick();
      const active = getActiveInnings(match);
      const striker = active.batters[active.strikerIndex];
      const bowlerStyle = getBowlingStyle(active.bowlerName);

      let deliveryType: DeliveryType = match.pendingDeliveryType;
      let deliveryLength: DeliveryLength = match.pendingDeliveryLength;

      if (match.mode === 'ai') {
        const aiDel = chooseAiDelivery(
          match.difficulty,
          Math.random,
          match.pitchCondition,
          bowlerStyle
        );
        deliveryType = aiDel.type;
        deliveryLength = aiDel.length;
      }

      const resolution = resolveDelivery({
        shot,
        deliveryType,
        deliveryLength,
        difficulty: match.difficulty,
        playerIsBatting: true,
        strikerName: striker?.name ?? 'Batter',
        bowlerName: active.bowlerName,
        format: match.format,
        pitchCondition: match.pitchCondition,
        bowlingSide: match.bowlingSide ?? 'over',
      });

      triggerDeliveryAnimation(deliveryType, deliveryLength, resolution);
    },
    [match, isAnimatingBall, aiThinking, screen, triggerDeliveryAnimation]
  );

  const handleBowl = useCallback(() => {
    if (
      !match ||
      isAnimatingBall ||
      aiThinking ||
      match.isPaused ||
      match.pendingMilestonePopup ||
      match.pendingBatterPopup ||
      match.pendingOverPopup ||
      match.pendingDayPopup ||
      screen !== 'playing'
    ) {
      return;
    }
    if (isPlayerBattingNow(match)) return;

    soundFx.playClick();
    const active = getActiveInnings(match);
    const bowlerStyle = getBowlingStyle(active.bowlerName);
    const effectiveDeliveryType: DeliveryType =
      bowlerStyle === 'spin'
        ? isSpinDelivery(selectedDeliveryType)
          ? selectedDeliveryType
          : 'off_spin'
        : isSpinDelivery(selectedDeliveryType)
        ? 'fast'
        : selectedDeliveryType;

    if (match.mode === 'pvp') {
      setMatch((prev) =>
        prev
          ? {
              ...prev,
              pendingDeliveryType: effectiveDeliveryType,
              pendingDeliveryLength: selectedDeliveryLength,
              pvpTurnPhase: 'bat_select',
            }
          : prev
      );
      return;
    }

    // PvAI: player bowls, AI thinks briefly and chooses shot
    setAiThinking(true);
    const t = window.setTimeout(() => {
      setAiThinking(false);
      const currentActive = getActiveInnings(match);
      const striker = currentActive.batters[currentActive.strikerIndex];
      const aiShot = chooseAiShot(match.difficulty, effectiveDeliveryType, selectedDeliveryLength);
      const resolution = resolveDelivery({
        shot: aiShot,
        deliveryType: effectiveDeliveryType,
        deliveryLength: selectedDeliveryLength,
        difficulty: match.difficulty,
        playerIsBatting: false,
        strikerName: striker?.name ?? 'Batter',
        bowlerName: currentActive.bowlerName,
        format: match.format,
        pitchCondition: match.pitchCondition,
        bowlingSide: match.bowlingSide ?? 'over',
      });
      triggerDeliveryAnimation(effectiveDeliveryType, selectedDeliveryLength, resolution);
    }, 360);
    timersRef.current.push(t);
  }, [
    match,
    isAnimatingBall,
    aiThinking,
    screen,
    selectedDeliveryType,
    selectedDeliveryLength,
    triggerDeliveryAnimation,
  ]);

  const handleSelectBowlingSide = useCallback((side: BowlingSide) => {
    soundFx.playClick();
    setMatch((prev) => (prev ? { ...prev, bowlingSide: side } : prev));
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundFx.muted = next;
      return next;
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    soundFx.playClick();
    setMatch((prev) => (prev ? { ...prev, isPaused: !prev.isPaused } : prev));
  }, []);

  const handleStartNextInnings = useCallback(() => {
    soundFx.playClick();
    clearTimers();
    setIsAnimatingBall(false);
    setAiThinking(false);
    setLastOutcomeBanner(null);
    setPendingScreenAfterMilestone(null);
    setMatch((prev) => {
      if (!prev) return prev;
      const next = startNextInnings(prev);
      const style = getBowlingStyle(getActiveInnings(next).bowlerName);
      setSelectedDeliveryType(style === 'spin' ? 'off_spin' : 'fast');
      return next;
    });
    setScreen('playing');
  }, [clearTimers]);

  const handleSelectNextBatter = useCallback((batterIndex: number) => {
    soundFx.playClick();
    setMatch((prev) => (prev ? selectNextBatter(prev, batterIndex) : prev));
  }, []);

  const handleSelectNextBowler = useCallback((bowlerName: string) => {
    soundFx.playClick();
    const style = getBowlingStyle(bowlerName);
    setSelectedDeliveryType((cur) => {
      if (style === 'spin') return isSpinDelivery(cur) ? cur : 'off_spin';
      return isSpinDelivery(cur) ? 'fast' : cur;
    });
    setMatch((prev) => (prev ? selectNextBowler(prev, bowlerName) : prev));
  }, []);

  const handleDismissOverPopup = useCallback(() => {
    soundFx.playClick();
    setMatch((prev) => (prev ? dismissOverPopup(prev) : prev));
  }, []);

  const handleDismissMilestonePopup = useCallback(() => {
    soundFx.playClick();
    setMatch((prev) => (prev ? dismissMilestonePopup(prev) : prev));
    if (pendingScreenAfterMilestone) {
      const nextScr = pendingScreenAfterMilestone;
      setPendingScreenAfterMilestone(null);
      setScreen(nextScr);
    } else if (match?.matchComplete) {
      setScreen('result');
    }
  }, [pendingScreenAfterMilestone, match?.matchComplete]);

  const handleProceedToNewDay = useCallback(() => {
    soundFx.playClick();
    setMatch((prev) => (prev ? advanceTestDayPopupToNewDay(prev) : prev));
  }, []);

  const handleContinueNewDay = useCallback(() => {
    soundFx.playClick();
    setMatch((prev) => (prev ? startTestNewDay(prev) : prev));
  }, []);

  const handleDeclareInnings = useCallback(() => {
    if (
      !match ||
      isAnimatingBall ||
      aiThinking ||
      match.isPaused ||
      match.pendingMilestonePopup ||
      match.pendingBatterPopup ||
      match.pendingOverPopup ||
      match.pendingDayPopup ||
      screen !== 'playing'
    ) {
      return;
    }
    soundFx.playClick();
    clearTimers();
    const res = declareTestInnings(match);
    setMatch(res.nextState);
    if (res.matchFinished) {
      setScreen('result');
    } else if (res.enteredInningsBreak) {
      setScreen('inningsBreak');
    }
  }, [match, isAnimatingBall, aiThinking, screen, clearTimers]);

  const handlePlayAgain = useCallback(() => {
    soundFx.playClick();
    clearTimers();
    setIsAnimatingBall(false);
    setAiThinking(false);
    setLastOutcomeBanner(null);
    setPendingScreenAfterMilestone(null);
    if (!match) return;
    const restarted = createInitialMatchState({
      mode: match.mode,
      format: match.format,
      pitchCondition: match.pitchCondition,
      difficulty: match.difficulty,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      totalOvers: match.totalOvers,
      oversPerDay: match.oversPerDay,
      homeBatsFirst: match.innings1.battingTeamId === match.homeTeamId,
      tossWinner: match.tossWinner,
      tossCoinResult: match.tossCoinResult,
    });
    const openingStyle = getBowlingStyle(getActiveInnings(restarted).bowlerName);
    setSelectedDeliveryType(openingStyle === 'spin' ? 'off_spin' : 'fast');
    setMatch(restarted);
    setScreen('playing');
  }, [match, clearTimers]);

  const handleReturnToTournament = useCallback(() => {
    soundFx.playClick();
    clearTimers();
    setIsAnimatingBall(false);
    setAiThinking(false);
    setLastOutcomeBanner(null);
    if (match && !match.matchComplete) {
      const parked: SavedMatchSession = {
        version: 1,
        screen: screen === 'inningsBreak' ? 'inningsBreak' : 'playing',
        autoResumeOnLoad: false,
        savedAt: Date.now(),
        selectedDeliveryType,
        selectedDeliveryLength,
        match: { ...match, isPaused: false },
      };
      saveMatchSession(parked);
      setSavedSession(parked);
    }
    setMatch(null);
    setActiveFixtureId(null);
    setPendingScreenAfterMilestone(null);
    setScreen('tournamentHub');
  }, [clearTimers, match, screen, selectedDeliveryType, selectedDeliveryLength]);

  const handleExitToMenu = useCallback(() => {
    soundFx.playClick();
    clearTimers();
    setIsAnimatingBall(false);
    setAiThinking(false);
    setLastOutcomeBanner(null);
    if (match && !match.matchComplete) {
      const parked: SavedMatchSession = {
        version: 1,
        screen: screen === 'inningsBreak' ? 'inningsBreak' : 'playing',
        autoResumeOnLoad: false,
        savedAt: Date.now(),
        selectedDeliveryType,
        selectedDeliveryLength,
        match: { ...match, isPaused: false },
      };
      saveMatchSession(parked);
      setSavedSession(parked);
    }
    setMatch(null);
    setActiveFixtureId(null);
    setPendingScreenAfterMilestone(null);
    setScreen('menu');
  }, [clearTimers, match, screen, selectedDeliveryType, selectedDeliveryLength]);

  const handleResumeSavedMatch = useCallback(() => {
    const latest = savedSession ?? loadSavedMatchSession();
    if (!latest) return;
    soundFx.playClick();
    clearTimers();
    setIsAnimatingBall(false);
    setAiThinking(false);
    setLastOutcomeBanner(null);
    setPendingScreenAfterMilestone(null);

    const restoredMatch: MatchState = { ...latest.match, isPaused: false };
    const bowlerStyle = getBowlingStyle(getActiveInnings(restoredMatch).bowlerName);
    const restoredDelivery: DeliveryType =
      bowlerStyle === 'spin'
        ? isSpinDelivery(latest.selectedDeliveryType)
          ? latest.selectedDeliveryType
          : 'off_spin'
        : isSpinDelivery(latest.selectedDeliveryType)
        ? 'fast'
        : latest.selectedDeliveryType;

    setMode(restoredMatch.mode);
    setFormat(restoredMatch.format);
    setPitchCondition(restoredMatch.pitchCondition);
    setDifficulty(restoredMatch.difficulty);
    setHomeTeamId(restoredMatch.homeTeamId);
    setAwayTeamId(restoredMatch.awayTeamId);
    setTotalOvers(restoredMatch.totalOvers);
    setOversPerDay(restoredMatch.oversPerDay);
    setActiveFixtureId(restoredMatch.activeTournamentMatchId ?? null);
    setSelectedDeliveryType(restoredDelivery);
    setSelectedDeliveryLength(latest.selectedDeliveryLength);
    setMatch(restoredMatch);
    setScreen(latest.screen);

    const activeSession: SavedMatchSession = {
      ...latest,
      autoResumeOnLoad: true,
      selectedDeliveryType: restoredDelivery,
      match: restoredMatch,
    };
    saveMatchSession(activeSession);
    setSavedSession(activeSession);
  }, [savedSession, clearTimers]);

  const handleDiscardSavedMatch = useCallback(() => {
    soundFx.playClick();
    clearSavedMatchSession();
    setSavedSession(null);
  }, []);

  // Tournament handlers
  const handleStartTournament = useCallback(
    (params: {
      type: TournamentType;
      userTeamId: string;
      difficulty: Difficulty;
      pitchCondition: PitchCondition;
      oversPerDay?: 30 | 60 | 90;
      testCount?: 3 | 5;
    }) => {
      soundFx.playClick();
      setPitchCondition(params.pitchCondition);
      if (savedSession?.match.activeTournamentMatchId) {
        clearSavedMatchSession();
        setSavedSession(null);
      }
      const created = createTournament(params);
      setTournament(created);
      setScreen('tournamentHub');
    },
    [savedSession]
  );

  const handleChangeTournamentPitch = useCallback((nextPitch: PitchCondition) => {
    soundFx.playClick();
    setPitchCondition(nextPitch);
    setTournament((prev) => (prev ? { ...prev, pitchCondition: nextPitch } : prev));
  }, []);

  const handleResetCareerStats = useCallback(() => {
    soundFx.playClick();
    setStatsArchive((prev) => {
      const next: Record<string, Record<string, TournamentPlayerStat>> =
        tournament && Object.keys(tournament.playerStats ?? {}).length > 0
          ? { [tournament.id]: tournament.playerStats }
          : {};
      try {
        window.localStorage.setItem(CAREER_ARCHIVE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, [tournament]);

  const handlePlayFixture = useCallback(
    (fixture: TournamentFixture) => {
      if (!tournament) return;
      soundFx.playClick();
      const userIsAway = fixture.awayTeamId === tournament.userTeamId;
      const resolvedHome = userIsAway ? fixture.awayTeamId : fixture.homeTeamId;
      const resolvedAway = userIsAway ? fixture.homeTeamId : fixture.awayTeamId;
      const opd =
        tournament.oversPerInningsOrDay === 30 ||
        tournament.oversPerInningsOrDay === 60 ||
        tournament.oversPerInningsOrDay === 90
          ? tournament.oversPerInningsOrDay
          : 90;

      setMode('ai');
      setFormat(tournament.format);
      setPitchCondition(tournament.pitchCondition ?? 'hard');
      setDifficulty(tournament.difficulty);
      setHomeTeamId(resolvedHome);
      setAwayTeamId(resolvedAway);
      setTotalOvers(tournament.oversPerInningsOrDay);
      setOversPerDay(opd);
      setActiveFixtureId(fixture.id);
      setTossFlipping(false);
      setTossCall(null);
      setTossCoinResult(null);
      setTossWinner(null);
      setAiChoice(null);
      setScreen('toss');
    },
    [tournament]
  );

  const handleSimFixture = useCallback(
    (fixtureId: string) => {
      soundFx.playClick();
      if (savedSession?.match.activeTournamentMatchId === fixtureId) {
        clearSavedMatchSession();
        setSavedSession(null);
      }
      setTournament((prev) => (prev ? simulateTournamentFixture(prev, fixtureId) : prev));
    },
    [savedSession]
  );

  const handleSimToUserOrNext = useCallback((stopAtUser: boolean) => {
    soundFx.playClick();
    if (savedSession?.match.activeTournamentMatchId) {
      clearSavedMatchSession();
      setSavedSession(null);
    }
    setTournament((prev) => {
      if (!prev) return prev;
      return stopAtUser ? simulateNextMatches(prev, true) : simulateStage(prev);
    });
  }, [savedSession]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen === 'menu' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if (savedSession) {
          handleResumeSavedMatch();
        } else {
          handleNavigate('mode');
        }
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        handleToggleMute();
        return;
      }

      if (screen === 'playing' && match) {
        if (match.pendingMilestonePopup) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            handleDismissMilestonePopup();
          }
          return;
        }
        if (
          match.pendingBatterPopup ||
          match.pendingOverPopup ||
          match.pendingDayPopup
        ) {
          return;
        }
        if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
          e.preventDefault();
          handleTogglePause();
          return;
        }
        if (match.isPaused) {
          return;
        }

        if (isPlayerBattingNow(match)) {
          const mapped = SHOT_KEYS[e.key];
          if (mapped) {
            e.preventDefault();
            handleSelectShot(mapped);
          }
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleBowl();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screen,
    match,
    savedSession,
    handleResumeSavedMatch,
    handleNavigate,
    handleToggleMute,
    handleTogglePause,
    handleDismissMilestonePopup,
    handleSelectShot,
    handleBowl,
  ]);

  const activeInnings = match ? getActiveInnings(match) : null;
  const teamCtx = { format: match?.format ?? format, totalOvers: match?.totalOvers ?? totalOvers };
  const battingTeam = getTeamById(activeInnings?.battingTeamId ?? homeTeamId ?? 'ind', teamCtx);
  const bowlingTeam = getTeamById(activeInnings?.bowlingTeamId ?? awayTeamId ?? 'aus', teamCtx);
  const strikerHand = activeInnings
    ? getBattingHand(activeInnings.batters[activeInnings.strikerIndex]?.name ?? '')
    : 'right';

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <StadiumCanvas
        isPlaying={screen === 'playing' || screen === 'inningsBreak' || screen === 'result'}
        isPaused={Boolean(
          match?.isPaused ||
            match?.pendingMilestonePopup ||
            match?.pendingBatterPopup ||
            match?.pendingOverPopup ||
            match?.pendingDayPopup
        )}
        format={match?.format ?? format}
        pitchCondition={match?.pitchCondition ?? pitchCondition}
        strikerHand={strikerHand}
        bowlingSide={match?.bowlingSide ?? 'over'}
        battingTeam={battingTeam}
        bowlingTeam={bowlingTeam}
        animTrigger={animTrigger}
        onAnimationComplete={handleAnimationComplete}
      />

      <MenuFlow
        screen={screen}
        mode={mode}
        format={format}
        pitchCondition={pitchCondition}
        difficulty={difficulty}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        totalOvers={totalOvers}
        tossFlipping={tossFlipping}
        tossCall={tossCall}
        tossCoinResult={tossCoinResult}
        tossWinner={tossWinner}
        aiChoice={aiChoice}
        isTournamentMatch={Boolean(activeFixtureId)}
        savedMatch={savedSession}
        onNavigate={handleNavigate}
        onSelectMode={handleSelectMode}
        onSelectFormat={handleSelectFormat}
        onSelectPitch={handleSelectPitch}
        onSelectDifficulty={handleSelectDifficulty}
        onSelectTeam={handleSelectTeam}
        onClearTeamSlot={handleClearTeamSlot}
        onSelectOvers={handleSelectOvers}
        onCallToss={handleCallToss}
        onStartFromToss={handleStartFromToss}
        onQuickStart={() => handleNavigate('mode')}
        onResumeSavedMatch={handleResumeSavedMatch}
        onDiscardSavedMatch={handleDiscardSavedMatch}
      />

      <TournamentHub
        screen={screen}
        tournament={tournament}
        defaultPitch={pitchCondition}
        careerPlayerStats={careerPlayerStats}
        onNavigate={handleNavigate}
        onStartTournament={handleStartTournament}
        onChangeTournamentPitch={handleChangeTournamentPitch}
        onResetCareerStats={handleResetCareerStats}
        onPlayFixture={handlePlayFixture}
        onSimFixture={handleSimFixture}
        onSimToUserOrNext={handleSimToUserOrNext}
      />

      <GameHud
        screen={screen}
        match={match}
        isAnimatingBall={isAnimatingBall}
        aiThinking={aiThinking}
        muted={muted}
        selectedDeliveryType={selectedDeliveryType}
        selectedDeliveryLength={selectedDeliveryLength}
        lastOutcomeBanner={lastOutcomeBanner}
        onSelectShot={handleSelectShot}
        onSelectDeliveryType={(t) => {
          soundFx.playClick();
          setSelectedDeliveryType(t);
        }}
        onSelectDeliveryLength={(l) => {
          soundFx.playClick();
          setSelectedDeliveryLength(l);
        }}
        onSelectBowlingSide={handleSelectBowlingSide}
        onBowl={handleBowl}
        onDeclareInnings={handleDeclareInnings}
        onSelectNextBatter={handleSelectNextBatter}
        onSelectNextBowler={handleSelectNextBowler}
        onDismissOverPopup={handleDismissOverPopup}
        onDismissMilestonePopup={handleDismissMilestonePopup}
        onProceedToNewDay={handleProceedToNewDay}
        onContinueNewDay={handleContinueNewDay}
        onToggleMute={handleToggleMute}
        onTogglePause={handleTogglePause}
        onStartNextInnings={handleStartNextInnings}
        onPlayAgain={handlePlayAgain}
        onReturnToTournament={handleReturnToTournament}
        onExitToMenu={handleExitToMenu}
      />

      <OfflineIndicator />
    </div>
  );
}
