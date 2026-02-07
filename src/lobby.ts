import type { PublicState } from './domain/types';
import { client, connectToServer, onState } from './net/clientSingleton';

const DEFAULT_SERVER = 'http://localhost:5174';

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
  title.textContent = '双人麻将 · 联机大厅';

  const row = el('div', 'lobby-row');

  const nameLabel = el('label');
  nameLabel.textContent = '昵称';
  const nameInput = el('input', 'lobby-input');
  nameInput.placeholder = 'Canvas Cao';
  nameInput.value = 'Canvas Cao';

  const serverLabel = el('label');
  serverLabel.textContent = '服务器';
  const serverInput = el('input', 'lobby-input');
  serverInput.placeholder = DEFAULT_SERVER;
  serverInput.value = DEFAULT_SERVER;

  const btnRow = el('div', 'lobby-buttons');
  const connectBtn = el('button', 'lobby-btn');
  connectBtn.textContent = '连接';
  const readyBtn = el('button', 'lobby-btn');
  readyBtn.textContent = '准备';
  readyBtn.disabled = true;

  const status = el('div', 'lobby-status');
  const players = el('div', 'lobby-players');

  btnRow.append(connectBtn, readyBtn);

  row.append(
    nameLabel,
    nameInput,
    serverLabel,
    serverInput,
  );

  card.append(title, row, btnRow, status, players);
  root.append(card);

  function render(st: PublicState) {
    const connected = client.connected;
    const ptxt = st.players
      .map((p, i) => (p ? `座位${i}: ${p.name}${p.ready ? '（已准备）' : ''}` : `座位${i}: (空)`))
      .join(' | ');

    status.textContent = `连接：${connected ? '✅' : '❌'}  |  ${st.message ?? ''}`;
    players.textContent = ptxt;

    readyBtn.disabled = !connected;

    const allReady = st.players.filter(Boolean).length === 4 && st.players.every(p => !!p && p.ready);
    if (st.started && allReady) {
      onEnterGame();
    }
  }

  const un = onState(render);

  connectBtn.onclick = () => {
    connectToServer(serverInput.value.trim() || DEFAULT_SERVER, nameInput.value, (msg) => {
      status.textContent = `⚠️ ${msg}`;
    });
  };

  readyBtn.onclick = () => {
    client.ready();
  };

  return () => {
    un();
  };
}
