import {
  DeliveryResolution,
  DrsAppealType,
  DrsBallTrackingData,
  DrsOnFieldDecision,
  DrsStumpingData,
  DrsThirdUmpireOutcome,
  MatchFormat,
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

export function generateLbwTrackingData(
  onFieldDecision: DrsOnFieldDecision,
  rng: () => number = Math.random,
  isSpeculativePostBall = false
): DrsBallTrackingData {
  const roll = rng();

  if (onFieldDecision === 'OUT') {
    // ~32% Overturned (NOT OUT), ~23% Umpire's Call (OUT stands & kept), ~45% Plumb OUT (lost)
    if (roll < 0.1) {
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
    if (roll < 0.18) {
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
    if (roll < 0.25) {
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
    if (roll < 0.32) {
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
    if (roll < 0.55) {
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
  const outCutoff = isSpeculativePostBall ? 0.24 : 0.34;
  const ucCutoff = isSpeculativePostBall ? 0.44 : 0.58;
  if (roll < outCutoff) {
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
  if (roll < ucCutoff) {
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
  if (roll < 0.72) {
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
  if (roll < 0.88) {
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
  } = params;

  let tracking = params.tracking;
  let stumpingCheck = params.stumpingCheck;
  let thirdUmpireOutcome: DrsThirdUmpireOutcome;

  if (appealType === 'LBW') {
    tracking = tracking ?? generateLbwTrackingData(onFieldDecision, rng, isSpeculativePostBall);
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
  rng?: () => number;
}): boolean {
  if (params.reviewsRemaining <= 0) return false;
  const rng = params.rng ?? Math.random;
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
