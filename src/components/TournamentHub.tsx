import React, { useEffect, useRef, useState } from 'react';
import { computePlayerOfTheTournament } from '../game/awards';
import { formatOvers, PITCH_META, RAIN_CHANCE_OPTIONS } from '../game/cricketEngine';
import { getTeamById, TEAMS } from '../game/teams';
import {
  formatBattingAverage,
  formatEconomy,
  formatStrikeRate,
  sortStandings,
} from '../game/tournaments';
import {
  Difficulty,
  PitchCondition,
  RainChance,
  ScreenId,
  TournamentFixture,
  TournamentPlayerStat,
  TournamentState,
  TournamentType,
} from '../game/types';
import { TeamBadge } from './TeamBadge';
import { TrophyCelebration } from './TrophyCelebration';
import { ArrowLeft, Award, BarChart3, CloudRain, FastForward, Play, Shield, Swords, Trash2, Trophy } from 'lucide-react';

interface TournamentHubProps {
  screen: ScreenId;
  tournament: TournamentState | null;
  defaultPitch: PitchCondition;
  defaultRainChance: RainChance;
  careerPlayerStats: Record<string, TournamentPlayerStat>;
  onNavigate: (screen: ScreenId) => void;
  onStartTournament: (params: {
    type: TournamentType;
    userTeamId: string;
    difficulty: Difficulty;
    pitchCondition: PitchCondition;
    rainChance: RainChance;
    oversPerDay?: 30 | 60 | 90;
    testCount?: 3 | 5;
  }) => void;
  onChangeTournamentPitch: (pitch: PitchCondition) => void;
  onChangeTournamentRainChance: (rain: RainChance) => void;
  onResetCareerStats?: () => void;
  onPlayFixture: (fixture: TournamentFixture) => void;
  onSimFixture: (fixtureId: string) => void;
  onSimToUserOrNext: (stopAtUser: boolean) => void;
}

const TOURNAMENT_CATALOG: Array<{
  type: TournamentType;
  title: string;
  subtitle: string;
  formatLabel: string;
  eligibleTeamIds: string[];
  isTest: boolean;
}> = [
  {
    type: 't20_wc',
    title: 'T20 World Cup',
    subtitle: '2 Groups of 6 · Semi-Finals · Final',
    formatLabel: '20 Overs · 12 Intl Teams',
    eligibleTeamIds: ['ind', 'pak', 'eng', 'sl', 'ban', 'ire', 'aus', 'sa', 'nz', 'wi', 'afg', 'zim'],
    isTest: false,
  },
  {
    type: 'odi_wc',
    title: 'ODI World Cup',
    subtitle: '10-Team Round Robin · Semi-Finals · Final',
    formatLabel: '50 Overs · 10 Intl Teams',
    eligibleTeamIds: ['ind', 'aus', 'eng', 'pak', 'sa', 'nz', 'wi', 'sl', 'ban', 'afg'],
    isTest: false,
  },
  {
    type: 'ipl',
    title: 'IPL Tournament',
    subtitle: '10 Franchises · Q1 · Eliminator · Q2 · Final',
    formatLabel: '20 Overs · 10 IPL Teams',
    eligibleTeamIds: ['mi', 'csk', 'rcb', 'kkr', 'dc', 'rr', 'srh', 'pbks', 'lsg', 'gt'],
    isTest: false,
  },
  {
    type: 'ashes',
    title: 'The Ashes Cup',
    subtitle: '3 or 5-Test Bilateral Series · England vs Australia',
    formatLabel: 'Test Mode · 3 / 5 Tests · 30/60/90 Ov/Day',
    eligibleTeamIds: ['eng', 'aus'],
    isTest: true,
  },
  {
    type: 'bgt',
    title: 'Border-Gavaskar Trophy',
    subtitle: '3 or 5-Test Bilateral Series · India vs Australia',
    formatLabel: 'Test Mode · 3 / 5 Tests · 30/60/90 Ov/Day',
    eligibleTeamIds: ['ind', 'aus'],
    isTest: true,
  },
];

export const TournamentHub: React.FC<TournamentHubProps> = ({
  screen,
  tournament,
  defaultPitch,
  defaultRainChance,
  careerPlayerStats,
  onNavigate,
  onStartTournament,
  onChangeTournamentPitch,
  onChangeTournamentRainChance,
  onResetCareerStats,
  onPlayFixture,
  onSimFixture,
  onSimToUserOrNext,
}) => {
  const [selectedType, setSelectedType] = useState<TournamentType>('t20_wc');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('ind');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [pitchCondition, setPitchCondition] = useState<PitchCondition>(defaultPitch);
  const [rainChance, setRainChance] = useState<RainChance>(defaultRainChance);
  const [oversPerDay, setOversPerDay] = useState<30 | 60 | 90>(90);
  const [testCount, setTestCount] = useState<3 | 5>(5);
  const [hubTab, setHubTab] = useState<'fixtures' | 'table' | 'stats'>('fixtures');
  const [statsScope, setStatsScope] = useState<'tournament' | 'career'>('tournament');
  const [statsTeamFilter, setStatsTeamFilter] = useState<'all' | 'user'>('all');
  const [showTrophyModal, setShowTrophyModal] = useState(false);

  const prevTournamentStatusRef = useRef<{ id: string; stage: string } | null>(null);

  useEffect(() => {
    if (!tournament) {
      prevTournamentStatusRef.current = null;
      setShowTrophyModal(false);
      return;
    }
    const prev = prevTournamentStatusRef.current;
    if (
      prev &&
      prev.id === tournament.id &&
      prev.stage !== 'complete' &&
      tournament.stage === 'complete'
    ) {
      setShowTrophyModal(true);
    }
    prevTournamentStatusRef.current = { id: tournament.id, stage: tournament.stage };
  }, [tournament]);

  if (
    screen !== 'tournamentSelect' &&
    screen !== 'tournamentSetup' &&
    screen !== 'tournamentHub'
  ) {
    return null;
  }

  const playerOfTournament =
    tournament && tournament.stage === 'complete'
      ? computePlayerOfTheTournament(tournament)
      : null;

  const activeCatalog =
    TOURNAMENT_CATALOG.find((c) => c.type === selectedType) ?? TOURNAMENT_CATALOG[0];

  const handleChooseType = (type: TournamentType) => {
    const cat = TOURNAMENT_CATALOG.find((c) => c.type === type)!;
    setSelectedType(type);
    if (!cat.eligibleTeamIds.includes(selectedTeamId)) {
      setSelectedTeamId(cat.eligibleTeamIds[0]);
    }
    onNavigate('tournamentSetup');
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-start sm:justify-center land:!justify-start p-3 sm:p-6 land:p-3 overflow-y-auto">
      <button
        type="button"
        onClick={() => {
          if (screen === 'tournamentSelect') onNavigate('menu');
          else if (screen === 'tournamentSetup') onNavigate('tournamentSelect');
          else onNavigate('menu');
        }}
        className="self-start mb-2 sm:mb-0 land:!static land:self-start land:mb-1.5 sm:fixed sm:top-4 sm:left-4 z-30 inline-flex items-center gap-2 px-3.5 py-2 land:px-3 land:py-1.5 rounded-lg bg-[#09132a]/92 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/15 hover:border-cyan-300 transition-colors text-xs font-semibold tracking-wider whitespace-nowrap cursor-pointer shrink-0"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        {screen === 'tournamentHub' ? 'MENU' : 'BACK'}
      </button>

      {/* 1. TOURNAMENT & SERIES CATALOG */}
      {screen === 'tournamentSelect' && (
        <main className="w-full max-w-3xl flex flex-col items-center pt-2 sm:pt-10 land:pt-0 pb-4">
          <h2 className="font-display text-4xl sm:text-5xl land:text-3xl font-bold tracking-wider text-amber-400 mb-2 land:mb-1 text-center">
            TOURNAMENTS & SERIES
          </h2>
          <p className="text-xs sm:text-sm text-cyan-300/90 mb-5 land:mb-3 text-center">
            World Cup Structures, IPL Playoffs, and 3 or 5-Test Iconic Rivalries
          </p>

          {tournament && (
            <div className="w-full mb-4 land:mb-3 px-4 py-3 land:py-2 rounded-xl bg-emerald-950/55 border border-emerald-400/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <TeamBadge team={getTeamById(tournament.userTeamId)} size="sm" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Active Event Saved
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {tournament.title} · {tournament.fixtures.filter((f) => f.completed).length}/
                    {tournament.fixtures.length} Played
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tournamentHub')}
                className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                Resume Event ▶
              </button>
            </div>
          )}

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5 land:gap-2.5">
            {TOURNAMENT_CATALOG.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => handleChooseType(item.type)}
                className="flex flex-col items-start text-left gap-2 land:gap-1 p-5 land:p-3.5 rounded-xl bg-[#0b1530]/95 border border-cyan-500/35 hover:border-amber-400 hover:bg-[#101f44] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="font-display text-2xl land:text-xl font-bold tracking-wide text-amber-400">
                    {item.title}
                  </span>
                  {item.isTest ? (
                    <Shield className="w-5 h-5 text-rose-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <Trophy className="w-5 h-5 text-cyan-300 shrink-0" aria-hidden="true" />
                  )}
                </div>
                <div className="text-xs text-slate-200 font-medium">{item.subtitle}</div>
                <div className="text-[11px] font-mono-num text-cyan-300/90">{item.formatLabel}</div>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* 2. TOURNAMENT / SERIES SETUP */}
      {screen === 'tournamentSetup' && (
        <main className="w-full max-w-xl land:max-w-2xl flex flex-col items-center pt-2 sm:pt-10 land:pt-0 pb-4">
          <h2 className="font-display text-3xl sm:text-4xl land:text-2xl font-bold tracking-wider text-amber-400 mb-1 text-center">
            {activeCatalog.title.toUpperCase()}
          </h2>
          <p className="text-xs text-cyan-300 mb-5 land:mb-3 text-center">{activeCatalog.subtitle}</p>

          {/* Select Your Team */}
          <div className="w-full mb-4 land:mb-3">
            <div className="text-xs font-semibold tracking-wider uppercase text-slate-300 mb-2">
              Choose Your Squad
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 land:grid-cols-3 gap-2 max-h-[30vh] land:max-h-none overflow-y-auto land:overflow-visible pr-1">
              {activeCatalog.eligibleTeamIds.map((tid) => {
                const team = getTeamById(tid);
                const selected = selectedTeamId === tid;
                return (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => setSelectedTeamId(tid)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'bg-emerald-950/65 border-emerald-400 text-white'
                        : 'bg-[#0b1530]/95 border-cyan-500/30 hover:border-cyan-300 text-slate-200'
                    }`}
                  >
                    <TeamBadge team={team} size="sm" />
                    <span className="text-xs font-semibold truncate">{team.name}</span>
                  </button>
                );
              })}
            </div>
            {(() => {
              const previewTeam = getTeamById(selectedTeamId, {
                format: activeCatalog.isTest ? 'test' : 'limited',
                totalOvers: selectedType === 'odi_wc' ? 50 : activeCatalog.isTest ? oversPerDay : 20,
                tournamentType: selectedType,
              });
              return (
                <div
                  data-testid="tournament-squad-preview"
                  className="mt-2.5 p-2.5 rounded-lg bg-[#081024]/95 border border-cyan-500/25"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono-num text-cyan-300 mb-1.5">
                    <span>{previewTeam.name} Playing XI</span>
                    <span className="text-amber-300">
                      {selectedType === 'odi_wc' ? 'ODI Squad (50 Ov)' : '2026 Squad'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-0.5 text-[11px] text-slate-300 font-mono-num">
                    {previewTeam.batters.map((player, idx) => (
                      <div key={player} className="truncate">
                        <span className="text-slate-500 mr-1">{idx + 1}.</span>
                        {player}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Series Length & Overs per Day (for Test Series) */}
          {activeCatalog.isTest && (
            <>
              <div className="w-full mb-4">
                <div className="text-xs font-semibold tracking-wider uppercase text-slate-300 mb-2">
                  Series Length
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {([3, 5] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      data-testid={`test-count-${cnt}`}
                      onClick={() => setTestCount(cnt)}
                      className={`py-2.5 px-3 rounded-lg border font-mono-num text-sm font-bold transition-colors cursor-pointer ${
                        testCount === cnt
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-[#0b1530]/95 border-cyan-500/35 text-cyan-200 hover:border-cyan-300'
                      }`}
                    >
                      {cnt} TEST SERIES
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full mb-4">
                <div className="text-xs font-semibold tracking-wider uppercase text-slate-300 mb-2">
                  Overs Per Day (5-Day Test)
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {([30, 60, 90] as const).map((opd) => (
                    <button
                      key={opd}
                      type="button"
                      onClick={() => setOversPerDay(opd)}
                      className={`py-2.5 px-3 rounded-lg border font-mono-num text-sm font-bold transition-colors cursor-pointer ${
                        oversPerDay === opd
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-[#0b1530]/95 border-cyan-500/35 text-cyan-200 hover:border-cyan-300'
                      }`}
                    >
                      {opd} OV / DAY
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Pitch Condition */}
          <div className="w-full mb-4">
            <div className="text-xs font-semibold tracking-wider uppercase text-slate-300 mb-2">
              Pitch Condition
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {(['hard', 'green', 'dry'] as PitchCondition[]).map((p) => {
                const meta = PITCH_META[p];
                const active = pitchCondition === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPitchCondition(p)}
                    className={`py-2 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-[#0b1530]/95 border-cyan-500/35 text-slate-200 hover:border-cyan-300'
                    }`}
                  >
                    <div className="text-xs font-bold tracking-wider uppercase">{meta.label}</div>
                    <div className={`text-[10px] ${active ? 'text-slate-900 font-semibold' : 'text-cyan-300/80'}`}>
                      {meta.shortLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rain Probability & DLS Method */}
          <div className="w-full mb-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-slate-300">
                <CloudRain className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
                Rain Chance {!activeCatalog.isTest && '(DLS Method)'}
              </span>
              <span className="text-[11px] font-mono-num text-cyan-300">
                {rainChance}% Probability
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {RAIN_CHANCE_OPTIONS.map((pct) => {
                const active = rainChance === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    data-testid={`tournament-rain-chance-${pct}`}
                    onClick={() => setRainChance(pct)}
                    className={`py-2 px-1 rounded-lg border font-mono-num text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-[#0b1530]/95 border-cyan-500/35 text-slate-200 hover:border-cyan-300'
                    }`}
                  >
                    {pct}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty */}
          <div className="w-full mb-5">
            <div className="text-xs font-semibold tracking-wider uppercase text-slate-300 mb-2">
              AI Difficulty
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                    difficulty === d
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                      : 'bg-[#0b1530]/95 border-cyan-500/35 text-slate-300 hover:border-cyan-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onStartTournament({
                type: selectedType,
                userTeamId: selectedTeamId,
                difficulty,
                pitchCondition,
                rainChance,
                oversPerDay,
                testCount: activeCatalog.isTest ? testCount : undefined,
              })
            }
            className="w-full py-3 px-6 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-lg font-bold tracking-widest uppercase cursor-pointer"
          >
            {activeCatalog.isTest ? `BEGIN ${testCount}-TEST SERIES ▶` : 'START TOURNAMENT ▶'}
          </button>
        </main>
      )}

      {/* 3. ACTIVE TOURNAMENT / SERIES HUB */}
      {screen === 'tournamentHub' && tournament && (
        <main className="w-full max-w-5xl min-h-0 sm:h-[88vh] land:h-auto flex flex-col gap-3 pt-1 sm:pt-10 land:pt-0 pb-6 sm:pb-0 land:pb-4">
          {/* Top Hub Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 land:gap-2 px-4 land:px-3 py-3 land:py-2 rounded-xl bg-[#0b1530]/95 border border-cyan-500/35">
            <div className="flex items-center gap-3">
              <TeamBadge team={getTeamById(tournament.userTeamId)} size="md" />
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-amber-400 leading-none">
                  {tournament.title.toUpperCase()}
                </h2>
                <p className="text-xs text-cyan-300 font-mono-num mt-1">
                  {tournament.format === 'test'
                    ? `${tournament.testMatchCount ?? tournament.fixtures.length}-Test Series · ${tournament.oversPerInningsOrDay} Overs/Day`
                    : `${tournament.oversPerInningsOrDay} Overs`}
                  {' · '}Stage: {tournament.stage.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Pitch & Rain Selectors + Sim Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center p-0.5 rounded-lg bg-[#081024] border border-cyan-500/30">
                {(['hard', 'green', 'dry'] as PitchCondition[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onChangeTournamentPitch(p)}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
                      (tournament.pitchCondition ?? 'hard') === p
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {PITCH_META[p].label}
                  </button>
                ))}
              </div>

              {tournament.format === 'limited' && (
                <div
                  title="Rain Chance (DLS Method)"
                  className="inline-flex items-center p-0.5 rounded-lg bg-[#081024] border border-cyan-500/30"
                >
                  <CloudRain className="w-3 h-3 text-cyan-300 mx-1.5 shrink-0" aria-hidden="true" />
                  {RAIN_CHANCE_OPTIONS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => onChangeTournamentRainChance(pct)}
                      className={`px-1.5 py-1 rounded text-[10px] font-mono-num font-bold cursor-pointer ${
                        (tournament.rainChance ?? 0) === pct
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setHubTab((cur) => (cur === 'stats' ? 'fixtures' : 'stats'))}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold uppercase tracking-wider cursor-pointer whitespace-nowrap ${
                  hubTab === 'stats'
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                    : 'bg-[#102046] border-cyan-400/50 text-cyan-200 hover:border-cyan-300'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
                {hubTab === 'stats' ? 'Schedule & Table' : 'Player Stats'}
              </button>

              {tournament.stage !== 'complete' && (
                <>
                  {tournament.format !== 'test' && (
                    <button
                      type="button"
                      onClick={() => onSimToUserOrNext(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#102046] border border-cyan-400/50 text-cyan-200 hover:border-cyan-300 text-xs font-semibold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    >
                      <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
                      Sim to My Match
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSimToUserOrNext(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#102046] border border-amber-400/50 text-amber-300 hover:border-amber-300 text-xs font-semibold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  >
                    <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
                    {tournament.format === 'test' ? 'Sim Series' : 'Sim Stage'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onNavigate('tournamentSelect')}
                className="px-3 py-2 rounded-lg bg-[#081229] border border-slate-600 text-slate-300 hover:border-slate-400 text-xs font-semibold uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                New Event
              </button>
            </div>
          </div>

          {/* Champion Banner / Trophy Ceremony Trigger */}
          {tournament.stage === 'complete' && tournament.championTeamId && (
            <div className="px-4 py-3 rounded-xl bg-amber-400/15 border border-amber-400 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Award className="w-6 h-6 text-amber-400 shrink-0" aria-hidden="true" />
                <div className="font-display text-xl sm:text-2xl font-bold tracking-wider text-amber-300">
                  {tournament.championTeamId === 'draw'
                    ? `${tournament.title.toUpperCase()} DRAWN!`
                    : `${getTeamById(tournament.championTeamId).name.toUpperCase()} LIFT THE TROPHY!`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTrophyModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                Trophy Ceremony
              </button>
            </div>
          )}

          {/* Inline Trophy & Player of the Tournament Showcase (shown on Fixtures tab when complete) */}
          {tournament.stage === 'complete' &&
            tournament.championTeamId &&
            hubTab === 'fixtures' && (
              <TrophyCelebration
                tournament={tournament}
                playerOfTournament={playerOfTournament}
              />
            )}

          {/* Mobile Tabs */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setHubTab('fixtures')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider border ${
                hubTab === 'fixtures'
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                  : 'bg-[#0b1530] text-slate-300 border-cyan-500/30'
              }`}
            >
              Fixtures
            </button>
            <button
              type="button"
              onClick={() => setHubTab('table')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider border ${
                hubTab === 'table'
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                  : 'bg-[#0b1530] text-slate-300 border-cyan-500/30'
              }`}
            >
              {tournament.format === 'test' ? 'Tally' : 'Table'}
            </button>
            <button
              type="button"
              onClick={() => setHubTab('stats')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider border ${
                hubTab === 'stats'
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                  : 'bg-[#0b1530] text-slate-300 border-cyan-500/30'
              }`}
            >
              Stats
            </button>
          </div>

          {/* Main Content: Player Stats View OR 2-Column Schedule & Standings */}
          {hubTab === 'stats' ? (
            <PlayerStatsView
              tournament={tournament}
              careerPlayerStats={careerPlayerStats}
              statsScope={statsScope}
              statsTeamFilter={statsTeamFilter}
              onChangeScope={setStatsScope}
              onChangeTeamFilter={setStatsTeamFilter}
              onResetCareerStats={onResetCareerStats}
            />
          ) : (
            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-12 gap-4">
              {/* Standings / Series Tally */}
              <section
                className={`sm:col-span-5 rounded-xl bg-[#0b1530]/95 border border-cyan-500/35 p-4 flex flex-col min-h-0 ${
                  hubTab === 'table' ? 'flex' : 'hidden sm:flex'
                }`}
              >
                <h3 className="font-display text-xl font-bold tracking-wider text-amber-400 mb-3">
                  {tournament.format === 'test' ? 'SERIES STANDINGS' : 'POINTS TABLE'}
                </h3>

                <div className="overflow-y-auto space-y-4 pr-1">
                  {tournament.type === 't20_wc' ? (
                    (['A', 'B'] as const).map((grp) => (
                      <div key={grp} className="space-y-1.5">
                        <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                          Group {grp} (Top 2 Qualify)
                        </div>
                        <StandingsTable
                          rows={sortStandings(tournament.standings.filter((r) => r.group === grp))}
                          qualifyCount={2}
                          userTeamId={tournament.userTeamId}
                          isTest={false}
                        />
                      </div>
                    ))
                  ) : (
                    <StandingsTable
                      rows={sortStandings(tournament.standings)}
                      qualifyCount={tournament.format === 'test' ? 1 : 4}
                      userTeamId={tournament.userTeamId}
                      isTest={tournament.format === 'test'}
                    />
                  )}
                </div>
              </section>

              {/* Fixtures & Knockout Bracket */}
              <section
                className={`sm:col-span-7 rounded-xl bg-[#0b1530]/95 border border-cyan-500/35 p-4 flex flex-col min-h-0 ${
                  hubTab === 'fixtures' ? 'flex' : 'hidden sm:flex'
                }`}
              >
                <h3 className="font-display text-xl font-bold tracking-wider text-amber-400 mb-3">
                  {tournament.format === 'test'
                    ? `${tournament.testMatchCount ?? tournament.fixtures.length}-TEST SCHEDULE`
                    : 'FIXTURES & KNOCKOUTS'}
                </h3>

                <div className="overflow-y-auto space-y-2.5 pr-1">
                  {tournament.fixtures
                    .slice()
                    .sort((a, b) => {
                      if (a.completed !== b.completed) {
                        return Number(a.completed) - Number(b.completed);
                      }
                      const rank: Record<string, number> = {
                        final: 6,
                        q2: 5,
                        sf2: 4,
                        sf1: 4,
                        q1: 3,
                        eliminator: 2,
                        test_match: 1,
                        group: 0,
                      };
                      if (a.completed && b.completed) {
                        return (rank[b.round] ?? 0) - (rank[a.round] ?? 0);
                      }
                      return 0;
                    })
                    .map((fix) => {
                      const home = getTeamById(fix.homeTeamId);
                      const away = getTeamById(fix.awayTeamId);
                      const involvesUser =
                        fix.homeTeamId === tournament.userTeamId ||
                        fix.awayTeamId === tournament.userTeamId;
                      const isKnockout = fix.round !== 'group' && fix.round !== 'test_match';

                      return (
                        <div
                          key={fix.id}
                          className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            isKnockout
                              ? 'bg-amber-950/25 border-amber-400/50'
                              : involvesUser
                              ? 'bg-cyan-950/35 border-cyan-400/50'
                              : 'bg-[#070f24] border-slate-700/60'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-[11px] font-mono-num text-cyan-300/90 flex items-center gap-2">
                              <span>{fix.label}</span>
                              {fix.venue && <span className="text-slate-400">· {fix.venue}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                              <TeamBadge team={home} size="sm" />
                              <span>{home.code}</span>
                              {fix.homeScoreText && (
                                <span className="font-mono-num text-xs text-amber-300">
                                  {fix.homeScoreText}
                                </span>
                              )}
                              <span className="text-slate-400 text-xs">vs</span>
                              <TeamBadge team={away} size="sm" />
                              <span>{away.code}</span>
                              {fix.awayScoreText && (
                                <span className="font-mono-num text-xs text-amber-300">
                                  {fix.awayScoreText}
                                </span>
                              )}
                            </div>
                            {fix.completed && (
                              <div className="text-xs text-emerald-300">{fix.summary}</div>
                            )}
                            {fix.completed && fix.potm && (
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-num text-amber-300/95">
                                <Award className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
                                <span>
                                  POTM: <strong className="text-white">{fix.potm.playerName}</strong> ({fix.potm.summary})
                                </span>
                              </div>
                            )}
                          </div>

                          {!fix.completed && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => onPlayFixture(fix)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold uppercase tracking-wider cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                                Play
                              </button>
                              <button
                                type="button"
                                onClick={() => onSimFixture(fix.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#102046] border border-cyan-500/40 text-cyan-200 hover:border-cyan-300 text-xs font-semibold uppercase tracking-wider cursor-pointer"
                              >
                                <Swords className="w-3 h-3" aria-hidden="true" />
                                Sim
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </section>
            </div>
          )}

          {showTrophyModal && tournament.stage === 'complete' && tournament.championTeamId && (
            <TrophyCelebration
              tournament={tournament}
              playerOfTournament={playerOfTournament}
              asModal
              onClose={() => setShowTrophyModal(false)}
            />
          )}
        </main>
      )}
    </div>
  );
};

const StandingsTable: React.FC<{
  rows: ReturnType<typeof sortStandings>;
  qualifyCount: number;
  userTeamId: string;
  isTest: boolean;
}> = ({ rows, qualifyCount, userTeamId, isTest }) => (
  <table className="w-full text-left border-collapse text-xs">
    <thead>
      <tr className="border-b border-slate-700/70 text-[10px] text-slate-400 font-mono-num uppercase">
        <th className="py-1.5 pr-2">#</th>
        <th className="py-1.5 pr-2">Team</th>
        <th className="py-1.5 px-1.5 text-right">P</th>
        <th className="py-1.5 px-1.5 text-right">W</th>
        <th className="py-1.5 px-1.5 text-right">L</th>
        {isTest && <th className="py-1.5 px-1.5 text-right">D</th>}
        <th className="py-1.5 px-1.5 text-right">Pts</th>
        {!isTest && <th className="py-1.5 pl-1.5 text-right">NRR</th>}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, idx) => {
        const team = TEAMS.find((t) => t.id === row.teamId) ?? TEAMS[0];
        const isUser = row.teamId === userTeamId;
        const qualifies = idx < qualifyCount;
        return (
          <tr
            key={row.teamId}
            className={`border-b border-slate-800/60 font-mono-num ${
              isUser ? 'bg-cyan-950/45 text-white font-semibold' : 'text-slate-200'
            }`}
          >
            <td className={`py-1.5 pr-2 ${qualifies ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
              {idx + 1}
            </td>
            <td className="py-1.5 pr-2">
              <div className="flex items-center gap-1.5">
                <TeamBadge team={team} size="sm" />
                <span>{team.code}</span>
              </div>
            </td>
            <td className="py-1.5 px-1.5 text-right">{row.played}</td>
            <td className="py-1.5 px-1.5 text-right text-emerald-300">{row.won}</td>
            <td className="py-1.5 px-1.5 text-right text-rose-300">{row.lost}</td>
            {isTest && <td className="py-1.5 px-1.5 text-right text-slate-300">{row.drawn}</td>}
            <td className="py-1.5 px-1.5 text-right font-bold text-amber-300">{row.points}</td>
            {!isTest && (
              <td className="py-1.5 pl-1.5 text-right text-[11px] text-slate-300">
                {row.nrr >= 0 ? `+${row.nrr.toFixed(2)}` : row.nrr.toFixed(2)}
              </td>
            )}
          </tr>
        );
      })}
    </tbody>
  </table>
);

const PlayerStatsView: React.FC<{
  tournament: TournamentState;
  careerPlayerStats: Record<string, TournamentPlayerStat>;
  statsScope: 'tournament' | 'career';
  statsTeamFilter: 'all' | 'user';
  onChangeScope: (scope: 'tournament' | 'career') => void;
  onChangeTeamFilter: (filter: 'all' | 'user') => void;
  onResetCareerStats?: () => void;
}> = ({
  tournament,
  careerPlayerStats,
  statsScope,
  statsTeamFilter,
  onChangeScope,
  onChangeTeamFilter,
  onResetCareerStats,
}) => {
  const sourceStats = statsScope === 'career' ? careerPlayerStats : tournament.playerStats ?? {};
  const entries = Object.values(sourceStats).filter((s) =>
    statsTeamFilter === 'user' ? s.teamId === tournament.userTeamId : true
  );

  const battingLeaders = entries
    .filter((s) => s.inningsBatted > 0)
    .sort((a, b) => {
      if (b.runs !== a.runs) return b.runs - a.runs;
      return b.ballsFaced === 0 ? -1 : a.ballsFaced === 0 ? 1 : b.runs / b.ballsFaced - a.runs / a.ballsFaced;
    })
    .slice(0, 30);

  const bowlingLeaders = entries
    .filter((s) => s.ballsBowled > 0)
    .sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      const econA = a.runsConceded / Math.max(1, a.ballsBowled);
      const econB = b.runsConceded / Math.max(1, b.ballsBowled);
      return econA - econB;
    })
    .slice(0, 30);

  return (
    <section
      data-testid="player-stats-panel"
      className="flex-none lg:flex-1 lg:min-h-0 rounded-xl bg-[#0b1530]/95 border border-cyan-500/35 p-4 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
        <div>
          <h3 className="font-display text-xl font-bold tracking-wider text-amber-400">
            PLAYER STATISTICS LEADERBOARD
          </h3>
          <p className="text-[11px] text-slate-300">
            Persistent Batting Averages, Strike Rates & Total Wickets across matches
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#070f24] border border-cyan-500/35">
            <button
              type="button"
              onClick={() => onChangeScope('tournament')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                statsScope === 'tournament'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              This Event
            </button>
            <button
              type="button"
              onClick={() => onChangeScope('career')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                statsScope === 'career'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              All-Time Career
            </button>
          </div>

          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#070f24] border border-cyan-500/35">
            <button
              type="button"
              onClick={() => onChangeTeamFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                statsTeamFilter === 'all'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              All Teams
            </button>
            <button
              type="button"
              onClick={() => onChangeTeamFilter('user')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                statsTeamFilter === 'user'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              My Squad ({getTeamById(tournament.userTeamId).code})
            </button>
          </div>

          {statsScope === 'career' && onResetCareerStats && Object.keys(careerPlayerStats).length > 0 && (
            <button
              type="button"
              onClick={onResetCareerStats}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 hover:border-rose-400 text-xs font-semibold cursor-pointer"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              Reset Career
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 text-sm">
          No match statistics recorded yet. Play or simulate a fixture to populate batting averages, strike rates, and bowling wickets.
        </div>
      ) : (
        <div className="flex-none lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Batting Leaderboard */}
          <div className="rounded-lg bg-[#070f24] border border-cyan-500/25 p-3 flex flex-col min-h-[240px] max-h-[340px] lg:min-h-0 lg:max-h-none">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
              Batting Leaders (Avg & Strike Rate)
            </div>
            <div className="overflow-auto flex-1 pr-1">
              <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-700/70 text-[10px] text-slate-400 font-mono-num uppercase">
                    <th className="py-1.5 pr-1">#</th>
                    <th className="py-1.5 pr-1.5">Batter</th>
                    <th className="py-1.5 px-1 text-right whitespace-nowrap">Inn</th>
                    <th className="py-1.5 px-1 text-right whitespace-nowrap">Runs</th>
                    <th className="py-1.5 px-1 text-right whitespace-nowrap">Avg</th>
                    <th className="py-1.5 px-1 text-right whitespace-nowrap">SR</th>
                    <th className="py-1.5 pl-1 text-right whitespace-nowrap">HS</th>
                  </tr>
                </thead>
                <tbody>
                  {battingLeaders.map((stat, idx) => {
                    const team = getTeamById(stat.teamId);
                    const isUser = stat.teamId === tournament.userTeamId;
                    return (
                      <tr
                        key={`${stat.teamId}:${stat.playerName}`}
                        className={`border-b border-slate-800/60 font-mono-num ${
                          isUser ? 'bg-cyan-950/35 text-white' : 'text-slate-200'
                        }`}
                      >
                        <td className="py-1.5 pr-1 text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 pr-1.5 font-sans">
                          <div className="flex items-center gap-1 min-w-0 max-w-[112px] sm:max-w-none">
                            <span
                              className="text-[9px] sm:text-[10px] font-mono-num px-1 rounded bg-slate-800 text-cyan-300 shrink-0"
                            >
                              {team.code}
                            </span>
                            <span className="truncate font-medium">{stat.playerName}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-1 text-right text-slate-300">{stat.inningsBatted}</td>
                        <td className="py-1.5 px-1 text-right font-bold text-amber-300">{stat.runs}</td>
                        <td className="py-1.5 px-1 text-right text-emerald-300">
                          {formatBattingAverage(stat)}
                        </td>
                        <td className="py-1.5 px-1 text-right text-cyan-300">
                          {formatStrikeRate(stat)}
                        </td>
                        <td className="py-1.5 pl-1 text-right text-slate-300">
                          {stat.highScore}
                          {stat.highScoreNotOut ? '*' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bowling Leaderboard */}
          <div className="rounded-lg bg-[#070f24] border border-cyan-500/25 p-3 flex flex-col min-h-[240px] max-h-[340px] lg:min-h-0 lg:max-h-none">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">
              Bowling Leaders (Total Wickets & Economy)
            </div>
            <div className="overflow-auto flex-1 pr-1">
              <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-700/70 text-[10px] text-slate-400 font-mono-num uppercase">
                    <th className="py-1.5 pr-1">#</th>
                    <th className="py-1.5 pr-1.5">Bowler</th>
                    <th className="py-1.5 px-1 text-right whitespace-nowrap">Mat</th>
                    <th className="py-1.5 px-1 text-right whitespace-nowrap">Ov</th>
                    <th className="py-1.5 px-1 text-right whitespace-nowrap">Wkts</th>
                    <th className="py-1.5 px-1 text-right whitespace-nowrap">Runs</th>
                    <th className="py-1.5 pl-1 text-right whitespace-nowrap">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {bowlingLeaders.map((stat, idx) => {
                    const team = getTeamById(stat.teamId);
                    const isUser = stat.teamId === tournament.userTeamId;
                    return (
                      <tr
                        key={`${stat.teamId}:${stat.playerName}`}
                        className={`border-b border-slate-800/60 font-mono-num ${
                          isUser ? 'bg-cyan-950/35 text-white' : 'text-slate-200'
                        }`}
                      >
                        <td className="py-1.5 pr-1 text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 pr-1.5 font-sans">
                          <div className="flex items-center gap-1 min-w-0 max-w-[112px] sm:max-w-none">
                            <span
                              className="text-[9px] sm:text-[10px] font-mono-num px-1 rounded bg-slate-800 text-cyan-300 shrink-0"
                            >
                              {team.code}
                            </span>
                            <span className="truncate font-medium">{stat.playerName}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-1 text-right text-slate-300">{stat.matches}</td>
                        <td className="py-1.5 px-1 text-right text-slate-300">
                          {formatOvers(stat.ballsBowled)}
                        </td>
                        <td className="py-1.5 px-1 text-right font-bold text-rose-300">
                          {stat.wickets}
                        </td>
                        <td className="py-1.5 px-1 text-right text-slate-300">
                          {stat.runsConceded}
                        </td>
                        <td className="py-1.5 pl-1 text-right text-cyan-300">
                          {formatEconomy(stat)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
