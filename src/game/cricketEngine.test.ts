import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeliveryCommentary } from './commentary';
import {
  advanceTestDayPopupToNewDay,
  applyDeliveryToMatch,
  calculateRequiredRunRate,
  calculateRunRate,
  chooseAiDelivery,
  chooseAiShot,
  computePredictedTotal,
  createInitialMatchState,
  dismissMilestonePopup,
  dismissOverPopup,
  formatOvers,
  isSpinDelivery,
  resolveDelivery,
  startSecondInnings,
  startTestNewDay,
} from './cricketEngine';
import { getBattingHand, getBowlingStyle, getTeamsByLeague, TEAMS } from './teams';
import { DeliveryLength, DeliveryType, ShotType } from './types';

test('teams include 12 international and 10 IPL teams with 11 unique players each', () => {
  assert.equal(getTeamsByLeague('international').length, 12);
  assert.equal(getTeamsByLeague('ipl').length, 10);

  for (const team of TEAMS) {
    assert.equal(team.batters.length, 11, `${team.name} should have 11 players`);
    assert.equal(
      new Set(team.batters).size,
      11,
      `${team.name} should have 11 unique player names`
    );
    assert.ok(team.bowlers.length >= 5, `${team.name} should have at least 5 bowlers`);
    for (const bowler of team.bowlers) {
      assert.ok(
        team.batters.includes(bowler),
        `${team.name} bowler ${bowler} should be part of the 11-player squad`
      );
    }
  }
});

test('overs and run rate formatting use tabular cricket conventions', () => {
  assert.equal(formatOvers(0), '0.0');
  assert.equal(formatOvers(5), '0.5');
  assert.equal(formatOvers(6), '1.0');
  assert.equal(formatOvers(14), '2.2');
  assert.equal(calculateRunRate(0, 0), '0.00');
  assert.equal(calculateRunRate(12, 6), '12.00');
  assert.equal(calculateRequiredRunRate(31, 10, 12, 5), '7.00');
});

test('buildDeliveryCommentary generates distinct flavor text across deliveries and shot outcomes', () => {
  const deliveries: DeliveryType[] = ['fast', 'spin', 'swing', 'seam', 'yorker', 'bouncer'];
  const lengths: DeliveryLength[] = ['full', 'good', 'short'];
  const shots: ShotType[] = ['drive', 'pull', 'sweep', 'cut', 'loft', 'defend', 'flick', 'hook'];

  const sampleSix = buildDeliveryCommentary({
    bowlerName: 'Jasprit Bumrah',
    strikerName: 'Travis Head',
    deliveryType: 'yorker',
    deliveryLength: 'full',
    shot: 'flick',
    runs: 6,
    isWicket: false,
  });
  assert.match(sampleSix, /Jasprit Bumrah/);
  assert.match(sampleSix, /Travis Head/);
  assert.match(sampleSix, /yorker/i);
  assert.match(sampleSix, /SIX/);

  const sampleWicket = buildDeliveryCommentary({
    bowlerName: 'Rashid Khan',
    strikerName: 'Jos Buttler',
    deliveryType: 'spin',
    deliveryLength: 'good',
    shot: 'sweep',
    runs: 0,
    isWicket: true,
    wicketKind: 'Stumped',
  });
  assert.match(sampleWicket, /STUMPED/);
  assert.match(sampleWicket, /Rashid Khan/);
  assert.match(sampleWicket, /Jos Buttler/);

  // Verify every delivery x length x shot generates non-empty unique commentary
  const lines = new Set<string>();
  for (const d of deliveries) {
    for (const l of lengths) {
      for (const s of shots) {
        const text = buildDeliveryCommentary({
          bowlerName: 'Bowler A',
          strikerName: 'Batter B',
          deliveryType: d,
          deliveryLength: l,
          shot: s,
          runs: 4,
          isWicket: false,
        });
        assert.ok(text.length > 25);
        lines.add(text);
      }
    }
  }
  assert.equal(lines.size, deliveries.length * lengths.length * shots.length);
});

test('resolveDelivery returns valid shot outcomes deterministically', () => {
  const highRoll = resolveDelivery({
    shot: 'loft',
    deliveryType: 'fast',
    deliveryLength: 'good',
    difficulty: 'easy',
    playerIsBatting: true,
    strikerName: 'Rohit Sharma',
    bowlerName: 'Mitchell Starc',
    rng: () => 0.99,
  });
  assert.equal(highRoll.runs, 6);
  assert.equal(highRoll.isBoundarySix, true);
  assert.equal(highRoll.ballSymbol, '6');

  const lowRoll = resolveDelivery({
    shot: 'hook',
    deliveryType: 'yorker',
    deliveryLength: 'full',
    difficulty: 'hard',
    playerIsBatting: true,
    strikerName: 'Rohit Sharma',
    bowlerName: 'Mitchell Starc',
    rng: () => 0.001,
  });
  assert.equal(lowRoll.isWicket, true);
  assert.equal(lowRoll.ballSymbol, 'W');
});

test('innings 1 transitions to innings break, logs commentary, and 2nd innings chases target', () => {
  let state = createInitialMatchState({
    mode: 'ai',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 1,
    homeBatsFirst: true,
  });

  assert.equal(state.commentaryLog.length, 1);

  for (let i = 0; i < 6; i++) {
    const res = applyDeliveryToMatch(state, {
      runs: 2,
      isWicket: false,
      isBoundaryFour: false,
      isBoundarySix: false,
      outcomeLabel: '2 RUNS',
      ballSymbol: '2',
      commentary: `Ball ${i + 1} commentary`,
      hitAngleRad: 0.2,
      hitDistanceFactor: 0.56,
      shotUsed: 'drive',
      deliveryUsed: 'fast',
      lengthUsed: 'good',
    });
    state = res.nextState;
    assert.equal(state.commentaryLog[0]?.overBall, formatOvers(i + 1));
    if (i < 5) {
      assert.equal(res.enteredInningsBreak, false);
    } else {
      assert.equal(res.enteredInningsBreak, true);
      assert.equal(state.innings1.runs, 12);
      assert.equal(state.target, 13);
    }
  }

  state = startSecondInnings(state);
  assert.equal(state.inningsNumber, 2);
  assert.equal(state.innings2?.battingTeamId, 'aus');

  for (const runs of [6, 6, 4]) {
    const res = applyDeliveryToMatch(state, {
      runs,
      isWicket: false,
      isBoundaryFour: runs === 4,
      isBoundarySix: runs === 6,
      outcomeLabel: runs === 6 ? 'SIX! 6' : 'FOUR! 4',
      ballSymbol: String(runs),
      commentary: 'Boundary',
      hitAngleRad: 0,
      hitDistanceFactor: 1,
      shotUsed: 'loft',
      deliveryUsed: 'fast',
      lengthUsed: 'full',
    });
    state = res.nextState;
    if (runs === 4) {
      assert.equal(res.matchFinished, true);
      assert.equal(state.matchComplete, true);
      assert.equal(state.winnerTeamId, 'aus');
    }
  }
});

test('AI delivery and shot helpers always return valid enum values across pitch conditions', () => {
  const validDeliveries: DeliveryType[] = [
    'fast',
    'spin',
    'off_spin',
    'leg_spin',
    'googly',
    'doosra',
    'arm_ball',
    'carrom',
    'swing',
    'seam',
    'yorker',
    'bouncer',
  ];
  for (const pitch of ['hard', 'green', 'dry'] as const) {
    const d = chooseAiDelivery('hard', () => 0.4, pitch);
    assert.ok(validDeliveries.includes(d.type));
    assert.ok(['full', 'good', 'short'].includes(d.length));
  }

  const s = chooseAiShot('hard', 'bouncer', 'short', () => 0.2);
  assert.ok(['pull', 'hook', 'cut'].includes(s));
});

test('all 6 new spin variations generate distinct commentary and valid delivery outcomes', () => {
  const spinTypes: DeliveryType[] = ['off_spin', 'leg_spin', 'googly', 'doosra', 'arm_ball', 'carrom'];
  const lines = new Set<string>();
  for (const spinType of spinTypes) {
    const comment = buildDeliveryCommentary({
      bowlerName: 'Kuldeep Yadav',
      strikerName: 'Steve Smith',
      deliveryType: spinType,
      deliveryLength: 'good',
      shot: 'drive',
      runs: 1,
      isWicket: false,
      pitchCondition: 'dry',
    });
    assert.ok(comment.length > 25);
    lines.add(comment);

    const res = resolveDelivery({
      shot: 'sweep',
      deliveryType: spinType,
      deliveryLength: 'good',
      difficulty: 'medium',
      playerIsBatting: false,
      strikerName: 'Steve Smith',
      bowlerName: 'Kuldeep Yadav',
      pitchCondition: 'dry',
      rng: () => 0.5,
    });
    assert.equal(res.deliveryUsed, spinType);
    assert.ok(res.commentary.includes('Steve Smith'));
  }
  assert.equal(lines.size, spinTypes.length);
});

test('pitch conditions measurably alter wicket/boundary probabilities and bowlerSpells tracks across overs', () => {
  // Dry pitch makes googly/spin significantly deadlier than hard pitch at boundary wicket rolls
  const sampleSpinWickets = (pitch: 'hard' | 'dry') => {
    let wickets = 0;
    for (let i = 1; i <= 100; i++) {
      const res = resolveDelivery({
        shot: 'drive',
        deliveryType: 'googly',
        deliveryLength: 'good',
        difficulty: 'medium',
        playerIsBatting: true,
        strikerName: 'Batter',
        bowlerName: 'Bowler',
        pitchCondition: pitch,
        rng: () => i / 101,
      });
      if (res.isWicket) wickets += 1;
    }
    return wickets;
  };
  assert.ok(
    sampleSpinWickets('dry') > sampleSpinWickets('hard'),
    'Dry pitch should produce more spin wickets than hard pitch'
  );

  // Green pitch makes seam/swing deadlier than dry pitch
  const sampleSeamWickets = (pitch: 'green' | 'dry') => {
    let wickets = 0;
    for (let i = 1; i <= 100; i++) {
      const res = resolveDelivery({
        shot: 'drive',
        deliveryType: 'seam',
        deliveryLength: 'good',
        difficulty: 'medium',
        playerIsBatting: true,
        strikerName: 'Batter',
        bowlerName: 'Bowler',
        pitchCondition: pitch,
        rng: () => i / 101,
      });
      if (res.isWicket) wickets += 1;
    }
    return wickets;
  };
  assert.ok(
    sampleSeamWickets('green') > sampleSeamWickets('dry'),
    'Green pitch should produce more seam wickets than dry pitch'
  );

  // Verify bowlerSpells tracks wickets and runs across 7 balls (2 bowlers)
  let match = createInitialMatchState({
    mode: 'ai',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 2,
    pitchCondition: 'green',
    homeBatsFirst: true,
  });
  const firstBowler = match.innings1.bowlerName;
  for (let b = 0; b < 6; b++) {
    match = applyDeliveryToMatch(match, {
      runs: b === 0 ? 4 : 0,
      isWicket: b === 5,
      wicketKind: b === 5 ? 'Bowled' : undefined,
      isBoundaryFour: b === 0,
      isBoundarySix: false,
      outcomeLabel: b === 5 ? 'OUT!' : b === 0 ? 'FOUR! 4' : 'DOT BALL',
      ballSymbol: b === 5 ? 'W' : b === 0 ? '4' : '•',
      commentary: 'Ball',
      hitAngleRad: 0,
      hitDistanceFactor: 0.4,
      shotUsed: 'drive',
      deliveryUsed: 'seam',
      lengthUsed: 'good',
    }).nextState;
  }
  const spell = match.innings1.bowlerSpells[firstBowler];
  assert.equal(spell.balls, 6);
  assert.equal(spell.runs, 4);
  assert.equal(spell.wickets, 1);
  assert.notEqual(match.innings1.bowlerName, firstBowler);
});

test('2025 rosters expose accurate batter handedness and bowler pace/spin style', () => {
  // Left-handed batters
  assert.equal(getBattingHand('Yashasvi Jaiswal'), 'left');
  assert.equal(getBattingHand('Travis Head'), 'left');
  assert.equal(getBattingHand('Rishabh Pant'), 'left');
  assert.equal(getBattingHand('Sunil Narine'), 'left');
  // Right-handed batters
  assert.equal(getBattingHand('Rohit Sharma'), 'right');
  assert.equal(getBattingHand('Virat Kohli'), 'right');
  assert.equal(getBattingHand('Shreyas Iyer'), 'right');
  // Pacers vs Spinners
  assert.equal(getBowlingStyle('Jasprit Bumrah'), 'pace');
  assert.equal(getBowlingStyle('Mitchell Starc'), 'pace');
  assert.equal(getBowlingStyle('Kuldeep Yadav'), 'spin');
  assert.equal(getBowlingStyle('Varun Chakaravarthy'), 'spin');
  assert.equal(getBowlingStyle('Rashid Khan'), 'spin');

  // Verify chooseAiDelivery enforces bowlerStyle across rolls
  for (let r = 0.05; r < 0.99; r += 0.15) {
    const paceChoice = chooseAiDelivery('hard', () => r, 'dry', 'pace');
    assert.equal(isSpinDelivery(paceChoice.type), false, 'Pacer must never bowl spin');

    const spinChoice = chooseAiDelivery('hard', () => r, 'green', 'spin');
    assert.equal(isSpinDelivery(spinChoice.type), true, 'Spinner must never bowl pace');
  }
});

test('overHistory, computePredictedTotal, and pendingOverPopup trigger accurately on over completion', () => {
  assert.equal(computePredictedTotal(0, 0, 5), 38);
  assert.equal(computePredictedTotal(18, 12, 5), 45);

  let match = createInitialMatchState({
    mode: 'ai',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 5,
    homeBatsFirst: true,
  });

  for (let b = 0; b < 6; b++) {
    match = applyDeliveryToMatch(match, {
      runs: b === 2 ? 4 : 1,
      isWicket: false,
      isBoundaryFour: b === 2,
      isBoundarySix: false,
      outcomeLabel: b === 2 ? 'FOUR! 4' : '1 RUN',
      ballSymbol: b === 2 ? '4' : '1',
      commentary: `Ball ${b + 1}`,
      hitAngleRad: 0.1,
      hitDistanceFactor: 0.4,
      shotUsed: 'drive',
      deliveryUsed: 'fast',
      lengthUsed: 'good',
    }).nextState;
  }

  // Over 1 scored 5*1 + 4 = 9 runs
  assert.equal(match.innings1.overHistory.length, 1);
  assert.equal(match.innings1.overHistory[0].over, 1);
  assert.equal(match.innings1.overHistory[0].runsInOver, 9);
  assert.equal(match.innings1.overHistory[0].runRate, 9);
  assert.equal(match.innings1.overHistory[0].predictedTotal, 45);
  assert.equal(match.pendingOverPopup?.overNumber, 1);
  assert.equal(match.pendingOverPopup?.runsConceded, 9);

  match = dismissOverPopup(match);
  assert.equal(match.pendingOverPopup, null);
});

test('Test Mode triggers day_completed scorecard popup, advances to new_day prompt, and starts new day cleanly', () => {
  let match = createInitialMatchState({
    mode: 'ai',
    format: 'test',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 30,
    oversPerDay: 30,
    homeBatsFirst: true,
  });

  // Bowl 30 overs (180 balls) cleanly without all-out
  for (let b = 0; b < 180; b++) {
    match = applyDeliveryToMatch(match, {
      runs: 1,
      isWicket: false,
      isBoundaryFour: false,
      isBoundarySix: false,
      outcomeLabel: '1 RUN',
      ballSymbol: '1',
      commentary: 'Single',
      hitAngleRad: 0,
      hitDistanceFactor: 0.3,
      shotUsed: 'drive',
      deliveryUsed: 'fast',
      lengthUsed: 'good',
    }).nextState;
    if (match.pendingOverPopup) {
      match = dismissOverPopup(match);
    }
  }

  assert.equal(match.pendingDayPopup?.phase, 'day_completed');
  assert.equal(match.pendingDayPopup?.completedDay, 1);
  assert.equal(match.pendingDayPopup?.nextDay, 2);
  assert.equal(match.pendingDayPopup?.runsToday, 180);
  assert.equal(match.pendingOverPopup, null);

  match = advanceTestDayPopupToNewDay(match);
  assert.equal(match.pendingDayPopup?.phase, 'new_day');

  match = startTestNewDay(match);
  assert.equal(match.pendingDayPopup, null);
  assert.equal(match.currentDay, 2);
  assert.equal(match.ballsToday, 0);
  assert.equal(match.runsToday, 0);
  assert.equal(match.wicketsToday, 0);
});

test('batter milestones (50, 100, 150, 200) and bowler 5-wicket haul trigger celebration popups', () => {
  let match = createInitialMatchState({
    mode: 'ai',
    format: 'test',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 90,
    oversPerDay: 90,
    homeBatsFirst: true,
  });

  // Hit 6s on even runs or use 4s so the same striker (index 0) stays on strike up to 200
  const milestonesSeen: string[] = [];
  for (let i = 0; i < 50; i++) {
    match = applyDeliveryToMatch(match, {
      runs: 4,
      isWicket: false,
      isBoundaryFour: true,
      isBoundarySix: false,
      outcomeLabel: 'FOUR! 4',
      ballSymbol: '4',
      commentary: 'Four!',
      hitAngleRad: 0,
      hitDistanceFactor: 0.9,
      shotUsed: 'drive',
      deliveryUsed: 'fast',
      lengthUsed: 'full',
    }).nextState;
    if (match.pendingOverPopup) {
      match = dismissOverPopup(match);
    }
    if (match.pendingMilestonePopup) {
      milestonesSeen.push(match.pendingMilestonePopup.kind);
      match = dismissMilestonePopup(match);
    }
  }
  // 50 * 4 = 200 (note at end of over strike swaps unless we reset, so check at least 50/100 or test striker 1+2!)
  assert.ok(milestonesSeen.includes('50'), '50 milestone should trigger');

  // Test explicit single-striker crossing 50 -> 100 -> 150 -> 200 on balls 1..5 of overs
  let singleMatch = createInitialMatchState({
    mode: 'ai',
    format: 'test',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 90,
    oversPerDay: 90,
    homeBatsFirst: true,
  });
  const batterMilestones: string[] = [];
  for (let ball = 0; ball < 60; ball++) {
    // Give striker 0 sixes on balls 0..4 of each over, and 1 run on ball 5 so over-end swap keeps striker 0 on strike!
    const isEndBall = ball % 6 === 5;
    const runs = isEndBall ? 1 : 6;
    singleMatch = applyDeliveryToMatch(singleMatch, {
      runs,
      isWicket: false,
      isBoundaryFour: false,
      isBoundarySix: runs === 6,
      outcomeLabel: runs === 6 ? 'SIX! 6' : '1 RUN',
      ballSymbol: String(runs),
      commentary: 'Shot',
      hitAngleRad: 0,
      hitDistanceFactor: 1,
      shotUsed: 'loft',
      deliveryUsed: 'fast',
      lengthUsed: 'full',
    }).nextState;
    if (singleMatch.pendingMilestonePopup) {
      batterMilestones.push(singleMatch.pendingMilestonePopup.kind);
      singleMatch = dismissMilestonePopup(singleMatch);
    }
    if (singleMatch.pendingOverPopup) {
      singleMatch = dismissOverPopup(singleMatch);
    }
  }
  assert.deepEqual(batterMilestones, ['50', '100', '150', '200']);

  // Test bowler 5-wicket haul popup within first over
  let bowlMatch = createInitialMatchState({
    mode: 'ai',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 5,
    homeBatsFirst: true,
  });
  const bowlMilestones: string[] = [];
  for (let w = 0; w < 5; w++) {
    bowlMatch = applyDeliveryToMatch(bowlMatch, {
      runs: 0,
      isWicket: true,
      wicketKind: 'Bowled',
      isBoundaryFour: false,
      isBoundarySix: false,
      outcomeLabel: 'OUT! BOWLED',
      ballSymbol: 'W',
      commentary: 'Bowled!',
      hitAngleRad: 0,
      hitDistanceFactor: 0.1,
      shotUsed: 'drive',
      deliveryUsed: 'yorker',
      lengthUsed: 'full',
    }).nextState;
    if (bowlMatch.pendingMilestonePopup) {
      bowlMilestones.push(bowlMatch.pendingMilestonePopup.kind);
      assert.equal(bowlMatch.pendingMilestonePopup.wickets, 5);
      bowlMatch = dismissMilestonePopup(bowlMatch);
      assert.equal(bowlMatch.pendingMilestonePopup, null);
    }
  }
  assert.deepEqual(bowlMilestones, ['5fer']);
});

test('resolveDelivery supports around the wicket bowlingSide and mentions angle in commentary', () => {
  const res = resolveDelivery({
    shot: 'drive',
    deliveryType: 'fast',
    deliveryLength: 'good',
    difficulty: 'medium',
    playerIsBatting: false,
    strikerName: 'Steve Smith',
    bowlerName: 'Jasprit Bumrah',
    bowlingSide: 'round',
    rng: () => 0.5,
  });
  assert.match(res.commentary, /around the wicket/i);
});

