import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDeliveryToMatch,
  beginDrsOrApplyDelivery,
  clearBowlerChallenge,
  completeDrsThirdUmpire,
  createInitialMatchState,
  declineOrExpireDrsReview,
  getActiveInnings,
  requestDrsReview,
  requestPostBallBowlerChallenge,
  revealDrsVerdict,
  startNextInnings,
} from './cricketEngine';
import {
  computeDrsProbabilityEstimate,
  computeStumpingOutProbability,
  deriveLbwThirdUmpireOutcome,
  deriveStumpingThirdUmpireOutcome,
  DRS_FORMAT_RULES,
  DRS_TIME_LIMIT_SEC,
  evaluateDrsVerdict,
  getDrsAllowance,
  isEligibleDrsDecision,
} from './drs';
import { DeliveryResolution } from './types';

function makeSampleResolution(
  overrides: Partial<DeliveryResolution> = {}
): DeliveryResolution {
  return {
    runs: 0,
    isWicket: true,
    wicketKind: 'LBW',
    isBoundaryFour: false,
    isBoundarySix: false,
    outcomeLabel: 'OUT! LBW',
    ballSymbol: 'W',
    commentary: 'Big appeal and the finger goes up!',
    hitAngleRad: 0.1,
    hitDistanceFactor: 0.08,
    shotUsed: 'defend',
    deliveryUsed: 'seam',
    lengthUsed: 'good',
    drsAppeal: { appealType: 'LBW', onFieldDecision: 'OUT' },
    ...overrides,
  };
}

test('DRS format rules grant 3 reviews in Test, 2 in ODI/T20I, and 1 in Super Over for limited overs', () => {
  assert.equal(DRS_TIME_LIMIT_SEC, 15);
  assert.equal(getDrsAllowance('test', 90), 3);
  assert.equal(getDrsAllowance('limited', 50), 2);
  assert.equal(getDrsAllowance('limited', 20), 2);
  assert.equal(getDrsAllowance('limited', 10), 2);

  // Super Over rules
  assert.equal(getDrsAllowance('test', 90, true), 0);
  assert.equal(DRS_FORMAT_RULES.test.superOverReviews, null);
  assert.equal(getDrsAllowance('limited', 50, true), 1);
  assert.equal(getDrsAllowance('limited', 20, true), 1);

  // Eligible decisions: LBW & Stumped only (excludes Timed out, Bowled, Caught)
  assert.equal(isEligibleDrsDecision('LBW'), true);
  assert.equal(isEligibleDrsDecision('Stumped'), true);
  assert.equal(isEligibleDrsDecision('Timed out'), false);
  assert.equal(isEligibleDrsDecision('Bowled'), false);
  assert.equal(isEligibleDrsDecision('Caught'), false);
});

test('LBW and Stumping Third Umpire derivation and retention rules handle Overturned, Umpires Call, Upheld, and zero-cost Stumping referrals', () => {
  // Inside edge -> NOT OUT -> Overturned when on-field was OUT -> review RETAINED
  const edgeOutcome = deriveLbwThirdUmpireOutcome({
    pitching: 'In Line',
    impact: 'In Line',
    wickets: 'Hitting',
    ultraEdge: 'Spike Near Bat',
    pitchXNorm: 0,
    impactXNorm: 0,
    wicketXNorm: 0,
    wicketHeightNorm: 0.5,
  });
  assert.equal(edgeOutcome, 'NOT_OUT');

  const overturnedVerdict = evaluateDrsVerdict({
    appealType: 'LBW',
    onFieldDecision: 'OUT',
    reviewsRemaining: 2,
    tracking: {
      pitching: 'Outside Leg',
      impact: 'In Line',
      wickets: 'Hitting',
      ultraEdge: 'Flat Line (No Bat)',
      pitchXNorm: -0.8,
      impactXNorm: -0.3,
      wicketXNorm: 0,
      wicketHeightNorm: 0.5,
    },
  });
  assert.equal(overturnedVerdict.finalDecisionIsOut, false);
  assert.equal(overturnedVerdict.overturned, true);
  assert.equal(overturnedVerdict.reviewRetained, true);
  assert.equal(overturnedVerdict.nextReviewsRemaining, 2);

  // Umpire's Call -> On-field stands AND review RETAINED
  const umpiresCallVerdict = evaluateDrsVerdict({
    appealType: 'LBW',
    onFieldDecision: 'OUT',
    reviewsRemaining: 2,
    tracking: {
      pitching: 'In Line',
      impact: 'In Line',
      wickets: "Umpire's Call",
      ultraEdge: 'Flat Line (No Bat)',
      pitchXNorm: 0.2,
      impactXNorm: 0.3,
      wicketXNorm: 0.47,
      wicketHeightNorm: 0.9,
    },
  });
  assert.equal(umpiresCallVerdict.thirdUmpireOutcome, 'UMPIRES_CALL');
  assert.equal(umpiresCallVerdict.finalDecisionIsOut, true);
  assert.equal(umpiresCallVerdict.reviewRetained, true);
  assert.equal(umpiresCallVerdict.nextReviewsRemaining, 2);

  // Upheld plumb OUT -> review LOST (2 -> 1)
  const upheldOutVerdict = evaluateDrsVerdict({
    appealType: 'LBW',
    onFieldDecision: 'OUT',
    reviewsRemaining: 2,
    tracking: {
      pitching: 'In Line',
      impact: 'In Line',
      wickets: 'Hitting',
      ultraEdge: 'Flat Line (No Bat)',
      pitchXNorm: 0,
      impactXNorm: 0,
      wicketXNorm: 0,
      wicketHeightNorm: 0.45,
    },
  });
  assert.equal(upheldOutVerdict.finalDecisionIsOut, true);
  assert.equal(upheldOutVerdict.overturned, false);
  assert.equal(upheldOutVerdict.reviewRetained, false);
  assert.equal(upheldOutVerdict.nextReviewsRemaining, 1);

  // Stumping: grounded behind crease -> NOT OUT; in air / on line -> OUT; umpire referral costs 0 reviews
  assert.equal(
    deriveStumpingThirdUmpireOutcome({
      backFootPosition: 'Behind Crease (Grounded)',
      bailsLit: true,
      ultraEdge: 'No Bat Involved',
      footOffsetMm: 22,
    }),
    'NOT_OUT'
  );
  assert.equal(
    deriveStumpingThirdUmpireOutcome({
      backFootPosition: 'In Air (Out of Crease)',
      bailsLit: true,
      ultraEdge: 'No Bat Involved',
      footOffsetMm: -18,
    }),
    'OUT'
  );
  const stumpingUmpireVerdict = evaluateDrsVerdict({
    appealType: 'Stumped',
    onFieldDecision: 'NOT_OUT',
    reviewsRemaining: 2,
    isUmpireReferral: true,
    stumpingCheck: {
      backFootPosition: 'Behind Crease (Grounded)',
      bailsLit: true,
      ultraEdge: 'No Bat Involved',
      footOffsetMm: 22,
    },
  });
  assert.equal(stumpingUmpireVerdict.finalDecisionIsOut, false);
  assert.equal(stumpingUmpireVerdict.reviewRetained, true);
  assert.equal(stumpingUmpireVerdict.nextReviewsRemaining, 2);
});

test('End-to-end engine DRS workflow supports LBW batter/bowler reviews, direct Third Umpire stumping referrals, 15s expiry, and innings reset', () => {
  const testMatch = createInitialMatchState({
    mode: 'ai',
    format: 'test',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 90,
    oversPerDay: 90,
    homeBatsFirst: true,
  });
  assert.equal(testMatch.innings1.battingReviewsRemaining, 3);
  assert.equal(testMatch.innings1.bowlingReviewsRemaining, 3);

  const odiMatch = createInitialMatchState({
    mode: 'pvp',
    format: 'limited',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 50,
    homeBatsFirst: true,
  });
  assert.equal(odiMatch.innings1.battingReviewsRemaining, 2);
  assert.equal(odiMatch.innings1.bowlingReviewsRemaining, 2);

  // 1) Batter given OUT LBW -> signals DRS within 15s -> Third Umpire overturns (rng=0.05 -> Spike Near Bat) -> batter stays NOT OUT & keeps 2/2 reviews
  const lbwOutRes = makeSampleResolution();
  const opened = beginDrsOrApplyDelivery(odiMatch, lbwOutRes);
  assert.equal(opened.drsOpened, true);
  assert.equal(opened.nextState.pendingDrsPopup?.phase, 'signal');
  assert.equal(opened.nextState.pendingDrsPopup?.requestingSide, 'batting');
  assert.equal(opened.nextState.pendingDrsPopup?.timeLimitSec, 15);

  let state = requestDrsReview(opened.nextState, () => 0.05);
  assert.equal(state.pendingDrsPopup?.phase, 'third_umpire');
  assert.equal(state.pendingDrsPopup?.finalDecisionIsOut, false);
  assert.equal(state.pendingDrsPopup?.reviewRetained, true);

  state = revealDrsVerdict(state);
  assert.equal(state.pendingDrsPopup?.phase, 'verdict');

  const appliedOverturn = completeDrsThirdUmpire(state);
  state = appliedOverturn.nextState;
  assert.equal(state.pendingDrsPopup, null);
  assert.equal(state.innings1.wickets, 0);
  assert.equal(state.innings1.ballsBowled, 1);
  assert.equal(state.innings1.battingReviewsRemaining, 2);

  // 2) Stumping NOT OUT appeal goes DIRECTLY to Third Umpire (no DRS signal prompt & 0 DRS reviews deducted)
  const stumpingNotOutRes = makeSampleResolution({
    isWicket: false,
    wicketKind: undefined,
    outcomeLabel: 'DOT BALL',
    ballSymbol: '0',
    deliveryUsed: 'off_spin',
    drsAppeal: { appealType: 'Stumped', onFieldDecision: 'NOT_OUT' },
  });
  const openedStump = beginDrsOrApplyDelivery(state, stumpingNotOutRes, () => 0.8);
  assert.equal(openedStump.drsOpened, true);
  assert.equal(openedStump.nextState.pendingDrsPopup?.phase, 'third_umpire');
  assert.equal(openedStump.nextState.pendingDrsPopup?.referralKind, 'umpire_stumping');
  assert.equal(openedStump.nextState.pendingDrsPopup?.finalDecisionIsOut, false);
  assert.equal(openedStump.nextState.pendingDrsPopup?.reviewRetained, true);
  state = completeDrsThirdUmpire(openedStump.nextState).nextState;
  assert.equal(state.innings1.wickets, 0);
  assert.equal(state.innings1.bowlingReviewsRemaining, 2);

  // 3) Bowler/captain LBW NOT OUT appeal -> signals DRS -> upheld NOT OUT (rng=0.95 -> outside off/missing) -> loses 1 bowling review (2 -> 1)
  const lbwNotOutRes = makeSampleResolution({
    isWicket: false,
    wicketKind: undefined,
    outcomeLabel: 'DOT BALL',
    ballSymbol: '0',
    deliveryUsed: 'seam',
    drsAppeal: { appealType: 'LBW', onFieldDecision: 'NOT_OUT' },
  });
  const openedLbwNotOut = beginDrsOrApplyDelivery(state, lbwNotOutRes);
  assert.equal(openedLbwNotOut.drsOpened, true);
  assert.equal(openedLbwNotOut.nextState.pendingDrsPopup?.phase, 'signal');
  assert.equal(openedLbwNotOut.nextState.pendingDrsPopup?.requestingSide, 'bowling');
  state = requestDrsReview(openedLbwNotOut.nextState, () => 0.95);
  assert.equal(state.pendingDrsPopup?.finalDecisionIsOut, false);
  assert.equal(state.pendingDrsPopup?.reviewRetained, false);
  state = completeDrsThirdUmpire(state).nextState;
  assert.equal(state.innings1.wickets, 0);
  assert.equal(state.innings1.bowlingReviewsRemaining, 1);

  // 4) Stumping direct Third Umpire OUT (rng=0.1) -> batter out Stumped & retains 1 bowling review
  const openedStumpOut = beginDrsOrApplyDelivery(state, stumpingNotOutRes, () => 0.1);
  assert.equal(openedStumpOut.nextState.pendingDrsPopup?.phase, 'third_umpire');
  assert.equal(openedStumpOut.nextState.pendingDrsPopup?.finalDecisionIsOut, true);
  state = completeDrsThirdUmpire(openedStumpOut.nextState).nextState;
  assert.equal(state.innings1.wickets, 1);
  assert.equal(state.innings1.batters[0].out, true);
  assert.equal(state.innings1.batters[0].dismissal, 'Stumped');
  assert.equal(state.innings1.bowlingReviewsRemaining, 1);

  // 5) 15s Timer expiry / decline applies on-field decision without deducting reviews
  const openedDecline = beginDrsOrApplyDelivery(state, lbwOutRes);
  assert.equal(openedDecline.drsOpened, true);
  state = declineOrExpireDrsReview(openedDecline.nextState).nextState;
  assert.equal(state.innings1.wickets, 2);
  assert.equal(state.innings1.battingReviewsRemaining, 2);

  // 6) Fresh 2nd innings resets reviews cleanly to format allowance (2 in ODI)
  state = {
    ...state,
    innings1: {
      ...state.innings1,
      battingReviewsRemaining: 0,
      bowlingReviewsRemaining: 1,
    },
  };
  // Verify 0 reviews left skips DRS prompt immediately
  const noReviewRes = beginDrsOrApplyDelivery(state, lbwOutRes);
  assert.equal(noReviewRes.drsOpened, false);
  assert.equal(noReviewRes.nextState.pendingDrsPopup, null);

  const inn2State = startNextInnings(noReviewRes.nextState);
  assert.equal(getActiveInnings(inn2State).battingReviewsRemaining, 2);
  assert.equal(getActiveInnings(inn2State).bowlingReviewsRemaining, 2);
});

test('Bowler can take post-ball DRS (LBW) or Third Umpire Stumping check on NOT OUT dot balls including 6th ball of over', () => {
  // User is bowling (homeBatsFirst: false in AI mode)
  let match = createInitialMatchState({
    mode: 'ai',
    format: 'limited',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 5,
    homeBatsFirst: false,
  });

  const spinDotBall: DeliveryResolution = {
    runs: 0,
    isWicket: false,
    isBoundaryFour: false,
    isBoundarySix: false,
    outcomeLabel: 'DOT BALL',
    ballSymbol: '0',
    commentary: 'Beaten past the outside edge! Huge shout from the keeper.',
    hitAngleRad: 0,
    hitDistanceFactor: 0.05,
    shotUsed: 'defend',
    deliveryUsed: 'off_spin',
    lengthUsed: 'good',
  };

  // Ball 1: spin dot ball populates pendingBowlerChallenge with isSpin=true
  let res = applyDeliveryToMatch(match, spinDotBall);
  match = res.nextState;
  assert.ok(match.pendingBowlerChallenge);
  assert.equal(match.pendingBowlerChallenge?.isSpin, true);
  assert.equal(match.pendingBowlerChallenge?.overCompleted, false);

  // Bowler requests 3rd Umpire Stumping check (overturned OUT when rng=0.05) -> wicket credited, 0 DRS reviews spent
  match = requestPostBallBowlerChallenge(match, 'Stumped', () => 0.05);
  assert.equal(match.pendingBowlerChallenge, null);
  assert.equal(match.pendingDrsPopup?.referralKind, 'umpire_stumping');
  assert.equal(match.pendingDrsPopup?.isPostBallChallenge, true);
  assert.equal(match.pendingDrsPopup?.finalDecisionIsOut, true);
  match = revealDrsVerdict(match);
  match = completeDrsThirdUmpire(match).nextState;
  assert.equal(match.innings1.wickets, 1);
  assert.equal(match.innings1.batters[0].dismissal, 'Stumped');
  assert.equal(match.innings1.bowlingReviewsRemaining, 2);
  assert.equal(match.innings1.currentOverBalls[0], 'W');

  // Balls 2-5 dot balls, then clear challenge to test Ball 6 over completion challenge
  for (let b = 2; b <= 5; b += 1) {
    match = applyDeliveryToMatch(match, spinDotBall).nextState;
    match = clearBowlerChallenge(match);
  }
  assert.equal(match.innings1.ballsBowled, 5);

  // Ball 6 (6th ball of over 1): pendingOverPopup AND pendingBowlerChallenge both exist
  match = applyDeliveryToMatch(match, spinDotBall).nextState;
  assert.ok(match.pendingOverPopup);
  assert.ok(match.pendingBowlerChallenge);
  assert.equal(match.pendingBowlerChallenge?.overCompleted, true);

  // Bowler takes DRS (LBW) on 6th ball -> rng=0.05 turns NOT OUT into LBW OUT while retaining 2/2 reviews
  match = requestPostBallBowlerChallenge(match, 'LBW', () => 0.05);
  assert.equal(match.pendingDrsPopup?.referralKind, 'drs');
  assert.equal(match.pendingDrsPopup?.finalDecisionIsOut, true);
  assert.equal(match.pendingDrsPopup?.reviewRetained, true);
  match = completeDrsThirdUmpire(match).nextState;

  assert.equal(match.innings1.wickets, 2);
  assert.equal(match.innings1.bowlingReviewsRemaining, 2);
  assert.equal(match.pendingOverPopup?.wicketsTaken, 2);
  assert.equal(match.pendingOverPopup?.balls[5], 'W');
  assert.equal(match.innings1.overHistory?.[0]?.wicketsInOver, 2);

  // Upheld NOT OUT post-ball LBW review deducts 1 bowling review (2 -> 1)
  match = { ...match, pendingOverPopup: null };
  match = applyDeliveryToMatch(match, spinDotBall).nextState;
  match = requestPostBallBowlerChallenge(match, 'LBW', () => 0.95);
  assert.equal(match.pendingDrsPopup?.finalDecisionIsOut, false);
  assert.equal(match.pendingDrsPopup?.reviewRetained, false);
  match = completeDrsThirdUmpire(match).nextState;
  assert.equal(match.innings1.wickets, 2);
  assert.equal(match.innings1.bowlingReviewsRemaining, 1);
});

test('AI Opponent takes DRS when batting (challenging OUT) and when bowling (challenging NOT OUT)', () => {
  // 1) AI Batting (homeBatsFirst: false -> away team AUS bats) gets given OUT LBW -> AI challenges and overturns (rng=0.05)
  let matchAiBatting = createInitialMatchState({
    mode: 'ai',
    format: 'limited',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 20,
    homeBatsFirst: false,
  });

  const lbwOutRes = makeSampleResolution();
  const aiBatReview = beginDrsOrApplyDelivery(matchAiBatting, lbwOutRes, () => 0.05);
  assert.equal(aiBatReview.drsOpened, true);
  assert.equal(aiBatReview.nextState.pendingDrsPopup?.triggeredByUser, false);
  assert.equal(aiBatReview.nextState.pendingDrsPopup?.phase, 'third_umpire');
  assert.equal(aiBatReview.nextState.pendingDrsPopup?.requestingTeamId, 'aus');
  assert.equal(aiBatReview.nextState.pendingDrsPopup?.requestingSide, 'batting');
  assert.equal(aiBatReview.nextState.pendingDrsPopup?.finalDecisionIsOut, false);

  matchAiBatting = completeDrsThirdUmpire(revealDrsVerdict(aiBatReview.nextState)).nextState;
  assert.equal(matchAiBatting.innings1.wickets, 0);
  assert.equal(matchAiBatting.innings1.battingReviewsRemaining, 2);

  // If AI batting review is upheld OUT (rng=0.9 from second rng call -> let's use deterministic sequence)
  let seqIdx = 0;
  const upheldSeq = [0.1, 0.9, 0.9, 0.9];
  const aiBatUpheld = beginDrsOrApplyDelivery(matchAiBatting, lbwOutRes, () => upheldSeq[seqIdx++] ?? 0.9);
  assert.equal(aiBatUpheld.drsOpened, true);
  assert.equal(aiBatUpheld.nextState.pendingDrsPopup?.finalDecisionIsOut, true);
  assert.equal(aiBatUpheld.nextState.pendingDrsPopup?.reviewRetained, false);
  matchAiBatting = completeDrsThirdUmpire(aiBatUpheld.nextState).nextState;
  assert.equal(matchAiBatting.innings1.wickets, 1);
  assert.equal(matchAiBatting.innings1.battingReviewsRemaining, 1);

  // 2) AI Bowling (homeBatsFirst: true -> away team AUS bowls) gets NOT OUT LBW appeal -> AI challenges and overturns user batter to OUT LBW
  let matchAiBowling = createInitialMatchState({
    mode: 'ai',
    format: 'limited',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 20,
    homeBatsFirst: true,
  });

  const lbwNotOutRes = makeSampleResolution({
    isWicket: false,
    wicketKind: undefined,
    outcomeLabel: 'DOT BALL',
    ballSymbol: '0',
    drsAppeal: { appealType: 'LBW', onFieldDecision: 'NOT_OUT' },
  });

  const aiBowlOverturn = beginDrsOrApplyDelivery(matchAiBowling, lbwNotOutRes, () => 0.05);
  assert.equal(aiBowlOverturn.drsOpened, true);
  assert.equal(aiBowlOverturn.nextState.pendingDrsPopup?.triggeredByUser, false);
  assert.equal(aiBowlOverturn.nextState.pendingDrsPopup?.phase, 'third_umpire');
  assert.equal(aiBowlOverturn.nextState.pendingDrsPopup?.requestingTeamId, 'aus');
  assert.equal(aiBowlOverturn.nextState.pendingDrsPopup?.requestingSide, 'bowling');
  assert.equal(aiBowlOverturn.nextState.pendingDrsPopup?.finalDecisionIsOut, true);

  matchAiBowling = completeDrsThirdUmpire(revealDrsVerdict(aiBowlOverturn.nextState)).nextState;
  assert.equal(matchAiBowling.innings1.wickets, 1);
  assert.equal(matchAiBowling.innings1.batters[0].out, true);
  assert.equal(matchAiBowling.innings1.batters[0].dismissal, 'LBW');
  assert.equal(matchAiBowling.innings1.bowlingReviewsRemaining, 2);

  // If AI bowling review is upheld NOT OUT -> AI loses 1 bowling review (2 -> 1)
  let seqIdx2 = 0;
  const bowlUpheldSeq = [0.1, 0.95, 0.95, 0.95];
  const aiBowlUpheld = beginDrsOrApplyDelivery(matchAiBowling, lbwNotOutRes, () => bowlUpheldSeq[seqIdx2++] ?? 0.95);
  assert.equal(aiBowlUpheld.drsOpened, true);
  assert.equal(aiBowlUpheld.nextState.pendingDrsPopup?.finalDecisionIsOut, false);
  assert.equal(aiBowlUpheld.nextState.pendingDrsPopup?.reviewRetained, false);
  matchAiBowling = completeDrsThirdUmpire(aiBowlUpheld.nextState).nextState;
  assert.equal(matchAiBowling.innings1.wickets, 1);
  assert.equal(matchAiBowling.innings1.bowlingReviewsRemaining, 1);
});

test('DRS probability estimates reflect delivery context, honor verdict cutoffs, and populate UI state before review', () => {
  // 1) Batter OUT: bouncer/short ball gives higher overturn chance than full straight yorker
  const bouncerOutProb = computeDrsProbabilityEstimate({
    appealType: 'LBW',
    onFieldDecision: 'OUT',
    deliveryUsed: 'bouncer',
    lengthUsed: 'short',
    shotUsed: 'defend',
    bowlingSide: 'round',
    pitchCondition: 'hard',
    paceSpeedKph: 150,
    variationUnit: 0.5,
  });
  const yorkerOutProb = computeDrsProbabilityEstimate({
    appealType: 'LBW',
    onFieldDecision: 'OUT',
    deliveryUsed: 'yorker',
    lengthUsed: 'full',
    shotUsed: 'drive',
    bowlingSide: 'over',
    pitchCondition: 'green',
    lineOffsetCm: 2,
    variationUnit: 0.5,
  });
  assert.ok(bouncerOutProb.overturnPct > yorkerOutProb.overturnPct);
  assert.equal(bouncerOutProb.retainReviewPct + bouncerOutProb.loseReviewPct, 100);
  assert.equal(yorkerOutProb.retainReviewPct + yorkerOutProb.loseReviewPct, 100);
  assert.ok(bouncerOutProb.overturnPct >= 6 && bouncerOutProb.overturnPct <= 78);
  assert.ok(yorkerOutProb.overturnPct >= 6 && yorkerOutProb.overturnPct <= 78);

  // 2) Bowler post-ball NOT OUT: bouncer warns low probability vs full straight yorker high shout
  const speculativeBouncer = computeDrsProbabilityEstimate({
    appealType: 'LBW',
    onFieldDecision: 'NOT_OUT',
    deliveryUsed: 'bouncer',
    lengthUsed: 'short',
    isSpeculativePostBall: true,
    variationUnit: 0.5,
  });
  const speculativeYorker = computeDrsProbabilityEstimate({
    appealType: 'LBW',
    onFieldDecision: 'NOT_OUT',
    deliveryUsed: 'yorker',
    lengthUsed: 'full',
    lineOffsetCm: 4,
    isSpeculativePostBall: true,
    variationUnit: 0.5,
  });
  assert.equal(speculativeBouncer.confidenceTier, 'low');
  assert.equal(speculativeBouncer.confidenceLabel, 'RISKY — LIKELY WASTED');
  assert.ok(speculativeYorker.overturnPct > speculativeBouncer.overturnPct);

  // 3) Verdict honors probabilityEstimate cutoffs (overturn, Umpire's Call, and uphold/lose)
  const customEst = {
    overturnPct: 60,
    umpiresCallPct: 20,
    retainReviewPct: 80,
    loseReviewPct: 20,
    confidenceTier: 'high' as const,
    confidenceLabel: 'STRONG REVIEW' as const,
    hint: 'Strong chance',
  };
  const vOverturn = evaluateDrsVerdict({
    appealType: 'LBW',
    onFieldDecision: 'OUT',
    reviewsRemaining: 2,
    probabilityEstimate: customEst,
    rng: () => 0.5, // < 0.60 -> overturned NOT OUT
  });
  assert.equal(vOverturn.finalDecisionIsOut, false);
  assert.equal(vOverturn.overturned, true);
  assert.equal(vOverturn.reviewRetained, true);

  const vUmpCall = evaluateDrsVerdict({
    appealType: 'LBW',
    onFieldDecision: 'OUT',
    reviewsRemaining: 2,
    probabilityEstimate: customEst,
    rng: () => 0.7, // between 0.60 and 0.80 -> UMPIRE'S CALL, review retained
  });
  assert.equal(vUmpCall.thirdUmpireOutcome, 'UMPIRES_CALL');
  assert.equal(vUmpCall.finalDecisionIsOut, true);
  assert.equal(vUmpCall.reviewRetained, true);

  const vUpheld = evaluateDrsVerdict({
    appealType: 'LBW',
    onFieldDecision: 'OUT',
    reviewsRemaining: 2,
    probabilityEstimate: customEst,
    rng: () => 0.9, // >= 0.80 -> upheld OUT, review lost
  });
  assert.equal(vUpheld.finalDecisionIsOut, true);
  assert.equal(vUpheld.reviewRetained, false);
  assert.equal(vUpheld.nextReviewsRemaining, 1);

  // 4) Engine attaches probabilityEstimate to pendingDrsPopup and lbwProbability + stumpingOutPct to pendingBowlerChallenge
  const match = createInitialMatchState({
    mode: 'ai',
    format: 'limited',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 20,
    homeBatsFirst: true,
  });
  const openedSignal = beginDrsOrApplyDelivery(match, makeSampleResolution());
  assert.ok(openedSignal.nextState.pendingDrsPopup?.probabilityEstimate);
  assert.equal(
    openedSignal.nextState.pendingDrsPopup!.probabilityEstimate!.retainReviewPct +
      openedSignal.nextState.pendingDrsPopup!.probabilityEstimate!.loseReviewPct,
    100
  );

  const bowlMatch = createInitialMatchState({
    mode: 'ai',
    format: 'limited',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 20,
    homeBatsFirst: false,
  });
  const spinDot = makeSampleResolution({
    isWicket: false,
    wicketKind: undefined,
    outcomeLabel: 'DOT BALL',
    ballSymbol: '0',
    deliveryUsed: 'off_spin',
    lengthUsed: 'full',
    spinDegree: 8,
    drsAppeal: undefined,
  });
  const afterDot = applyDeliveryToMatch(bowlMatch, spinDot).nextState;
  assert.ok(afterDot.pendingBowlerChallenge?.lbwProbability);
  assert.equal(typeof afterDot.pendingBowlerChallenge?.stumpingOutPct, 'number');

  const stumpPct = computeStumpingOutProbability({
    lengthUsed: 'full',
    deliveryUsed: 'googly',
    spinDegree: 9,
    rng: () => 0.5,
  });
  assert.ok(stumpPct >= 8 && stumpPct <= 62);
});



