import {
  DeliveryType,
  MatchFormat,
  PitchCondition,
  RainChance,
  ShotType,
  WeatherCondition,
} from './types';

export const RAIN_CHANCE_OPTIONS: RainChance[] = [100, 75, 50, 25, 0];

export const WEATHER_META: Record<
  WeatherCondition,
  {
    label: string;
    shortLabel: string;
    visibilityPct: number;
    badgeColor: string;
    description: string;
  }
> = {
  clear: {
    label: 'CLEAR',
    shortLabel: '100% Vis',
    visibilityPct: 100,
    badgeColor: 'text-cyan-200 border-cyan-400/50',
    description: 'Clear stadium sky & crisp 100% visibility — pitch plays to its natural state.',
  },
  overcast: {
    label: 'OVERCAST',
    shortLabel: 'Swing+ · 82% Vis',
    visibilityPct: 82,
    badgeColor: 'text-slate-200 border-slate-400/60',
    description: 'Thick cloud cover lowers visibility (82%) and boosts swing & seam for fast bowlers.',
  },
  windy: {
    label: 'WINDY',
    shortLabel: 'Crosswind · 90% Vis',
    visibilityPct: 90,
    badgeColor: 'text-sky-200 border-sky-400/60',
    description: 'Gusty crosswinds add aerial drift to lofted shots and extra seam movement.',
  },
  humid: {
    label: 'HUMID',
    shortLabel: 'Skid / Dew · 80% Vis',
    visibilityPct: 80,
    badgeColor: 'text-teal-200 border-teal-400/60',
    description: 'Heavy muggy air & evening dew — ball skids quicker and spinners get less grip.',
  },
  drizzle: {
    label: 'DRIZZLE',
    shortLabel: 'Seam+ · 68% Vis',
    visibilityPct: 68,
    badgeColor: 'text-indigo-200 border-indigo-400/65',
    description: 'Light passing drizzle reduces visibility (68%), slows outfield & helps seamers.',
  },
};

// Duckworth-Lewis-Stern (DLS) asymptotic resource share F(w) & decay rate k(w) by wickets lost (0..9)
const DLS_ASYMPTOTE_F = [1.0, 0.905, 0.802, 0.692, 0.576, 0.456, 0.34, 0.232, 0.138, 0.062];
const DLS_DECAY_K = [0.035, 0.039, 0.044, 0.05, 0.058, 0.068, 0.082, 0.102, 0.132, 0.185];

/**
 * Computes DLS remaining resource percentage [0..100] for `oversRemaining` and `wicketsLost`
 * normalized against `originalMaxOvers` (e.g. 5, 10, 20, 30, or 50).
 */
export function calculateDlsResourcePct(
  originalMaxOvers: number,
  oversRemaining: number,
  wicketsLost: number
): number {
  if (originalMaxOvers <= 0 || oversRemaining <= 0 || wicketsLost >= 10) return 0;
  const clampedOvers = Math.min(originalMaxOvers, Math.max(0, oversRemaining));
  const w = Math.min(9, Math.max(0, Math.floor(wicketsLost)));
  const uNorm = (clampedOvers / originalMaxOvers) * 50;
  const F = DLS_ASYMPTOTE_F[w];
  const k = DLS_DECAY_K[w];
  const denom = 1 - Math.exp(-k * 50);
  const numer = 1 - Math.exp(-k * uNorm);
  const pct = 100 * F * (numer / denom);
  return Number(Math.min(100, Math.max(0, pct)).toFixed(2));
}

/**
 * Average full-innings par score G(N) used when Team 2 has more resources than Team 1.
 */
export function getDlsGScore(originalMaxOvers: number): number {
  if (originalMaxOvers >= 50) return 260;
  if (originalMaxOvers >= 30) return 195;
  if (originalMaxOvers >= 20) return 165;
  if (originalMaxOvers >= 10) return 92;
  if (originalMaxOvers >= 5) return 50;
  return Math.max(15, Math.round(originalMaxOvers * 9.5));
}

/**
 * Official DLS Par Score & Target calculation comparing Team 1 and Team 2 resources.
 */
export function calculateDlsTarget(params: {
  team1Score: number;
  team1ResourcesPct: number;
  team2ResourcesPct: number;
  originalMaxOvers: number;
}): { parScore: number; target: number } {
  const { team1Score, team1ResourcesPct, team2ResourcesPct, originalMaxOvers } = params;
  const r1 = Math.max(1, team1ResourcesPct);
  const r2 = Math.max(0, team2ResourcesPct);

  if (Math.abs(r2 - r1) < 0.05) {
    return { parScore: team1Score, target: team1Score + 1 };
  }

  if (r2 < r1) {
    const parScore = Math.floor(team1Score * (r2 / r1));
    return { parScore, target: parScore + 1 };
  }

  const gScore = getDlsGScore(originalMaxOvers);
  const parScore = Math.floor(team1Score + gScore * ((r2 - r1) / 100));
  return { parScore, target: parScore + 1 };
}

export function pickInitialWeather(
  rainChance: RainChance,
  rng: () => number = Math.random
): WeatherCondition {
  const r = rng();
  if (rainChance === 0) {
    if (r < 0.5) return 'clear';
    if (r < 0.72) return 'overcast';
    if (r < 0.86) return 'windy';
    return 'humid';
  }
  if (rainChance === 25) {
    if (r < 0.35) return 'clear';
    if (r < 0.65) return 'overcast';
    if (r < 0.8) return 'windy';
    if (r < 0.94) return 'humid';
    return 'drizzle';
  }
  if (rainChance === 50) {
    if (r < 0.2) return 'clear';
    if (r < 0.55) return 'overcast';
    if (r < 0.7) return 'windy';
    if (r < 0.85) return 'humid';
    return 'drizzle';
  }
  if (rainChance === 75) {
    if (r < 0.08) return 'clear';
    if (r < 0.48) return 'overcast';
    if (r < 0.6) return 'windy';
    if (r < 0.78) return 'humid';
    return 'drizzle';
  }
  // 100% rain
  if (r < 0.45) return 'overcast';
  if (r < 0.8) return 'drizzle';
  return 'humid';
}

export function maybeShiftWeather(params: {
  currentWeather: WeatherCondition;
  rainChance: RainChance;
  format: MatchFormat;
  rng?: () => number;
}): { nextWeather: WeatherCondition; changed: boolean; commentary: string | null } {
  const rng = params.rng ?? Math.random;
  const shiftChance = params.rainChance >= 50 ? 0.32 : params.rainChance > 0 ? 0.25 : 0.2;
  if (rng() >= shiftChance) {
    return { nextWeather: params.currentWeather, changed: false, commentary: null };
  }

  const candidate = pickInitialWeather(params.rainChance, rng);
  if (candidate === params.currentWeather) {
    return { nextWeather: params.currentWeather, changed: false, commentary: null };
  }

  const meta = WEATHER_META[candidate];
  const commentaryByWeather: Record<WeatherCondition, string> = {
    clear: `Skies clear up over the stadium (${meta.visibilityPct}% visibility) — pitch returns to true pace and bounce.`,
    overcast: `Thick overcast clouds roll in (${meta.visibilityPct}% visibility) — fast bowlers get extra swing & seam!`,
    windy: `Gusty crosswinds sweep across the ground (${meta.visibilityPct}% visibility) — lofted strokes carry drift risk.`,
    humid: `Humid dew settles on the outfield (${meta.visibilityPct}% visibility) — ball skids on with reduced spin grip.`,
    drizzle: `Light drizzle & mist lower visibility to ${meta.visibilityPct}% — damp turf slows boundaries & helps seamers.`,
  };

  return {
    nextWeather: candidate,
    changed: true,
    commentary: commentaryByWeather[candidate],
  };
}

export function computeWeatherModifiers(
  weather: WeatherCondition,
  deliveryType: DeliveryType,
  shot: ShotType
): {
  wicketMod: number;
  boundaryMod: number;
  dotMod: number;
  swingVisualScale: number;
} {
  const isPaceSwingSeam =
    deliveryType === 'swing' ||
    deliveryType === 'seam' ||
    deliveryType === 'fast' ||
    deliveryType === 'yorker';
  const isSpin =
    deliveryType === 'spin' ||
    deliveryType === 'off_spin' ||
    deliveryType === 'leg_spin' ||
    deliveryType === 'googly' ||
    deliveryType === 'doosra' ||
    deliveryType === 'arm_ball' ||
    deliveryType === 'carrom';
  const isTrickery =
    deliveryType === 'googly' ||
    deliveryType === 'doosra' ||
    deliveryType === 'carrom' ||
    deliveryType === 'swing';

  if (weather === 'overcast') {
    return {
      wicketMod:
        (deliveryType === 'swing' || deliveryType === 'seam'
          ? 0.035
          : isPaceSwingSeam
          ? 0.018
          : 0) + (isTrickery ? 0.01 : 0),
      boundaryMod: -0.02,
      dotMod: 0.022,
      swingVisualScale: 1.38,
    };
  }

  if (weather === 'windy') {
    const aerialRisk = shot === 'loft' || shot === 'hook' ? 0.02 : 0;
    return {
      wicketMod:
        aerialRisk + (deliveryType === 'swing' || deliveryType === 'seam' ? 0.016 : 0),
      boundaryMod: shot === 'loft' ? 0.01 : -0.008,
      dotMod: 0.01,
      swingVisualScale: 1.22,
    };
  }

  if (weather === 'humid') {
    return {
      wicketMod:
        deliveryType === 'swing' ? 0.022 : isSpin ? -0.02 : 0,
      boundaryMod: 0.015,
      dotMod: -0.01,
      swingVisualScale: 1.15,
    };
  }

  if (weather === 'drizzle') {
    return {
      wicketMod:
        (isPaceSwingSeam ? 0.028 : 0) + (isTrickery ? 0.015 : 0),
      boundaryMod: -0.035,
      dotMod: 0.035,
      swingVisualScale: 1.32,
    };
  }

  return {
    wicketMod: 0,
    boundaryMod: 0,
    dotMod: 0,
    swingVisualScale: 1.0,
  };
}

export interface WeatherPitchPalette {
  baseColor: string;
  accentColor: string;
  moistureSheenColor: string | null;
  puddleOpacity: number;
  outfieldEvenColor: string;
  outfieldOddColor: string;
}

export function getWeatherPitchPalette(
  pitchCondition: PitchCondition,
  weather: WeatherCondition,
  isRainDelay = false
): WeatherPitchPalette {
  const heavyRain = isRainDelay || weather === 'drizzle';

  const outfieldEvenColor = isRainDelay
    ? '#0c431b'
    : weather === 'drizzle'
    ? '#0e4c1d'
    : weather === 'overcast'
    ? '#0f561f'
    : weather === 'humid'
    ? '#105c22'
    : '#116322';
  const outfieldOddColor = isRainDelay
    ? '#115423'
    : weather === 'drizzle'
    ? '#146026'
    : weather === 'overcast'
    ? '#156b27'
    : weather === 'humid'
    ? '#167229'
    : '#177a2b';

  if (pitchCondition === 'green') {
    if (isRainDelay) {
      return {
        baseColor: '#456235',
        accentColor: 'rgba(22, 61, 30, 0.42)',
        moistureSheenColor: 'rgba(147, 197, 253, 0.2)',
        puddleOpacity: 0.35,
        outfieldEvenColor,
        outfieldOddColor,
      };
    }
    if (weather === 'drizzle') {
      return {
        baseColor: '#52733e',
        accentColor: 'rgba(26, 74, 34, 0.36)',
        moistureSheenColor: 'rgba(147, 197, 253, 0.14)',
        puddleOpacity: 0.22,
        outfieldEvenColor,
        outfieldOddColor,
      };
    }
    if (weather === 'overcast') {
      return {
        baseColor: '#638448',
        accentColor: 'rgba(38, 86, 35, 0.3)',
        moistureSheenColor: 'rgba(148, 163, 184, 0.1)',
        puddleOpacity: 0,
        outfieldEvenColor,
        outfieldOddColor,
      };
    }
    if (weather === 'humid') {
      return {
        baseColor: '#608647',
        accentColor: 'rgba(34, 88, 36, 0.28)',
        moistureSheenColor: 'rgba(186, 230, 253, 0.14)',
        puddleOpacity: 0.08,
        outfieldEvenColor,
        outfieldOddColor,
      };
    }
    return {
      baseColor: '#799a54',
      accentColor: 'rgba(46, 102, 38, 0.25)',
      moistureSheenColor: null,
      puddleOpacity: 0,
      outfieldEvenColor,
      outfieldOddColor,
    };
  }

  if (pitchCondition === 'dry') {
    if (isRainDelay) {
      return {
        baseColor: '#6d624d',
        accentColor: 'rgba(68, 53, 33, 0.36)',
        moistureSheenColor: 'rgba(147, 197, 253, 0.22)',
        puddleOpacity: 0.35,
        outfieldEvenColor,
        outfieldOddColor,
      };
    }
    if (weather === 'drizzle') {
      return {
        baseColor: '#8d7d60',
        accentColor: 'rgba(89, 67, 39, 0.3)',
        moistureSheenColor: 'rgba(147, 197, 253, 0.15)',
        puddleOpacity: 0.22,
        outfieldEvenColor,
        outfieldOddColor,
      };
    }
    if (weather === 'overcast') {
      return {
        baseColor: '#baa886',
        accentColor: 'rgba(105, 79, 44, 0.24)',
        moistureSheenColor: 'rgba(148, 163, 184, 0.1)',
        puddleOpacity: 0,
        outfieldEvenColor,
        outfieldOddColor,
      };
    }
    if (weather === 'humid') {
      return {
        baseColor: '#bfa97d',
        accentColor: 'rgba(110, 82, 46, 0.24)',
        moistureSheenColor: 'rgba(186, 230, 253, 0.12)',
        puddleOpacity: 0.08,
        outfieldEvenColor,
        outfieldOddColor,
      };
    }
    return {
      baseColor: weather === 'windy' ? '#dfc48e' : '#d7c195',
      accentColor: 'rgba(130, 92, 48, 0.22)',
      moistureSheenColor: null,
      puddleOpacity: 0,
      outfieldEvenColor,
      outfieldOddColor,
    };
  }

  // Hard pitch
  if (isRainDelay) {
    return {
      baseColor: '#665b48',
      accentColor: 'rgba(55, 42, 24, 0.34)',
      moistureSheenColor: 'rgba(147, 197, 253, 0.22)',
      puddleOpacity: 0.35,
      outfieldEvenColor,
      outfieldOddColor,
    };
  }
  if (heavyRain) {
    return {
      baseColor: '#817056',
      accentColor: 'rgba(78, 56, 30, 0.28)',
      moistureSheenColor: 'rgba(147, 197, 253, 0.15)',
      puddleOpacity: 0.22,
      outfieldEvenColor,
      outfieldOddColor,
    };
  }
  if (weather === 'overcast') {
    return {
      baseColor: '#a8926d',
      accentColor: 'rgba(92, 65, 34, 0.22)',
      moistureSheenColor: 'rgba(148, 163, 184, 0.1)',
      puddleOpacity: 0,
      outfieldEvenColor,
      outfieldOddColor,
    };
  }
  if (weather === 'humid') {
    return {
      baseColor: '#b09468',
      accentColor: 'rgba(104, 72, 36, 0.2)',
      moistureSheenColor: 'rgba(186, 230, 253, 0.12)',
      puddleOpacity: 0.08,
      outfieldEvenColor,
      outfieldOddColor,
    };
  }
  return {
    baseColor: weather === 'windy' ? '#cfa970' : '#c8a774',
    accentColor: 'rgba(139, 90, 43, 0.16)',
    moistureSheenColor: null,
    puddleOpacity: 0,
    outfieldEvenColor,
    outfieldOddColor,
  };
}

export interface WeatherBallPhysics {
  swingMultiplier: number;
  bounceMultiplier: number;
  flightDragScale: number;
}

export function getWeatherBallPhysics(
  weather: WeatherCondition,
  isRainDelay = false
): WeatherBallPhysics {
  if (isRainDelay) {
    return {
      swingMultiplier: 1.48,
      bounceMultiplier: 0.44,
      flightDragScale: 1.18,
    };
  }
  if (weather === 'drizzle') {
    return {
      swingMultiplier: 1.42,
      bounceMultiplier: 0.56,
      flightDragScale: 1.12,
    };
  }
  if (weather === 'overcast') {
    return {
      swingMultiplier: 1.65,
      bounceMultiplier: 0.88,
      flightDragScale: 1.0,
    };
  }
  if (weather === 'windy') {
    return {
      swingMultiplier: 1.35,
      bounceMultiplier: 0.96,
      flightDragScale: 1.0,
    };
  }
  if (weather === 'humid') {
    return {
      swingMultiplier: 1.18,
      bounceMultiplier: 0.78,
      flightDragScale: 0.95,
    };
  }
  return {
    swingMultiplier: 1.0,
    bounceMultiplier: 1.0,
    flightDragScale: 1.0,
  };
}

export function shouldTriggerRainInterruption(params: {
  format: MatchFormat;
  rainChance: RainChance;
  inningsNumber: 1 | 2 | 3 | 4;
  completedOvers: number;
  maxOvers: number;
  rainInterruptionsInMatch: number;
  rainInterruptionsInInnings: number;
  rng?: () => number;
}): boolean {
  const {
    format,
    rainChance,
    inningsNumber,
    completedOvers,
    maxOvers,
    rainInterruptionsInMatch,
    rainInterruptionsInInnings,
  } = params;
  const rng = params.rng ?? Math.random;

  if (format !== 'limited' || rainChance === 0) return false;
  if (completedOvers < 1 || completedOvers >= maxOvers) return false;
  if (rainInterruptionsInInnings >= 1 || rainInterruptionsInMatch >= 2) return false;

  // Guaranteed rain checkpoint for 100% rain chance
  if (rainChance === 100) {
    const inn2GuaranteeOver = Math.max(1, Math.floor(maxOvers * 0.35));
    if (inningsNumber === 2 && rainInterruptionsInMatch === 0 && completedOvers >= inn2GuaranteeOver) {
      return true;
    }
    if (inningsNumber === 1 && maxOvers >= 10 && completedOvers >= Math.max(2, Math.floor(maxOvers * 0.4))) {
      return rng() < 0.45;
    }
    if (inningsNumber === 2) {
      return rng() < 0.5;
    }
    return false;
  }

  // Probabilistic rain for 25%, 50%, 75% spread cleanly over eligible over boundaries
  const p = rainChance / 100;
  const inn1Eligible = maxOvers >= 10 ? Math.max(1, Math.floor((maxOvers - 2) * 0.4)) : 0;
  const inn2Eligible = Math.max(1, maxOvers - 1);
  const totalCheckpoints = Math.max(1, inn1Eligible + inn2Eligible);
  const hazard = 1 - Math.pow(1 - p, 1 / totalCheckpoints);

  if (inningsNumber === 1 && maxOvers < 10) {
    // Keep 5-over Innings 1 clean unless 10+ overs; rain hits Innings 2 chase cleanly
    return false;
  }
  return rng() < hazard;
}

export function computeRainReduction(params: {
  originalMaxOvers: number;
  maxOvers: number;
  completedOvers: number;
  wicketsLost: number;
  currentResourcesPct: number;
  rainChance: RainChance;
  rng?: () => number;
}): {
  previousOvers: number;
  revisedOvers: number;
  oversLost: number;
  newResourcesPct: number;
  resourceDelta: number;
} {
  const {
    originalMaxOvers,
    maxOvers,
    completedOvers,
    wicketsLost,
    currentResourcesPct,
    rainChance,
  } = params;
  const rng = params.rng ?? Math.random;

  const oversRemainingBefore = Math.max(1, maxOvers - completedOvers);
  let oversLost: number;
  if (oversRemainingBefore === 1) {
    oversLost = 1;
  } else {
    const minFraction = rainChance >= 75 ? 0.3 : 0.2;
    const maxFraction = rainChance >= 75 ? 0.55 : 0.45;
    const rawLost = Math.round(oversRemainingBefore * (minFraction + rng() * (maxFraction - minFraction)));
    oversLost = Math.max(1, Math.min(oversRemainingBefore - 1, rawLost));
  }

  const oversRemainingAfter = Math.max(0, oversRemainingBefore - oversLost);
  const revisedOvers = completedOvers + oversRemainingAfter;

  const resourceBefore = calculateDlsResourcePct(originalMaxOvers, oversRemainingBefore, wicketsLost);
  const resourceAfter = calculateDlsResourcePct(originalMaxOvers, oversRemainingAfter, wicketsLost);
  const resourceDelta = Number(Math.max(0.5, resourceBefore - resourceAfter).toFixed(2));
  const newResourcesPct = Number(Math.max(1, currentResourcesPct - resourceDelta).toFixed(2));

  return {
    previousOvers: maxOvers,
    revisedOvers,
    oversLost,
    newResourcesPct,
    resourceDelta,
  };
}
