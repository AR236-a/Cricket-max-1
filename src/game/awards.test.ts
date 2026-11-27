import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlayerOfTheMatch,
  computePlayerOfTheTournament,
  computePostMatchAwards,
} from './awards';
import { applyDeliveryToMatch, createInitialMatchState, startSecondInnings } from './cricketEngine';
import { createTournament, simulateNextMatches } from './tournaments';

test('computePlayerOfTheMatch selects standout performer with structured runs, wickets, strike rate, and honors', () => {
  let match = createInitialMatchState({
    mode: 'ai',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 1,
    homeBatsFirst: true,
  });

  // Striker hits 36 off 6 balls in innings 1 (SR = 600.0)
  for (let i = 0; i < 6; i++) {
    match = applyDeliveryToMatch(match, {
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
    }).nextState;
  }

  match = startSecondInnings(match);

  // Bowling team takes 6 wickets in 6 balls (first bowler gets 6-0) -> India wins defending 36
  for (let i = 0; i < 6; i++) {
    match = applyDeliveryToMatch(match, {
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
    if (match.matchComplete) break;
  }

  assert.equal(match.winnerTeamId, 'ind');
  const potm = computePlayerOfTheMatch(match);
  assert.ok(potm);
  assert.equal(potm.teamId, 'ind');
  assert.ok(potm.summary.length > 0);
  assert.equal(typeof potm.runs, 'number');
  assert.equal(typeof potm.wickets, 'number');
  assert.equal(typeof potm.strikeRate, 'number');

  const awards = computePostMatchAwards(match);
  assert.ok(awards);
  assert.equal(awards.bestBatter?.runs, 36);
  assert.equal(awards.bestBatter?.strikeRate, 600);
  assert.equal(awards.bestBowler?.wickets, 6);
  assert.equal(awards.bestBowler?.economy, 0);
  assert.ok(awards.topPerformers.length >= 2);
});

test('computePlayerOfTheTournament returns Player of the Series / Tournament for completed BGT and IPL', () => {
  let bgt = createTournament({
    type: 'bgt',
    userTeamId: 'ind',
    difficulty: 'medium',
    oversPerDay: 90,
    testCount: 3,
  });
  bgt = simulateNextMatches(bgt, false);
  assert.equal(bgt.stage, 'complete');

  const pottBgt = computePlayerOfTheTournament(bgt);
  assert.ok(pottBgt);
  assert.ok(pottBgt.playerName.length > 0);
  assert.ok(['ind', 'aus'].includes(pottBgt.teamId));
  assert.ok(pottBgt.points > 0);

  let ipl = createTournament({
    type: 'ipl',
    userTeamId: 'mi',
    difficulty: 'medium',
  });
  ipl = simulateNextMatches(ipl, false);
  assert.equal(ipl.stage, 'complete');

  const pottIpl = computePlayerOfTheTournament(ipl);
  assert.ok(pottIpl);
  assert.ok(pottIpl.playerName.length > 0);
  assert.ok(pottIpl.matches >= 1);
});
