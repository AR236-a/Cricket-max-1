import {
  BattingHand,
  BowlingSide,
  DeliveryLength,
  DeliveryType,
  PitchBallRecord,
} from './types';

export const PITCH_MAP_MAX_BALLS = 6;
export const PITCH_LENGTH_METERS = 20.12;
export const PITCH_MAP_MAX_DISTANCE_M = 15.5;
export const PITCH_MAP_MAX_LINE_CM = 65;

export type PitchLengthZone = 'yorker' | 'full' | 'good' | 'short';

export interface PitchLengthBand {
  zone: PitchLengthZone;
  label: string;
  minM: number;
  maxM: number;
  color: string;
}

export const PITCH_LENGTH_BANDS: PitchLengthBand[] = [
  { zone: 'yorker', label: 'YORKER', minM: 0, maxM: 2.2, color: '#fb7185' },
  { zone: 'full', label: 'FULL', minM: 2.2, maxM: 5.8, color: '#38bdf8' },
  { zone: 'good', label: 'GOOD', minM: 5.8, maxM: 9.8, color: '#34d399' },
  { zone: 'short', label: 'SHORT', minM: 9.8, maxM: PITCH_MAP_MAX_DISTANCE_M, color: '#facc15' },
];

export interface PitchLengthTrendsSummary {
  totalBalls: number;
  fullCount: number;
  goodCount: number;
  shortCount: number;
  fullPct: number;
  goodPct: number;
  shortPct: number;
  dominantLength: DeliveryLength | null;
  dominantLabel: string;
  averageDistanceM: number;
  trendDirection: 'fuller' | 'shorter' | 'steady' | 'none';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function classifyDistanceLength(pitchDistanceM: number): DeliveryLength {
  if (pitchDistanceM <= 5.8) return 'full';
  if (pitchDistanceM <= 9.8) return 'good';
  return 'short';
}

export function computePitchLandingPoint(params: {
  deliveryType: DeliveryType;
  deliveryLength: DeliveryLength;
  bowlingSide?: BowlingSide;
  strikerHand?: BattingHand;
  paceSpeedKph?: number;
  spinDegree?: number;
  rng?: () => number;
}): { pitchDistanceM: number; lineOffsetCm: number } {
  const rng = params.rng ?? Math.random;
  const r1 = clamp(rng(), 0, 0.9999);
  const r2 = clamp(rng(), 0, 0.9999);

  let minDist = 6.2;
  let maxDist = 9.4;

  if (params.deliveryType === 'yorker') {
    minDist = 0.5;
    maxDist = params.deliveryLength === 'full' ? 1.9 : 2.2;
  } else if (params.deliveryType === 'bouncer') {
    minDist = 11.5;
    maxDist = 14.6;
  } else if (params.deliveryLength === 'full') {
    minDist = 2.5;
    maxDist = 5.6;
  } else if (params.deliveryLength === 'good') {
    minDist = 6.0;
    maxDist = 9.5;
  } else {
    minDist = 10.0;
    maxDist = 13.8;
  }

  // Subtle pace / spin depth shift within zone
  if (params.paceSpeedKph !== undefined && params.paceSpeedKph >= 146 && params.deliveryLength === 'short') {
    minDist += 0.4;
  } else if (params.spinDegree !== undefined && params.spinDegree >= 8 && params.deliveryLength === 'full') {
    maxDist -= 0.4;
  }

  const pitchDistanceM = Number((minDist + r1 * (maxDist - minDist)).toFixed(2));

  // Lateral line offset in cm relative to middle stump (0).
  // Positive = right side of pitch view (Off stump for RHB), Negative = left side (Leg stump for RHB).
  const isLeftHanded = params.strikerHand === 'left';
  const offSign = isLeftHanded ? -1 : 1;
  const sideBias = params.bowlingSide === 'round' ? -6 * offSign : 4 * offSign;

  let targetCorridorCm = 14 * offSign; // fourth-stump channel
  if (params.deliveryType === 'yorker') {
    targetCorridorCm = 4 * offSign;
  } else if (params.deliveryType === 'swing' || params.deliveryType === 'seam') {
    targetCorridorCm = 18 * offSign;
  } else if (params.deliveryType === 'bouncer') {
    targetCorridorCm = 9 * offSign;
  } else if (params.deliveryType === 'off_spin' || params.deliveryType === 'doosra' || params.deliveryType === 'spin') {
    targetCorridorCm = 15 * offSign;
  } else if (params.deliveryType === 'leg_spin' || params.deliveryType === 'googly') {
    targetCorridorCm = -8 * offSign;
  } else if (params.deliveryType === 'arm_ball' || params.deliveryType === 'carrom') {
    targetCorridorCm = 8 * offSign;
  }

  const spread = (r2 - 0.5) * 34;
  const lineOffsetCm = Number(
    clamp(targetCorridorCm + sideBias + spread, -PITCH_MAP_MAX_LINE_CM + 5, PITCH_MAP_MAX_LINE_CM - 5).toFixed(1)
  );

  return { pitchDistanceM, lineOffsetCm };
}

export function appendRecentPitchBall(
  existing: PitchBallRecord[] | undefined,
  nextBall: PitchBallRecord,
  maxCount: number = PITCH_MAP_MAX_BALLS
): PitchBallRecord[] {
  const list = [...(existing ?? []), nextBall];
  if (list.length <= maxCount) return list;
  return list.slice(list.length - maxCount);
}

export function summarizePitchLengthTrends(
  balls: PitchBallRecord[] | undefined
): PitchLengthTrendsSummary {
  const list = balls ?? [];
  const totalBalls = list.length;

  if (totalBalls === 0) {
    return {
      totalBalls: 0,
      fullCount: 0,
      goodCount: 0,
      shortCount: 0,
      fullPct: 0,
      goodPct: 0,
      shortPct: 0,
      dominantLength: null,
      dominantLabel: 'No balls yet',
      averageDistanceM: 0,
      trendDirection: 'none',
    };
  }

  let fullCount = 0;
  let goodCount = 0;
  let shortCount = 0;
  let sumDist = 0;

  for (const ball of list) {
    sumDist += ball.pitchDistanceM;
    if (ball.length === 'full') fullCount += 1;
    else if (ball.length === 'good') goodCount += 1;
    else shortCount += 1;
  }

  const fullPct = Math.round((fullCount / totalBalls) * 100);
  const goodPct = Math.round((goodCount / totalBalls) * 100);
  const shortPct = Math.max(0, 100 - fullPct - goodPct);

  let dominantLength: DeliveryLength | null = 'good';
  let dominantLabel = 'Good';
  if (fullCount === goodCount && goodCount === shortCount) {
    dominantLength = list[list.length - 1].length;
    dominantLabel = 'Balanced';
  } else {
    const counts: Record<DeliveryLength, number> = {
      full: fullCount,
      good: goodCount,
      short: shortCount,
    };
    const maxCount = Math.max(fullCount, goodCount, shortCount);
    // Prefer the most recently bowled length when two zones are tied
    for (let i = list.length - 1; i >= 0; i--) {
      if (counts[list[i].length] === maxCount) {
        dominantLength = list[i].length;
        break;
      }
    }
    dominantLabel =
      dominantLength === 'full' ? 'Full' : dominantLength === 'good' ? 'Good' : 'Short';
  }

  let trendDirection: PitchLengthTrendsSummary['trendDirection'] = 'steady';
  if (totalBalls >= 3) {
    const split = Math.floor(totalBalls / 2);
    const earlyAvg =
      list.slice(0, split).reduce((acc, b) => acc + b.pitchDistanceM, 0) / Math.max(1, split);
    const lateSlice = list.slice(split);
    const lateAvg =
      lateSlice.reduce((acc, b) => acc + b.pitchDistanceM, 0) / Math.max(1, lateSlice.length);
    const delta = lateAvg - earlyAvg;
    if (delta <= -1.2) trendDirection = 'fuller';
    else if (delta >= 1.2) trendDirection = 'shorter';
  }

  return {
    totalBalls,
    fullCount,
    goodCount,
    shortCount,
    fullPct,
    goodPct,
    shortPct,
    dominantLength,
    dominantLabel,
    averageDistanceM: Number((sumDist / totalBalls).toFixed(1)),
    trendDirection,
  };
}
