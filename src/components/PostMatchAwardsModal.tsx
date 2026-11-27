import React from 'react';
import { Award, Star, Trophy, X } from 'lucide-react';
import { getTeamById } from '../game/teams';
import { MatchFormat, PostMatchAwardsSummary } from '../game/types';
import { TeamBadge } from './TeamBadge';

interface PostMatchAwardsModalProps {
  awards: PostMatchAwardsSummary;
  resultSummary: string;
  format: MatchFormat;
  totalOvers: number;
  onClose: () => void;
}

export const PostMatchAwardsModal: React.FC<PostMatchAwardsModalProps> = ({
  awards,
  resultSummary,
  format,
  totalOvers,
  onClose,
}) => {
  const { playerOfTheMatch: potm, bestBatter, bestBowler, topPerformers } = awards;
  const teamCtx = { format, totalOvers };
  const potmTeam = getTeamById(potm.teamId, teamCtx);

  const runsVal = potm.runs ?? 0;
  const ballsVal = potm.ballsFaced ?? 0;
  const srVal = (potm.strikeRate ?? 0).toFixed(1);
  const wicketsVal = potm.wickets ?? 0;
  const ballsBowledVal = potm.ballsBowled ?? 0;
  const runsConcVal = potm.runsConceded ?? 0;
  const oversText = potm.oversBowled ?? '0.0';
  const foursVal = potm.fours ?? 0;
  const sixesVal = potm.sixes ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post-Match Awards Ceremony"
      data-testid="post-match-awards-modal"
      className="pointer-events-auto fixed inset-0 z-40 bg-[#020612]/90 flex items-center justify-center p-3 sm:p-4 land:p-2"
    >
      <div className="animate-modal-pop w-full max-w-xl land:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-xl bg-[#0b1530] border-2 border-amber-400/80 p-4 sm:p-6 land:p-3.5 space-y-3 sm:space-y-4 land:space-y-2.5 shadow-[0_0_48px_rgba(250,204,21,0.3)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-700/60 pb-2.5 sm:pb-3 land:pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 land:w-9 land:h-9 rounded-lg bg-amber-400/15 border border-amber-400/60 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6 land:w-5 land:h-5 text-amber-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono-num uppercase tracking-widest text-cyan-300 font-bold">
                Post-Match Presentation
              </div>
              <h2 className="font-display text-2xl sm:text-3xl land:text-xl font-bold tracking-wider text-amber-400 leading-none">
                PLAYER OF THE MATCH
              </h2>
              <p className="text-xs land:text-[11px] text-slate-300 truncate mt-1 land:mt-0.5">
                {resultSummary}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close post-match awards"
            data-testid="close-awards-modal-btn"
            onClick={onClose}
            className="w-8 h-8 land:w-7 land:h-7 rounded-md bg-[#101e42] border border-cyan-500/35 text-slate-200 hover:border-cyan-300 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Winner Card */}
        <div className="rounded-xl bg-[#070f24] border border-amber-400/55 p-3 sm:p-4 land:p-2.5 space-y-2.5 sm:space-y-3 land:space-y-2">
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <TeamBadge team={potmTeam} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono-num uppercase tracking-wider text-amber-300 font-bold">
                    {potmTeam.name}
                  </span>
                  {potm.roleTag && (
                    <span className="text-[10px] font-mono-num uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/35 text-cyan-200">
                      {potm.roleTag}
                    </span>
                  )}
                </div>
                <div
                  data-testid="awards-potm-name"
                  className="font-display text-2xl sm:text-3xl land:text-xl font-bold tracking-wide text-white mt-0.5 leading-tight"
                >
                  {potm.playerName}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 px-2.5 sm:px-3 land:px-2 py-1 sm:py-1.5 land:py-1 rounded-lg bg-[#0d1c3d] border border-amber-400/40 ml-auto">
              <div className="text-[9px] font-mono-num uppercase tracking-widest text-slate-400">
                Impact
              </div>
              <div className="font-mono-num text-base sm:text-lg land:text-base font-bold text-amber-300 tabular-nums">
                {potm.points.toFixed(1)} pts
              </div>
            </div>
          </div>

          {/* Key Stats: Runs, Wickets, Strike Rate + Economy/Boundaries */}
          <div className="grid grid-cols-2 sm:grid-cols-4 land:grid-cols-4 gap-2 text-left">
            <div
              data-testid="awards-stat-runs"
              className="p-2 sm:p-2.5 land:p-2 rounded-lg bg-[#0c1a3a] border border-slate-700/70"
            >
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                Runs
              </div>
              <div className="font-mono-num text-xl land:text-lg font-bold text-amber-300 tabular-nums mt-0.5">
                {runsVal}
                {potm.notOut && ballsVal > 0 ? '*' : ''}
              </div>
              <div className="text-[10px] font-mono-num text-slate-300">
                {ballsVal > 0 ? `${ballsVal} balls · ${foursVal}×4 ${sixesVal}×6` : 'Did not bat'}
              </div>
            </div>

            <div
              data-testid="awards-stat-wickets"
              className="p-2 sm:p-2.5 land:p-2 rounded-lg bg-[#0c1a3a] border border-slate-700/70"
            >
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                Wickets
              </div>
              <div className="font-mono-num text-xl land:text-lg font-bold text-rose-400 tabular-nums mt-0.5">
                {wicketsVal}
                {ballsBowledVal > 0 ? `-${runsConcVal}` : ''}
              </div>
              <div className="text-[10px] font-mono-num text-slate-300">
                {ballsBowledVal > 0 ? `${oversText} overs` : 'Did not bowl'}
              </div>
            </div>

            <div
              data-testid="awards-stat-sr"
              className="p-2 sm:p-2.5 land:p-2 rounded-lg bg-[#0c1a3a] border border-slate-700/70"
            >
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                Strike Rate
              </div>
              <div className="font-mono-num text-xl land:text-lg font-bold text-cyan-300 tabular-nums mt-0.5">
                {ballsVal > 0 ? srVal : '0.0'}
              </div>
              <div className="text-[10px] font-mono-num text-slate-300">
                {ballsVal > 0 ? 'Runs / 100 balls' : 'No balls faced'}
              </div>
            </div>

            <div className="p-2 sm:p-2.5 land:p-2 rounded-lg bg-[#0c1a3a] border border-slate-700/70">
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                {ballsBowledVal > 0 ? 'Economy' : 'Boundaries'}
              </div>
              <div className="font-mono-num text-xl land:text-lg font-bold text-emerald-300 tabular-nums mt-0.5">
                {ballsBowledVal > 0 && potm.economy !== null && potm.economy !== undefined
                  ? potm.economy.toFixed(2)
                  : `${foursVal + sixesVal}`}
              </div>
              <div className="text-[10px] font-mono-num text-slate-300">
                {ballsBowledVal > 0 ? 'Runs per over' : `${foursVal} fours · ${sixesVal} sixes`}
              </div>
            </div>
          </div>
        </div>

        {/* Match Honours: Best Batter & Best Bowler */}
        {(bestBatter || bestBowler) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 land:grid-cols-2 gap-2.5 land:gap-2 text-left">
            {bestBatter && (
              <div className="p-3 land:p-2 rounded-lg bg-[#070f24] border border-cyan-500/30 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono-num uppercase tracking-wider text-cyan-300 font-bold inline-flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-300" aria-hidden="true" />
                    Best Batter
                  </div>
                  <div className="text-sm land:text-xs font-bold text-white truncate">
                    {bestBatter.playerName}{' '}
                    <span className="text-[10px] font-mono-num text-slate-400">
                      ({getTeamById(bestBatter.teamId, teamCtx).code})
                    </span>
                  </div>
                </div>
                <div className="text-right font-mono-num shrink-0">
                  <div className="text-sm land:text-xs font-bold text-amber-300">
                    {bestBatter.runs}
                    {bestBatter.notOut ? '*' : ''}({bestBatter.ballsFaced})
                  </div>
                  <div className="text-[10px] text-slate-400">SR {bestBatter.strikeRate.toFixed(1)}</div>
                </div>
              </div>
            )}

            {bestBowler && (
              <div className="p-3 land:p-2 rounded-lg bg-[#070f24] border border-cyan-500/30 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono-num uppercase tracking-wider text-rose-300 font-bold inline-flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-rose-300" aria-hidden="true" />
                    Best Bowler
                  </div>
                  <div className="text-sm land:text-xs font-bold text-white truncate">
                    {bestBowler.playerName}{' '}
                    <span className="text-[10px] font-mono-num text-slate-400">
                      ({getTeamById(bestBowler.teamId, teamCtx).code})
                    </span>
                  </div>
                </div>
                <div className="text-right font-mono-num shrink-0">
                  <div className="text-sm land:text-xs font-bold text-rose-300">
                    {bestBowler.wickets}-{bestBowler.runsConceded} ({bestBowler.oversBowled})
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Econ {bestBowler.economy !== null ? bestBowler.economy.toFixed(2) : '—'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top 3 Match Impact Leaderboard */}
        {topPerformers.length > 1 && (
          <div className="p-3 land:p-2 rounded-lg bg-[#070f24] border border-slate-700/60 space-y-1.5">
            <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400 font-bold">
              Top Match Performers
            </div>
            <div className="divide-y divide-slate-800/80">
              {topPerformers.map((p, idx) => (
                <div
                  key={`${p.teamId}:${p.playerName}`}
                  className="flex items-center justify-between gap-2 py-1.5 land:py-1 text-xs font-mono-num"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="text-amber-300 font-bold w-4 shrink-0">#{idx + 1}</span>
                    <span className="text-white font-sans font-semibold truncate">{p.playerName}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      ({getTeamById(p.teamId, teamCtx).code})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-[11px] tabular-nums">
                    <span className="text-slate-300">
                      {p.runs}r · {p.wickets}w
                      <span className="hidden sm:inline"> · SR {p.strikeRate.toFixed(1)}</span>
                    </span>
                    <span className="text-amber-300 font-bold">{p.points.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 land:py-2 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-lg land:text-base font-bold tracking-wider uppercase cursor-pointer"
        >
          BACK TO MATCH RESULT ▶
        </button>
      </div>
    </div>
  );
};
