
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K';

export type Slot =
  | 'QB'
  | 'RB1'
  | 'RB2'
  | 'WR1'
  | 'WR2'
  | 'TE'
  | 'FLEX'
  | 'K';

export type Player = {
  id: string;
  name: string;
  team: string;
  year: number;
  position: Position;
  rank: number;
  points: number;
  games: number;
  stats: Record<string, number>;
};

export type Pick = {
  slot: Slot;
  player: Player;
};

export const caps: Record<Position, number> = {
  QB: 32,
  RB: 32,
  WR: 50,
  TE: 32,
  K: 32,
};

export const years = Array.from(
  { length: 26 },
  (_, i) => 2000 + i
);

export function slots(kicker: boolean): Slot[] {
  return [
    'QB',
    'RB1',
    'RB2',
    'WR1',
    'WR2',
    'TE',
    'FLEX',
    ...(kicker ? ['K'] : []),
  ] as Slot[];
}

export function poolForSlot(
  slot: Slot,
  players: Player[],
  year: number,
  picks: Pick[]
): Player[] {
  const positions: Position[] =
    slot === 'FLEX'
      ? ['RB', 'WR', 'TE']
      : [slot.replace(/[12]/, '') as Position];

  const used = new Set(
    picks.map(p => p.player.name.toLowerCase())
  );

  return players.filter(
    p =>
      p.year === year &&
      positions.includes(p.position) &&
      p.rank <= caps[p.position] &&
      !used.has(p.name.toLowerCase())
  );
}

// Fisher-Yates shuffle for unbiased random ordering.
function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// FLEX: guarantee at least one RB, WR, and TE
// when all three positions are available.
// Other drafts remain fully random.
export function sample<T>(
  items: T[],
  count: number
): T[] {
  if (count <= 0) return [];

  if (count === 5 && items.length >= 5) {
    const players = items as Player[];

    const positions: Position[] = ['RB', 'WR', 'TE'];

    const isFlexPool = positions.every(pos =>
      players.some(p => p.position === pos)
    );

    if (isFlexPool) {
      const guaranteed = positions.map(pos =>
        shuffle(
          players.filter(p => p.position === pos)
        )[0]
      );

      const selectedIds = new Set(
        guaranteed.map(p => p.id)
      );

      const remaining = shuffle(
        players.filter(p => !selectedIds.has(p.id))
      ).slice(0, 2);

      return shuffle([
        ...guaranteed,
        ...remaining,
      ]) as T[];
    }
  }

  return shuffle(items).slice(0, count);
}

export function totalPoints(picks: Pick[]): number {
  return picks.reduce(
    (sum, pick) => sum + pick.player.points,
    0
  );
}

// Normalize historical production to 16 games.
export function normalizedPoints(picks: Pick[]): number {
  return picks.reduce(
    (sum, pick) =>
      sum +
      (pick.player.points /
        Math.max(1, pick.player.games)) *
        16,
    0
  );
}

// Illustrative opponent model.
// This is NOT calibrated against real fantasy matchups.
export function estimatedRecord(picks: Pick[]) {
  const weekly = normalizedPoints(picks) / 16;

  const winProbability =
    1 /
    (1 + Math.exp(-(weekly - 120) / 19));

  const wins = Math.round(14 * winProbability);
  const qualifies = wins >= 8;

  const semifinal = qualifies
    ? winProbability >= 0.5
      ? 'Win'
      : 'Loss'
    : 'Not qualified';

  const championship =
    semifinal === 'Win'
      ? winProbability >= 0.65
        ? 'Win'
        : 'Loss'
      : 'Not played';

  return {
    wins,
    losses: 14 - wins,
    weekly,
    winProbability,
    qualifies,
    semifinal,
    championship,
  };
}

// Daily leaderboard resets at midnight Eastern.
export function dayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
