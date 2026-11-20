import { DeliveryLength, DeliveryType, PitchCondition, ShotType, WicketKind } from './types';

const DELIVERY_FLAVOR: Record<DeliveryType, Record<DeliveryLength, string>> = {
  fast: {
    full: '145 kph thunderbolt pitched right up at the toes',
    good: 'rapid hard-length fast ball hitting the deck',
    short: 'sharp fast delivery rising briskly off the turf',
  },
  spin: {
    full: 'flighted spinning delivery dipping late onto the bat',
    good: 'tossed-up spinner gripping and turning past the edge',
    short: 'dragged-down spin ball kicking up with sharp turn',
  },
  off_spin: {
    full: 'looped off-break drifting in and dipping late',
    good: 'classic off-spin biting sharply back into the batter',
    short: 'short off-break turning square off the deck',
  },
  leg_spin: {
    full: 'flighted leg-break tempting the drive outside off',
    good: 'ripped leg-spinner pitching on middle and spinning past the edge',
    short: 'long-hop leg-break spitting away from the crease',
  },
  googly: {
    full: 'disguised full googly dipping and darting back in unexpectedly',
    good: 'deceptive wrong’un turning sharply against the spin',
    short: 'back-of-the-hand googly hurrying through onto the pads',
  },
  doosra: {
    full: 'full doosra sliding away from the inside half of the bat',
    good: 'clever doosra breaking away the other way off a tight length',
    short: 'quick doosra jumping off the pitch away from the arc',
  },
  arm_ball: {
    full: 'darted-in full arm ball skidding straight with the angle',
    good: 'flat, fast arm ball refusing to turn and attacking the stumps',
    short: 'skiddy arm ball hurrying low off the surface',
  },
  carrom: {
    full: 'flicked carrom ball dipping abruptly with mystery spin',
    good: 'zippy carrom ball fizzing off the seam with sharp bounce',
    short: 'short mystery carrom ball spinning unpredictably',
  },
  swing: {
    full: 'pitching-up outswinger curving gracefully in the air',
    good: 'classic late-swinging delivery probing the off-stump channel',
    short: 'back-of-a-length swinger shaping away late',
  },
  seam: {
    full: 'full seam-up delivery nibbling off the pitch',
    good: 'nippy seam-up ball jagging off the deck on a tight line',
    short: 'heavy seam delivery hitting the splice off a short length',
  },
  yorker: {
    full: 'pinpoint toe-crushing yorker right in the blockhole',
    good: 'spearing low full-toss/yorker targeting the base of middle stump',
    short: 'skiddy yorker-length attempt that stays low',
  },
  bouncer: {
    full: 'surprise slower-bouncer variation climbing toward the ribs',
    good: 'steeply rising bouncer whistling past the shoulder',
    short: 'ferocious chin-music bouncer rearing up at the helmet',
  },
};

const SHOT_VERB_SIX: Record<ShotType, string> = {
  drive: 'threads an effortless lofted drive straight over long-off for SIX!',
  pull: 'swivels and hammers a monstrous pull shot deep into the stands for SIX!',
  sweep: 'drops to one knee and slog-sweeps it cleanly over cow corner for SIX!',
  cut: 'slashes a fierce upper-cut flying over deep third for SIX!',
  loft: 'clears the front leg and launches a towering lofted strike into orbit for SIX!',
  defend: 'checks the swing yet the pure timing sends it sailing over the rope for SIX!',
  flick: 'whips a wristy flick off the pads high over deep square leg for SIX!',
  hook: 'takes on the short ball with a fearless hook soaring over fine leg for SIX!',
};

const SHOT_VERB_FOUR: Record<ShotType, string> = {
  drive: 'leans into a silky cover drive racing across the turf for FOUR!',
  pull: 'rocks back and cracks a commanding pull between mid-wicket and square leg for FOUR!',
  sweep: 'sweeps fine behind square with surgical precision for FOUR!',
  cut: 'opens the face and slashes a blazing square cut past point for FOUR!',
  loft: 'chips cleanly over the infield on one bounce into the boundary boards for FOUR!',
  defend: 'guides a late defensive push through the slips into the third-man fence for FOUR!',
  flick: 'clips a velvet flick through mid-wicket that speeds to the rope for FOUR!',
  hook: 'swats an audacious hook behind square for a blistering FOUR!',
};

const SHOT_VERB_DOT: Record<ShotType, string> = {
  drive: 'punches the drive straight to cover — no run.',
  pull: 'swings hard at the pull but finds mid-wicket on the circle.',
  sweep: 'misses the sweep and wears it on the pad — dot ball.',
  cut: 'chops the cut straight to backward point — tight fielding.',
  loft: 'mistimes the lofted swing, beaten by the change of pace.',
  defend: 'presents the full face of the bat in a textbook forward defence.',
  flick: 'works the flick straight to short mid-wicket — dot ball.',
  hook: 'ducks late after shaping for the hook as the ball sails through.',
};

const SHOT_VERB_RUNS: Record<ShotType, string> = {
  drive: 'caresses a crisp drive into the deep',
  pull: 'controls a sharp pull into the gap on the leg side',
  sweep: 'rolls the wrists on a tidy sweep toward deep backward square',
  cut: 'steers a late cut down toward deep third',
  loft: 'elevates a controlled loft into vacant outfield grass',
  defend: 'drops it softly into the gap with soft hands',
  flick: 'tucks a neat flick past square leg',
  hook: 'glances an assertive hook down to fine leg',
};

const WICKET_FLAVOR: Record<WicketKind, (bowler: string, striker: string, shot: ShotType, deliveryDesc: string) => string> = {
  Bowled: (bowler, striker, shot, deliveryDesc) =>
    `CLEAN BOWLED! ${bowler} sends down a ${deliveryDesc} — ${striker} swings for a ${shot.toUpperCase()} and the timber is shattered!`,
  Caught: (bowler, striker, shot, deliveryDesc) =>
    `OUT! CAUGHT! ${striker} tries a ${shot.toUpperCase()} against ${bowler}'s ${deliveryDesc}, slices it high, and the fielder pouches it safely!`,
  LBW: (bowler, striker, shot, deliveryDesc) =>
    `PLUMB LBW! ${bowler} spears in a ${deliveryDesc}; ${striker} misses the ${shot.toUpperCase()} and the finger goes straight up!`,
  Stumped: (bowler, striker, shot, deliveryDesc) =>
    `STUMPED IN A FLASH! ${striker} charges down for a ${shot.toUpperCase()}, beaten by ${bowler}'s ${deliveryDesc}, and the keeper whips the bails off!`,
  'Hit Wicket': (bowler, striker, shot, deliveryDesc) =>
    `HIT WICKET! Cramped for room by ${bowler}'s ${deliveryDesc}, ${striker} steps back into the stumps while attempting a ${shot.toUpperCase()}!`,
};

export function buildDeliveryCommentary(params: {
  bowlerName: string;
  strikerName: string;
  deliveryType: DeliveryType;
  deliveryLength: DeliveryLength;
  shot: ShotType;
  runs: number;
  isWicket: boolean;
  wicketKind?: WicketKind;
  pitchCondition?: PitchCondition;
  bowlingSide?: 'over' | 'round';
}): string {
  const {
    bowlerName,
    strikerName,
    deliveryType,
    deliveryLength,
    shot,
    runs,
    isWicket,
    wicketKind,
    pitchCondition,
    bowlingSide,
  } = params;

  const sideTag = bowlingSide === 'round' ? ' from around the wicket' : '';
  const deliveryDesc = `${DELIVERY_FLAVOR[deliveryType][deliveryLength]}${sideTag}`;
  const pitchTag =
    pitchCondition === 'green'
      ? ' off the green seamers deck'
      : pitchCondition === 'dry'
      ? ' off the dry turning surface'
      : pitchCondition === 'hard'
      ? ' off the hard true surface'
      : '';

  if (isWicket) {
    const kind = wicketKind ?? 'Bowled';
    return `${WICKET_FLAVOR[kind](bowlerName, strikerName, shot, deliveryDesc)}${pitchTag ? ` (${pitchTag.trim()})` : ''}`;
  }

  if (runs === 6) {
    return `${bowlerName} bowls a ${deliveryDesc}${pitchTag}. ${strikerName} ${SHOT_VERB_SIX[shot]}`;
  }

  if (runs === 4) {
    return `${bowlerName} fires a ${deliveryDesc}. ${strikerName} ${SHOT_VERB_FOUR[shot]}`;
  }

  if (runs === 0) {
    return `${bowlerName} delivers a ${deliveryDesc}; ${strikerName} ${SHOT_VERB_DOT[shot]}`;
  }

  const runLabel = runs === 1 ? '1 quick run' : `${runs} well-ran runs`;
  return `${bowlerName} sends down a ${deliveryDesc}. ${strikerName} ${SHOT_VERB_RUNS[shot]} for ${runLabel}.`;
}
