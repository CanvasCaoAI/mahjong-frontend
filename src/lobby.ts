import type { PublicState, Seat } from './domain/types';
import { client, connectToServer, onState } from './net/clientSingleton';
import { getOrCreateClientId, getRoomId, isDebugMode, getDebugTileCount } from './net/identity';

const SEAT_NAME: Record<Seat, string> = { 0: '东', 1: '南', 2: '西', 3: '北' };
const seatName = (s: Seat) => SEAT_NAME[s] ?? String(s);

const DEFAULT_SERVER = 'http://localhost:5174';

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

    const name = nameInput.value.trim() || nameInput.placeholder || '玩家';
    const roomId = getRoomId();
    const clientId = getOrCreateClientId();
    const tile = debugMode ? (tile5Cb.checked ? 4 : null) : getDebugTileCount();
    const sameTile = debugMode ? (sameTileCb.checked ? 'm1' : null) : null;
    connectToServer(DEFAULT_SERVER, { roomId, clientId, debug: isDebugMode(), tile, sameTile }, name, (msg) => {
      status.textContent = `⚠️ ${msg}`;
      connecting = false;
      connectBtn.textContent = '重试连接';
      connectBtn.disabled = false;
    });
  }

  function render(st: PublicState) {
    const connected = client.connected;
    const ptxt = st.players
      .map((p, i) => {
        const pos = seatName(i as Seat);
        return p ? `${pos}: ${p.name}${p.ready ? '（已准备）' : ''}` : `${pos}: (空)`;
      })
      .join(' | ');

    status.textContent = '';
    players.textContent = ptxt;

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
  if (!debugMode) doConnect();

  // Connect / reconnect
  connectBtn.onclick = () => {
    doConnect(debugMode);
  };

  readyBtn.onclick = () => {
    client.ready();
  };

  return () => {
    un();
  };
}
