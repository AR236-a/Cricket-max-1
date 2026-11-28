import {
  BowlingSide,
  DeliveryLength,
  DeliveryResolution,
  DeliveryType,
  DrsAppealType,
  DrsBallTrackingData,
  DrsOnFieldDecision,
  DrsProbabilityEstimate,
  DrsStumpingData,
  DrsThirdUmpireOutcome,
  MatchFormat,
  PitchCondition,
  ShotType,
  WeatherCondition,
} from './types';

export const DRS_TIME_LIMIT_SEC = 15;

export interface DrsFormatRuleSpec {
  formatKey: 'test' | 'odi' | 't20i';
  label: string;
  reviewsPerInnings: number;
  superOverReviews: number | null;
  timeLimitSec: number;
  whoCanRequest: string;
  eligibleDecisions: string;
  retentionRule: string;
}

export const DRS_FORMAT_RULES: Record<'test' | 'odi' | 't20i', DrsFormatRuleSpec> = {
  test: {
    formatKey: 'test',
    label: 'Test Cricket',
    reviewsPerInnings: 3,
    superOverReviews: null,
    timeLimitSec: DRS_TIME_LIMIT_SEC,
    whoCanRequest: 'Dismissed batter or fielding captain',
    eligibleDecisions: 'Dismissals only (LBW & Stumping; excluding Timed out)',
    retentionRule: 'Kept if overturned or "Umpire\'s Call"',
  },
  odi: {
    formatKey: 'odi',
    label: 'ODI Cricket',
    reviewsPerInnings: 2,
    superOverReviews: 1,
    timeLimitSec: DRS_TIME_LIMIT_SEC,
    whoCanRequest: 'Dismissed batter or fielding captain',
    eligibleDecisions: 'Dismissals only (LBW & Stumping; excluding Timed out)',
    retentionRule: 'Kept if overturned or "Umpire\'s Call"',
  },
  t20i: {
    formatKey: 't20i',
    label: 'T20I Cricket',
    reviewsPerInnings: 2,
    superOverReviews: 1,
    timeLimitSec: DRS_TIME_LIMIT_SEC,
    whoCanRequest: 'Dismissed batter or fielding captain',
    eligibleDecisions: 'Dismissals only (LBW & Stumping; excluding Timed out)',
    retentionRule: 'Kept if overturned or "Umpire\'s Call"',
  },
};

export function getDrsFormatKey(
  format: MatchFormat,
  totalOvers: number
): 'test' | 'odi' | 't20i' {
  if (format === 'test') return 'test';
  return totalOvers >= 40 ? 'odi' : 't20i';
}

export function getDrsAllowance(
  format: MatchFormat,
  totalOvers = 20,
  isSuperOver = false
): number {
  const key = getDrsFormatKey(format, totalOvers);
  const spec = DRS_FORMAT_RULES[key];
  if (isSuperOver) {
    return spec.superOverReviews ?? 0;
  }
  return spec.reviewsPerInnings;
}

export function isEligibleDrsDecision(
  appealType: DrsAppealType | string | undefined
): appealType is DrsAppealType {
  return appealType === 'LBW' || appealType === 'Stumped';
}

export function deriveLbwThirdUmpireOutcome(tracking: DrsBallTrackingData): DrsThirdUmpireOutcome {
  if (tracking.ultraEdge === 'Spike Near Bat') return 'NOT_OUT';
  if (tracking.pitching === 'Outside Leg') return 'NOT_OUT';
  if (tracking.impact === 'Outside Off') return 'NOT_OUT';
  if (tracking.wickets === 'Missing') return 'NOT_OUT';
  if (tracking.impact === "Umpire's Call" || tracking.wickets === "Umpire's Call") {
    return 'UMPIRES_CALL';
  }
  return 'OUT';
}

export function deriveStumpingThirdUmpireOutcome(
  stumping: DrsStumpingData
): Exclude<DrsThirdUmpireOutcome, 'UMPIRES_CALL'> {
  if (stumping.backFootPosition === 'Behind Crease (Grounded)') {
    return 'NOT_OUT';
  }
  return 'OUT';
}

function clampInt(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function computeStumpingOutProbability(params: {
  lengthUsed: DeliveryLength;
  deliveryUsed: DeliveryType;
  shotUsed?: ShotType;
  spinDegree?: number;
  isSpeculativePostBall?: boolean;
  rng?: () => number;
}): number {
  const rng = params.rng ?? Math.random;
  let pct = params.isSpeculativePostBall ? 18 : 42;
  if (params.lengthUsed === 'full') pct += 8;
  else if (params.lengthUsed === 'short') pct -= 8;
  if (
    params.deliveryUsed === 'googly' ||
    params.deliveryUsed === 'doosra' ||
    params.deliveryUsed === 'carrom'
  ) {
    pct += 6;
  }
  if ((params.spinDegree ?? 5) >= 8) pct += 5;
  if (params.shotUsed === 'loft' || params.shotUsed === 'drive') pct += 6;
  pct += (rng() - 0.5) * 14;
  return clampInt(pct, 8, 62);
}

export function computeDrsProbabilityEstimate(params: {
  appealType: DrsAppealType;
  onFieldDecision: DrsOnFieldDecision;
  deliveryUsed: DeliveryType;
  lengthUsed: DeliveryLength;
  shotUsed?: ShotType;
  pitchCondition?: PitchCondition;
  weatherCondition?: WeatherCondition;
  bowlingSide?: BowlingSide;
  paceSpeedKph?: number;
  spinDegree?: number;
  lineOffsetCm?: number;
  pitchDistanceM?: number;
  isSpeculativePostBall?: boolean;
  variationUnit?: number;
  rng?: () => number;
}): DrsProbabilityEstimate {
  const unitRoll =
    typeof params.variationUnit === 'number'
      ? Math.max(0, Math.min(1, params.variationUnit))
      : (params.rng ?? Math.random)();
  const {
    onFieldDecision,
    deliveryUsed,
    lengthUsed,
    shotUsed,
    pitchCondition = 'hard',
    weatherCondition = 'clear',
    bowlingSide = 'over',
    paceSpeedKph,
    spinDegree,
    lineOffsetCm,
    pitchDistanceM,
    isSpeculativePostBall = false,
  } = params;

  const isShortBall = lengthUsed === 'short' || deliveryUsed === 'bouncer';
  const isFullOrYorker = lengthUsed === 'full' || deliveryUsed === 'yorker';
  const isHighMovement =
    deliveryUsed === 'swing' ||
    deliveryUsed === 'leg_spin' ||
    deliveryUsed === 'googly' ||
    deliveryUsed === 'doosra' ||
    (spinDegree !== undefined && spinDegree >= 8) ||
    weatherCondition === 'overcast';
  const isStraightSeam =
    deliveryUsed === 'fast' || deliveryUsed === 'seam' || deliveryUsed === 'arm_ball';

  let rawOverturn: number;
  let rawUc: number;

  if (onFieldDecision === 'OUT') {
    // Batter challenging OUT LBW
    rawOverturn = 32;
    rawUc = 22;

    if (isShortBall) {
      rawOverturn += 18;
      rawUc += 2;
    } else if (isFullOrYorker) {
      rawOverturn -= 11;
      rawUc -= 2;
    }

    if (isHighMovement) {
      rawOverturn += 10;
      rawUc += 4;
    } else if (isStraightSeam) {
      rawOverturn -= 6;
    }

    if (bowlingSide === 'round') {
      rawOverturn += 6;
      rawUc += 2;
    }
    if (shotUsed === 'sweep' || shotUsed === 'flick' || shotUsed === 'defend') {
      rawOverturn += 6;
    }
    if (pitchCondition === 'hard' && deliveryUsed === 'fast') {
      rawOverturn += 4;
    } else if (pitchCondition === 'dry' && isHighMovement) {
      rawOverturn += 5;
    }
    if (lineOffsetCm !== undefined && lineOffsetCm < -22) {
      rawOverturn += 14;
    } else if (lineOffsetCm !== undefined && Math.abs(lineOffsetCm) <= 10 && !isShortBall) {
      rawOverturn -= 9;
    }
    if (paceSpeedKph !== undefined && paceSpeedKph >= 146 && lengthUsed !== 'full') {
      rawOverturn += 5;
    }
    if (pitchDistanceM !== undefined && pitchDistanceM > 9.5) {
      rawOverturn += 8;
    }

    rawOverturn += (unitRoll - 0.5) * 30;
    rawUc += (0.5 - unitRoll) * 6;
  } else {
    // Bowler / fielding captain challenging NOT OUT LBW
    rawOverturn = isSpeculativePostBall ? 22 : 34;
    rawUc = isSpeculativePostBall ? 19 : 23;

    if (isShortBall) {
      rawOverturn -= 14;
      rawUc -= 6;
    } else if (isFullOrYorker) {
      rawOverturn += 12;
      rawUc += 3;
    }

    if (isStraightSeam) {
      rawOverturn += 8;
      rawUc += 2;
    } else if (isHighMovement) {
      rawOverturn -= 5;
      rawUc += 3;
    }

    if (pitchCondition === 'green' && !isHighMovement) {
      rawOverturn += 6;
    } else if (pitchCondition === 'dry' && spinDegree !== undefined && spinDegree >= 6) {
      rawOverturn += 5;
    }
    if (lineOffsetCm !== undefined) {
      if (Math.abs(lineOffsetCm) <= 15) rawOverturn += 10;
      else if (Math.abs(lineOffsetCm) >= 28) rawOverturn -= 10;
    }
    if (shotUsed === 'sweep' || shotUsed === 'loft') {
      rawOverturn += 5;
    }

    rawOverturn += (unitRoll - 0.5) * 26;
    rawUc += (0.5 - unitRoll) * 6;
  }

  const overturnPct = clampInt(rawOverturn, 6, 78);
  const maxUcAllowed = Math.max(8, 88 - overturnPct);
  const umpiresCallPct = clampInt(rawUc, 8, Math.min(28, maxUcAllowed));
  const retainReviewPct = Math.min(88, overturnPct + umpiresCallPct);
  const loseReviewPct = Math.max(12, 100 - retainReviewPct);

  const confidenceTier: DrsProbabilityEstimate['confidenceTier'] =
    overturnPct >= 46 || retainReviewPct >= 68
      ? 'high'
      : overturnPct >= 25 || retainReviewPct >= 46
      ? 'medium'
      : 'low';

  const confidenceLabel: DrsProbabilityEstimate['confidenceLabel'] =
    confidenceTier === 'high'
      ? 'STRONG REVIEW'
      : confidenceTier === 'medium'
      ? 'CLOSE CALL'
      : 'RISKY — LIKELY WASTED';

  let hint: string;
  if (onFieldDecision === 'OUT') {
    if (confidenceTier === 'high') {
      hint = isShortBall
        ? 'High bounce detected — trajectory looks likely to clear the bails.'
        : isHighMovement
        ? 'Strong angle/movement — ball may miss leg stump or catch an inside edge.'
        : 'Pitching/impact margin favors batter — high chance of overturning or keeping review.';
    } else if (confidenceTier === 'medium') {
      hint = "Tight margin near stump line — strong chance of Umpire's Call to retain review.";
    } else {
      hint = 'Struck plumb in front of the stumps — reviewing carries high risk of losing DRS.';
    }
  } else if (confidenceTier === 'high') {
    hint = isFullOrYorker
      ? 'Full, straight trajectory hitting in front of middle — strong LBW shout.'
      : "Tight line attacking the stumps — high chance of hitting or retaining via Umpire's Call.";
  } else if (confidenceTier === 'medium') {
    hint = "Borderline impact/stump clipping — Umpire's Call could save the review, but overturn is 50/50.";
  } else {
    hint = isShortBall
      ? 'Pitched too short for LBW — likely bouncing over stumps and wasting a review.'
      : 'Wide angle or bat involvement likely — high risk of wasting this review.';
  }

  return {
    overturnPct,
    umpiresCallPct,
    retainReviewPct,
    loseReviewPct,
    confidenceTier,
    confidenceLabel,
    hint,
  };
}

export function generateLbwTrackingData(
  onFieldDecision: DrsOnFieldDecision,
  rng: () => number = Math.random,
  isSpeculativePostBall = false,
  probabilityEstimate?: DrsProbabilityEstimate
): DrsBallTrackingData {
  const roll = rng();

  const overturnCutoff = probabilityEstimate
    ? probabilityEstimate.overturnPct / 100
    : onFieldDecision === 'OUT'
    ? 0.32
    : isSpeculativePostBall
    ? 0.24
    : 0.34;
  const retainCutoff = probabilityEstimate
    ? probabilityEstimate.retainReviewPct / 100
    : onFieldDecision === 'OUT'
    ? 0.55
    : isSpeculativePostBall
    ? 0.44
    : 0.58;

  if (onFieldDecision === 'OUT') {
    if (roll < overturnCutoff) {
      const reasonRoll = rng();
      if (reasonRoll < 0.31) {
        return {
          pitching: 'In Line',
          impact: 'In Line',
          wickets: 'Hitting',
          ultraEdge: 'Spike Near Bat',
          pitchXNorm: -0.1,
          impactXNorm: 0.05,
          wicketXNorm: 0.12,
          wicketHeightNorm: 0.48,
        };
      }
      if (reasonRoll < 0.56) {
        return {
          pitching: 'Outside Leg',
          impact: 'In Line',
          wickets: 'Hitting',
          ultraEdge: 'Flat Line (No Bat)',
          pitchXNorm: -0.78,
          impactXNorm: -0.35,
          wicketXNorm: -0.05,
          wicketHeightNorm: 0.52,
        };
      }
      if (reasonRoll < 0.78) {
        return {
          pitching: 'Outside Off',
          impact: 'Outside Off',
          wickets: 'Hitting',
          ultraEdge: 'Flat Line (No Bat)',
          pitchXNorm: 0.72,
          impactXNorm: 0.64,
          wicketXNorm: 0.35,
          wicketHeightNorm: 0.5,
        };
      }
      const goingOver = rng() < 0.5;
      return {
        pitching: 'In Line',
        impact: 'In Line',
        wickets: 'Missing',
        ultraEdge: 'Flat Line (No Bat)',
        pitchXNorm: 0.12,
        impactXNorm: 0.22,
        wicketXNorm: goingOver ? 0.15 : 0.78,
        wicketHeightNorm: goingOver ? 1.18 : 0.58,
      };
    }
    if (roll < retainCutoff) {
      const impactUc = rng() < 0.35;
      return {
        pitching: 'In Line',
        impact: impactUc ? "Umpire's Call" : 'In Line',
        wickets: impactUc ? 'Hitting' : "Umpire's Call",
        ultraEdge: 'Flat Line (No Bat)',
        pitchXNorm: 0.22,
        impactXNorm: impactUc ? 0.46 : 0.28,
        wicketXNorm: impactUc ? 0.25 : 0.47,
        wicketHeightNorm: impactUc ? 0.56 : 0.92,
      };
    }
    return {
      pitching: rng() < 0.7 ? 'In Line' : 'Outside Off',
      impact: 'In Line',
      wickets: 'Hitting',
      ultraEdge: 'Flat Line (No Bat)',
      pitchXNorm: rng() < 0.7 ? 0.05 : 0.56,
      impactXNorm: 0.08,
      wicketXNorm: -0.06,
      wicketHeightNorm: 0.44,
    };
  }

  // On-field NOT OUT (bowler / fielding captain reviewing):
  if (roll < overturnCutoff) {
    return {
      pitching: rng() < 0.75 ? 'In Line' : 'Outside Off',
      impact: 'In Line',
      wickets: 'Hitting',
      ultraEdge: 'Flat Line (No Bat)',
      pitchXNorm: 0.1,
      impactXNorm: 0.04,
      wicketXNorm: -0.08,
      wicketHeightNorm: 0.46,
    };
  }
  if (roll < retainCutoff) {
    const impactUc = rng() < 0.4;
    return {
      pitching: 'In Line',
      impact: impactUc ? "Umpire's Call" : 'In Line',
      wickets: impactUc ? 'Hitting' : "Umpire's Call",
      ultraEdge: 'Flat Line (No Bat)',
      pitchXNorm: -0.18,
      impactXNorm: impactUc ? -0.46 : -0.25,
      wicketXNorm: impactUc ? -0.22 : -0.46,
      wicketHeightNorm: 0.88,
    };
  }
  const failRoll = rng();
  if (failRoll < 0.34) {
    return {
      pitching: 'Outside Leg',
      impact: 'In Line',
      wickets: 'Hitting',
      ultraEdge: 'Flat Line (No Bat)',
      pitchXNorm: -0.82,
      impactXNorm: -0.32,
      wicketXNorm: -0.02,
      wicketHeightNorm: 0.5,
    };
  }
  if (failRoll < 0.72) {
    return {
      pitching: 'In Line',
      impact: 'In Line',
      wickets: 'Missing',
      ultraEdge: 'Flat Line (No Bat)',
      pitchXNorm: 0.18,
      impactXNorm: 0.34,
      wicketXNorm: 0.84,
      wicketHeightNorm: 0.62,
    };
  }
  return {
    pitching: 'In Line',
    impact: 'In Line',
    wickets: 'Hitting',
    ultraEdge: 'Spike Near Bat',
    pitchXNorm: 0.0,
    impactXNorm: 0.1,
    wicketXNorm: 0.15,
    wicketHeightNorm: 0.49,
  };
}

export function generateStumpingCheckData(
  onFieldDecision: DrsOnFieldDecision,
  rng: () => number = Math.random,
  isSpeculativePostBall = false
): DrsStumpingData {
  const roll = rng();

  if (onFieldDecision === 'OUT') {
    if (roll < 0.36) {
      return {
        backFootPosition: 'Behind Crease (Grounded)',
        bailsLit: true,
        ultraEdge: 'No Bat Involved',
        footOffsetMm: Math.round(12 + rng() * 38),
      };
    }
    if (roll < 0.68) {
      return {
        backFootPosition: 'On Line (Nothing Behind)',
        bailsLit: true,
        ultraEdge: 'No Bat Involved',
        footOffsetMm: 0,
      };
    }
    return {
      backFootPosition: 'In Air (Out of Crease)',
      bailsLit: true,
      ultraEdge: 'No Bat Involved',
      footOffsetMm: -Math.round(14 + rng() * 36),
    };
  }

  // On-field NOT OUT / Umpire Stumping Referral:
  const outCutoff = isSpeculativePostBall ? 0.18 : 0.42;
  if (roll < outCutoff) {
    const inAir = rng() < 0.5;
    return {
      backFootPosition: inAir ? 'In Air (Out of Crease)' : 'On Line (Nothing Behind)',
      bailsLit: true,
      ultraEdge: 'No Bat Involved',
      footOffsetMm: inAir ? -Math.round(10 + rng() * 30) : 0,
    };
  }
  return {
    backFootPosition: 'Behind Crease (Grounded)',
    bailsLit: true,
    ultraEdge: 'No Bat Involved',
    footOffsetMm: Math.round(15 + rng() * 45),
  };
}

export interface EvaluatedDrsVerdict {
  thirdUmpireOutcome: DrsThirdUmpireOutcome;
  finalDecisionIsOut: boolean;
  overturned: boolean;
  reviewRetained: boolean;
  nextReviewsRemaining: number;
  tracking?: DrsBallTrackingData;
  stumpingCheck?: DrsStumpingData;
  verdictSummary: string;
}

export function evaluateDrsVerdict(params: {
  appealType: DrsAppealType;
  onFieldDecision: DrsOnFieldDecision;
  reviewsRemaining: number;
  isUmpireReferral?: boolean;
  isSpeculativePostBall?: boolean;
  probabilityEstimate?: DrsProbabilityEstimate;
  tracking?: DrsBallTrackingData;
  stumpingCheck?: DrsStumpingData;
  rng?: () => number;
}): EvaluatedDrsVerdict {
  const rng = params.rng ?? Math.random;
  const {
    appealType,
    onFieldDecision,
    reviewsRemaining,
    isUmpireReferral = false,
    isSpeculativePostBall = false,
    probabilityEstimate,
  } = params;

  let tracking = params.tracking;
  let stumpingCheck = params.stumpingCheck;
  let thirdUmpireOutcome: DrsThirdUmpireOutcome;

  if (appealType === 'LBW') {
    tracking =
      tracking ??
      generateLbwTrackingData(onFieldDecision, rng, isSpeculativePostBall, probabilityEstimate);
    thirdUmpireOutcome = deriveLbwThirdUmpireOutcome(tracking);
  } else {
    stumpingCheck =
      stumpingCheck ?? generateStumpingCheckData(onFieldDecision, rng, isSpeculativePostBall);
    thirdUmpireOutcome = deriveStumpingThirdUmpireOutcome(stumpingCheck);
  }

  const finalDecisionIsOut =
    thirdUmpireOutcome === 'UMPIRES_CALL'
      ? onFieldDecision === 'OUT'
      : thirdUmpireOutcome === 'OUT';

  const overturned = finalDecisionIsOut !== (onFieldDecision === 'OUT');
  const isUmpiresCall = thirdUmpireOutcome === 'UMPIRES_CALL';

  // Official DRS rule: Umpire Stumping Referrals use zero DRS reviews; otherwise kept if overturned OR Umpire's Call.
  const reviewRetained = isUmpireReferral || overturned || isUmpiresCall;
  const nextReviewsRemaining = reviewRetained
    ? reviewsRemaining
    : Math.max(0, reviewsRemaining - 1);

  const verdictLabel = isUmpiresCall
    ? `UMPIRE'S CALL (${finalDecisionIsOut ? 'OUT' : 'NOT OUT'})`
    : finalDecisionIsOut
    ? 'OUT'
    : 'NOT OUT';

  const retentionNote = isUmpireReferral
    ? 'Umpire Referral — No DRS Review Used'
    : overturned
    ? 'Decision OVERTURNED — Review RETAINED'
    : isUmpiresCall
    ? "UMPIRE'S CALL — On-field decision stands, Review RETAINED"
    : 'Decision UPHELD — Review LOST';

  return {
    thirdUmpireOutcome,
    finalDecisionIsOut,
    overturned,
    reviewRetained,
    nextReviewsRemaining,
    tracking,
    stumpingCheck,
    verdictSummary: `3rd Umpire: ${verdictLabel}. ${retentionNote}.`,
  };
}

export function shouldAiRequestDrs(params: {
  appealType: DrsAppealType;
  onFieldDecision: DrsOnFieldDecision;
  reviewsRemaining: number;
  probabilityEstimate?: DrsProbabilityEstimate;
  rng?: () => number;
}): boolean {
  if (params.reviewsRemaining <= 0) return false;
  const rng = params.rng ?? Math.random;
  if (params.probabilityEstimate) {
    const { confidenceTier, retainReviewPct, overturnPct } = params.probabilityEstimate;
    if (confidenceTier === 'low' && params.reviewsRemaining <= 1) {
      return rng() < 0.14;
    }
    if (confidenceTier === 'high') {
      return rng() < (params.reviewsRemaining >= 2 ? 0.85 : 0.72);
    }
    const smartThreshold = Math.min(0.75, Math.max(0.22, (overturnPct + retainReviewPct * 0.35) / 100));
    return rng() < smartThreshold;
  }
  // AI reviews assertively when it has 2+ reviews left, selectively when down to 1 review
  const threshold =
    params.onFieldDecision === 'OUT'
      ? params.reviewsRemaining >= 2
        ? 0.62
        : 0.38
      : params.reviewsRemaining >= 2
      ? 0.55
      : 0.30;
  return rng() < threshold;
}

export function applyDrsVerdictToResolution(params: {
  resolution: DeliveryResolution;
  appealType: DrsAppealType;
  finalDecisionIsOut: boolean;
  strikerName: string;
  bowlerName: string;
  verdictSummary: string;
}): DeliveryResolution {
  const { resolution, appealType, finalDecisionIsOut, strikerName, bowlerName, verdictSummary } =
    params;

  if (finalDecisionIsOut) {
    return {
      ...resolution,
      runs: 0,
      isWicket: true,
      wicketKind: appealType,
      isBoundaryFour: false,
      isBoundarySix: false,
      outcomeLabel: `OUT! ${appealType.toUpperCase()} (DRS)`,
      ballSymbol: 'W',
      hitDistanceFactor: 0.08,
      commentary: `DRS VERDICT: ${strikerName} is OUT (${appealType}) off ${bowlerName}! ${verdictSummary}`,
      drsAppeal: undefined,
    };
  }

  return {
    ...resolution,
    runs: 0,
    isWicket: false,
    wicketKind: undefined,
    isBoundaryFour: false,
    isBoundarySix: false,
    outcomeLabel: 'NOT OUT (DRS)',
    ballSymbol: '0',
    hitDistanceFactor: 0.14,
    commentary: `DRS VERDICT: ${strikerName} survives — NOT OUT! ${verdictSummary}`,
    drsAppeal: undefined,
  };
}
