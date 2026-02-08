import type { PublicState } from '../domain/types';
import { MahjongClient } from './socketClient';

export const client = new MahjongClient();

let lastState: PublicState | null = null;
const listeners = new Set<(st: PublicState) => void>();

export function getState(): PublicState | null {
  return lastState;
}

export function onState(cb: (st: PublicState) => void): () => void {
  listeners.add(cb);
  if (lastState) cb(lastState);
  return () => listeners.delete(cb);
}

export function connectToServer(
  serverUrl: string,
  params: { roomId: string; clientId: string; debug?: boolean },
  name: string | undefined,
  onError: (msg: string) => void,
) {
  client.connect(
    serverUrl,
    params,
    (st) => {
      lastState = st;

      for (const l of listeners) l(st);
    },
    onError,
  );

  const n = (name ?? '').trim();
  if (n) client.setName(n);
}
