export function getOrCreateClientId(): string {
  const key = 'mahjong.clientId';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
  localStorage.setItem(key, id);
  return id;
}

export function getRoomId(): string {
  // Single-room only (ignore URL params)
  return 'main';
}

export function isDebugMode(): boolean {
  // URL only accepts: ?debug=true
  const url = new URL(location.href);
  const v = (url.searchParams.get('debug') ?? '').trim().toLowerCase();
  return v === 'true';
}

// URL 不再接受 ?tile=...；tile 数量只允许通过 debug UI 选择
export function getDebugTileCount(): number | null {
  return null;
}
