export type Seat = 0 | 1 | 2 | 3;
export type Suit = 'm' | 'p' | 's' | 'z';
export type Tile = `${Suit}${number}`; // m/p/s:1-9, z:1-7

export type DiscardEvent = { seat: Seat; tile: Tile };

export type PublicState = {
  connected: boolean;
  players: Array<{ seat: Seat; name: string; ready: boolean } | null>;
  started: boolean;
  wallCount: number;
  discards: DiscardEvent[];
  turn: Seat;
  phase: 'draw' | 'discard' | 'end';
  yourSeat: Seat | null;
  yourHand: Tile[];
  handCounts: number[]; // 0-3
  winAvailable: boolean;
  message: string;
  result?: { winnerSeat: Seat; hand: Tile[]; reason: string };
};
