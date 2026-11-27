import React from 'react';
import { getTeamById } from '../game/teams';
import { DrsPromptState, MatchFormat } from '../game/types';
import { getDrsFormatKey, DRS_FORMAT_RULES } from '../game/drs';
import { TeamBadge } from './TeamBadge';
import { CheckCircle2, Clock, Radio, ShieldAlert, Tv, XCircle } from 'lucide-react';

interface DrsThirdUmpireModalProps {
  prompt: DrsPromptState;
  format: MatchFormat;
  totalOvers: number;
  timeLeftSec: number;
  onSignalReview: () => void;
  onDeclineReview: () => void;
  onRevealVerdict: () => void;
  onApplyVerdict: () => void;
}

function verdictPillClass(
  value: string,
  positiveValues: string[],
  amberValues: string[] = ["Umpire's Call"]
): string {
  if (positiveValues.includes(value)) {
    return 'bg-rose-600/25 border-rose-400/70 text-rose-200';
  }
  if (amberValues.includes(value)) {
    return 'bg-amber-500/25 border-amber-400/70 text-amber-200';
  }
  return 'bg-emerald-500/25 border-emerald-400/70 text-emerald-200';
}

export const DrsThirdUmpireModal: React.FC<DrsThirdUmpireModalProps> = ({
  prompt,
  format,
  totalOvers,
  timeLeftSec,
  onSignalReview,
  onDeclineReview,
  onRevealVerdict,
  onApplyVerdict,
}) => {
  const reqTeam = getTeamById(prompt.requestingTeamId, { format, totalOvers });
  const ruleSpec = DRS_FORMAT_RULES[getDrsFormatKey(format, totalOvers)];
  const pct = Math.max(0, Math.min(100, (timeLeftSec / prompt.timeLimitSec) * 100));
  const isUrgent = timeLeftSec <= 5;
  const isVerdict = prompt.phase === 'verdict';
  const isChecking = prompt.phase === 'third_umpire';
  const isUmpireReferral = prompt.referralKind === 'umpire_stumping';

  const finalIsOut = prompt.finalDecisionIsOut ?? prompt.onFieldDecision === 'OUT';
  const nextReviewsLeft =
    isUmpireReferral || (prompt.reviewRetained ?? true)
      ? prompt.reviewsRemaining
      : Math.max(0, prompt.reviewsRemaining - 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Decision Review System and Third Umpire"
      data-testid="drs-modal"
      className="pointer-events-auto fixed inset-0 z-40 bg-[#020612]/90 flex items-center justify-center p-3 sm:p-4 land:p-2"
    >
      {prompt.phase === 'signal' ? (
        <div
          data-testid="drs-signal-card"
          className="animate-modal-pop w-full max-w-lg land:max-w-xl max-h-[92dvh] overflow-y-auto rounded-xl bg-[#0b1530] border-2 border-cyan-400/80 p-5 land:p-3.5 space-y-4 land:space-y-2.5 shadow-[0_0_40px_rgba(34,211,238,0.28)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-3 land:pb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamBadge team={reqTeam} size="sm" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono-num uppercase tracking-widest text-cyan-300 font-bold">
                  Decision Review System · {ruleSpec.label}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl land:text-xl font-bold tracking-wider text-amber-400 leading-none mt-0.5">
                  {prompt.appealType.toUpperCase()} APPEAL — REVIEW?
                </h2>
              </div>
            </div>
            <div
              data-testid="drs-countdown-timer"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono-num text-sm land:text-xs font-bold tabular-nums shrink-0 ${
                isUrgent
                  ? 'bg-rose-600/25 border-rose-400 text-rose-200'
                  : 'bg-[#070f24] border-cyan-400/60 text-cyan-200'
              }`}
            >
              <Clock className="w-4 h-4 land:w-3.5 land:h-3.5" aria-hidden="true" />
              <span>{timeLeftSec}s</span>
            </div>
          </div>

          {/* 15-Second Countdown Bar */}
          <div className="w-full h-2 rounded bg-[#060d20] overflow-hidden border border-slate-700/60">
            <div
              className={`h-full transition-all duration-300 ${
                isUrgent ? 'bg-rose-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 land:grid-cols-2 gap-2.5 land:gap-2 text-xs">
            <div className="p-3 land:p-2 rounded-lg bg-[#070f24] border border-cyan-500/30 space-y-1">
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                On-Field Decision
              </div>
              <div
                className={`font-display text-2xl land:text-xl font-bold tracking-wider ${
                  prompt.onFieldDecision === 'OUT' ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {prompt.onFieldDecision === 'OUT'
                  ? `OUT (${prompt.appealType.toUpperCase()})`
                  : `NOT OUT (${prompt.appealType.toUpperCase()})`}
              </div>
              <div className="text-[11px] text-slate-300">
                Eligible: {prompt.requestingSide === 'batting' ? 'Dismissed Batter' : 'Bowler / Fielding Captain'}
              </div>
            </div>

            <div className="p-3 land:p-2 rounded-lg bg-[#070f24] border border-cyan-500/30 space-y-1">
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                Reviews Remaining ({reqTeam.code})
              </div>
              <div className="font-mono-num text-xl land:text-lg font-bold text-amber-300 tabular-nums">
                {prompt.reviewsRemaining} / {prompt.maxReviews} Left
              </div>
              <div className="text-[11px] text-cyan-200/85">
                {prompt.requestingPlayerName}
              </div>
            </div>
          </div>

          <div className="px-3 py-2 land:py-1.5 rounded-lg bg-[#070f24]/90 border border-slate-700/70 text-[11px] text-slate-300 flex items-center justify-between gap-2">
            <span>Retention: {ruleSpec.retentionRule}</span>
            <span className="font-mono-num text-cyan-300 shrink-0">Keys: R / Esc</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 land:grid-cols-2 gap-2.5 land:gap-2 pt-0.5">
            <button
              type="button"
              data-testid="drs-signal-btn"
              onClick={onSignalReview}
              className="w-full py-3 land:py-2 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-lg land:text-base font-bold tracking-wider uppercase cursor-pointer"
            >
              SIGNAL "T" · REVIEW (DRS)
            </button>
            <button
              type="button"
              data-testid="drs-decline-btn"
              onClick={onDeclineReview}
              className="w-full py-3 land:py-2 px-4 rounded-lg bg-[#101e42] hover:bg-[#172b5d] border border-slate-500/60 text-slate-100 font-display text-lg land:text-base font-bold tracking-wider uppercase cursor-pointer"
            >
              ACCEPT ON-FIELD CALL
            </button>
          </div>
        </div>
      ) : (
        /* THIRD UMPIRE TV REPLAY & VERDICT */
        <div
          data-testid="third-umpire-card"
          className="animate-modal-pop w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-xl bg-[#0b1530] border-2 border-amber-400/80 p-4 sm:p-5 land:p-3 space-y-3.5 land:space-y-2 shadow-[0_0_48px_rgba(250,204,21,0.3)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5 land:pb-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {isUmpireReferral ? (
                <Tv className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
              ) : (
                <TeamBadge team={reqTeam} size="sm" />
              )}
              <div className="min-w-0">
                <div
                  data-testid="drs-third-umpire-subtitle"
                  className={`text-[10px] font-mono-num uppercase tracking-widest font-bold ${
                    !prompt.triggeredByUser && !isUmpireReferral
                      ? 'text-amber-300'
                      : 'text-cyan-300'
                  }`}
                >
                  {isUmpireReferral
                    ? `On-Field Umpire Referral · ${reqTeam.code} (No DRS Review Used)`
                    : !prompt.triggeredByUser
                    ? `Opponent DRS Review · ${reqTeam.code} Signals "T" (${prompt.reviewsRemaining}/${prompt.maxReviews} Reviews)`
                    : `Third Umpire Review · ${reqTeam.code} (${prompt.reviewsRemaining}/${prompt.maxReviews} Reviews)`}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl land:text-xl font-bold tracking-wider text-amber-400 leading-none">
                  {prompt.appealType === 'LBW'
                    ? 'ULTRAEDGE & BALL-TRACKING'
                    : 'SIDE-ON STUMPING REPLAY'}
                </h2>
                {!isUmpireReferral && (
                  <div className="text-[11px] font-mono-num text-slate-300 truncate mt-0.5">
                    Reviewed by {prompt.requestingPlayerName} ({prompt.requestingSide === 'batting' ? 'Batting' : 'Bowling'})
                  </div>
                )}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded bg-[#070f24] border border-cyan-500/40 font-mono-num text-[11px] font-semibold text-slate-200 shrink-0">
              On-Field: {prompt.onFieldDecision === 'OUT' ? 'OUT' : 'NOT OUT'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 land:grid-cols-12 gap-3.5 land:gap-2.5 items-stretch">
            {/* Visual Replay Graphics */}
            <div className="sm:col-span-7 land:col-span-7 rounded-lg bg-[#070f24] border border-cyan-500/35 p-3 land:p-2 flex flex-col justify-between gap-2.5 land:gap-1.5">
              {prompt.appealType === 'LBW' && prompt.tracking ? (
                <>
                  {/* Ball-Tracking Pitch & Stumps SVG */}
                  <svg
                    viewBox="0 0 320 158"
                    className="w-full h-36 land:h-28 rounded bg-[#040a18] border border-slate-800"
                    role="img"
                    aria-label="LBW Ball-Tracking Trajectory Replay"
                  >
                    {/* Pitch Strip */}
                    <polygon points="88,148 232,148 205,22 115,22" fill="#172b1e" stroke="#2c4f38" strokeWidth="1" />
                    {/* Stump Line Zone */}
                    <rect x="136" y="22" width="48" height="126" fill="rgba(56,189,248,0.08)" />
                    <line x1="136" y1="22" x2="136" y2="148" stroke="#38bdf8" strokeDasharray="3 3" strokeOpacity="0.45" />
                    <line x1="184" y1="22" x2="184" y2="148" stroke="#38bdf8" strokeDasharray="3 3" strokeOpacity="0.45" />
                    {/* Popping Crease */}
                    <line x1="95" y1="92" x2="225" y2="92" stroke="#e2e8f0" strokeWidth="1.5" strokeOpacity="0.7" />
                    {/* Three Stumps */}
                    <rect x="138" y="20" width="4" height="44" rx="1" fill="#facc15" />
                    <rect x="158" y="20" width="4" height="44" rx="1" fill="#facc15" />
                    <rect x="178" y="20" width="4" height="44" rx="1" fill="#facc15" />
                    <rect x="137" y="18" width="21" height="3" rx="1" fill="#fef08a" />
                    <rect x="162" y="18" width="21" height="3" rx="1" fill="#fef08a" />

                    {/* Ball Trajectory Points */}
                    {(() => {
                      const t = prompt.tracking!;
                      const px = 160 + t.pitchXNorm * 44;
                      const py = 128;
                      const ix = 160 + t.impactXNorm * 44;
                      const iy = 92;
                      const wx = 160 + t.wicketXNorm * 44;
                      const wy = Math.max(8, Math.min(64, 64 - t.wicketHeightNorm * 44));
                      const pathColor =
                        prompt.thirdUmpireOutcome === 'OUT'
                          ? '#f43f5e'
                          : prompt.thirdUmpireOutcome === 'UMPIRES_CALL'
                          ? '#f59e0b'
                          : '#34d399';
                      return (
                        <g>
                          <polyline
                            points={`${px},${py} ${ix},${iy} ${wx},${wy}`}
                            fill="none"
                            stroke={pathColor}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx={px} cy={py} r="5.5" fill="#38bdf8" stroke="#fff" strokeWidth="1.5" />
                          <circle cx={ix} cy={iy} r="5.5" fill="#facc15" stroke="#fff" strokeWidth="1.5" />
                          <circle cx={wx} cy={wy} r="6.5" fill={pathColor} stroke="#fff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}
                    <text x="10" y="16" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                      LEG SIDE
                    </text>
                    <text x="262" y="16" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                      OFF SIDE
                    </text>
                  </svg>

                  {/* UltraEdge Waveform */}
                  <div className="p-2 rounded bg-[#040a18] border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono-num">
                      <span className="text-cyan-300 uppercase font-bold inline-flex items-center gap-1">
                        <Radio className="w-3 h-3" aria-hidden="true" />
                        UltraEdge Snicko
                      </span>
                      <span
                        className={
                          prompt.tracking.ultraEdge === 'Spike Near Bat'
                            ? 'text-emerald-300 font-bold'
                            : 'text-slate-300'
                        }
                      >
                        {prompt.tracking.ultraEdge}
                      </span>
                    </div>
                    <svg viewBox="0 0 280 28" className="w-full h-6" aria-hidden="true">
                      <line x1="0" y1="14" x2="280" y2="14" stroke="#1e293b" strokeWidth="1" />
                      {prompt.tracking.ultraEdge === 'Spike Near Bat' ? (
                        <polyline
                          points="0,14 95,14 108,13 118,4 126,25 134,3 142,24 150,12 162,14 280,14"
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="2"
                        />
                      ) : (
                        <polyline
                          points="0,14 80,13.5 130,14.5 180,13.8 280,14"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.8"
                        />
                      )}
                    </svg>
                  </div>
                </>
              ) : prompt.stumpingCheck ? (
                <>
                  {/* Side-on Stumping Crease Replay SVG */}
                  <svg
                    viewBox="0 0 320 158"
                    className="w-full h-36 land:h-28 rounded bg-[#040a18] border border-slate-800"
                    role="img"
                    aria-label="Third Umpire Side-On Stumping Crease Replay"
                  >
                    {/* Turf & Pitch Cross-section */}
                    <rect x="0" y="114" width="320" height="44" fill="#172b1e" />
                    <line x1="0" y1="114" x2="320" y2="114" stroke="#475569" strokeWidth="1.5" />

                    {/* Stumps & Glowing Bails */}
                    <rect x="234" y="42" width="7" height="72" rx="1.5" fill="#facc15" />
                    {/* LED Bails dislodged & lit */}
                    <rect
                      x="228"
                      y="33"
                      width="18"
                      height="5"
                      rx="2"
                      transform="rotate(-18 237 35)"
                      fill="#f43f5e"
                      stroke="#fecdd3"
                      strokeWidth="1"
                    />
                    <circle cx="236" cy="36" r="11" fill="rgba(244,63,94,0.22)" />

                    {/* Popping Crease White Line (x = 152..158) */}
                    <rect x="150" y="110" width="8" height="48" fill="#f8fafc" />
                    <text x="84" y="148" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                      SAFE ZONE
                    </text>
                    <text x="172" y="148" fill="#fca5a5" fontSize="9" fontFamily="monospace">
                      OUT ZONE
                    </text>

                    {/* Batter Back Foot Boot */}
                    {(() => {
                      const sc = prompt.stumpingCheck!;
                      const isBehind = sc.backFootPosition === 'Behind Crease (Grounded)';
                      const isInAir = sc.backFootPosition === 'In Air (Out of Crease)';
                      const bootX = isBehind ? 102 : sc.backFootPosition === 'On Line (Nothing Behind)' ? 132 : 146;
                      const bootY = isInAir ? 92 : 102;
                      const bootColor = isBehind ? '#34d399' : '#f43f5e';
                      return (
                        <g>
                          {/* Leg / Pad */}
                          <rect
                            x={bootX + 12}
                            y={bootY - 56}
                            width="20"
                            height="54"
                            rx="4"
                            fill="#cbd5e1"
                            stroke="#64748b"
                            strokeWidth="1.5"
                          />
                          {/* Boot Sole */}
                          <path
                            d={`M ${bootX} ${bootY + 12} L ${bootX + 38} ${bootY + 12} L ${bootX + 34} ${bootY - 2} L ${bootX + 10} ${bootY - 2} Z`}
                            fill={bootColor}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        </g>
                      );
                    })()}
                    <text x="10" y="18" fill="#38bdf8" fontSize="10" fontFamily="monospace">
                      SIDE-ON CREASE CAM · BAILS LIT
                    </text>
                  </svg>

                  <div className="p-2 rounded bg-[#040a18] border border-slate-800 flex items-center justify-between text-[11px] font-mono-num">
                    <span className="text-cyan-300 font-bold">Crease Margin</span>
                    <span
                      className={
                        prompt.stumpingCheck.footOffsetMm > 0
                          ? 'text-emerald-300 font-bold'
                          : 'text-rose-300 font-bold'
                      }
                    >
                      {prompt.stumpingCheck.footOffsetMm > 0
                        ? `+${prompt.stumpingCheck.footOffsetMm}mm Behind Crease`
                        : prompt.stumpingCheck.footOffsetMm === 0
                        ? '0mm On Line (Out)'
                        : `${Math.abs(prompt.stumpingCheck.footOffsetMm)}mm Short / Raised`}
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            {/* Right Panel: Telemetry & Big Screen */}
            <div className="sm:col-span-5 land:col-span-5 flex flex-col justify-between gap-2.5 land:gap-1.5">
              {prompt.appealType === 'LBW' && prompt.tracking ? (
                <div className="space-y-1.5 text-xs font-mono-num">
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded border border-slate-700/70 bg-[#070f24]">
                    <span className="text-slate-300">ULTRAEDGE</span>
                    <span
                      className={
                        prompt.tracking.ultraEdge === 'Spike Near Bat'
                          ? 'text-emerald-300 font-bold'
                          : 'text-cyan-200 font-bold'
                      }
                    >
                      {prompt.tracking.ultraEdge === 'Spike Near Bat' ? 'SPIKE' : 'NO BAT'}
                    </span>
                  </div>
                  <div
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded border ${verdictPillClass(
                      prompt.tracking.pitching,
                      ['In Line', 'Outside Off'],
                      []
                    )}`}
                  >
                    <span>PITCHING</span>
                    <span className="font-bold">{prompt.tracking.pitching.toUpperCase()}</span>
                  </div>
                  <div
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded border ${verdictPillClass(
                      prompt.tracking.impact,
                      ['In Line']
                    )}`}
                  >
                    <span>IMPACT</span>
                    <span className="font-bold">{prompt.tracking.impact.toUpperCase()}</span>
                  </div>
                  <div
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded border ${verdictPillClass(
                      prompt.tracking.wickets,
                      ['Hitting']
                    )}`}
                  >
                    <span>WICKETS</span>
                    <span className="font-bold">{prompt.tracking.wickets.toUpperCase()}</span>
                  </div>
                </div>
              ) : prompt.stumpingCheck ? (
                <div className="space-y-1.5 text-xs font-mono-num">
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded border border-slate-700/70 bg-[#070f24]">
                    <span className="text-slate-300">ULTRAEDGE</span>
                    <span className="text-cyan-200 font-bold">NO BAT</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded border border-rose-500/40 bg-rose-500/15 text-rose-200">
                    <span>BAILS</span>
                    <span className="font-bold">DISLODGED</span>
                  </div>
                  <div
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border ${
                      prompt.stumpingCheck.backFootPosition === 'Behind Crease (Grounded)'
                        ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200'
                        : 'bg-rose-600/25 border-rose-400/70 text-rose-200'
                    }`}
                  >
                    <span>BACK FOOT</span>
                    <span className="font-bold text-right">
                      {prompt.stumpingCheck.backFootPosition === 'Behind Crease (Grounded)'
                        ? 'GROUNDED'
                        : prompt.stumpingCheck.backFootPosition === 'On Line (Nothing Behind)'
                        ? 'ON LINE'
                        : 'IN AIR'}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Big Screen Result Card */}
              <div
                data-testid="third-umpire-verdict-box"
                className={`p-3 land:p-2 rounded-lg border text-center space-y-1 ${
                  isChecking
                    ? 'bg-[#070f24] border-cyan-500/40'
                    : prompt.thirdUmpireOutcome === 'UMPIRES_CALL'
                    ? 'bg-amber-500/15 border-amber-400'
                    : finalIsOut
                    ? 'bg-rose-600/25 border-rose-400'
                    : 'bg-emerald-500/20 border-emerald-400'
                }`}
              >
                {isChecking ? (
                  <>
                    <div className="text-[10px] font-mono-num uppercase tracking-widest text-cyan-300 animate-pulse">
                      Third Umpire Checking...
                    </div>
                    <div className="font-display text-2xl land:text-xl font-bold tracking-wider text-white">
                      REVIEW IN PROGRESS
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono-num uppercase tracking-widest font-bold text-slate-200">
                      {prompt.thirdUmpireOutcome === 'UMPIRES_CALL' ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                      ) : finalIsOut ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                      )}
                      <span>
                        {prompt.thirdUmpireOutcome === 'UMPIRES_CALL'
                          ? "UMPIRE'S CALL"
                          : 'BIG SCREEN DECISION'}
                      </span>
                    </div>
                    <div
                      className={`font-display text-4xl land:text-2xl font-bold tracking-widest leading-none ${
                        finalIsOut ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {finalIsOut ? 'OUT' : 'NOT OUT'}
                    </div>
                    <div className="text-[11px] font-mono-num text-slate-200">
                      {isUmpireReferral
                        ? 'Umpire Referral — No DRS Review Used'
                        : prompt.reviewRetained
                        ? `Review RETAINED (${nextReviewsLeft}/${prompt.maxReviews})`
                        : `Review LOST (${nextReviewsLeft}/${prompt.maxReviews})`}
                    </div>
                  </>
                )}
              </div>

              {isChecking ? (
                <button
                  type="button"
                  data-testid="drs-reveal-btn"
                  onClick={onRevealVerdict}
                  className="w-full py-2.5 land:py-1.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display text-lg land:text-base font-bold tracking-wider uppercase cursor-pointer"
                >
                  SHOW BIG SCREEN VERDICT ▶
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="drs-apply-btn"
                  onClick={onApplyVerdict}
                  className={`w-full py-2.5 land:py-1.5 px-4 rounded-lg font-display text-lg land:text-base font-bold tracking-wider uppercase cursor-pointer ${
                    finalIsOut
                      ? 'bg-rose-500 hover:bg-rose-400 text-white'
                      : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                  }`}
                >
                  {isVerdict ? 'APPLY DECISION ▶' : 'CONTINUE ▶'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
