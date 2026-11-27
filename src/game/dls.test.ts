import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDlsResourcePct,
  calculateDlsTarget,
  computeRainReduction,
  computeWeatherModifiers,
  getWeatherBallPhysics,
  getWeatherPitchPalette,
  maybeShiftWeather,
  shouldTriggerRainInterruption,
} from './dls';
import {
  applyDeliveryToMatch,
  createInitialMatchState,
  dismissDlsPopup,
  dismissOverPopup,
  resolveDelivery,
  selectNextBatter,
  startNextInnings,
} from './cricketEngine';

test('DLS resource percentage is bounded 0..100 and strictly monotonic in overs and wickets', () => {
  assert.equal(calculateDlsResourcePct(20, 20, 0), 100);
  assert.equal(calculateDlsResourcePct(20, 0, 0), 0);
  assert.equal(calculateDlsResourcePct(20, 10, 10), 0);

  const r10_w0 = calculateDlsResourcePct(20, 10, 0);
  const r10_w3 = calculateDlsResourcePct(20, 10, 3);
  const r10_w7 = calculateDlsResourcePct(20, 10, 7);
  const r5_w0 = calculateDlsResourcePct(20, 5, 0);

  assert.ok(r10_w0 > r5_w0 && r5_w0 > 0);
  assert.ok(r10_w0 > r10_w3 && r10_w3 > r10_w7);
  assert.ok(r10_w0 > 50 && r10_w0 <= 75);
});

test('DLS target scales down when Team 2 loses resources and scales up when Team 2 has more resources', () => {
  // Team 1 scored 200 with 100% resources; Team 2 reduced to 75% resources -> par 150, target 151
  const reduced = calculateDlsTarget({
    team1Score: 200,
    team1ResourcesPct: 100,
    team2ResourcesPct: 75,
    originalMaxOvers: 20,
  });
  assert.equal(reduced.parScore, 150);
  assert.equal(reduced.target, 151);

  // Team 1 scored 140 with 72% resources; Team 2 has 90% resources -> target > 141
  const boosted = calculateDlsTarget({
    team1Score: 140,
    team1ResourcesPct: 72,
    team2ResourcesPct: 90,
    originalMaxOvers: 20,
  });
  assert.ok(boosted.parScore > 140);
  assert.equal(boosted.target, boosted.parScore + 1);
});

test('0% rain never triggers rain interruption, while 100% rain always triggers in limited overs', () => {
  for (let ov = 1; ov <= 19; ov++) {
    assert.equal(
      shouldTriggerRainInterruption({
        format: 'limited',
        rainChance: 0,
        inningsNumber: 2,
        completedOvers: ov,
        maxOvers: 20,
        rainInterruptionsInMatch: 0,
        rainInterruptionsInInnings: 0,
        rng: () => 0.01,
      }),
      false
    );
  }

  // 100% rain guarantees trigger in Innings 2 even in a short 5-over chase
  assert.equal(
    shouldTriggerRainInterruption({
      format: 'limited',
      rainChance: 100,
      inningsNumber: 2,
      completedOvers: 1,
      maxOvers: 5,
      rainInterruptionsInMatch: 0,
      rainInterruptionsInInnings: 0,
      rng: () => 0.99,
    }),
    true
  );

  // Test match never triggers limited-overs DLS rain interruption
  assert.equal(
    shouldTriggerRainInterruption({
      format: 'test',
      rainChance: 100,
      inningsNumber: 2,
      completedOvers: 10,
      maxOvers: 90,
      rainInterruptionsInMatch: 0,
      rainInterruptionsInInnings: 0,
      rng: () => 0.01,
    }),
    false
  );
});

test('Weather modifiers boost swing/seam in overcast & drizzle and reduce spin grip in humid conditions', () => {
  const clearMods = computeWeatherModifiers('clear', 'swing', 'drive');
  const overcastMods = computeWeatherModifiers('overcast', 'swing', 'drive');
  const drizzleMods = computeWeatherModifiers('drizzle', 'seam', 'drive');
  const humidSpinMods = computeWeatherModifiers('humid', 'off_spin', 'drive');

  assert.ok(overcastMods.wicketMod > clearMods.wicketMod);
  assert.ok(overcastMods.swingVisualScale > clearMods.swingVisualScale);
  assert.ok(drizzleMods.wicketMod > clearMods.wicketMod);
  assert.ok(drizzleMods.boundaryMod < clearMods.boundaryMod);
  assert.ok(humidSpinMods.wicketMod < 0);
});

test('computeRainReduction reduces overs and subtracts DLS resources accurately', () => {
  const red = computeRainReduction({
    originalMaxOvers: 20,
    maxOvers: 20,
    completedOvers: 7,
    wicketsLost: 2,
    currentResourcesPct: 100,
    rainChance: 100,
    rng: () => 0.5,
  });

  assert.ok(red.oversLost >= 1);
  assert.equal(red.revisedOvers, 20 - red.oversLost);
  assert.ok(red.revisedOvers > 7);
  assert.ok(red.newResourcesPct < 100 && red.newResourcesPct > 10);
});

test('maybeShiftWeather returns commentary when weather shifts', () => {
  const shifted = maybeShiftWeather({
    currentWeather: 'clear',
    rainChance: 100,
    format: 'limited',
    rng: () => 0.1,
  });
  assert.equal(shifted.changed, true);
  assert.notEqual(shifted.nextWeather, 'clear');
  assert.ok(shifted.commentary && shifted.commentary.length > 10);
});

test('End-to-end 5-over match with 100% rain triggers DLS popup and reduces overs & target', () => {
  let state = createInitialMatchState({
    mode: 'ai',
    format: 'limited',
    pitchCondition: 'hard',
    rainChance: 100,
    difficulty: 'medium',
    homeTeamId: 'ind',
    awayTeamId: 'aus',
    totalOvers: 5,
    homeBatsFirst: true,
  });

  // Play all 5 overs of Innings 1
  for (let b = 0; b < 30; b++) {
    const res = resolveDelivery({
      shot: 'drive',
      deliveryType: 'fast',
      deliveryLength: 'good',
      difficulty: 'medium',
      playerIsBatting: true,
      strikerName: 'Batter',
      bowlerName: 'Bowler',
      weatherCondition: state.weatherCondition,
      rng: () => 0.6,
    });
    const applied = applyDeliveryToMatch(state, res);
    state = applied.nextState;
    if (state.pendingBatterPopup) state = selectNextBatter(state, state.pendingBatterPopup.selectedBatterIndex);
    if (state.pendingOverPopup) state = dismissOverPopup(state);
    if (state.pendingDlsPopup) state = dismissDlsPopup(state);
    if (applied.enteredInningsBreak) break;
  }

  state = startNextInnings(state);
  const originalTarget = state.target!;

  // Play 1 over in Innings 2 -> 100% rain triggers DLS interruption!
  let dlsTriggered = false;
  for (let b = 0; b < 12; b++) {
    const res = resolveDelivery({
      shot: 'defend',
      deliveryType: 'fast',
      deliveryLength: 'good',
      difficulty: 'medium',
      playerIsBatting: false,
      strikerName: 'Batter',
      bowlerName: 'Bowler',
      weatherCondition: state.weatherCondition,
      rng: () => 0.5,
    });
    const applied = applyDeliveryToMatch(state, res);
    state = applied.nextState;
    if (state.pendingDlsPopup) {
      dlsTriggered = true;
      assert.ok(state.dlsApplied);
      assert.ok(state.totalOvers < 5);
      assert.ok(state.target !== null && state.target <= originalTarget);
      state = dismissDlsPopup(state);
      break;
    }
    if (state.pendingOverPopup) state = dismissOverPopup(state);
  }

  assert.equal(dlsTriggered, true);
});

test('getWeatherPitchPalette dynamically updates pitch/outfield colors, moisture sheen, and puddles by weather', () => {
  const clearHard = getWeatherPitchPalette('hard', 'clear', false);
  const overcastHard = getWeatherPitchPalette('hard', 'overcast', false);
  const drizzleHard = getWeatherPitchPalette('hard', 'drizzle', false);
  const rainDelayHard = getWeatherPitchPalette('hard', 'drizzle', true);

  assert.equal(clearHard.moistureSheenColor, null);
  assert.equal(clearHard.puddleOpacity, 0);
  assert.notEqual(overcastHard.baseColor, clearHard.baseColor);
  assert.ok(overcastHard.moistureSheenColor !== null);
  assert.notEqual(drizzleHard.baseColor, overcastHard.baseColor);
  assert.ok(drizzleHard.puddleOpacity > 0);
  assert.ok(rainDelayHard.puddleOpacity > drizzleHard.puddleOpacity);
  assert.notEqual(drizzleHard.outfieldEvenColor, clearHard.outfieldEvenColor);

  const clearGreen = getWeatherPitchPalette('green', 'clear', false);
  const drizzleGreen = getWeatherPitchPalette('green', 'drizzle', false);
  assert.notEqual(clearGreen.baseColor, drizzleGreen.baseColor);

  const clearDry = getWeatherPitchPalette('dry', 'clear', false);
  const rainDry = getWeatherPitchPalette('dry', 'drizzle', true);
  assert.notEqual(clearDry.baseColor, rainDry.baseColor);
});

test('getWeatherBallPhysics amplifies swing in overcast and lowers bounce + increases drag in rain', () => {
  const clear = getWeatherBallPhysics('clear', false);
  const overcast = getWeatherBallPhysics('overcast', false);
  const drizzle = getWeatherBallPhysics('drizzle', false);
  const rainDelay = getWeatherBallPhysics('drizzle', true);

  assert.equal(clear.swingMultiplier, 1);
  assert.equal(clear.bounceMultiplier, 1);
  assert.ok(overcast.swingMultiplier > clear.swingMultiplier);
  assert.ok(drizzle.bounceMultiplier < clear.bounceMultiplier);
  assert.ok(rainDelay.bounceMultiplier < drizzle.bounceMultiplier);
  assert.ok(rainDelay.flightDragScale > clear.flightDragScale);
});
