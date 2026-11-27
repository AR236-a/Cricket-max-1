import {
  MatchState,
  PlayerMatchStatLine,
  PlayerOfMatchAward,
  PlayerOfTournamentAward,
  PostMatchAwardsSummary,
  TournamentPlayerStat,
  TournamentState,
} from './types';

function formatOversCount(balls: number): string {
  const completed = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${completed}.${rem}`;
}

function buildMatchPlayerTallies(match: MatchState): PlayerMatchStatLine[] {
  const tally: Record<
    string,
    {
      playerName: string;
      teamId: string;
      runs: number;
      ballsFaced: number;
      fours: number;
      sixes: number;
      notOut: boolean;
      wickets: number;
      ballsBowled: number;
      runsConceded: number;
      points: number;
    }
  > = {};

  const ensure = (teamId: string, playerName: string) => {
    const key = `${teamId}:${playerName}`;
    if (!tally[key]) {
      tally[key] = {
        playerName,
        teamId,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        notOut: false,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        points: 0,
      };
    }
    return tally[key];
  };

  const inningsList = [match.innings1, match.innings2, match.innings3, match.innings4];
  for (const inn of inningsList) {
    if (!inn) continue;

    for (const b of inn.batters) {
      if (b.balls === 0 && !b.out) continue;
      const entry = ensure(inn.battingTeamId, b.name);
      entry.runs += b.runs;
      entry.ballsFaced += b.balls;
      entry.fours += b.fours;
      entry.sixes += b.sixes;
      if (!b.out) entry.notOut = true;

      let batPts = b.runs * 1.15 + b.fours * 1.0 + b.sixes * 2.0;
      if (b.runs >= 200) batPts += 45;
      else if (b.runs >= 150) batPts += 35;
      else if (b.runs >= 100) batPts += 26;
      else if (b.runs >= 50) batPts += 14;

      if (match.format === 'limited' && b.balls >= 10) {
        const sr = (b.runs / b.balls) * 100;
        if (sr >= 180) batPts += 18;
        else if (sr >= 140) batPts += 10;
      }
      entry.points += batPts;
    }

    for (const [bowlerName, spell] of Object.entries(inn.bowlerSpells ?? {})) {
      if (spell.balls <= 0) continue;
      const entry = ensure(inn.bowlingTeamId, bowlerName);
      entry.wickets += spell.wickets;
      entry.ballsBowled += spell.balls;
      entry.runsConceded += spell.runs;

      let bowlPts = spell.wickets * 24;
      if (spell.wickets >= 5) bowlPts += 28;
      else if (spell.wickets >= 3) bowlPts += 12;

      if (spell.balls >= 12) {
        const econ = (spell.runs / spell.balls) * 6;
        if (match.format === 'limited' && econ <= 6.0) bowlPts += 12;
        else if (match.format === 'test' && econ <= 3.5) bowlPts += 12;
      }
      entry.points += bowlPts;
    }
  }

  const allEntries = Object.values(tally);
  for (const entry of allEntries) {
    if (
      match.winnerTeamId &&
      match.winnerTeamId !== 'tie' &&
      match.winnerTeamId !== 'draw' &&
      entry.teamId === match.winnerTeamId
    ) {
      entry.points += 18;
    }
  }

  return allEntries
    .map((e) => {
      const strikeRate =
        e.ballsFaced > 0 ? Number(((e.runs / e.ballsFaced) * 100).toFixed(1)) : 0;
      const oversBowled = formatOversCount(e.ballsBowled);
      const economy =
        e.ballsBowled > 0 ? Number(((e.runsConceded / e.ballsBowled) * 6).toFixed(2)) : null;

      const parts: string[] = [];
      if (e.ballsFaced > 0 || e.runs > 0) {
        parts.push(`${e.runs}${e.notOut ? '*' : ''}(${e.ballsFaced})`);
      }
      if (e.ballsBowled > 0) {
        parts.push(`${e.wickets}-${e.runsConceded} (${oversBowled} ov)`);
      }

      return {
        playerName: e.playerName,
        teamId: e.teamId,
        runs: e.runs,
        ballsFaced: e.ballsFaced,
        fours: e.fours,
        sixes: e.sixes,
        notOut: e.notOut,
        strikeRate,
        wickets: e.wickets,
        ballsBowled: e.ballsBowled,
        runsConceded: e.runsConceded,
        oversBowled,
        economy,
        points: Number(e.points.toFixed(1)),
        summary: parts.join(' & ') || 'Match Impact',
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.runs !== a.runs) return b.runs - a.runs;
      return b.wickets - a.wickets;
    });
}

function resolveRoleTag(entry: PlayerMatchStatLine): 'All-Rounder' | 'Batter' | 'Bowler' {
  if (entry.runs >= 15 && entry.wickets >= 1) return 'All-Rounder';
  if (entry.ballsBowled > 0 && (entry.ballsFaced === 0 || entry.wickets * 22 > entry.runs)) {
    return 'Bowler';
  }
  return 'Batter';
}

export function computePlayerOfTheMatch(match: MatchState): PlayerOfMatchAward | null {
  const ranked = buildMatchPlayerTallies(match);
  if (ranked.length === 0) return null;

  const winner = ranked[0];
  return {
    playerName: winner.playerName,
    teamId: winner.teamId,
    points: winner.points,
    summary: winner.summary,
    runs: winner.runs,
    ballsFaced: winner.ballsFaced,
    fours: winner.fours,
    sixes: winner.sixes,
    notOut: winner.notOut,
    strikeRate: winner.strikeRate,
    wickets: winner.wickets,
    ballsBowled: winner.ballsBowled,
    runsConceded: winner.runsConceded,
    oversBowled: winner.oversBowled,
    economy: winner.economy,
    roleTag: resolveRoleTag(winner),
  };
}

export function computePostMatchAwards(match: MatchState): PostMatchAwardsSummary | null {
  const ranked = buildMatchPlayerTallies(match);
  if (ranked.length === 0) return null;

  const potm = computePlayerOfTheMatch(match);
  if (!potm) return null;

  const batters = ranked
    .filter((p) => p.ballsFaced > 0 || p.runs > 0)
    .sort((a, b) => {
      if (b.runs !== a.runs) return b.runs - a.runs;
      if (b.strikeRate !== a.strikeRate) return b.strikeRate - a.strikeRate;
      return b.points - a.points;
    });

  const bowlers = ranked
    .filter((p) => p.ballsBowled > 0)
    .sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      const econA = a.economy ?? 99;
      const econB = b.economy ?? 99;
      if (econA !== econB) return econA - econB;
      return a.runsConceded - b.runsConceded;
    });

  return {
    playerOfTheMatch: potm,
    bestBatter: batters[0] ?? null,
    bestBowler: bowlers[0] ?? null,
    topPerformers: ranked.slice(0, 3),
  };
}

function formatTournamentAvg(stat: TournamentPlayerStat): string {
  if (stat.inningsBatted === 0) return '—';
  const dismissals = stat.inningsBatted - stat.notOuts;
  if (dismissals <= 0) return `${stat.runs.toFixed(1)}*`;
  return (stat.runs / dismissals).toFixed(1);
}

export function computePlayerOfTheTournament(
  tournament: TournamentState
): PlayerOfTournamentAward | null {
  const entries = Object.values(tournament.playerStats ?? {});
  if (entries.length === 0) return null;

  const scored = entries.map((stat) => {
    const dismissals = Math.max(1, stat.inningsBatted - stat.notOuts);
    const avg = stat.inningsBatted > 0 ? stat.runs / dismissals : 0;
    const econ = stat.ballsBowled > 0 ? (stat.runsConceded / stat.ballsBowled) * 6 : 99;

    let pts = stat.runs * 1.0 + stat.wickets * 22 + stat.sixes * 1.5;
    if (avg >= 45 && stat.runs >= 100) pts += 22;
    if (stat.ballsBowled >= 24 && econ <= 6.5) pts += 15;
    if (
      tournament.championTeamId &&
      tournament.championTeamId !== 'draw' &&
      stat.teamId === tournament.championTeamId
    ) {
      pts += 25;
    }

    return {
      stat,
      points: Number(pts.toFixed(1)),
    };
  });

  scored.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.stat.runs !== a.stat.runs) return b.stat.runs - a.stat.runs;
    return b.stat.wickets - a.stat.wickets;
  });

  const top = scored[0].stat;
  return {
    playerName: top.playerName,
    teamId: top.teamId,
    matches: top.matches,
    runs: top.runs,
    battingAverage: formatTournamentAvg(top),
    strikeRate: top.ballsFaced > 0 ? ((top.runs / top.ballsFaced) * 100).toFixed(1) : '0.0',
    wickets: top.wickets,
    economy: top.ballsBowled > 0 ? ((top.runsConceded / top.ballsBowled) * 6).toFixed(2) : '—',
    points: scored[0].points,
  };
}
