import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDeliveryToMatch, createInitialMatchState, resolveDelivery } from './cricketEngine';
import {
  formatSavedMatchSummary,
  parseMatchSession,
  SavedMatchSession,
  serializeMatchSession,
} from './matchStorage';

test('parseMatchSession round-trips an unfinished match and clears isPaused on resume', () => {
  const base = createInitialMatchState({
    mode: 'ai',
    format: 'limited',
    pitchCondition: 'hard',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 5,
    homeBatsFirst: true,
  });

  const res = resolveDelivery({
    shot: 'drive',
    deliveryType: 'fast',
    deliveryLength: 'good',
    difficulty: 'medium',
    playerIsBatting: true,
    strikerName: 'Rohit Sharma',
    bowlerName: 'Mitchell Starc',
    format: 'limited',
    pitchCondition: 'hard',
    rng: () => 0.42,
  });

  const afterOneBall = applyDeliveryToMatch(base, res).nextState;
  const pausedMatch = { ...afterOneBall, isPaused: true };

  const session: SavedMatchSession = {
    version: 1,
    screen: 'playing',
    autoResumeOnLoad: true,
    savedAt: 1700000000000,
    selectedDeliveryType: 'yorker',
    selectedDeliveryLength: 'full',
    selectedPaceSpeedKph: 151,
    selectedSpinDegree: 9,
    match: pausedMatch,
  };

  const parsed = parseMatchSession(serializeMatchSession(session));
  assert.ok(parsed);
  assert.equal(parsed.screen, 'playing');
  assert.equal(parsed.autoResumeOnLoad, true);
  assert.equal(parsed.selectedDeliveryType, 'yorker');
  assert.equal(parsed.selectedDeliveryLength, 'full');
  assert.equal(parsed.selectedPaceSpeedKph, 151);
  assert.equal(parsed.selectedSpinDegree, 9);
  assert.equal(parsed.match.isPaused, false);
  assert.equal(parsed.match.innings1.ballsBowled, 1);
  assert.equal(parsed.match.innings1.runs, afterOneBall.innings1.runs);
});

test('parseMatchSession rejects completed, malformed, or wrong-version sessions', () => {
  const base = createInitialMatchState({
    mode: 'pvp',
    format: 'test',
    pitchCondition: 'green',
    difficulty: 'hard',
    homeTeamId: 'eng',
    awayTeamId: 'aus',
    totalOvers: 30,
    oversPerDay: 30,
    homeBatsFirst: false,
  });

  const completedSession: SavedMatchSession = {
    version: 1,
    screen: 'playing',
    autoResumeOnLoad: true,
    savedAt: 1700000000000,
    selectedDeliveryType: 'fast',
    selectedDeliveryLength: 'good',
    match: { ...base, matchComplete: true },
  };

  assert.equal(parseMatchSession(serializeMatchSession(completedSession)), null);
  assert.equal(parseMatchSession('{broken json'), null);
  assert.equal(parseMatchSession(null), null);
  assert.equal(
    parseMatchSession(JSON.stringify({ version: 2, screen: 'playing', match: base })),
    null
  );
});

test('formatSavedMatchSummary formats Test and Limited-Overs resume labels clearly', () => {
  const testMatch = createInitialMatchState({
    mode: 'ai',
    format: 'test',
    pitchCondition: 'dry',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 60,
    oversPerDay: 60,
    homeBatsFirst: true,
  });

  const summary = formatSavedMatchSummary({
    version: 1,
    screen: 'playing',
    autoResumeOnLoad: false,
    savedAt: 1700000000000,
    selectedDeliveryType: 'fast',
    selectedDeliveryLength: 'good',
    match: {
      ...testMatch,
      currentDay: 2,
      innings1: {
        ...testMatch.innings1,
        runs: 142,
        wickets: 3,
        ballsBowled: 94,
      },
    },
  });

  assert.match(summary.title, /IND 142\/3 \(15\.4 ov\)/);
  assert.match(summary.subtitle, /Test Day 2\/5/);
});
