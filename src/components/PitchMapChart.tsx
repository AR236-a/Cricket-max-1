import React, { useId, useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  PITCH_LENGTH_BANDS,
  PITCH_MAP_MAX_BALLS,
  PITCH_MAP_MAX_DISTANCE_M,
  PITCH_MAP_MAX_LINE_CM,
  summarizePitchLengthTrends,
} from '../game/pitchMap';
import { BattingHand, PitchBallRecord, PitchCondition } from '../game/types';
import { Crosshair, Maximize2, Minimize2, Target } from 'lucide-react';

interface PitchMapChartProps {
  balls: PitchBallRecord[];
  pitchCondition: PitchCondition;
  strikerHand: BattingHand;
}

const PITCH_SURFACE_COLORS: Record<PitchCondition, { turf: string; strip: string; crease: string }> = {
  hard: { turf: '#132a20', strip: '#8b6f47', crease: '#f8fafc' },
  green: { turf: '#0f2b1c', strip: '#4c7c45', crease: '#f8fafc' },
  dry: { turf: '#1d271c', strip: '#a68b5b', crease: '#f8fafc' },
};

function getBallMarkerColor(ball: PitchBallRecord): { fill: string; stroke: string; text: string } {
  if (ball.isWicket) {
    return { fill: '#f43f5e', stroke: '#fff1f2', text: '#ffffff' };
  }
  if (ball.runs === 6) {
    return { fill: '#facc15', stroke: '#fef08a', text: '#090d16' };
  }
  if (ball.runs === 4) {
    return { fill: '#22d3ee', stroke: '#cffafe', text: '#090d16' };
  }
  if (ball.runs === 0) {
    return { fill: '#94a3b8', stroke: '#e2e8f0', text: '#090d16' };
  }
  return { fill: '#f8fafc', stroke: '#38bdf8', text: '#090d16' };
}

function getZoneColor(length: PitchBallRecord['length']): string {
  if (length === 'full') return '#38bdf8';
  if (length === 'good') return '#34d399';
  return '#facc15';
}

export const PitchMapChart: React.FC<PitchMapChartProps> = ({
  balls,
  pitchCondition,
  strikerHand,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const clipUid = useId().replace(/:/g, '');

  const recentBalls = useMemo(
    () => balls.slice(-PITCH_MAP_MAX_BALLS),
    [balls]
  );
  const summary = useMemo(() => summarizePitchLengthTrends(recentBalls), [recentBalls]);
  const surface = PITCH_SURFACE_COLORS[pitchCondition] ?? PITCH_SURFACE_COLORS.hard;

  const renderBody = (isModal: boolean) => {
    const isLarge = isModal || expanded;

    // SVG 1: D3 Spatial Pitch Heatmap
    const mapW = isLarge ? 300 : 254;
    const mapH = isLarge ? 168 : 122;
    const mapPad = isLarge
      ? { top: 8, right: 40, bottom: 14, left: 26 }
      : { top: 6, right: 36, bottom: 12, left: 24 };
    const innerMapW = mapW - mapPad.left - mapPad.right;
    const innerMapH = mapH - mapPad.top - mapPad.bottom;

    const xLineScale = d3
      .scaleLinear()
      .domain([-PITCH_MAP_MAX_LINE_CM, PITCH_MAP_MAX_LINE_CM])
      .range([0, innerMapW]);

    const yDistScale = d3
      .scaleLinear()
      .domain([0, PITCH_MAP_MAX_DISTANCE_M])
      .range([innerMapH, 0]);

    const contours =
      recentBalls.length > 0
        ? d3
            .contourDensity<PitchBallRecord>()
            .x((d) => xLineScale(d.lineOffsetCm))
            .y((d) => yDistScale(d.pitchDistanceM))
            .size([innerMapW, innerMapH])
            .bandwidth(isLarge ? 22 : 16)
            .thresholds(8)(recentBalls)
        : [];

    const maxContourVal = d3.max(contours, (c) => c.value) ?? 0.01;
    const heatColorScale = d3
      .scaleSequential(
        d3.interpolateRgbBasis([
          'rgba(14, 165, 233, 0.16)',
          'rgba(34, 197, 94, 0.36)',
          'rgba(250, 204, 21, 0.56)',
          'rgba(249, 115, 22, 0.72)',
          'rgba(239, 68, 68, 0.86)',
        ])
      )
      .domain([0, Math.max(0.0001, maxContourVal)]);

    const geoPathGen = d3.geoPath();

    // SVG 2: D3 Pitch Length Trend (Last 6 balls sequence)
    const trendW = isLarge ? 250 : 254;
    const trendH = isLarge ? 116 : 62;
    const trendPad = isLarge
      ? { top: 10, right: 12, bottom: 16, left: 22 }
      : { top: 6, right: 10, bottom: 14, left: 22 };
    const innerTrendW = trendW - trendPad.left - trendPad.right;
    const innerTrendH = trendH - trendPad.top - trendPad.bottom;

    const trendIndices = recentBalls.map((_, idx) => idx);
    const xSeqScale = d3
      .scalePoint<number>()
      .domain(trendIndices.length > 0 ? trendIndices : [0])
      .range([8, Math.max(12, innerTrendW - 8)]);

    const yTrendScale = d3
      .scaleLinear()
      .domain([0, PITCH_MAP_MAX_DISTANCE_M])
      .range([innerTrendH, 0]);

    const trendLineGen = d3
      .line<PitchBallRecord>()
      .x((_, idx) => (recentBalls.length === 1 ? innerTrendW / 2 : xSeqScale(idx) ?? 0))
      .y((d) => yTrendScale(d.pitchDistanceM))
      .curve(d3.curveMonotoneX);

    const trendAreaGen = d3
      .area<PitchBallRecord>()
      .x((_, idx) => (recentBalls.length === 1 ? innerTrendW / 2 : xSeqScale(idx) ?? 0))
      .y0(innerTrendH)
      .y1((d) => yTrendScale(d.pitchDistanceM))
      .curve(d3.curveMonotoneX);

    const trendLinePath = recentBalls.length >= 2 ? trendLineGen(recentBalls) ?? '' : '';
    const trendAreaPath = recentBalls.length >= 2 ? trendAreaGen(recentBalls) ?? '' : '';

    const leftSideLabel = strikerHand === 'left' ? 'OFF' : 'LEG';
    const rightSideLabel = strikerHand === 'left' ? 'LEG' : 'OFF';
    const clipId = `pitch-clip-${clipUid}-${isModal ? 'm' : 'd'}`;
    const trendGradId = `pitch-trend-grad-${clipUid}-${isModal ? 'm' : 'd'}`;

    const trendBadgeText =
      summary.trendDirection === 'fuller'
        ? 'Trending Fuller'
        : summary.trendDirection === 'shorter'
        ? 'Trending Shorter'
        : summary.trendDirection === 'steady'
        ? 'Holding Length'
        : 'Awaiting Balls';

    return (
      <div
        data-testid={isModal ? 'd3-pitch-map-expanded' : 'd3-pitch-map'}
        className={`pointer-events-auto rounded-xl bg-[#060f24]/92 border border-cyan-500/40 shadow-[0_8px_28px_rgba(2,6,23,0.75)] ${
          isModal
            ? 'w-full max-w-lg land:max-w-2xl max-h-[92dvh] overflow-y-auto p-3.5 land:p-2.5'
            : isLarge
            ? 'w-[536px] p-3'
            : 'w-[274px] p-2.5'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-1.5 land:mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Target className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 truncate">
              Pitch Map · Last {PITCH_MAP_MAX_BALLS} Balls
            </span>
          </div>

          <button
            type="button"
            aria-label={isLarge ? 'Collapse pitch map' : 'Expand pitch map'}
            onClick={() => {
              if (isModal) setMobileOpen(false);
              else setExpanded((e) => !e);
            }}
            className="p-1 rounded bg-[#0c1a3a] border border-cyan-500/30 text-cyan-300 hover:border-cyan-300 cursor-pointer shrink-0"
          >
            {isLarge ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>

        {/* Summary Strip */}
        <div
          data-testid="pitch-map-summary"
          className="mb-1.5 land:mb-1 px-2 py-1 rounded-md bg-[#0a1634] border border-cyan-500/25 flex items-center justify-between gap-2 text-[10px] font-mono-num"
        >
          {summary.totalBalls > 0 ? (
            <>
              <span className="font-bold text-amber-300 truncate">
                {summary.dominantLabel} ({summary.totalBalls}/6) · {trendBadgeText}
              </span>
              <span className="text-cyan-300 shrink-0 tabular-nums">
                Avg {summary.averageDistanceM}m
              </span>
            </>
          ) : (
            <>
              <span className="text-slate-300">Awaiting 1st delivery</span>
              <span className="text-cyan-300/80 shrink-0">0/6 tracked</span>
            </>
          )}
        </div>

        {/* Two-column layout when expanded on desktop or in landscape modal so everything fits cleanly without clipping or overlapping batter cards */}
        <div
          className={
            isModal
              ? 'grid grid-cols-1 land:grid-cols-[1.15fr_1fr] gap-2 land:gap-3 items-start'
              : isLarge
              ? 'grid grid-cols-[1.18fr_1fr] gap-3 items-start'
              : 'space-y-1.5'
          }
        >
          {/* D3 Pitch Heatmap SVG */}
          <svg
            width="100%"
            viewBox={`0 0 ${mapW} ${mapH}`}
            role="img"
            aria-label="Pitch landing heatmap of the last 6 deliveries"
            className="overflow-visible block"
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={0} width={innerMapW} height={innerMapH} rx={4} />
              </clipPath>
            </defs>

            <g transform={`translate(${mapPad.left}, ${mapPad.top})`}>
              {/* Outfield edge + Pitch turf */}
              <rect
                x={0}
                y={0}
                width={innerMapW}
                height={innerMapH}
                rx={4}
                fill={surface.turf}
                stroke="rgba(148,163,184,0.28)"
              />

              {/* Central Rolled Pitch Strip */}
              <rect
                x={xLineScale(-42)}
                y={0}
                width={xLineScale(42) - xLineScale(-42)}
                height={innerMapH}
                fill={surface.strip}
                fillOpacity={0.34}
              />

              {/* Length Zone Horizontal Guidelines */}
              {PITCH_LENGTH_BANDS.map((band) => {
                const yTop = yDistScale(band.maxM);
                const yBot = yDistScale(band.minM);
                const yMid = (yTop + yBot) / 2;
                return (
                  <g key={band.zone}>
                    {band.maxM < PITCH_MAP_MAX_DISTANCE_M && (
                      <line
                        x1={0}
                        x2={innerMapW}
                        y1={yTop}
                        y2={yTop}
                        stroke="rgba(226,232,240,0.2)"
                        strokeDasharray="3,3"
                      />
                    )}
                    <text
                      x={innerMapW + 4}
                      y={yMid}
                      dy="0.32em"
                      className="text-[7px] font-mono-num font-bold"
                      fill={band.color}
                    >
                      {band.label}
                    </text>
                  </g>
                );
              })}

              {/* Stumps Corridor Vertical Guide Lines (Leg, Middle, Off) */}
              {[-11.4, 0, 11.4].map((cm, idx) => (
                <line
                  key={`stump-line-${idx}`}
                  x1={xLineScale(cm)}
                  x2={xLineScale(cm)}
                  y1={0}
                  y2={innerMapH}
                  stroke={idx === 1 ? 'rgba(250,204,21,0.34)' : 'rgba(248,250,252,0.16)'}
                  strokeDasharray={idx === 1 ? '2,2' : '2,3'}
                />
              ))}

              {/* Popping Crease & Stumps at Batter End */}
              <line
                x1={xLineScale(-52)}
                x2={xLineScale(52)}
                y1={yDistScale(1.22)}
                y2={yDistScale(1.22)}
                stroke="rgba(248,250,252,0.58)"
                strokeWidth={1.2}
              />
              {[-11.4, 0, 11.4].map((cm, idx) => (
                <circle
                  key={`stump-dot-${idx}`}
                  cx={xLineScale(cm)}
                  cy={yDistScale(0.25)}
                  r={isLarge ? 2.1 : 1.7}
                  fill="#fde68a"
                />
              ))}

              {/* D3 Contour Density Heatmap Layer */}
              <g clipPath={`url(#${clipId})`}>
                {contours.map((contour, idx) => (
                  <path
                    key={`contour-${idx}`}
                    d={geoPathGen(contour) ?? ''}
                    fill={heatColorScale(contour.value)}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={0.5}
                  />
                ))}
              </g>

              {/* Individual Last-6 Ball Landing Spots */}
              {recentBalls.map((ball, idx) => {
                const cx = xLineScale(ball.lineOffsetCm);
                const cy = yDistScale(ball.pitchDistanceM);
                const isLatest = idx === recentBalls.length - 1;
                const marker = getBallMarkerColor(ball);
                const r = isLarge ? (isLatest ? 5.6 : 4.5) : isLatest ? 4.8 : 3.9;

                return (
                  <g key={ball.id} data-testid={`pitch-ball-dot-${idx + 1}`}>
                    {isLatest && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r + 2.4}
                        fill="none"
                        stroke="#facc15"
                        strokeWidth={1.2}
                        strokeOpacity={0.85}
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={marker.fill}
                      stroke={marker.stroke}
                      strokeWidth={1}
                    >
                      <title>
                        {`${ball.overBall}: ${ball.length.toUpperCase()} (${ball.pitchDistanceM}m) · ${ball.deliveryType.replace('_', ' ')} · ${ball.ballSymbol}`}
                      </title>
                    </circle>
                    <text
                      x={cx}
                      y={cy}
                      dy="0.34em"
                      textAnchor="middle"
                      fill={marker.text}
                      className="font-mono-num font-bold pointer-events-none"
                      fontSize={isLarge ? 6.2 : 5.5}
                    >
                      {idx + 1}
                    </text>
                  </g>
                );
              })}

              {/* Distance Axis Labels */}
              {[0, 6, 10, 14].map((m) => (
                <text
                  key={`dist-lbl-${m}`}
                  x={-4}
                  y={yDistScale(m)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-slate-400 text-[7px] font-mono-num"
                >
                  {m}m
                </text>
              ))}

              {/* Leg / Batter / Off Side Orientation Footer */}
              <text
                x={4}
                y={innerMapH + 10}
                textAnchor="start"
                className="fill-slate-400 text-[7px] font-mono-num font-semibold"
              >
                {leftSideLabel}
              </text>
              <text
                x={innerMapW / 2}
                y={innerMapH + 10}
                textAnchor="middle"
                className="fill-amber-300/90 text-[7px] font-mono-num font-bold"
              >
                STUMPS ({strikerHand === 'left' ? 'LHB' : 'RHB'})
              </text>
              <text
                x={innerMapW - 4}
                y={innerMapH + 10}
                textAnchor="end"
                className="fill-slate-400 text-[7px] font-mono-num font-semibold"
              >
                {rightSideLabel}
              </text>
            </g>
          </svg>

          {/* D3 Length Trend Sparkline & Zone Distribution */}
          <div className={`${isLarge ? 'pt-0' : 'pt-1.5 border-t border-cyan-500/20'}`}>
            <div className="flex items-center justify-between text-[9px] font-mono-num text-slate-300 mb-1">
              <span className="uppercase tracking-wider text-cyan-200/90 font-semibold">
                Length Trend (m)
              </span>
              {!isLarge && (
                <span className="tabular-nums text-slate-400">
                  Full {summary.fullPct}% · Good {summary.goodPct}% · Short {summary.shortPct}%
                </span>
              )}
            </div>

            <svg
              width="100%"
              viewBox={`0 0 ${trendW} ${trendH}`}
              role="img"
              aria-label="D3 pitch length trend across the last 6 deliveries"
              className="overflow-visible block"
            >
              <defs>
                <linearGradient id={trendGradId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#facc15" stopOpacity="0.28" />
                  <stop offset="55%" stopColor="#34d399" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.06" />
                </linearGradient>
              </defs>

              <g transform={`translate(${trendPad.left}, ${trendPad.top})`}>
                <rect
                  x={0}
                  y={yTrendScale(PITCH_MAP_MAX_DISTANCE_M)}
                  width={innerTrendW}
                  height={yTrendScale(9.8) - yTrendScale(PITCH_MAP_MAX_DISTANCE_M)}
                  fill="rgba(250,204,21,0.06)"
                />
                <rect
                  x={0}
                  y={yTrendScale(9.8)}
                  width={innerTrendW}
                  height={yTrendScale(5.8) - yTrendScale(9.8)}
                  fill="rgba(52,211,153,0.07)"
                />
                <rect
                  x={0}
                  y={yTrendScale(5.8)}
                  width={innerTrendW}
                  height={yTrendScale(0) - yTrendScale(5.8)}
                  fill="rgba(56,189,248,0.06)"
                />

                {[5.8, 9.8].map((thresh) => (
                  <line
                    key={`thresh-${thresh}`}
                    x1={0}
                    x2={innerTrendW}
                    y1={yTrendScale(thresh)}
                    y2={yTrendScale(thresh)}
                    stroke="rgba(148,163,184,0.25)"
                    strokeDasharray="2,2"
                  />
                ))}

                {[
                  { val: 2, label: 'F' },
                  { val: 8, label: 'G' },
                  { val: 13, label: 'S' },
                ].map((tick) => (
                  <text
                    key={`t-y-${tick.label}`}
                    x={-4}
                    y={yTrendScale(tick.val)}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-slate-400 text-[7px] font-mono-num font-bold"
                  >
                    {tick.label}
                  </text>
                ))}

                <line
                  x1={0}
                  x2={innerTrendW}
                  y1={innerTrendH}
                  y2={innerTrendH}
                  stroke="rgba(148,163,184,0.3)"
                />

                {trendAreaPath && <path d={trendAreaPath} fill={`url(#${trendGradId})`} />}
                {trendLinePath && (
                  <path
                    d={trendLinePath}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                )}

                {recentBalls.map((ball, idx) => {
                  const cx =
                    recentBalls.length === 1 ? innerTrendW / 2 : xSeqScale(idx) ?? 0;
                  const cy = yTrendScale(ball.pitchDistanceM);
                  return (
                    <g key={`tr-${ball.id}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isLarge ? 3.4 : 2.6}
                        fill={getZoneColor(ball.length)}
                        stroke="#060f24"
                        strokeWidth={1}
                      />
                      <text
                        x={cx}
                        y={innerTrendH + 10}
                        textAnchor="middle"
                        className="fill-slate-400 text-[7px] font-mono-num"
                      >
                        {ball.overBall}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {isLarge && (
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9px] font-mono-num">
                <div className="rounded bg-[#0a1634] border border-sky-400/30 px-1.5 py-1 text-center">
                  <div className="text-sky-300 font-bold">FULL</div>
                  <div className="text-slate-200 tabular-nums">{summary.fullPct}% ({summary.fullCount})</div>
                </div>
                <div className="rounded bg-[#0a1634] border border-emerald-400/30 px-1.5 py-1 text-center">
                  <div className="text-emerald-300 font-bold">GOOD</div>
                  <div className="text-slate-200 tabular-nums">{summary.goodPct}% ({summary.goodCount})</div>
                </div>
                <div className="rounded bg-[#0a1634] border border-amber-400/30 px-1.5 py-1 text-center">
                  <div className="text-amber-300 font-bold">SHORT</div>
                  <div className="text-slate-200 tabular-nums">{summary.shortPct}% ({summary.shortCount})</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop / Tablet docked widget (top-right, symmetric to RunRateChart; hidden on short mobile landscape) */}
      <div
        className={`hidden md:block land:!hidden absolute right-3 top-12 ${
          expanded ? 'z-30' : 'z-20'
        }`}
      >
        {renderBody(false)}
      </div>

      {/* Mobile & Landscape Phone compact toggle button */}
      <div className="md:hidden land:!block absolute right-3 top-14 sm:top-12 land:right-2.5 land:top-9 z-20 pointer-events-auto">
        <button
          type="button"
          data-testid="pitch-map-mobile-toggle"
          aria-label="Open pitch map heatmap and length trends"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 land:px-2 land:py-0.5 rounded-md bg-[#060f24]/90 border border-amber-400/45 text-amber-200 text-[11px] land:text-[10px] font-mono-num font-semibold cursor-pointer"
        >
          <Crosshair className="w-3.5 h-3.5 land:w-3 land:h-3 text-amber-300" aria-hidden="true" />
          {summary.totalBalls > 0
            ? `Pitch: ${summary.dominantLabel} (${summary.totalBalls}/6)`
            : 'Pitch Map'}
        </button>
      </div>

      {/* Mobile / Landscape Phone expanded D3 modal */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pitch mapping heatmap and length trends"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#020612]/85 flex items-center justify-center p-4 land:p-2 md:hidden land:!flex"
        >
          {renderBody(true)}
        </div>
      )}
    </>
  );
};
