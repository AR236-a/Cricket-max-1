import React from 'react';
import { getTeamById } from '../game/teams';
import { PlayerOfTournamentAward, Team, TournamentState } from '../game/types';
import { Award, Crown, Sparkles, Trophy, X } from 'lucide-react';
import { TeamBadge } from './TeamBadge';

interface TrophyLiftIllustrationProps {
  team: Team;
  isTest: boolean;
}

export const TrophyLiftIllustration: React.FC<TrophyLiftIllustrationProps> = ({ team, isTest }) => {
  const jersey = isTest ? '#f1f5f9' : team.primaryColor;
  const trim = isTest ? team.primaryColor : team.secondaryColor;
  const capColor = team.primaryColor;

  return (
    <svg
      viewBox="0 0 360 190"
      className="w-full max-w-[340px] h-auto mx-auto drop-shadow-[0_8px_24px_rgba(250,204,21,0.22)]"
      role="img"
      aria-label={`${team.name} players lifting the championship trophy`}
    >
      <defs>
        <linearGradient id="trophyGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
        <radialGradient id="stadiumGlow" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="rgba(250, 204, 21, 0.34)" />
          <stop offset="65%" stopColor="rgba(56, 189, 248, 0.12)" />
          <stop offset="100%" stopColor="rgba(6, 15, 36, 0)" />
        </radialGradient>
      </defs>

      {/* Stadium Spotlight Backdrop */}
      <rect x="0" y="0" width="360" height="190" rx="14" fill="#071128" />
      <rect x="0" y="0" width="360" height="190" rx="14" fill="url(#stadiumGlow)" />

      {/* Confetti & Spotlights */}
      <circle cx="48" cy="36" r="3" fill="#facc15" opacity="0.85" />
      <circle cx="92" cy="24" r="2.5" fill="#38bdf8" opacity="0.85" />
      <circle cx="272" cy="26" r="2.5" fill="#4ade80" opacity="0.85" />
      <circle cx="312" cy="40" r="3" fill="#facc15" opacity="0.85" />
      <rect x="64" y="48" width="6" height="3" rx="1" fill="#f472b6" transform="rotate(-24 64 48)" />
      <rect x="290" y="54" width="6" height="3" rx="1" fill="#38bdf8" transform="rotate(28 290 54)" />
      <rect x="130" y="20" width="5" height="3" rx="1" fill="#facc15" transform="rotate(18 130 20)" />
      <rect x="230" y="18" width="5" height="3" rx="1" fill="#fb923c" transform="rotate(-15 230 18)" />

      {/* Emerald Outfield Turf & Stage Podium */}
      <ellipse cx="180" cy="176" rx="152" ry="18" fill="#14532d" opacity="0.8" />
      <rect x="86" y="156" width="188" height="22" rx="6" fill="#0f1f44" stroke="#facc15" strokeWidth="1.5" />
      <text
        x="180"
        y="171"
        textAnchor="middle"
        fill="#fde047"
        fontSize="10"
        fontWeight="700"
        letterSpacing="2.5"
        fontFamily="monospace"
      >
        {team.code} CHAMPIONS
      </text>

      {/* Left Teammate Cheering */}
      <g transform="translate(106, 98)">
        <rect x="-12" y="12" width="24" height="36" rx="7" fill={jersey} stroke={trim} strokeWidth="1.5" />
        {/* Raised Left Arm */}
        <path d="M-10 18 L-24 -6" stroke={jersey} strokeWidth="7" strokeLinecap="round" />
        {/* Right Arm Supporting */}
        <path d="M10 18 L22 2" stroke={jersey} strokeWidth="7" strokeLinecap="round" />
        {/* Head + Cap */}
        <circle cx="0" cy="-1" r="10.5" fill="#fdba74" />
        <path d="M-11 -3 C-11 -12 11 -12 11 -3 Z" fill={capColor} />
        <rect x="-1" y="-5" width="13" height="3.2" rx="1.5" fill={trim} />
      </g>

      {/* Right Teammate Cheering */}
      <g transform="translate(254, 98)">
        <rect x="-12" y="12" width="24" height="36" rx="7" fill={jersey} stroke={trim} strokeWidth="1.5" />
        {/* Raised Right Arm */}
        <path d="M10 18 L24 -6" stroke={jersey} strokeWidth="7" strokeLinecap="round" />
        {/* Left Arm Supporting */}
        <path d="M-10 18 L-22 2" stroke={jersey} strokeWidth="7" strokeLinecap="round" />
        {/* Head + Cap */}
        <circle cx="0" cy="-1" r="10.5" fill="#fdba74" />
        <path d="M-11 -3 C-11 -12 11 -12 11 -3 Z" fill={capColor} />
        <rect x="-12" y="-5" width="13" height="3.2" rx="1.5" fill={trim} />
      </g>

      {/* Captain Center Lifting Trophy */}
      <g transform="translate(180, 92)">
        {/* Torso */}
        <rect x="-15" y="12" width="30" height="42" rx="8" fill={jersey} stroke={trim} strokeWidth="2" />
        <rect x="-10" y="22" width="20" height="5" rx="2" fill={trim} />
        {/* Both Arms Hoisting Trophy Overhead */}
        <path d="M-13 17 L-18 -18" stroke={jersey} strokeWidth="8" strokeLinecap="round" />
        <path d="M13 17 L18 -18" stroke={jersey} strokeWidth="8" strokeLinecap="round" />
        <circle cx="-18" cy="-20" r="4" fill="#fdba74" />
        <circle cx="18" cy="-20" r="4" fill="#fdba74" />
        {/* Captain Head + Cap */}
        <circle cx="0" cy="-2" r="11.5" fill="#fdba74" />
        <path d="M-12 -4 C-12 -14 12 -14 12 -4 Z" fill={capColor} />
        <rect x="-12" y="-6" width="24" height="3" rx="1.5" fill="#facc15" />

        {/* Championship Trophy Cup Held High */}
        <g transform="translate(0, -52)">
          {/* Handles */}
          <path d="M-14 4 C-25 4 -25 20 -11 22" fill="none" stroke="url(#trophyGold)" strokeWidth="3.2" />
          <path d="M14 4 C25 4 25 20 11 22" fill="none" stroke="url(#trophyGold)" strokeWidth="3.2" />
          {/* Cup Bowl */}
          <path d="M-15 0 L15 0 L11 24 C8 31 -8 31 -11 24 Z" fill="url(#trophyGold)" stroke="#fef9c3" strokeWidth="1" />
          {/* Stem & Base */}
          <rect x="-3.5" y="28" width="7" height="10" fill="url(#trophyGold)" />
          <rect x="-12" y="37" width="24" height="6" rx="2" fill="#eab308" stroke="#fef08a" strokeWidth="1" />
          {/* Shine */}
          <path d="M-9 5 L-6 18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </g>
      </g>
    </svg>
  );
};

interface TrophyCelebrationProps {
  tournament: TournamentState;
  playerOfTournament: PlayerOfTournamentAward | null;
  asModal?: boolean;
  onClose?: () => void;
}

export const TrophyCelebration: React.FC<TrophyCelebrationProps> = ({
  tournament,
  playerOfTournament,
  asModal = false,
  onClose,
}) => {
  if (tournament.stage !== 'complete' || !tournament.championTeamId) return null;

  const isDraw = tournament.championTeamId === 'draw';
  const championTeam = !isDraw ? getTeamById(tournament.championTeamId) : null;
  const pottTeam = playerOfTournament ? getTeamById(playerOfTournament.teamId) : null;
  const isSeries = tournament.format === 'test';
  const awardHeading = isSeries ? 'PLAYER OF THE SERIES' : 'PLAYER OF THE TOURNAMENT';

  const cardContent = (
    <div
      data-testid={asModal ? 'trophy-ceremony-modal' : 'trophy-celebration-card'}
      className={`rounded-xl bg-[#0b1530]/98 border-2 border-amber-400/80 p-4 sm:p-5 shadow-[0_0_32px_rgba(250,204,21,0.2)] space-y-3.5 ${
        asModal ? 'w-full max-w-2xl max-h-[90vh] overflow-y-auto' : 'w-full'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {championTeam ? (
            <TeamBadge team={championTeam} size="md" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-400/20 border border-amber-400 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-amber-300" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono-num font-bold uppercase tracking-widest text-cyan-300">
              <Sparkles className="w-3 h-3 text-amber-400" aria-hidden="true" />
              {tournament.title} · Champions
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-amber-300 leading-tight">
              {isDraw
                ? `${tournament.title.toUpperCase()} DRAWN!`
                : `${championTeam!.name.toUpperCase()} LIFT THE TROPHY!`}
            </h3>
          </div>
        </div>

        {asModal && onClose && (
          <button
            type="button"
            aria-label="Close trophy presentation"
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-[#101e42] border border-cyan-500/40 text-slate-200 hover:border-cyan-300 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {championTeam && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className={playerOfTournament ? 'md:col-span-7' : 'md:col-span-12'}>
            <TrophyLiftIllustration team={championTeam} isTest={isSeries} />
          </div>

          {playerOfTournament && pottTeam && (
            <div
              data-testid="pott-award-card"
              className="md:col-span-5 rounded-lg bg-[#070f24] border border-cyan-400/45 p-3.5 space-y-2.5 text-left"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono-num font-bold uppercase tracking-widest text-amber-300">
                  <Crown className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  {awardHeading}
                </span>
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              </div>

              <div className="flex items-center gap-2.5">
                <TeamBadge team={pottTeam} size="sm" />
                <div className="min-w-0">
                  <div className="font-display text-xl font-bold tracking-wide text-white truncate">
                    {playerOfTournament.playerName}
                  </div>
                  <div className="text-[11px] font-mono-num text-cyan-300">
                    {pottTeam.name} · {playerOfTournament.matches} Matches
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center font-mono-num text-xs">
                <div className="p-2 rounded bg-[#0c1a3a]">
                  <div className="text-[9px] text-slate-400 uppercase">Runs</div>
                  <div className="font-bold text-amber-300">{playerOfTournament.runs}</div>
                </div>
                <div className="p-2 rounded bg-[#0c1a3a]">
                  <div className="text-[9px] text-slate-400 uppercase">Avg</div>
                  <div className="font-bold text-emerald-300">{playerOfTournament.battingAverage}</div>
                </div>
                <div className="p-2 rounded bg-[#0c1a3a]">
                  <div className="text-[9px] text-slate-400 uppercase">Wkts</div>
                  <div className="font-bold text-rose-300">{playerOfTournament.wickets}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-300 pt-0.5">
                <span>SR: {playerOfTournament.strikeRate}</span>
                <span>Econ: {playerOfTournament.economy}</span>
                <span className="text-amber-300 font-bold">{playerOfTournament.points} pts</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!championTeam && playerOfTournament && pottTeam && (
        <div
          data-testid="pott-award-card"
          className="rounded-lg bg-[#070f24] border border-cyan-400/45 p-3.5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <Crown className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
            <TeamBadge team={pottTeam} size="sm" />
            <div>
              <div className="text-[10px] font-mono-num font-bold uppercase tracking-widest text-amber-300">
                {awardHeading}
              </div>
              <div className="font-display text-xl font-bold text-white">
                {playerOfTournament.playerName} ({pottTeam.code})
              </div>
            </div>
          </div>
          <div className="text-xs font-mono-num text-cyan-300">
            {playerOfTournament.runs} runs (Avg {playerOfTournament.battingAverage}) ·{' '}
            {playerOfTournament.wickets} wkts
          </div>
        </div>
      )}

      {asModal && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-lg font-bold tracking-wider uppercase cursor-pointer"
        >
          CONTINUE TO HUB ▶
        </button>
      )}
    </div>
  );

  if (!asModal) return cardContent;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Championship Trophy Presentation"
      className="fixed inset-0 z-40 bg-[#020612]/88 flex items-center justify-center p-4"
    >
      {cardContent}
    </div>
  );
};
