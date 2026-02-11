export type Seat = 0 | 1 | 2 | 3;
export type Suit = 'm' | 'p' | 's' | 'z' | 'f';
export type Tile = `${Suit}${number}`; // m/p/s:1-9, z:1-7, f:1-8

export type DiscardEvent = { seat: Seat; tile: Tile };

export type Meld =
  | { type: 'peng'; tiles: [Tile, Tile, Tile]; fromSeat: Seat }
  | { type: 'chi'; tiles: [Tile, Tile, Tile]; fromSeat: Seat }
  | { type: 'gang'; tiles: [Tile, Tile, Tile, Tile]; fromSeat: Seat | null; kind: 'discard' | 'concealed' | 'add' }
  | { type: 'flower'; tiles: [Tile]; fromSeat: null; kind: 'flower' };

export type PublicState = {
  connected: boolean;
  players: Array<{ seat: Seat; name: string; ready: boolean } | null>;
  started: boolean;
  wallCount: number;
  discards: DiscardEvent[];
  turn: Seat;
  phase: 'draw' | 'discard' | 'claim' | 'end';
  yourSeat: Seat | null;
  yourHand: Tile[];
  yourMelds: Meld[];
  meldsBySeat: Meld[][];
  handCounts: number[]; // 0-3
  winAvailable: boolean;
  gangAvailable: boolean;
  pengAvailable: boolean;
  chiAvailable: boolean;
  message: string;
  result?: { winners: Seat[]; handsBySeat: Partial<Record<Seat, Tile[]>> };
  winInfo?: { reason: string };
};
