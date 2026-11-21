import React, { useState } from 'react';
import { PITCH_META } from '../game/cricketEngine';
import { getTeamById, getTeamsByLeague } from '../game/teams';
import {
  Difficulty,
  GameMode,
  LeagueId,
  MatchFormat,
  PitchCondition,
  ScreenId,
} from '../game/types';
import { TeamBadge } from './TeamBadge';
import { PWAInstallButton } from './PWAInstallButton';
import {
  ArrowLeft,
  Bot,
  ClipboardList,
  Coins,
  Play,
  RotateCcw,
  Shield,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { formatSavedMatchSummary, SavedMatchSession } from '../game/matchStorage';

interface MenuFlowProps {
  screen: ScreenId;
  mode: GameMode;
  format: MatchFormat;
  pitchCondition: PitchCondition;
  difficulty: Difficulty;
  homeTeamId: string | null;
  awayTeamId: string | null;
  totalOvers: number;
  tossFlipping: boolean;
  tossCall: 'heads' | 'tails' | null;
  tossCoinResult: 'heads' | 'tails' | null;
  tossWinner: 'home' | 'away' | null;
  aiChoice: 'bat' | 'bowl' | null;
  isTournamentMatch?: boolean;
  savedMatch?: SavedMatchSession | null;
  onNavigate: (screen: ScreenId) => void;
  onSelectMode: (mode: GameMode) => void;
  onSelectFormat: (format: MatchFormat) => void;
  onSelectPitch: (pitch: PitchCondition) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onSelectTeam: (teamId: string) => void;
  onClearTeamSlot: (slot: 'home' | 'away') => void;
  onSelectOvers: (overs: number) => void;
  onCallToss: (call: 'heads' | 'tails') => void;
  onStartFromToss: (homeBatsFirst: boolean) => void;
  onQuickStart: () => void;
  onResumeSavedMatch?: () => void;
  onDiscardSavedMatch?: () => void;
}

export const MenuFlow: React.FC<MenuFlowProps> = ({
  screen,
  mode,
  format,
  pitchCondition,
  homeTeamId,
  awayTeamId,
  tossFlipping,
  tossCoinResult,
  tossWinner,
  aiChoice,
  isTournamentMatch,
  savedMatch,
  onNavigate,
  onSelectMode,
  onSelectFormat,
  onSelectPitch,
  onSelectDifficulty,
  onSelectTeam,
  onClearTeamSlot,
  onSelectOvers,
  onCallToss,
  onStartFromToss,
  onQuickStart,
  onResumeSavedMatch,
  onDiscardSavedMatch,
}) => {
  const [league, setLeague] = useState<LeagueId>('international');
  const [showSquads, setShowSquads] = useState(false);
  const [rosterFormat, setRosterFormat] = useState<'t20' | 'odi'>('t20');

  if (
    screen === 'playing' ||
    screen === 'inningsBreak' ||
    screen === 'result' ||
    screen === 'tournamentSelect' ||
    screen === 'tournamentSetup' ||
    screen === 'tournamentHub'
  ) {
    return null;
  }

  const homeTeam = homeTeamId ? getTeamById(homeTeamId) : null;
  const awayTeam = awayTeamId ? getTeamById(awayTeamId) : null;
  const leagueTeams = getTeamsByLeague(
    league,
    league === 'international' && format === 'limited' && rosterFormat === 'odi'
      ? { format: 'limited', totalOvers: 50 }
      : undefined
  );

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center overflow-y-auto p-4 sm:p-6 pt-16 sm:pt-6">
      {screen !== 'menu' && (
        <button
          type="button"
          onClick={() => {
            if (screen === 'mode' || screen === 'rules') onNavigate('menu');
            else if (screen === 'difficulty') onNavigate('mode');
            else if (screen === 'teams') onNavigate(mode === 'ai' ? 'difficulty' : 'mode');
            else if (screen === 'overs') onNavigate('teams');
            else if (screen === 'toss') onNavigate(isTournamentMatch ? 'tournamentHub' : 'overs');
          }}
          className="fixed top-3 left-3 sm:top-5 sm:left-5 z-30 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#09132a]/95 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/15 hover:border-cyan-300 transition-colors text-xs font-semibold tracking-wider whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          BACK
        </button>
      )}

      {/* MAIN MENU */}
      {screen === 'menu' && (
        <main className="my-auto flex flex-col items-center text-center max-w-3xl w-full px-4">
          <h1 className="font-display text-5xl sm:text-7xl md:text-[5.25rem] font-bold tracking-wider text-amber-400 title-glow select-none leading-none whitespace-nowrap">
            CRICKET MAX
          </h1>
          <p className="mt-3 text-xs sm:text-base tracking-[0.28em] sm:tracking-[0.38em] uppercase text-cyan-400 font-semibold whitespace-nowrap">
            Stadium Edition · Offline Ready
          </p>

          <div className="mt-7 sm:mt-9 flex flex-col gap-3 w-full max-w-xs">
            {savedMatch && onResumeSavedMatch && (
              <div
                data-testid="resume-match-card"
                className="flex items-stretch gap-1.5 w-full"
              >
                <button
                  type="button"
                  data-testid="resume-match-btn"
                  onClick={onResumeSavedMatch}
                  className="flex-1 min-w-0 flex items-center gap-2.5 py-3 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 shadow-[0_0_24px_rgba(250,204,21,0.28)]"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold tracking-widest uppercase text-xs leading-tight">
                      Resume Match
                    </div>
                    <div className="text-[11px] font-mono-num font-semibold text-slate-900 truncate mt-0.5">
                      {formatSavedMatchSummary(savedMatch).title}
                    </div>
                    <div className="text-[10px] font-mono-num text-slate-800/85 truncate">
                      {formatSavedMatchSummary(savedMatch).subtitle}
                    </div>
                  </div>
                </button>
                {onDiscardSavedMatch && (
                  <button
                    type="button"
                    aria-label="Discard saved match"
                    title="Discard saved match"
                    onClick={onDiscardSavedMatch}
                    className="px-2.5 rounded-lg bg-[#0d1936]/90 border border-rose-500/45 text-rose-300 hover:bg-rose-500/20 hover:border-rose-400 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              data-start="true"
              onClick={onQuickStart}
              className="inline-flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-lg bg-[#0d1936]/90 border border-amber-400/85 text-amber-300 hover:bg-amber-400 hover:text-slate-950 font-semibold tracking-widest uppercase text-sm transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              {savedMatch ? 'New Match' : 'Start Match'}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('tournamentSelect')}
              className="inline-flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-lg bg-[#0d1936]/90 border border-cyan-400/75 text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 font-semibold tracking-widest uppercase text-sm transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <Trophy className="w-4 h-4" aria-hidden="true" />
              Tournaments & Series
            </button>

            <button
              type="button"
              onClick={() => onNavigate('rules')}
              className="inline-flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-lg bg-[#0d1936]/90 border border-amber-400/70 text-amber-100 hover:border-amber-300 hover:bg-[#132248] font-semibold tracking-widest uppercase text-sm transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <ClipboardList className="w-4 h-4 text-cyan-300" aria-hidden="true" />
              How to Play
            </button>

            <PWAInstallButton />
          </div>

          <p className="mt-6 pb-2 text-[11px] sm:text-xs text-slate-400/85 tracking-wide">
            Enter / Space to Start · Keys 1–8 for Shots · P to Pause
          </p>
        </main>
      )}

      {/* SELECT MODE */}
      {screen === 'mode' && (
        <main className="flex flex-col items-center w-full max-w-xl">
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-amber-400 mb-5">
            SELECT MODE
          </h2>

          {/* Match Format Selector */}
          <div className="inline-flex items-center p-1 rounded-xl bg-[#081024]/95 border border-cyan-500/40 mb-6">
            <button
              type="button"
              onClick={() => onSelectFormat('limited')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer whitespace-nowrap ${
                format === 'limited'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Limited Overs
            </button>
            <button
              type="button"
              onClick={() => onSelectFormat('test')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer whitespace-nowrap ${
                format === 'test'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              Test Match (5 Days)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-md">
            <button
              type="button"
              onClick={() => onSelectMode('pvp')}
              className="flex flex-col items-center justify-center gap-4 p-7 rounded-xl bg-[#0b1530]/95 border border-cyan-500/40 hover:border-cyan-300 hover:bg-[#112047] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <Users className="w-11 h-11 text-sky-400" aria-hidden="true" />
              <span className="text-base font-semibold text-cyan-300 tracking-wide">
                Player vs Player
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectMode('ai')}
              className="flex flex-col items-center justify-center gap-4 p-7 rounded-xl bg-[#0b1530]/95 border border-cyan-500/40 hover:border-cyan-300 hover:bg-[#112047] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <Bot className="w-11 h-11 text-amber-400" aria-hidden="true" />
              <span className="text-base font-semibold text-cyan-300 tracking-wide">
                Player vs AI
              </span>
            </button>
          </div>
        </main>
      )}

      {/* SELECT DIFFICULTY */}
      {screen === 'difficulty' && (
        <main className="flex flex-col items-center w-full max-w-2xl">
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-amber-400 mb-8">
            SELECT DIFFICULTY
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
            <button
              type="button"
              onClick={() => onSelectDifficulty('easy')}
              className="flex flex-col items-center text-center gap-3 p-6 rounded-xl bg-[#0b1530]/95 border border-emerald-500/45 hover:border-emerald-300 hover:bg-[#10223f] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <span className="w-9 h-9 rounded-full bg-emerald-500 border-2 border-emerald-200/60" aria-hidden="true" />
              <span className="font-semibold tracking-wider text-emerald-400 text-base">EASY</span>
              <span className="text-xs text-slate-400 leading-relaxed">
                Relaxed AI
                <br />
                Great for beginners
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectDifficulty('medium')}
              className="flex flex-col items-center text-center gap-3 p-6 rounded-xl bg-[#0b1530]/95 border border-amber-500/45 hover:border-amber-300 hover:bg-[#10223f] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <span className="w-9 h-9 rounded-full bg-amber-400 border-2 border-amber-100/60" aria-hidden="true" />
              <span className="font-semibold tracking-wider text-amber-400 text-base">MEDIUM</span>
              <span className="text-xs text-slate-400 leading-relaxed">
                Balanced AI
                <br />
                Fair challenge
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectDifficulty('hard')}
              className="flex flex-col items-center text-center gap-3 p-6 rounded-xl bg-[#0b1530]/95 border border-rose-500/45 hover:border-rose-300 hover:bg-[#10223f] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <span className="w-9 h-9 rounded-full bg-rose-500 border-2 border-rose-200/60" aria-hidden="true" />
              <span className="font-semibold tracking-wider text-rose-400 text-base">HARD</span>
              <span className="text-xs text-slate-400 leading-relaxed">
                Smart AI
                <br />
                For pros only!
              </span>
            </button>
          </div>
        </main>
      )}

      {/* SELECT TEAMS */}
      {screen === 'teams' && (
        <main className="flex flex-col items-center w-full max-w-xl max-h-[88vh]">
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-amber-400 mb-5">
            SELECT TEAMS
          </h2>

          {/* Matchup Bar */}
          <div className="w-full flex items-center justify-between gap-3 px-5 py-3 rounded-xl bg-[#0b1530]/95 border border-cyan-500/35 mb-4">
            <button
              type="button"
              onClick={() => homeTeam && onClearTeamSlot('home')}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200 cursor-pointer truncate"
            >
              {homeTeam ? (
                <>
                  <TeamBadge team={homeTeam} size="sm" />
                  <span className="truncate">{homeTeam.name}</span>
                </>
              ) : (
                <span className="text-emerald-400/80">Pick Home Team</span>
              )}
            </button>

            <span className="font-display text-xl font-bold text-amber-400 shrink-0 px-2">VS</span>

            <button
              type="button"
              onClick={() => awayTeam && onClearTeamSlot('away')}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-rose-300 hover:text-rose-200 cursor-pointer truncate"
            >
              {awayTeam ? (
                <>
                  <TeamBadge team={awayTeam} size="sm" />
                  <span className="truncate">{awayTeam.name}</span>
                </>
              ) : (
                <span className="text-rose-400/80">Pick Away Team</span>
              )}
            </button>
          </div>

          {/* League Segmented Toggle + Squads Toggle */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <div className="inline-flex items-center p-1 rounded-lg bg-[#081024] border border-cyan-500/35">
              <button
                type="button"
                onClick={() => setLeague('international')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors whitespace-nowrap cursor-pointer ${
                  league === 'international'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                International
              </button>
              <button
                type="button"
                onClick={() => setLeague('ipl')}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors whitespace-nowrap cursor-pointer ${
                  league === 'ipl'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                IPL
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSquads((s) => !s)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold tracking-wide transition-colors whitespace-nowrap cursor-pointer ${
                showSquads
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-[#0b1530]/95 border-cyan-500/35 text-cyan-300 hover:border-cyan-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              {showSquads ? 'Hide Rosters' : 'View All Rosters'}
            </button>
          </div>

          {showSquads ? (
            <div className="w-full space-y-3 overflow-y-auto pr-1 max-h-[46vh]">
              {league === 'international' && format === 'limited' && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#081024] border border-cyan-500/30 text-xs">
                  <span className="text-slate-300 font-medium">International Format Squad:</span>
                  <div className="inline-flex items-center p-0.5 rounded-md bg-[#0b1530] border border-cyan-500/35">
                    <button
                      type="button"
                      onClick={() => setRosterFormat('t20')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        rosterFormat === 't20'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      T20 / Short
                    </button>
                    <button
                      type="button"
                      data-testid="roster-odi-toggle"
                      onClick={() => setRosterFormat('odi')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        rosterFormat === 'odi'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      ODI (50 Ov)
                    </button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {leagueTeams.map((team) => (
                  <div
                    key={team.id}
                    className="p-3.5 rounded-lg bg-[#0b1530]/95 border border-cyan-500/30 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-700/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamBadge team={team} size="sm" />
                        <span className="text-sm font-semibold text-white truncate">{team.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTeam(team.id);
                          setShowSquads(false);
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 cursor-pointer shrink-0"
                      >
                        {homeTeamId === team.id || awayTeamId === team.id ? 'Selected' : 'Pick'}
                      </button>
                    </div>
                    <ol className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-300">
                      {team.batters.map((player, idx) => (
                        <li key={player} className="truncate font-mono-num">
                          <span className="text-slate-500 mr-1">{idx + 1}.</span>
                          {player}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 max-h-[46vh]">
            {leagueTeams.map((team) => {
              const isHome = homeTeamId === team.id;
              const isAway = awayTeamId === team.id;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => onSelectTeam(team.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                    isHome
                      ? 'bg-emerald-950/60 border-emerald-400 text-white'
                      : isAway
                      ? 'bg-rose-950/60 border-rose-400 text-white'
                      : 'bg-[#0b1530]/95 border-cyan-500/30 hover:border-cyan-300 hover:bg-[#112047]'
                  }`}
                >
                  <TeamBadge team={team} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{team.name}</div>
                    <div className="text-[11px] font-mono-num text-cyan-300/90">
                      {team.code}
                      {isHome ? ' · HOME' : isAway ? ' · AWAY' : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          )}

          <button
            type="button"
            disabled={!homeTeamId || !awayTeamId}
            onClick={() => onNavigate('overs')}
            className={`mt-5 w-full py-3 px-6 rounded-lg font-semibold tracking-widest uppercase text-xs transition-colors border whitespace-nowrap ${
              homeTeamId && awayTeamId
                ? 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300 cursor-pointer'
                : 'bg-[#0b1530]/70 text-amber-400/50 border-amber-500/30 cursor-not-allowed'
            }`}
          >
            {homeTeamId && awayTeamId
              ? 'CONTINUE TO OVERS ▶'
              : 'SELECT BOTH TEAMS TO CONTINUE ▶'}
          </button>
        </main>
      )}

      {/* SELECT OVERS / OVERS PER DAY & PITCH CONDITION */}
      {screen === 'overs' && (
        <main className="flex flex-col items-center w-full max-w-2xl">
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-amber-400 mb-2 text-center">
            {format === 'test' ? 'SELECT OVERS PER DAY' : 'SELECT OVERS'}
          </h2>
          <p className="text-xs text-cyan-300 mb-5 tracking-wide text-center">
            {format === 'test'
              ? '5-Day Test Match · 4 Innings · Unlimited Overs per Innings'
              : 'Choose Pitch Condition & Limited-Overs Length'}
          </p>

          {/* Pitch Condition Selector */}
          <div className="w-full max-w-xl mb-6">
            <div className="text-[11px] font-semibold tracking-[0.2em] text-slate-300 uppercase mb-2 text-center">
              Pitch Condition
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {(['hard', 'green', 'dry'] as PitchCondition[]).map((pitch) => {
                const meta = PITCH_META[pitch];
                const selected = pitchCondition === pitch;
                return (
                  <button
                    key={pitch}
                    type="button"
                    onClick={() => onSelectPitch(pitch)}
                    className={`flex flex-col items-center text-center px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                      selected
                        ? pitch === 'green'
                          ? 'bg-emerald-950/70 border-emerald-400 text-white'
                          : pitch === 'dry'
                          ? 'bg-orange-950/70 border-orange-400 text-white'
                          : 'bg-amber-950/70 border-amber-400 text-white'
                        : 'bg-[#0b1530]/95 border-cyan-500/30 hover:border-cyan-300 text-slate-300'
                    }`}
                  >
                    <span className="font-display text-lg font-bold tracking-wider">
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-cyan-200/90 font-medium">
                      {meta.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-300 text-center">
              {PITCH_META[pitchCondition].description}
            </p>
          </div>

          {format === 'test' ? (
            <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
              {[30, 60, 90].map((ov) => (
                <button
                  key={ov}
                  type="button"
                  onClick={() => onSelectOvers(ov)}
                  className="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-[#0b1530]/95 border border-cyan-500/40 hover:border-amber-400 hover:bg-[#112047] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  <span className="font-display font-mono-num text-4xl font-bold text-amber-400">
                    {ov}
                  </span>
                  <span className="mt-1.5 text-[11px] tracking-[0.18em] text-slate-300 uppercase whitespace-nowrap">
                    OVERS / DAY
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 w-full max-w-xl">
              {[5, 10, 20, 30, 50].map((ov) => (
                <button
                  key={ov}
                  type="button"
                  onClick={() => onSelectOvers(ov)}
                  className="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-[#0b1530]/95 border border-cyan-500/40 hover:border-amber-400 hover:bg-[#112047] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  <span className="font-display font-mono-num text-4xl font-bold text-amber-400">
                    {ov}
                  </span>
                  <span className="mt-1.5 text-[11px] tracking-[0.22em] text-slate-400 uppercase">
                    OVERS
                  </span>
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {/* TOSS TIME */}
      {screen === 'toss' && (
        <main className="flex flex-col items-center text-center w-full max-w-lg">
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-amber-400 mb-6">
            TOSS TIME
          </h2>

          <div
            className={`w-24 h-24 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 border-4 border-yellow-200/80 shadow-[0_0_30px_rgba(250,204,21,0.35)] flex items-center justify-center mb-5 ${
              tossFlipping ? 'animate-coin-flip' : ''
            }`}
          >
            <Coins className="w-10 h-10 text-amber-950" aria-hidden="true" />
          </div>

          <p className="text-xs tracking-[0.25em] text-slate-300 uppercase mb-5">
            {tossFlipping
              ? 'FLIPPING COIN...'
              : tossCoinResult
              ? 'TOSS COMPLETE'
              : 'CALL THE TOSS'}
          </p>

          {!tossCoinResult && !tossFlipping && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onCallToss('heads')}
                className="px-7 py-3 rounded-lg bg-[#0b1530]/95 border border-cyan-400/60 text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 font-semibold tracking-widest uppercase text-sm transition-colors cursor-pointer"
              >
                HEADS
              </button>
              <button
                type="button"
                onClick={() => onCallToss('tails')}
                className="px-7 py-3 rounded-lg bg-[#0b1530]/95 border border-cyan-400/60 text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 font-semibold tracking-widest uppercase text-sm transition-colors cursor-pointer"
              >
                TAILS
              </button>
            </div>
          )}

          {tossCoinResult && !tossFlipping && (
            <div className="flex flex-col items-center gap-5">
              <div className="flex items-center gap-2.5 text-xl sm:text-2xl font-display font-bold tracking-wide text-amber-400">
                <span>{tossCoinResult.toUpperCase()}!</span>
                {tossWinner === 'home' && homeTeam && (
                  <>
                    <TeamBadge team={homeTeam} size="sm" />
                    <span>{homeTeam.code} WON THE TOSS</span>
                  </>
                )}
                {tossWinner === 'away' && awayTeam && (
                  <>
                    <TeamBadge team={awayTeam} size="sm" />
                    <span>{awayTeam.code} WON THE TOSS</span>
                  </>
                )}
              </div>

              {mode === 'pvp' || tossWinner === 'home' ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onStartFromToss(tossWinner === 'home')}
                    className="px-6 py-2.5 rounded-lg bg-[#0b1530]/95 border border-cyan-400/70 text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 font-semibold tracking-wider uppercase text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    BAT FIRST
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartFromToss(tossWinner !== 'home')}
                    className="px-6 py-2.5 rounded-lg bg-[#0b1530]/95 border border-cyan-400/70 text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 font-semibold tracking-wider uppercase text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    BOWL FIRST
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-cyan-200">
                    {awayTeam?.name} elected to {aiChoice === 'bat' ? 'bat' : 'bowl'} first.
                  </p>
                  <button
                    type="button"
                    onClick={() => onStartFromToss(aiChoice === 'bowl')}
                    className="px-7 py-2.5 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 font-semibold tracking-wider uppercase text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    START MATCH ▶
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* HOW TO PLAY */}
      {screen === 'rules' && (
        <main className="flex flex-col items-center w-full max-w-lg max-h-[86vh]">
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-amber-400 mb-6">
            HOW TO PLAY
          </h2>
          <div className="w-full rounded-xl bg-[#0b1530]/95 border border-cyan-500/35 p-6 overflow-y-auto space-y-5 text-sm text-slate-200">
            <section>
              <h3 className="font-display text-lg tracking-wider text-amber-400 mb-2">BATTING</h3>
              <ul className="space-y-1.5 text-slate-300 text-xs sm:text-sm">
                <li>• Choose your shot type from 8 different shots (Keys 1–8)</li>
                <li>• <span className="text-emerald-400 font-semibold">DRIVE</span> = Off/On side, good for full balls</li>
                <li>• <span className="text-amber-400 font-semibold">PULL</span> = Powerful, great vs short balls</li>
                <li>• <span className="text-purple-400 font-semibold">SWEEP</span> = Effective vs spin</li>
                <li>• <span className="text-cyan-400 font-semibold">CUT</span> = Off-side force</li>
                <li>• <span className="text-yellow-300 font-semibold">LOFT</span> = Risk for big runs!</li>
                <li>• <span className="text-slate-200 font-semibold">DEFEND</span> = Safe, usually dot ball</li>
                <li>• <span className="text-orange-400 font-semibold">FLICK</span> = Leg-side finesse</li>
                <li>• <span className="text-rose-400 font-semibold">HOOK</span> = Aggressive, risky!</li>
              </ul>
            </section>

            <section>
              <h3 className="font-display text-lg tracking-wider text-amber-400 mb-2">BOWLING & PITCHES</h3>
              <ul className="space-y-1.5 text-slate-300 text-xs sm:text-sm">
                <li>• Pace & Seam: Fast, Swing, Seam, Yorker, Bouncer</li>
                <li>• Spin Variations: Off Spin, Leg Spin, Googly, Doosra, Arm Ball, Carrom</li>
                <li>• Pitch Conditions: Hard (bounce/boundaries), Green (seam/swing), Dry (sharp spin)</li>
                <li>• Choose length (Full, Good, Short) & click BOWL (or Space)</li>
              </ul>
            </section>

            <section>
              <h3 className="font-display text-lg tracking-wider text-amber-400 mb-2">TOSS</h3>
              <ul className="space-y-1.5 text-slate-300 text-xs sm:text-sm">
                <li>• Call Heads or Tails</li>
                <li>• Winner chooses to Bat or Bowl first</li>
              </ul>
            </section>
          </div>
        </main>
      )}
    </div>
  );
};
