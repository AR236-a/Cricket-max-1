import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { computePredictedTotal, formatOvers } from '../game/cricketEngine';
import { InningsState, OverProgressPoint } from '../game/types';
import { BarChart3, Maximize2, Minimize2, TrendingUp } from 'lucide-react';

interface RunRateChartProps {
  innings: InningsState;
  inningsNumber: 1 | 2 | 3 | 4;
  totalOvers: number;
  target: number | null;
}

interface ChartDatum {
  overs: number;
  runRate: number;
  runs: number;
  isLive?: boolean;
}

export const RunRateChart: React.FC<RunRateChartProps> = ({
  innings,
  inningsNumber,
  totalOvers,
  target,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const ballsBowled = innings.ballsBowled;
  const maxBalls = Math.max(6, totalOvers * 6);
  const ballsRemaining = Math.max(0, maxBalls - ballsBowled);
  const currentOversDecimal = ballsBowled / 6;
  const currentRR = ballsBowled > 0 ? (innings.runs / ballsBowled) * 6 : 0;
  const predictedTotal = computePredictedTotal(innings.runs, ballsBowled, totalOvers);

  const isChase = inningsNumber === 2 && target !== null;
  const runsNeeded = isChase ? Math.max(0, (target ?? 0) - innings.runs) : null;
  const requiredRR =
    isChase && ballsRemaining > 0 && runsNeeded !== null ? (runsNeeded / ballsRemaining) * 6 : null;

  const points: ChartDatum[] = useMemo(() => {
    const hist: OverProgressPoint[] = innings.overHistory ?? [];
    const list: ChartDatum[] = [{ overs: 0, runRate: 0, runs: 0 }];
    for (const pt of hist) {
      list.push({
        overs: pt.over,
        runRate: pt.runRate,
        runs: pt.cumulativeRuns,
      });
    }
    if (ballsBowled > 0 && ballsBowled % 6 !== 0) {
      list.push({
        overs: Number(currentOversDecimal.toFixed(2)),
        runRate: Number(currentRR.toFixed(2)),
        runs: innings.runs,
        isLive: true,
      });
    }
    return list;
  }, [innings.overHistory, innings.runs, ballsBowled, currentOversDecimal, currentRR]);

  const width = expanded ? 500 : 258;
  const height = expanded ? 210 : 108;
  const margin = expanded
    ? { top: 14, right: 34, bottom: 24, left: 32 }
    : { top: 10, right: 26, bottom: 18, left: 26 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const {
    xScale,
    yLeftScale,
    yRightScale,
    rrPath,
    rrAreaPath,
    actualRunsPath,
    projPath,
    xTicks,
    yLeftTicks,
    yRightTicks,
  } = useMemo(() => {
    const xDomMax = Math.max(1, totalOvers);
    const xSc = d3.scaleLinear().domain([0, xDomMax]).range([0, innerW]);

    const maxHistRR = d3.max(points, (d) => d.runRate) ?? 8;
    const yLeftMax = Math.max(12, Math.ceil(Math.max(maxHistRR, requiredRR ?? 0) / 2) * 2 + 2);
    const yL = d3.scaleLinear().domain([0, yLeftMax]).range([innerH, 0]);

    const maxScoreScale = Math.max(
      totalOvers * 10,
      predictedTotal + 10,
      isChase && target ? target + 8 : 0
    );
    const yR = d3.scaleLinear().domain([0, maxScoreScale]).range([innerH, 0]);

    const rrLineGen = d3
      .line<ChartDatum>()
      .x((d) => xSc(d.overs))
      .y((d) => yL(d.runRate))
      .curve(d3.curveMonotoneX);

    const rrAreaGen = d3
      .area<ChartDatum>()
      .x((d) => xSc(d.overs))
      .y0(innerH)
      .y1((d) => yL(d.runRate))
      .curve(d3.curveMonotoneX);

    const runsLineGen = d3
      .line<ChartDatum>()
      .x((d) => xSc(d.overs))
      .y((d) => yR(d.runs))
      .curve(d3.curveMonotoneX);

    const lastPt = points[points.length - 1] ?? { overs: 0, runs: 0, runRate: 0 };
    const projLineGen = d3
      .line<{ overs: number; runs: number }>()
      .x((d) => xSc(d.overs))
      .y((d) => yR(d.runs));

    const projectionData =
      lastPt.overs < xDomMax
        ? [
            { overs: lastPt.overs, runs: lastPt.runs },
            { overs: xDomMax, runs: predictedTotal },
          ]
        : [];

    const tickStep = totalOvers <= 10 ? 2 : totalOvers <= 20 ? 5 : 10;
    const ticksX: number[] = [];
    for (let o = 0; o <= totalOvers; o += tickStep) ticksX.push(o);
    if (ticksX[ticksX.length - 1] !== totalOvers) ticksX.push(totalOvers);

    return {
      xScale: xSc,
      yLeftScale: yL,
      yRightScale: yR,
      rrPath: points.length > 1 ? rrLineGen(points) ?? '' : '',
      rrAreaPath: points.length > 1 ? rrAreaGen(points) ?? '' : '',
      actualRunsPath: points.length > 1 ? runsLineGen(points) ?? '' : '',
      projPath: projectionData.length === 2 ? projLineGen(projectionData) ?? '' : '',
      xTicks: ticksX,
      yLeftTicks: yL.ticks(3),
      yRightTicks: yR.ticks(3),
    };
  }, [points, totalOvers, innerW, innerH, requiredRR, predictedTotal, isChase, target]);

  const lastPoint = points[points.length - 1] ?? { overs: 0, runRate: 0, runs: 0 };

  const renderChartBody = (isModal = false) => (
    <div
      data-testid={isModal ? 'd3-run-rate-chart-expanded' : 'd3-run-rate-chart'}
      className={`pointer-events-auto rounded-xl bg-[#060f24]/92 border border-cyan-500/40 shadow-[0_8px_28px_rgba(2,6,23,0.75)] ${
        isModal
          ? 'w-full max-w-lg max-h-[92dvh] overflow-y-auto p-4 land:p-3'
          : expanded
          ? 'w-[340px] xl:w-[400px] p-3'
          : 'w-[232px] xl:w-[266px] p-2.5'
      }`}
    >
      {/* Chart Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-300 shrink-0" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200 truncate">
            Run Rate & Predicted Total
          </span>
        </div>

        <button
          type="button"
          aria-label={expanded || isModal ? 'Collapse run rate chart' : 'Expand run rate chart'}
          onClick={() => {
            if (isModal) setMobileOpen(false);
            else setExpanded((e) => !e);
          }}
          className="p-1 rounded bg-[#0c1a3a] border border-cyan-500/30 text-cyan-300 hover:border-cyan-300 cursor-pointer shrink-0"
        >
          {expanded || isModal ? (
            <Minimize2 className="w-3 h-3" />
          ) : (
            <Maximize2 className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Runs Needed in Balls / Projected Total Status Strip */}
      <div className="mb-1.5 px-2 py-1 rounded-md bg-[#0a1634] border border-cyan-500/25 flex items-center justify-between gap-2 text-[11px] font-mono-num">
        {isChase && runsNeeded !== null ? (
          <>
            <span className="font-bold text-amber-300 truncate">
              Need {runsNeeded} in {ballsRemaining}b
            </span>
            <span className="text-cyan-300 shrink-0">
              Proj {predictedTotal}
            </span>
          </>
        ) : (
          <>
            <span className="text-emerald-300 font-semibold">
              Proj: {predictedTotal} ({formatOvers(ballsRemaining)} left)
            </span>
            <span className="text-cyan-300 shrink-0">CRR {currentRR.toFixed(2)}</span>
          </>
        )}
      </div>

      {/* D3.js SVG Graph */}
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Run rate trend and predicted total overs progress chart"
        className="overflow-visible block"
      >
        <defs>
          <linearGradient id={`rrAreaGrad-${isModal ? 'm' : 'd'}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Horizontal gridlines */}
          {yLeftTicks.map((t) => (
            <g key={`grid-${t}`} transform={`translate(0, ${yLeftScale(t)})`}>
              <line x1={0} x2={innerW} stroke="rgba(148,163,184,0.16)" strokeDasharray="2,2" />
              <text
                x={-5}
                dy="0.32em"
                textAnchor="end"
                className="fill-cyan-300/80 text-[8px] font-mono-num"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Right Y-axis ticks (Runs / Predicted Total) */}
          {yRightTicks.map((t) => (
            <text
              key={`yr-${t}`}
              x={innerW + 4}
              y={yRightScale(t)}
              dy="0.32em"
              textAnchor="start"
              className="fill-emerald-300/80 text-[8px] font-mono-num"
            >
              {t}
            </text>
          ))}

          {/* X-axis (Overs Progress) */}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="rgba(148,163,184,0.35)" />
          {xTicks.map((ov) => (
            <g key={`ov-${ov}`} transform={`translate(${xScale(ov)}, ${innerH})`}>
              <line y2={3} stroke="rgba(148,163,184,0.45)" />
              <text
                y={12}
                textAnchor="middle"
                className="fill-slate-400 text-[8px] font-mono-num"
              >
                {ov}
              </text>
            </g>
          ))}

          {/* Target horizontal line in chase */}
          {isChase && target !== null && (
            <g transform={`translate(0, ${yRightScale(target)})`}>
              <line x1={0} x2={innerW} stroke="#fb7185" strokeWidth={1} strokeDasharray="3,3" />
              <text
                x={2}
                y={-3}
                className="fill-rose-300 text-[8px] font-mono-num font-bold"
              >
                T:{target}
              </text>
            </g>
          )}

          {/* Required Run Rate dashed line */}
          {requiredRR !== null && (
            <line
              x1={0}
              x2={innerW}
              y1={yLeftScale(Math.min(yLeftScale.domain()[1], requiredRR))}
              y2={yLeftScale(Math.min(yLeftScale.domain()[1], requiredRR))}
              stroke="#facc15"
              strokeWidth={1}
              strokeDasharray="4,3"
            />
          )}

          {/* Run Rate Trend Area + Line */}
          {rrAreaPath && (
            <path d={rrAreaPath} fill={`url(#rrAreaGrad-${isModal ? 'm' : 'd'})`} />
          )}
          {rrPath && (
            <path d={rrPath} fill="none" stroke="#38bdf8" strokeWidth={2} strokeLinecap="round" />
          )}

          {/* Cumulative Score Progress + Predicted Total Projection */}
          {actualRunsPath && (
            <path
              d={actualRunsPath}
              fill="none"
              stroke="#34d399"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          )}
          {projPath && (
            <path
              d={projPath}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={1.6}
              strokeDasharray="4,3"
            />
          )}

          {/* Completed Over Nodes & Current Live Dot */}
          {points.slice(1).map((pt) => (
            <circle
              key={`pt-${pt.overs}`}
              cx={xScale(pt.overs)}
              cy={yLeftScale(pt.runRate)}
              r={pt.isLive ? 3.2 : 2.3}
              fill={pt.isLive ? '#facc15' : '#38bdf8'}
              stroke="#060f24"
              strokeWidth={1}
            />
          ))}

          {/* Predicted Total Endpoint Dot */}
          {lastPoint.overs < totalOvers && (
            <circle
              cx={xScale(totalOvers)}
              cy={yRightScale(predictedTotal)}
              r={2.8}
              fill="#fbbf24"
              stroke="#060f24"
              strokeWidth={1}
            />
          )}
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono-num text-slate-300">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-0.5 bg-sky-400 inline-block" /> CRR
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-0.5 bg-emerald-400 inline-block" /> Runs
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-0.5 bg-amber-400 inline-block" /> Proj {predictedTotal}
        </span>
        {requiredRR !== null && (
          <span className="text-amber-300">RRR {requiredRR.toFixed(2)}</span>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Laptop / Tablet-Landscape docked widget (top-left, clear of the oval pitch; hidden on portrait tablets, phones & short landscape) */}
      <div className="hidden lg:block land:!hidden absolute left-3 top-11 z-20">
        {renderChartBody(false)}
      </div>

      {/* Mobile, Tablet Portrait & Landscape Phone compact toggle button */}
      <div className="lg:hidden land:!block absolute left-3 top-12 sm:top-12 land:left-2.5 land:top-9 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 land:px-2 land:py-0.5 rounded-md bg-[#060f24]/90 border border-cyan-500/40 text-cyan-200 text-[11px] land:text-[10px] font-mono-num font-semibold cursor-pointer"
        >
          <BarChart3 className="w-3.5 h-3.5 land:w-3 land:h-3 text-cyan-300" aria-hidden="true" />
          {isChase && runsNeeded !== null
            ? `Need ${runsNeeded} in ${ballsRemaining}b`
            : `Proj ${predictedTotal}`}
        </button>
      </div>

      {/* Mobile / Tablet Portrait / Landscape Phone expanded D3 modal */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Run rate and predicted total chart"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#020612]/85 flex items-center justify-center p-4 land:p-2 lg:hidden land:!flex"
        >
          {renderChartBody(true)}
        </div>
      )}
    </>
  );
};
