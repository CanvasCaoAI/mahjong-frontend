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
