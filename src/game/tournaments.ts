import { computePlayerOfTheMatch } from './awards';
import { simulateFullMatch } from './cricketEngine';
import { getTeamById } from './teams';
import {
  Difficulty,
  MatchState,
  PitchCondition,
  RainChance,
  StandingRow,
  TournamentFixture,
  TournamentPlayerStat,
  TournamentState,
  TournamentType,
} from './types';

function makeStandings(teamIds: string[], group?: 'A' | 'B'): StandingRow[] {
  return teamIds.map((teamId) => ({
    teamId,
    group,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    drawn: 0,
    points: 0,
    runsFor: 0,
    ballsFaced: 0,
    runsAgainst: 0,
    ballsBowled: 0,
    nrr: 0,
  }));
}

function generateRoundRobinPairs(teamIds: string[]): Array<[string, string]> {
  const list = [...teamIds];
  if (list.length % 2 === 1) list.push('BYE');
  const n = list.length;
  const pairs: Array<[string, string]> = [];

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const t1 = list[i];
      const t2 = list[n - 1 - i];
      if (t1 !== 'BYE' && t2 !== 'BYE') {
        pairs.push(round % 2 === 0 ? [t1, t2] : [t2, t1]);
      }
    }
    const fixed = list[0];
    const rest = list.slice(1);
    const last = rest.pop()!;
    list.splice(0, list.length, fixed, last, ...rest);
  }
  return pairs;
}

export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    return b.nrr - a.nrr;
  });
}

function recomputeNrr(row: StandingRow): StandingRow {
  const oversFor = row.ballsFaced > 0 ? row.ballsFaced / 6 : 0;
  const oversAgainst = row.ballsBowled > 0 ? row.ballsBowled / 6 : 0;
  const forRate = oversFor > 0 ? row.runsFor / oversFor : 0;
  const againstRate = oversAgainst > 0 ? row.runsAgainst / oversAgainst : 0;
  return {
    ...row,
    nrr: Number((forRate - againstRate).toFixed(3)),
  };
}

export function getPlayerStatKey(teamId: string, playerName: string): string {
  return `${teamId}:${playerName}`;
}

export function getBattingAverageValue(stat: TournamentPlayerStat): number {
  const dismissals = stat.inningsBatted - stat.notOuts;
  if (stat.inningsBatted === 0) return 0;
  return dismissals > 0 ? stat.runs / dismissals : stat.runs;
}

export function formatBattingAverage(stat: TournamentPlayerStat): string {
  if (stat.inningsBatted === 0) return '—';
  const dismissals = stat.inningsBatted - stat.notOuts;
  if (dismissals <= 0) {
    return `${stat.runs.toFixed(2)}*`;
  }
  return (stat.runs / dismissals).toFixed(2);
}

export function getStrikeRateValue(stat: TournamentPlayerStat): number {
  if (stat.ballsFaced <= 0) return 0;
  return (stat.runs / stat.ballsFaced) * 100;
}

export function formatStrikeRate(stat: TournamentPlayerStat): string {
  if (stat.ballsFaced <= 0) return '0.0';
  return ((stat.runs / stat.ballsFaced) * 100).toFixed(1);
}

export function formatEconomy(stat: TournamentPlayerStat): string {
  if (stat.ballsBowled <= 0) return '—';
  return ((stat.runsConceded / stat.ballsBowled) * 6).toFixed(2);
}

export function mergeMatchStatsIntoRecord(
  existing: Record<string, TournamentPlayerStat>,
  match: MatchState
): Record<string, TournamentPlayerStat> {
  const next: Record<string, TournamentPlayerStat> = { ...existing };
  const participated = new Set<string>();

  const ensureEntry = (teamId: string, playerName: string): TournamentPlayerStat => {
    const key = getPlayerStatKey(teamId, playerName);
    if (!next[key]) {
      next[key] = {
        playerName,
        teamId,
        matches: 0,
        inningsBatted: 0,
        notOuts: 0,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        highScore: 0,
        highScoreNotOut: false,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
      };
    } else {
      next[key] = { ...next[key] };
    }
    return next[key];
  };

  const allInn = [match.innings1, match.innings2, match.innings3, match.innings4];
  for (const inn of allInn) {
    if (!inn) continue;

    for (const batter of inn.batters) {
      if (batter.balls === 0 && !batter.out) continue;
      const key = getPlayerStatKey(inn.battingTeamId, batter.name);
      participated.add(key);
      const stat = ensureEntry(inn.battingTeamId, batter.name);
      stat.inningsBatted += 1;
      if (!batter.out) stat.notOuts += 1;
      stat.runs += batter.runs;
      stat.ballsFaced += batter.balls;
      stat.fours += batter.fours;
      stat.sixes += batter.sixes;
      if (
        batter.runs > stat.highScore ||
        (batter.runs === stat.highScore && !batter.out && !stat.highScoreNotOut)
      ) {
        stat.highScore = batter.runs;
        stat.highScoreNotOut = !batter.out;
      }
    }

    const spells = inn.bowlerSpells ?? {};
    for (const [bowlerName, spell] of Object.entries(spells)) {
      if (spell.balls <= 0) continue;
      const key = getPlayerStatKey(inn.bowlingTeamId, bowlerName);
      participated.add(key);
      const stat = ensureEntry(inn.bowlingTeamId, bowlerName);
      stat.wickets += spell.wickets;
      stat.ballsBowled += spell.balls;
      stat.runsConceded += spell.runs;
    }
  }

  for (const key of participated) {
    if (next[key]) {
      next[key].matches += 1;
    }
  }

  return next;
}

export function combinePlayerStatRecords(
  records: Array<Record<string, TournamentPlayerStat>>
): Record<string, TournamentPlayerStat> {
  const combined: Record<string, TournamentPlayerStat> = {};
  for (const record of records) {
    if (!record) continue;
    for (const [key, entry] of Object.entries(record)) {
      if (!combined[key]) {
        combined[key] = { ...entry };
      } else {
        const cur = combined[key];
        const newBest =
          entry.highScore > cur.highScore ||
          (entry.highScore === cur.highScore && entry.highScoreNotOut && !cur.highScoreNotOut);
        combined[key] = {
          playerName: cur.playerName,
          teamId: cur.teamId,
          matches: cur.matches + entry.matches,
          inningsBatted: cur.inningsBatted + entry.inningsBatted,
          notOuts: cur.notOuts + entry.notOuts,
          runs: cur.runs + entry.runs,
          ballsFaced: cur.ballsFaced + entry.ballsFaced,
          fours: cur.fours + entry.fours,
          sixes: cur.sixes + entry.sixes,
          highScore: newBest ? entry.highScore : cur.highScore,
          highScoreNotOut: newBest ? entry.highScoreNotOut : cur.highScoreNotOut,
          wickets: cur.wickets + entry.wickets,
          ballsBowled: cur.ballsBowled + entry.ballsBowled,
          runsConceded: cur.runsConceded + entry.runsConceded,
        };
      }
    }
  }
  return combined;
}

export function createTournament(params: {
  type: TournamentType;
  userTeamId: string;
  difficulty: Difficulty;
  pitchCondition?: PitchCondition;
  rainChance?: RainChance;
  oversPerDay?: 30 | 60 | 90;
  testCount?: 3 | 5;
}): TournamentState {
  const {
    type,
    userTeamId,
    difficulty,
    pitchCondition = 'hard',
    rainChance = 0,
    oversPerDay = 90,
    testCount = 5,
  } = params;
  const id = `${type}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  if (type === 't20_wc') {
    const groupA = ['ind', 'pak', 'eng', 'sl', 'ban', 'ire'];
    const groupB = ['aus', 'sa', 'nz', 'wi', 'afg', 'zim'];
    const pairsA = generateRoundRobinPairs(groupA);
    const pairsB = generateRoundRobinPairs(groupB);
    const fixtures: TournamentFixture[] = [];

    for (let i = 0; i < Math.max(pairsA.length, pairsB.length); i++) {
      if (pairsA[i]) {
        const [homeTeamId, awayTeamId] = pairsA[i];
        fixtures.push({
          id: `t20-a-${i + 1}`,
          round: 'group',
          group: 'A',
          label: `Group A · Match ${i + 1}`,
          homeTeamId,
          awayTeamId,
          completed: false,
          winnerTeamId: null,
          summary: 'Scheduled',
        });
      }
      if (pairsB[i]) {
        const [homeTeamId, awayTeamId] = pairsB[i];
        fixtures.push({
          id: `t20-b-${i + 1}`,
          round: 'group',
          group: 'B',
          label: `Group B · Match ${i + 1}`,
          homeTeamId,
          awayTeamId,
          completed: false,
          winnerTeamId: null,
          summary: 'Scheduled',
        });
      }
    }

    return {
      id,
      type,
      title: 'ICC T20 World Cup',
      format: 'limited',
      pitchCondition,
      rainChance,
      oversPerInningsOrDay: 20,
      userTeamId,
      difficulty,
      stage: 'league',
      standings: [...makeStandings(groupA, 'A'), ...makeStandings(groupB, 'B')],
      fixtures,
      playerStats: {},
      championTeamId: null,
    };
  }

  if (type === 'odi_wc') {
    const teams = ['ind', 'aus', 'eng', 'pak', 'sa', 'nz', 'wi', 'sl', 'ban', 'afg'];
    const pairs = generateRoundRobinPairs(teams);
    const fixtures: TournamentFixture[] = pairs.map(([homeTeamId, awayTeamId], idx) => ({
      id: `odi-${idx + 1}`,
      round: 'group',
      label: `League Match ${idx + 1}`,
      homeTeamId,
      awayTeamId,
      completed: false,
      winnerTeamId: null,
      summary: 'Scheduled',
    }));

    return {
      id,
      type,
      title: 'ICC ODI World Cup',
      format: 'limited',
      pitchCondition,
      rainChance,
      oversPerInningsOrDay: 50,
      userTeamId,
      difficulty,
      stage: 'league',
      standings: makeStandings(teams),
      fixtures,
      playerStats: {},
      championTeamId: null,
    };
  }

  if (type === 'ipl') {
    const teams = ['mi', 'csk', 'rcb', 'kkr', 'dc', 'rr', 'srh', 'pbks', 'lsg', 'gt'];
    const pairs = generateRoundRobinPairs(teams);
    const fixtures: TournamentFixture[] = pairs.map(([homeTeamId, awayTeamId], idx) => ({
      id: `ipl-${idx + 1}`,
      round: 'group',
      label: `Match ${idx + 1}`,
      homeTeamId,
      awayTeamId,
      completed: false,
      winnerTeamId: null,
      summary: 'Scheduled',
    }));

    return {
      id,
      type,
      title: 'IPL Championship',
      format: 'limited',
      pitchCondition,
      rainChance,
      oversPerInningsOrDay: 20,
      userTeamId,
      difficulty,
      stage: 'league',
      standings: makeStandings(teams),
      fixtures,
      playerStats: {},
      championTeamId: null,
    };
  }

  if (type === 'ashes') {
    const venues =
      testCount === 3
        ? ["Lord's, London", 'Edgbaston, Birmingham', 'The Oval, London']
        : [
            "Lord's, London",
            'Edgbaston, Birmingham',
            'Headingley, Leeds',
            'Old Trafford, Manchester',
            'The Oval, London',
          ];
    const fixtures: TournamentFixture[] = venues.map((venue, idx) => ({
      id: `ashes-${idx + 1}`,
      round: 'test_match',
      label: `Ashes Test ${idx + 1}`,
      venue,
      homeTeamId: idx % 2 === 0 ? 'eng' : 'aus',
      awayTeamId: idx % 2 === 0 ? 'aus' : 'eng',
      completed: false,
      winnerTeamId: null,
      summary: 'Scheduled',
    }));

    return {
      id,
      type,
      title: 'The Ashes Cup',
      format: 'test',
      pitchCondition,
      rainChance,
      oversPerInningsOrDay: oversPerDay,
      testMatchCount: testCount,
      userTeamId,
      difficulty,
      stage: 'series',
      standings: makeStandings(['eng', 'aus']),
      fixtures,
      playerStats: {},
      championTeamId: null,
    };
  }

  // Border-Gavaskar Trophy (3 or 5 Tests: India vs Australia)
  const bgtVenues =
    testCount === 3
      ? ['Perth Stadium, Perth', 'MCG, Melbourne', 'SCG, Sydney']
      : [
          'Perth Stadium, Perth',
          'Adelaide Oval, Adelaide',
          'The Gabba, Brisbane',
          'MCG, Melbourne',
          'SCG, Sydney',
        ];
  const fixtures: TournamentFixture[] = bgtVenues.map((venue, idx) => ({
    id: `bgt-${idx + 1}`,
    round: 'test_match',
    label: `BGT Test ${idx + 1}`,
    venue,
    homeTeamId: idx % 2 === 0 ? 'aus' : 'ind',
    awayTeamId: idx % 2 === 0 ? 'ind' : 'aus',
    completed: false,
    winnerTeamId: null,
    summary: 'Scheduled',
  }));

  return {
    id,
    type: 'bgt',
    title: 'Border-Gavaskar Trophy',
    format: 'test',
    pitchCondition,
    rainChance,
    oversPerInningsOrDay: oversPerDay,
    testMatchCount: testCount,
    userTeamId,
    difficulty,
    stage: 'series',
    standings: makeStandings(['ind', 'aus']),
    fixtures,
    playerStats: {},
    championTeamId: null,
  };
}

function formatScoreText(match: MatchState, teamId: string): string {
  const parts: string[] = [];
  const allInn = [match.innings1, match.innings2, match.innings3, match.innings4];
  for (const inn of allInn) {
    if (inn && inn.battingTeamId === teamId) {
      parts.push(`${inn.runs}/${inn.wickets}${inn.declared ? 'd' : ''}`);
    }
  }
  return parts.join(' & ') || '—';
}

export function applyMatchOutcomeToTournament(
  tournament: TournamentState,
  fixtureId: string,
  match: MatchState
): TournamentState {
  const targetFixture = tournament.fixtures.find((f) => f.id === fixtureId);
  if (!targetFixture || targetFixture.completed) return tournament;

  const winner = match.winnerTeamId;
  const homeScoreText = formatScoreText(match, targetFixture.homeTeamId);
  const awayScoreText = formatScoreText(match, targetFixture.awayTeamId);
  const potm = computePlayerOfTheMatch(match) ?? undefined;

  const updatedFixtures = tournament.fixtures.map((f) =>
    f.id === fixtureId
      ? {
          ...f,
          completed: true,
          winnerTeamId: winner,
          summary: match.resultSummary,
          homeScoreText,
          awayScoreText,
          potm,
        }
      : f
  );

  // Update standings (for group/league or series tally)
  const isCountsForTable =
    targetFixture.round === 'group' || targetFixture.round === 'test_match';

  let updatedStandings = tournament.standings;
  if (isCountsForTable) {
    updatedStandings = tournament.standings.map((row) => {
      if (row.teamId !== targetFixture.homeTeamId && row.teamId !== targetFixture.awayTeamId) {
        return row;
      }
      const isWin = winner === row.teamId;
      const isTie = winner === 'tie';
      const isDraw = winner === 'draw';
      const isLoss = !isWin && !isTie && !isDraw;

      // Sum runs & balls for NRR (in limited overs)
      let runsFor = row.runsFor;
      let ballsFaced = row.ballsFaced;
      let runsAgainst = row.runsAgainst;
      let ballsBowled = row.ballsBowled;
      const allInn = [match.innings1, match.innings2, match.innings3, match.innings4];
      for (const inn of allInn) {
        if (!inn) continue;
        // Full quota rule for NRR when all out in limited overs
        const effectiveBalls =
          match.format === 'limited' && inn.wickets >= 10
            ? match.totalOvers * 6
            : inn.ballsBowled;
        if (inn.battingTeamId === row.teamId) {
          runsFor += inn.runs;
          ballsFaced += effectiveBalls;
        } else {
          runsAgainst += inn.runs;
          ballsBowled += effectiveBalls;
        }
      }

      const ptsEarned =
        tournament.format === 'test'
          ? isWin
            ? 12
            : isTie
            ? 6
            : isDraw
            ? 4
            : 0
          : isWin
          ? 2
          : isTie
          ? 1
          : 0;

      return recomputeNrr({
        ...row,
        played: row.played + 1,
        won: row.won + (isWin ? 1 : 0),
        lost: row.lost + (isLoss ? 1 : 0),
        tied: row.tied + (isTie ? 1 : 0),
        drawn: row.drawn + (isDraw ? 1 : 0),
        points: row.points + ptsEarned,
        runsFor,
        ballsFaced,
        runsAgainst,
        ballsBowled,
      });
    });
  }

  const updatedPlayerStats = mergeMatchStatsIntoRecord(tournament.playerStats ?? {}, match);

  let nextTournament: TournamentState = {
    ...tournament,
    standings: updatedStandings,
    fixtures: updatedFixtures,
    playerStats: updatedPlayerStats,
  };

  // Stage progression logic
  if (nextTournament.type === 'ashes' || nextTournament.type === 'bgt') {
    const allDone = updatedFixtures.every((f) => f.completed);
    if (allDone) {
      const sorted = sortStandings(updatedStandings);
      const top = sorted[0];
      const second = sorted[1];
      const champ =
        top.won > second.won ? top.teamId : top.won === second.won ? 'draw' : second.teamId;
      nextTournament = {
        ...nextTournament,
        stage: 'complete',
        championTeamId: champ,
      };
    }
    return nextTournament;
  }

  // Group/League stage -> Knockouts
  if (nextTournament.stage === 'league') {
    const leagueDone = updatedFixtures
      .filter((f) => f.round === 'group')
      .every((f) => f.completed);

    if (leagueDone) {
      if (nextTournament.type === 't20_wc') {
        const groupA = sortStandings(updatedStandings.filter((s) => s.group === 'A'));
        const groupB = sortStandings(updatedStandings.filter((s) => s.group === 'B'));
        const sfFixtures: TournamentFixture[] = [
          {
            id: 't20-sf1',
            round: 'sf1',
            label: 'Semi-Final 1 (A1 vs B2)',
            homeTeamId: groupA[0].teamId,
            awayTeamId: groupB[1].teamId,
            completed: false,
            winnerTeamId: null,
            summary: 'Scheduled',
          },
          {
            id: 't20-sf2',
            round: 'sf2',
            label: 'Semi-Final 2 (B1 vs A2)',
            homeTeamId: groupB[0].teamId,
            awayTeamId: groupA[1].teamId,
            completed: false,
            winnerTeamId: null,
            summary: 'Scheduled',
          },
        ];
        return {
          ...nextTournament,
          stage: 'knockouts',
          fixtures: [...updatedFixtures, ...sfFixtures],
        };
      }

      if (nextTournament.type === 'odi_wc') {
        const top4 = sortStandings(updatedStandings);
        const sfFixtures: TournamentFixture[] = [
          {
            id: 'odi-sf1',
            round: 'sf1',
            label: 'Semi-Final 1 (#1 vs #4)',
            homeTeamId: top4[0].teamId,
            awayTeamId: top4[3].teamId,
            completed: false,
            winnerTeamId: null,
            summary: 'Scheduled',
          },
          {
            id: 'odi-sf2',
            round: 'sf2',
            label: 'Semi-Final 2 (#2 vs #3)',
            homeTeamId: top4[1].teamId,
            awayTeamId: top4[2].teamId,
            completed: false,
            winnerTeamId: null,
            summary: 'Scheduled',
          },
        ];
        return {
          ...nextTournament,
          stage: 'knockouts',
          fixtures: [...updatedFixtures, ...sfFixtures],
        };
      }

      if (nextTournament.type === 'ipl') {
        const top4 = sortStandings(updatedStandings);
        const playoffFixtures: TournamentFixture[] = [
          {
            id: 'ipl-q1',
            round: 'q1',
            label: 'Qualifier 1 (#1 vs #2)',
            homeTeamId: top4[0].teamId,
            awayTeamId: top4[1].teamId,
            completed: false,
            winnerTeamId: null,
            summary: 'Scheduled',
          },
          {
            id: 'ipl-elim',
            round: 'eliminator',
            label: 'Eliminator (#3 vs #4)',
            homeTeamId: top4[2].teamId,
            awayTeamId: top4[3].teamId,
            completed: false,
            winnerTeamId: null,
            summary: 'Scheduled',
          },
        ];
        return {
          ...nextTournament,
          stage: 'knockouts',
          fixtures: [...updatedFixtures, ...playoffFixtures],
        };
      }
    }
    return nextTournament;
  }

  // Knockout stage progression
  if (nextTournament.stage === 'knockouts') {
    if (nextTournament.type === 't20_wc' || nextTournament.type === 'odi_wc') {
      const sf1 = updatedFixtures.find((f) => f.round === 'sf1');
      const sf2 = updatedFixtures.find((f) => f.round === 'sf2');
      const existingFinal = updatedFixtures.find((f) => f.round === 'final');

      if (sf1?.completed && sf2?.completed && !existingFinal) {
        const w1 = sf1.winnerTeamId && sf1.winnerTeamId !== 'tie' ? sf1.winnerTeamId : sf1.homeTeamId;
        const w2 = sf2.winnerTeamId && sf2.winnerTeamId !== 'tie' ? sf2.winnerTeamId : sf2.homeTeamId;
        return {
          ...nextTournament,
          fixtures: [
            ...updatedFixtures,
            {
              id: `${nextTournament.type}-final`,
              round: 'final',
              label: 'Grand Final',
              homeTeamId: w1,
              awayTeamId: w2,
              completed: false,
              winnerTeamId: null,
              summary: 'Scheduled',
            },
          ],
        };
      }

      if (existingFinal?.completed) {
        const champ =
          existingFinal.winnerTeamId && existingFinal.winnerTeamId !== 'tie'
            ? existingFinal.winnerTeamId
            : existingFinal.homeTeamId;
        return {
          ...nextTournament,
          stage: 'complete',
          championTeamId: champ,
        };
      }
    }

    if (nextTournament.type === 'ipl') {
      const q1 = updatedFixtures.find((f) => f.round === 'q1');
      const elim = updatedFixtures.find((f) => f.round === 'eliminator');
      const q2 = updatedFixtures.find((f) => f.round === 'q2');
      const finalMatch = updatedFixtures.find((f) => f.round === 'final');

      if (q1?.completed && elim?.completed && !q2) {
        const q1Winner = q1.winnerTeamId && q1.winnerTeamId !== 'tie' ? q1.winnerTeamId : q1.homeTeamId;
        const q1Loser = q1Winner === q1.homeTeamId ? q1.awayTeamId : q1.homeTeamId;
        const elimWinner =
          elim.winnerTeamId && elim.winnerTeamId !== 'tie' ? elim.winnerTeamId : elim.homeTeamId;

        return {
          ...nextTournament,
          fixtures: [
            ...updatedFixtures,
            {
              id: 'ipl-q2',
              round: 'q2',
              label: 'Qualifier 2 (Q1 Loser vs Elim Winner)',
              homeTeamId: q1Loser,
              awayTeamId: elimWinner,
              completed: false,
              winnerTeamId: null,
              summary: 'Scheduled',
            },
          ],
        };
      }

      if (q1?.completed && q2?.completed && !finalMatch) {
        const q1Winner = q1.winnerTeamId && q1.winnerTeamId !== 'tie' ? q1.winnerTeamId : q1.homeTeamId;
        const q2Winner = q2.winnerTeamId && q2.winnerTeamId !== 'tie' ? q2.winnerTeamId : q2.homeTeamId;

        return {
          ...nextTournament,
          fixtures: [
            ...updatedFixtures,
            {
              id: 'ipl-final',
              round: 'final',
              label: 'IPL Grand Final',
              homeTeamId: q1Winner,
              awayTeamId: q2Winner,
              completed: false,
              winnerTeamId: null,
              summary: 'Scheduled',
            },
          ],
        };
      }

      if (finalMatch?.completed) {
        const champ =
          finalMatch.winnerTeamId && finalMatch.winnerTeamId !== 'tie'
            ? finalMatch.winnerTeamId
            : finalMatch.homeTeamId;
        return {
          ...nextTournament,
          stage: 'complete',
          championTeamId: champ,
        };
      }
    }
  }

  return nextTournament;
}

export function simulateTournamentFixture(
  tournament: TournamentState,
  fixtureId: string,
  rng: () => number = Math.random
): TournamentState {
  const fixture = tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || fixture.completed) return tournament;

  let simMatch = simulateFullMatch({
    format: tournament.format,
    pitchCondition: tournament.pitchCondition,
    rainChance: tournament.rainChance ?? 0,
    difficulty: tournament.difficulty,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    totalOvers: tournament.oversPerInningsOrDay,
    oversPerDay:
      tournament.oversPerInningsOrDay === 30 ||
      tournament.oversPerInningsOrDay === 60 ||
      tournament.oversPerInningsOrDay === 90
        ? tournament.oversPerInningsOrDay
        : 90,
    rng,
  });

  // In knockout matches, break ties cleanly via Super Over fallback
  if (fixture.round !== 'group' && fixture.round !== 'test_match' && simMatch.winnerTeamId === 'tie') {
    const superWinner = rng() < 0.5 ? fixture.homeTeamId : fixture.awayTeamId;
    const teamName = getTeamById(superWinner).name;
    simMatch = {
      ...simMatch,
      winnerTeamId: superWinner,
      resultSummary: `${teamName} won in Super Over!`,
    };
  }

  return applyMatchOutcomeToTournament(tournament, fixtureId, simMatch);
}

export function simulateNextMatches(
  tournament: TournamentState,
  stopAtUserMatch = true,
  rng: () => number = Math.random
): TournamentState {
  let current = tournament;
  let guard = 0;
  while (current.stage !== 'complete' && guard < 60) {
    guard += 1;
    const nextPending = current.fixtures.find((f) => !f.completed);
    if (!nextPending) break;
    const involvesUser =
      nextPending.homeTeamId === current.userTeamId ||
      nextPending.awayTeamId === current.userTeamId;
    if (stopAtUserMatch && involvesUser) {
      break;
    }
    current = simulateTournamentFixture(current, nextPending.id, rng);
  }
  return current;
}

export function simulateStage(
  tournament: TournamentState,
  rng: () => number = Math.random
): TournamentState {
  const initialStage = tournament.stage;
  let current = tournament;
  let guard = 0;
  while (current.stage === initialStage && current.stage !== 'complete' && guard < 60) {
    guard += 1;
    const nextPending = current.fixtures.find((f) => !f.completed);
    if (!nextPending) break;
    current = simulateTournamentFixture(current, nextPending.id, rng);
  }
  return current;
}
