export function getOrCreateClientId(): string {
  const key = 'mahjong.clientId';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
  localStorage.setItem(key, id);
  return id;
}

export function getRoomId(): string {
  // Single-room default. Allow overriding via URL for debugging / future multi-table.
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get('room');
  return (fromUrl && fromUrl.trim()) ? fromUrl.trim() : 'main';
}

export function isDebugMode(): boolean {
  const url = new URL(location.href);
  const v = (url.searchParams.get('debug') ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

// ?tile=5 => debug 发牌：每位玩家起手牌数量变为 5（东家仍会多摸 1 张进入出牌阶段）
export function getDebugTileCount(): number | null {
  const url = new URL(location.href);
  const raw = (url.searchParams.get('tile') ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const v = Math.floor(n);
  if (v < 1 || v > 13) return null;
  return v;
}
