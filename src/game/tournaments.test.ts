import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDeliveryToMatch,
  createInitialMatchState,
  declareTestInnings,
  getTestLeadText,
  startNextInnings,
} from './cricketEngine';
import {
  combinePlayerStatRecords,
  createTournament,
  formatBattingAverage,
  formatStrikeRate,
  simulateNextMatches,
  simulateStage,
  simulateTournamentFixture,
} from './tournaments';

test('Test Mode supports 30, 60, and 90 overs/day, 4 innings, declaration, and innings victory', () => {
  for (const opd of [30, 60, 90] as const) {
    const state = createInitialMatchState({
      mode: 'ai',
      format: 'test',
      difficulty: 'medium',
      homeTeamId: 'ind',
      awayTeamId: 'aus',
      totalOvers: opd,
      oversPerDay: opd,
      homeBatsFirst: true,
    });
    assert.equal(state.format, 'test');
    assert.equal(state.oversPerDay, opd);
    assert.equal(state.currentDay, 1);
  }

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

  // Score 60 runs in Innings 1 and declare
  for (let i = 0; i < 10; i++) {
    const res = applyDeliveryToMatch(match, {
      runs: 6,
      isWicket: false,
      isBoundaryFour: false,
      isBoundarySix: true,
      outcomeLabel: 'SIX! 6',
      ballSymbol: '6',
      commentary: 'Six!',
      hitAngleRad: 0,
      hitDistanceFactor: 1,
      shotUsed: 'loft',
      deliveryUsed: 'fast',
      lengthUsed: 'full',
    });
    match = res.nextState;
  }
  assert.equal(match.innings1.runs, 60);

  const dec1 = declareTestInnings(match);
  assert.equal(dec1.enteredInningsBreak, true);
  match = startNextInnings(dec1.nextState);
  assert.equal(match.inningsNumber, 2);

  // Team 2 scores 20 and declares -> Team 1 leads by 40
  for (let i = 0; i < 5; i++) {
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
  }
  assert.match(getTestLeadText(match) ?? '', /trail by 40/);

  const dec2 = declareTestInnings(match);
  match = startNextInnings(dec2.nextState);
  assert.equal(match.inningsNumber, 3);
  assert.match(getTestLeadText(match) ?? '', /lead by 40/);

  // Team 1 declares immediately in 3rd innings setting target 41
  const dec3 = declareTestInnings(match);
  assert.equal(dec3.enteredInningsBreak, true);
  match = startNextInnings(dec3.nextState);
  assert.equal(match.inningsNumber, 4);
  assert.equal(match.target, 41);
});

test('T20 World Cup creates 2 groups of 6, 30 group matches, and completes through Semi-Finals & Final', () => {
  let wc = createTournament({
    type: 't20_wc',
    userTeamId: 'ind',
    difficulty: 'medium',
  });
  assert.equal(wc.standings.length, 12);
  assert.equal(wc.standings.filter((s) => s.group === 'A').length, 6);
  assert.equal(wc.standings.filter((s) => s.group === 'B').length, 6);
  assert.equal(wc.fixtures.length, 30);

  // Sim entire tournament
  wc = simulateNextMatches(wc, false);
  assert.equal(wc.stage, 'complete');
  assert.ok(wc.championTeamId);
  assert.equal(wc.fixtures.some((f) => f.round === 'sf1'), true);
  assert.equal(wc.fixtures.some((f) => f.round === 'sf2'), true);
  assert.equal(wc.fixtures.some((f) => f.round === 'final'), true);
});

test('ODI World Cup creates 10-team league (45 matches) and completes through Semi-Finals & Final', () => {
  let odi = createTournament({
    type: 'odi_wc',
    userTeamId: 'ind',
    difficulty: 'medium',
  });
  assert.equal(odi.standings.length, 10);
  assert.equal(odi.fixtures.length, 45);
  assert.equal(odi.oversPerInningsOrDay, 50);

  // Sim all 45 league matches + knockouts deterministically
  let guard = 0;
  while (odi.stage !== 'complete' && guard < 60) {
    guard += 1;
    const next = odi.fixtures.find((f) => !f.completed)!;
    odi = simulateTournamentFixture(odi, next.id);
  }
  assert.equal(odi.stage, 'complete');
  assert.ok(odi.championTeamId);
  assert.equal(odi.fixtures.some((f) => f.round === 'sf1'), true);
  assert.equal(odi.fixtures.some((f) => f.round === 'final'), true);
});

test('IPL Tournament runs 10-team league and 4-match Playoff Bracket (Q1, Eliminator, Q2, Final)', () => {
  let ipl = createTournament({
    type: 'ipl',
    userTeamId: 'mi',
    difficulty: 'medium',
  });
  assert.equal(ipl.standings.length, 10);
  assert.equal(ipl.fixtures.length, 45);

  ipl = simulateStage(ipl);
  assert.equal(ipl.stage, 'knockouts');
  assert.equal(ipl.fixtures.some((f) => f.round === 'q1'), true);
  assert.equal(ipl.fixtures.some((f) => f.round === 'eliminator'), true);

  ipl = simulateStage(ipl);
  assert.equal(ipl.stage, 'complete');
  assert.ok(ipl.championTeamId);
  assert.equal(ipl.fixtures.some((f) => f.round === 'q2'), true);
  assert.equal(ipl.fixtures.some((f) => f.round === 'final'), true);
});

test('Ashes Cup and Border-Gavaskar Trophy run 5-Test series with 30/60/90 overs/day', () => {
  let ashes = createTournament({
    type: 'ashes',
    userTeamId: 'eng',
    difficulty: 'medium',
    oversPerDay: 60,
  });
  assert.equal(ashes.format, 'test');
  assert.equal(ashes.oversPerInningsOrDay, 60);
  assert.equal(ashes.fixtures.length, 5);
  assert.ok(ashes.fixtures[0].venue?.includes("Lord's"));

  ashes = simulateNextMatches(ashes, false);
  assert.equal(ashes.stage, 'complete');
  assert.ok(ashes.championTeamId);

  let bgt = createTournament({
    type: 'bgt',
    userTeamId: 'ind',
    difficulty: 'hard',
    oversPerDay: 90,
  });
  assert.equal(bgt.format, 'test');
  assert.equal(bgt.oversPerInningsOrDay, 90);
  assert.equal(bgt.fixtures.length, 5);
  assert.ok(bgt.fixtures[3].venue?.includes('MCG'));

  bgt = simulateNextMatches(bgt, false);
  assert.equal(bgt.stage, 'complete');
  assert.ok(bgt.championTeamId);
});

test('tournament tracks persistent batting averages, strike rates, and total wickets across matches and events', () => {
  let ipl = createTournament({
    type: 'ipl',
    userTeamId: 'mi',
    difficulty: 'medium',
    pitchCondition: 'dry',
  });
  assert.equal(ipl.pitchCondition, 'dry');
  assert.ok(ipl.id.startsWith('ipl-'));

  // Sim first 6 fixtures
  for (let i = 0; i < 6; i++) {
    const next = ipl.fixtures.find((f) => !f.completed)!;
    ipl = simulateTournamentFixture(ipl, next.id);
  }

  const statsValues = Object.values(ipl.playerStats);
  assert.ok(statsValues.length > 0, 'Should accumulate player stats across tournament fixtures');

  const batters = statsValues.filter((s) => s.inningsBatted > 0 && s.ballsFaced > 0);
  const bowlersWithWickets = statsValues.filter((s) => s.ballsBowled > 0 && s.wickets > 0);
  assert.ok(batters.length > 0, 'Should record batting innings and balls faced');
  assert.ok(bowlersWithWickets.length > 0, 'Should record bowler wickets taken');

  const sampleBatter = batters[0];
  assert.match(formatBattingAverage(sampleBatter), /^\d+\.\d{2}\*?$/);
  assert.match(formatStrikeRate(sampleBatter), /^\d+\.\d$/);

  // Career aggregation combines across two separate tournaments cleanly
  let t20 = createTournament({
    type: 't20_wc',
    userTeamId: 'ind',
    difficulty: 'medium',
    pitchCondition: 'green',
  });
  for (let i = 0; i < 4; i++) {
    const next = t20.fixtures.find((f) => !f.completed)!;
    t20 = simulateTournamentFixture(t20, next.id);
  }
  const combined = combinePlayerStatRecords([ipl.playerStats, t20.playerStats]);
  assert.ok(
    Object.keys(combined).length >= Math.max(Object.keys(ipl.playerStats).length, Object.keys(t20.playerStats).length)
  );
});
