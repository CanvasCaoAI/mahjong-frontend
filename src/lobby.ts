import type { PublicState, Seat } from './domain/types';
import { client, connectToServer, onState } from './net/clientSingleton';
import { getOrCreateClientId, getRoomId, isDebugMode, getDebugTileCount } from './net/identity';

const SEAT_NAME: Record<Seat, string> = { 0: '东', 1: '南', 2: '西', 3: '北' };
const seatName = (s: Seat) => SEAT_NAME[s] ?? String(s);

// Backend server URL for deployment.
// This repo uses Vite env var at build time:
// - VITE_SERVER_URL=http://<EC2-IP>:5174
//
// No runtime override via querystring (per requirement).

function resolveServerUrl(): string {
  const v = (import.meta as any)?.env?.VITE_SERVER_URL;
  if (typeof v === 'string' && v.trim()) return v.trim();

  // fallback (mainly for local dev)
  const proto = location.protocol;
  const host = location.hostname;
  return `${proto}//${host}:5174`;
}

const RANDOM_NAMES = [
  '阿凯','小鹿','丸子','阿飞','大熊','小新','皮皮','阿文','豆豆','小雨','米粒','南风','北辰','橘子','可可','星河','木木','团子'
];
function randomName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)] + String(Math.floor(10 + Math.random() * 90));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

export function mountLobby(opts: {
  root: HTMLElement;
  onEnterGame: () => void;
}) {
  const { root, onEnterGame } = opts;

  root.innerHTML = '';

  const card = el('div', 'lobby-card');
  const title = el('div', 'lobby-title');
  title.innerHTML = '<span class="lobby-title-big">麻将</span>';

  const row = el('div', 'lobby-row');

  const nameLabel = el('label');
  nameLabel.textContent = '昵称';
  const nameInput = el('input', 'lobby-input');
  const rn = randomName();
  nameInput.placeholder = rn;
  nameInput.value = '';

  const btnRow = el('div', 'lobby-buttons');
  // Auto-connect on page load (non-debug); keep buttons grouped.
  const connectBtn = el('button', 'lobby-btn');
  const debugMode = isDebugMode();
  connectBtn.textContent = debugMode ? '连接' : '连接中…';
  connectBtn.disabled = !debugMode;

  const readyBtn = el('button', 'lobby-btn');
  readyBtn.textContent = '准备';
  readyBtn.disabled = true;

  const status = el('div', 'lobby-status');
  const players = el('div', 'lobby-players');

  btnRow.append(connectBtn, readyBtn);

  // Debug options (only when ?debug=true)
  const debugOpts = el('div', 'lobby-debug-opts');

  const tile5Label = el('label', 'lobby-debug-item');
  const tile5Cb = el('input') as HTMLInputElement;
  tile5Cb.type = 'checkbox';
  tile5Cb.checked = false;
  tile5Label.append(tile5Cb, document.createTextNode('tile=4'));

  const sameTileLabel = el('label', 'lobby-debug-item');
  const sameTileCb = el('input') as HTMLInputElement;
  sameTileCb.type = 'checkbox';
  sameTileCb.checked = false;
  sameTileLabel.append(sameTileCb, document.createTextNode('sameTile=一万'));

  debugOpts.append(tile5Label, sameTileLabel);

  // If debug options change while connected, allow quick reconnect
  const markReconnect = () => {
    if (!debugMode) return;
    if (client.connected && !connecting) {
      connectBtn.textContent = '重新连接';
      connectBtn.disabled = false;
    }
  };
  tile5Cb.onchange = markReconnect;
  sameTileCb.onchange = markReconnect;

  row.append(
    nameLabel,
    nameInput,
    ...(debugMode ? [debugOpts] : []),
  );

  card.append(title, row, btnRow, status, players);
  root.append(card);

  let connecting = false;

  function doConnect(force = false) {
    if (connecting) return;
    if (!force && client.connected) return;
    connecting = true;
    connectBtn.textContent = '连接中…';
    connectBtn.disabled = true;

    // IMPORTANT:
    // - Do NOT use the random placeholder as the real nickname.
    //   Otherwise we will auto-connect and immediately set a random name on the server.
    // - Only send setName when user actually typed something.
    const name = nameInput.value.trim();

    const roomId = getRoomId();
    const clientId = getOrCreateClientId();
    const tile = debugMode ? (tile5Cb.checked ? 4 : null) : getDebugTileCount();
    const sameTile = debugMode ? (sameTileCb.checked ? 'm1' : null) : null;

    // Resolve server URL (build-time VITE_SERVER_URL)
    status.textContent = '';
    const serverUrl = resolveServerUrl();

    connectToServer(serverUrl, { roomId, clientId, debug: isDebugMode(), tile, sameTile }, name || undefined, (msg) => {
      status.textContent = `⚠️ ${msg}`;
      connecting = false;
      connectBtn.textContent = '重试连接';
      connectBtn.disabled = false;
    });
  }

  function render(st: PublicState) {
    const connected = client.connected;

    // Only show players AFTER they are ready.
    // Requirement: don't show the full "东:xxx | 南:xxx | ..." line at the very beginning.
    // Instead, show one player when one player becomes ready.
    const readyList = st.players
      .map((p, i) => ({ p, i }))
      .filter((x) => !!x.p && !!x.p.ready);

    status.textContent = '';
    if (readyList.length === 0) {
      players.textContent = '';
    } else {
      players.textContent = readyList
        .map(({ p, i }) => `${seatName(i as Seat)}: ${(p as any).name}（已准备）`)
        .join(' | ');
    }

    readyBtn.disabled = !connected;

    // Update connect button state
    if (connected) {
      connecting = false;
      connectBtn.textContent = debugMode ? '已连接（可重连）' : '已连接';
      connectBtn.disabled = !debugMode;
    }

    const allReady = st.players.filter(Boolean).length === 4 && st.players.every(p => !!p && p.ready);
    if (st.started && allReady) {
      onEnterGame();
    }
  }

  const un = onState(render);

  // Entering the page => auto connect (only when not in debug mode)
  if (!debugMode) {
    void doConnect();
  }

  // Connect / reconnect
  connectBtn.onclick = () => {
    doConnect(debugMode);
  };

  // If user edits nickname after connecting, allow it to take effect immediately.
  const maybeSetName = () => {
    // Only set name on explicit user actions (edit / ready), not on auto-connect.
    // If user leaves it empty, fall back to the suggested placeholder so they still
    // get a nice default nickname.
    const n = nameInput.value.trim() || nameInput.placeholder || '';
    if (client.connected && n) client.setName(n);
  };
  nameInput.onchange = maybeSetName;
  nameInput.onblur = maybeSetName;

  readyBtn.onclick = () => {
    // On ready, always sync the typed nickname first (if any)
    maybeSetName();
    client.ready();
  };

  return () => {
    un();
  };
}
