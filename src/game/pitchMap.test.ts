import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDeliveryToMatch,
  createInitialMatchState,
  getActiveInnings,
  resolveDelivery,
} from './cricketEngine';
import {
  appendRecentPitchBall,
  classifyDistanceLength,
  computePitchLandingPoint,
  PITCH_MAP_MAX_BALLS,
  summarizePitchLengthTrends,
} from './pitchMap';
import { PitchBallRecord } from './types';

test('computePitchLandingPoint maps full, good, short, yorker, and bouncer into official meter zones', () => {
  const yorker = computePitchLandingPoint({
    deliveryType: 'yorker',
    deliveryLength: 'full',
    strikerHand: 'right',
    rng: () => 0.5,
  });
  assert.ok(yorker.pitchDistanceM >= 0.4 && yorker.pitchDistanceM <= 2.2);
  assert.equal(classifyDistanceLength(yorker.pitchDistanceM), 'full');

  const full = computePitchLandingPoint({
    deliveryType: 'swing',
    deliveryLength: 'full',
    strikerHand: 'right',
    rng: () => 0.5,
  });
  assert.ok(full.pitchDistanceM >= 2.2 && full.pitchDistanceM <= 5.8);
  assert.equal(classifyDistanceLength(full.pitchDistanceM), 'full');

  const good = computePitchLandingPoint({
    deliveryType: 'seam',
    deliveryLength: 'good',
    strikerHand: 'right',
    rng: () => 0.5,
  });
  assert.ok(good.pitchDistanceM >= 5.8 && good.pitchDistanceM <= 9.8);
  assert.equal(classifyDistanceLength(good.pitchDistanceM), 'good');

  const short = computePitchLandingPoint({
    deliveryType: 'fast',
    deliveryLength: 'short',
    strikerHand: 'right',
    rng: () => 0.5,
  });
  assert.ok(short.pitchDistanceM >= 9.8 && short.pitchDistanceM <= 15.0);
  assert.equal(classifyDistanceLength(short.pitchDistanceM), 'short');

  const bouncer = computePitchLandingPoint({
    deliveryType: 'bouncer',
    deliveryLength: 'short',
    strikerHand: 'right',
    rng: () => 0.5,
  });
  assert.ok(bouncer.pitchDistanceM >= 11.5 && bouncer.pitchDistanceM <= 15.0);
  assert.equal(classifyDistanceLength(bouncer.pitchDistanceM), 'short');
});

test('appendRecentPitchBall strictly keeps only the last 6 balls in chronological order', () => {
  let balls: PitchBallRecord[] = [];
  for (let i = 1; i <= 9; i++) {
    balls = appendRecentPitchBall(balls, {
      id: i,
      overBall: `0.${i}`,
      length: i % 3 === 0 ? 'short' : i % 2 === 0 ? 'good' : 'full',
      deliveryType: 'fast',
      pitchDistanceM: 4 + i * 0.8,
      lineOffsetCm: 10,
      runs: i % 4,
      isWicket: false,
      ballSymbol: String(i % 4),
      bowlerName: 'Jasprit Bumrah',
    });
  }

  assert.equal(balls.length, PITCH_MAP_MAX_BALLS);
  assert.deepEqual(
    balls.map((b) => b.id),
    [4, 5, 6, 7, 8, 9]
  );
});

test('summarizePitchLengthTrends computes percentages, dominant zone, average distance, and trend direction', () => {
  const empty = summarizePitchLengthTrends([]);
  assert.equal(empty.totalBalls, 0);
  assert.equal(empty.dominantLength, null);
  assert.equal(empty.trendDirection, 'none');

  const sample: PitchBallRecord[] = [
    {
      id: 1,
      overBall: '0.1',
      length: 'full',
      deliveryType: 'swing',
      pitchDistanceM: 4.2,
      lineOffsetCm: 14,
      runs: 0,
      isWicket: false,
      ballSymbol: '0',
      bowlerName: 'Mitchell Starc',
    },
    {
      id: 2,
      overBall: '0.2',
      length: 'full',
      deliveryType: 'swing',
      pitchDistanceM: 4.8,
      lineOffsetCm: 12,
      runs: 4,
      isWicket: false,
      ballSymbol: '4',
      bowlerName: 'Mitchell Starc',
    },
    {
      id: 3,
      overBall: '0.3',
      length: 'good',
      deliveryType: 'seam',
      pitchDistanceM: 7.5,
      lineOffsetCm: 18,
      runs: 1,
      isWicket: false,
      ballSymbol: '1',
      bowlerName: 'Mitchell Starc',
    },
    {
      id: 4,
      overBall: '0.4',
      length: 'short',
      deliveryType: 'bouncer',
      pitchDistanceM: 12.6,
      lineOffsetCm: 8,
      runs: 0,
      isWicket: true,
      ballSymbol: 'W',
      bowlerName: 'Mitchell Starc',
    },
    {
      id: 5,
      overBall: '0.5',
      length: 'short',
      deliveryType: 'fast',
      pitchDistanceM: 11.4,
      lineOffsetCm: 16,
      runs: 0,
      isWicket: false,
      ballSymbol: '0',
      bowlerName: 'Mitchell Starc',
    },
    {
      id: 6,
      overBall: '0.6',
      length: 'short',
      deliveryType: 'fast',
      pitchDistanceM: 10.5,
      lineOffsetCm: 10,
      runs: 2,
      isWicket: false,
      ballSymbol: '2',
      bowlerName: 'Mitchell Starc',
    },
  ];

  const summary = summarizePitchLengthTrends(sample);
  assert.equal(summary.totalBalls, 6);
  assert.equal(summary.fullCount, 2);
  assert.equal(summary.goodCount, 1);
  assert.equal(summary.shortCount, 3);
  assert.equal(summary.dominantLength, 'short');
  assert.equal(summary.dominantLabel, 'Short');
  assert.equal(summary.fullPct + summary.goodPct + summary.shortPct, 100);
  assert.equal(summary.trendDirection, 'shorter');
  assert.equal(summary.averageDistanceM, 8.5);
});

test('applyDeliveryToMatch persists landing points and caps recentPitchBalls at 6 across overs', () => {
  let state = createInitialMatchState({
    mode: 'ai',
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 5,
    homeBatsFirst: true,
  });

  const lengths: Array<'full' | 'good' | 'short'> = ['full', 'good', 'short'];
  for (let i = 0; i < 8; i++) {
    const res = resolveDelivery({
      shot: 'drive',
      deliveryType: 'fast',
      deliveryLength: lengths[i % 3],
      difficulty: 'medium',
      playerIsBatting: true,
      strikerName: 'Rohit Sharma',
      bowlerName: 'Mitchell Starc',
      rng: () => 0.45,
    });
    state = applyDeliveryToMatch(state, res).nextState;
  }

  const active = getActiveInnings(state);
  assert.equal(active.recentPitchBalls?.length, 6);
  assert.deepEqual(
    active.recentPitchBalls?.map((b) => b.id),
    [3, 4, 5, 6, 7, 8]
  );
  assert.ok(active.recentPitchBalls?.every((b) => Number.isFinite(b.pitchDistanceM)));
});
