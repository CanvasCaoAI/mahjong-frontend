import Phaser from 'phaser';
import type { PublicState, Seat } from '../../domain/types';
import { TileButton } from '../ui/TileButton';
import { ALL_TILES, backKey, backUrl, tileKey, tileUrl } from '../../domain/tileset';
import { client, onState } from '../../net/clientSingleton';

const tableBgKey = 'table_bg';
const tableBgUrl = '/assets/ui/table-solid-darkgreen.svg';

const SEAT_NAME: Record<Seat, string> = { 0: '东', 1: '南', 2: '西', 3: '北' };
const seatName = (s: Seat) => SEAT_NAME[s] ?? String(s);


export class GameScene extends Phaser.Scene {
  // Layout
  private readonly DISCARD = { x: 550, y: 330, cols: 6, gapX: 34, gapY: 44, tileW: 28, tileH: 36 };

  private _stateUnsub: (() => void) | null = null;
  private state: PublicState | null = null;

  private hudText!: Phaser.GameObjects.Text;
  private msgText!: Phaser.GameObjects.Text;
  private handButtons: TileButton[] = [];
  private selectedHandBtn: TileButton | null = null;
  private animatingDiscard = false;


  private autoDrawToken: string | null = null;

  // Win prompt buttons (Hu / Pass)
  private huBtn?: Phaser.GameObjects.Container;
  private passBtn?: Phaser.GameObjects.Container;
  private passedToken: string | null = null;

  constructor() { super('Game'); }

  preload() {
    // Table background
    this.load.svg(tableBgKey, tableBgUrl, { width: 1100, height: 700 });

    // Load tileset
    // back is SVG (solid color), faces are PNG slices
    this.load.svg(backKey(), backUrl(), { width: 140, height: 180 });
    for (const tile of ALL_TILES) {
      this.load.image(tileKey(tile), tileUrl(tile));
    }
  }

  create() {
    console.log('[GameScene] create');

    // Background
    const bg = this.add.image(550, 350, tableBgKey);
    bg.setDisplaySize(1100, 700);

    this.add.text(32, 24, '双人麻将 · 极简联机（Phaser）', { fontSize: '22px', color: '#F8FAFC', fontStyle: 'bold' });
    this.hudText = this.add.text(32, 60, '', { fontSize: '14px', color: '#AAB3C7' });
    this.msgText = this.add.text(32, 90, '', { fontSize: '16px', color: '#E2E8F0', wordWrap: { width: 1030 } });

    // Win prompt buttons (show only when eligible)
    // Position: move a bit left+up, and keep distance between Hu / Pass.
    this.huBtn = this.makeRoundBtn(900, 520, 44, '胡', 0xB91C1C, () => client.checkWin());
    this.passBtn = this.makeRoundBtn(1035, 520, 36, '过', 0x0F766E, () => {
      const st = this.state;
      if (st && st.yourSeat !== null) {
        this.passedToken = `${st.turn}:${st.phase}:${st.wallCount}`;
      }
      this.huBtn?.setVisible(false);
      this.passBtn?.setVisible(false);
    });
    this.huBtn.setVisible(false);
    this.passBtn.setVisible(false);

    this._stateUnsub = onState((st) => { this.state = st; this.updateUI(); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._stateUnsub?.();
      this._stateUnsub = null;
    });
    this.updateUI();
  }

  private makeRoundBtn(x: number, y: number, r: number, label: string, color: number, onClick: () => void) {
    const circle = this.add.circle(0, 0, r, color, 0.95);
    circle.setStrokeStyle(3, 0x062F1F, 0.9);

    const text = this.add.text(0, 1, label, {
      fontSize: `${Math.round(r)}px`,
      color: '#F8FAFC',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const c = this.add.container(x, y, [circle, text]);
    c.setSize(r * 2, r * 2);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', onClick);
    c.setDepth(100);
    return c;
  }

  private showError(msg: string) {
    // Minimal UX: show on message line
    this.msgText.setText(`⚠️ ${msg}`);
  }

  private updateUI() {
    const st = this.state;
    const connected = client.connected;

    const players = st?.players
      .map((p, i) => {
        const pos = seatName(i as Seat);
        return p ? `${pos}:${p.name}${p.ready ? '(已准备)' : ''}` : `${pos}:(空)`;
      })
      .join(' | ') ?? '未连接';

    const youPos = st?.yourSeat === null || st?.yourSeat === undefined ? '-' : seatName(st.yourSeat as Seat);
    this.hudText.setText(
      `连接：${connected ? '✅' : '❌'}  |  你：${youPos}  |  牌堆：${st?.wallCount ?? '-'}\n${players}`
    );

    this.msgText.setText(st?.message ?? (connected ? '等待服务器状态…' : '回到大厅点击“连接”。'));

    // Phase state
    const canDraw = !!(connected && st && st.started && st.yourSeat !== null && st.turn === st.yourSeat && st.phase === 'draw');
    const canDiscard = !!(connected && st && st.started && st.yourSeat !== null && st.turn === st.yourSeat && st.phase === 'discard');

    // Auto-draw when it's your draw phase. De-dupe to avoid spamming the server on state broadcasts.
    if (canDraw && st) {
      const token = `${st.turn}:${st.phase}:${st.wallCount}:${st.yourHand.length}`;
      if (this.autoDrawToken !== token) {
        this.autoDrawToken = token;
        client.draw();
      }
    } else {
      this.autoDrawToken = null;
    }

    // Hu/Pass buttons: only show when server says winAvailable (computed after each draw).
    const passToken = st ? `${st.turn}:${st.phase}:${st.wallCount}:${st.yourHand.length}` : null;
    const shouldShow = !!(st && st.winAvailable && (!this.passedToken || this.passedToken !== passToken));
    this.huBtn?.setVisible(shouldShow);
    this.passBtn?.setVisible(shouldShow);

    // Hand rendering
    this.handButtons.forEach(b => b.destroy());
    this.handButtons = [];
    this.selectedHandBtn = null;

    const rawHand = st?.yourHand ?? [];
    // Auto-sort hand for display, but keep original indices for server actions.
    const hand = rawHand.map((tile, idx) => ({ tile, idx })).sort((a, b) => {
      const sa = a.tile[0];
      const sb = b.tile[0];
      const na = Number(a.tile.slice(1));
      const nb = Number(b.tile.slice(1));
      const suitOrder: Record<string, number> = { m: 0, p: 1, s: 2, z: 3 };
      const ds = (suitOrder[sa] ?? 99) - (suitOrder[sb] ?? 99);
      if (ds) return ds;
      return na - nb;
    });
    const y = 620;
    const gap = 62;
    // Auto layout: center hand row, keep within safe margins
    const totalW = hand.length > 0 ? (hand.length - 1) * gap + 60 : 0;
    const minX = 32;
    const maxX = 1100 - 32 - totalW;
    const centered = (1100 - totalW) / 2;
    const startX = Math.max(minX, Math.min(centered, maxX));
    for (let i = 0; i < hand.length; i++) {
      const x = startX + i * gap;
      const { tile, idx: serverIndex } = hand[i];

      const btn = new TileButton(
        this,
        x + 30,
        y,
        tileKey(tile),
        () => {
          // First click: select (always allowed when hand is shown)
          if (this.selectedHandBtn !== btn) {
            if (this.selectedHandBtn) this.selectedHandBtn.setSelected(false);
            this.selectedHandBtn = btn;
            btn.setSelected(true);
            return;
          }

          // Second click on the same selected tile => try discard
          if (!canDiscard) {
            this.showError('现在不是你出牌的回合。');
            return;
          }
          this.animateDiscard(i, serverIndex, tile);
        }
      );

      // Always allow selecting when the tile is rendered; only gate the actual discard action.
      btn.setEnabled(true);
      this.handButtons.push(btn);
    }


    this.renderOtherHands(st);
    this.renderDiscardsBySeat(st);
    this.updateTurnIndicator(st);

    // Show result if any
    if (st?.result) {
      this.msgText.setText(`🎉 座位${st.result.winnerSeat} 胡了（${st.result.reason}）`);
    }
  }

  private animateDiscard(displayIndex: number, serverIndex: number, _tile: any) {
    if (this.animatingDiscard) return;
    const st = this.state;
    if (!st) return;
    const canDiscard = st.started && st.yourSeat !== null && st.turn === st.yourSeat && st.phase === 'discard';
    if (!canDiscard) return;

    this.animatingDiscard = true;
    for (const b of this.handButtons) b.setEnabled(false);

    const btn = this.handButtons[displayIndex];
    if (!btn) { this.animatingDiscard = false; return; }
    btn.setSelected(true);

    const nextIdx = (st.discards?.length ?? 0);
    const startX = this.DISCARD.x - (this.DISCARD.cols - 1) * this.DISCARD.gapX * 0.5;
    const r = Math.floor(nextIdx / this.DISCARD.cols);
    const c = nextIdx % this.DISCARD.cols;
    const tx = startX + c * this.DISCARD.gapX;
    const ty = (this.DISCARD.y + 50) + r * this.DISCARD.gapY;

    const fx = btn.container.x;
    const fy = btn.container.y;
    const fly = this.add.image(fx, fy, btn.getTextureKey());
    fly.setDisplaySize(56, 72);
    fly.setDepth(50);

    this.tweens.add({
      targets: btn.container,
      y: btn.container.y - 18,
      duration: 90,
      ease: 'Sine.easeOut'
    });

    this.tweens.add({
      targets: fly,
      x: tx,
      y: ty,
      scale: 0.55,
      duration: 180,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        fly.destroy();
        client.discard(serverIndex);
        this.animatingDiscard = false;
      }
    });
  }

  // Center turn indicator (dynamic winds around the viewer) + wall count
  private turnIndicator?: {
    container: Phaser.GameObjects.Container;
    labels: {
      bottom: Phaser.GameObjects.Text;
      right: Phaser.GameObjects.Text;
      top: Phaser.GameObjects.Text;
      left: Phaser.GameObjects.Text;
    };
    wallText: Phaser.GameObjects.Text;
  };

  private ensureTurnIndicator() {
    if (this.turnIndicator) return;

    const cx = 550;
    const cy = 330;

    const container = this.add.container(cx, cy);

    // simple compass background
    const ring = this.add.circle(0, 0, 86, 0x000000, 0.08);
    ring.setStrokeStyle(2, 0x0b3d2e, 0.35);

    const center = this.add.rectangle(0, 0, 44, 44, 0x000000, 0.12);
    center.setStrokeStyle(2, 0x86efac, 0.25);

    const mk = (x: number, y: number) => {
      const txt = this.add.text(x, y, '-', {
        fontSize: '30px',
        color: '#9CA3AF',
        fontStyle: '900'
      }).setOrigin(0.5);
      return txt;
    };

    const labels = {
      bottom: mk(0, 54),
      right: mk(54, 0),
      top: mk(0, -54),
      left: mk(-54, 0),
    };

    const wallText = this.add.text(0, 118, '剩余张数：-', {
      fontSize: '28px',
      color: '#0B1020',
      fontStyle: '900'
    }).setOrigin(0.5);

    container.add([ring, center, labels.bottom, labels.right, labels.top, labels.left, wallText]);
    container.setDepth(5);

    this.turnIndicator = { container, labels, wallText };
  }

  private updateTurnIndicator(st: PublicState | null) {
    this.ensureTurnIndicator();
    const ti = this.turnIndicator!;

    // Dynamic wind labels around the viewer (seat numbers arranged clockwise)
    if (st && st.yourSeat !== null) {
      const you = st.yourSeat as Seat;
      const bottom = you;
      const right = (((you as number) + 1) % 4) as Seat;
      const top = (((you as number) + 2) % 4) as Seat;
      const left = (((you as number) + 3) % 4) as Seat;

      ti.labels.bottom.setText(seatName(bottom));
      ti.labels.right.setText(seatName(right));
      ti.labels.top.setText(seatName(top));
      ti.labels.left.setText(seatName(left));

      // Highlight the direction of the current turn (relative to you)
      const relTurn = (you - (st.turn as number) + 4) % 4; // 0=bottom,1=left,2=top,3=right
      const isOn = {
        bottom: relTurn === 0,
        left: relTurn === 1,
        top: relTurn === 2,
        right: relTurn === 3,
      };

      for (const pos of ['bottom','left','top','right'] as const) {
        const t = ti.labels[pos];
        const on = isOn[pos];
        t.setColor(on ? '#FDE68A' : '#9CA3AF');
        t.setAlpha(on ? 1 : 0.55);
      }
    } else {
      // Not seated yet
      for (const pos of ['bottom','left','top','right'] as const) {
        ti.labels[pos].setText('-');
        ti.labels[pos].setColor('#9CA3AF');
        ti.labels[pos].setAlpha(0.55);
      }
    }

    ti.wallText.setText(`剩余张数：${st?.wallCount ?? '-'}`);
  }


  private opponentSprites: Phaser.GameObjects.GameObject[] = [];
  private renderOtherHands(st: PublicState | null) {
    this.opponentSprites.forEach(s => s.destroy());
    this.opponentSprites = [];
    if (!st || st.yourSeat === null) return;

    const you = st.yourSeat;
    // Seat numbers are arranged clockwise.
    // Relative layout we draw: 0=self(bottom), 1=left, 2=top, 3=right.
    // Therefore: right neighbor is seat (you+1), left neighbor is seat (you+3).
    const rel = (seat: number) => (you - seat + 4) % 4;
    const clamp = (n: number, m: number) => Math.min(n, m);

    const makeBack = (x: number, y: number, angle: number) => {
      const border = this.add.rectangle(x, y, 30, 38, 0x000000, 0);
      border.setStrokeStyle(2, 0x0b3d2e, 0.95);
      border.setAngle(angle);

      const img = this.add.image(x, y, backKey());
      img.setDisplaySize(28, 36);
      img.setAngle(angle);
      img.setAlpha(0.92);

      this.opponentSprites.push(border, img);
    };

    const max = 18;
    for (const seat of [0, 1, 2, 3]) {
      if (seat === you) continue;
      const count = st.handCounts?.[seat] ?? 0;
      if (!count) continue;
      const r = rel(seat);
      const show = clamp(count, max);

      if (r === 2) {
        // top: horizontal
        const startX = 360;
        const y = 120;
        const gap = 28;
        for (let i = 0; i < show; i++) {
          makeBack(startX + i * gap, y, 0);
        }
      } else if (r === 1) {
        // left: vertical
        const x = 90;
        const startY = 210;
        const gap = 20;
        for (let i = 0; i < show; i++) {
          makeBack(x, startY + i * gap, 90);
        }
      } else if (r === 3) {
        // right: vertical
        const x = 1010;
        const startY = 210;
        const gap = 20;
        for (let i = 0; i < show; i++) {
          makeBack(x, startY + i * gap, 90);
        }
      }
    }
  }

  private discardSprites: Phaser.GameObjects.Image[] = [];
  private renderDiscardsBySeat(st: PublicState | null) {
    this.discardSprites.forEach(s => s.destroy());
    this.discardSprites = [];
    if (!st || st.yourSeat === null) return;

    const you = st.yourSeat;
    // Seat numbers are arranged clockwise; map seat->relative draw position.
    const rel = (seat: number) => (you - seat + 4) % 4;

    const bySeat: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [] };
    for (const d of st.discards ?? []) {
      bySeat[d.seat].push(d.tile);
    }

    for (const seat of [0, 1, 2, 3]) {
      const tiles = bySeat[seat].slice(-24);
      if (!tiles.length) continue;
      const r = rel(seat);

      // Rough zones similar to classic 4-player layout.
      let startX = 0, startY = 0, cols = 6, gapX = 34, gapY = 44;
      if (r === 0) { startX = 360; startY = 470; }
      else if (r === 2) { startX = 360; startY = 200; }
      else if (r === 1) { startX = 250; startY = 240; cols = 4; gapX = 30; gapY = 40; }
      else if (r === 3) { startX = 850; startY = 240; cols = 4; gapX = 30; gapY = 40; }

      for (let i = 0; i < tiles.length; i++) {
        const rr = Math.floor(i / cols);
        const cc = i % cols;
        const key = tileKey(tiles[i] as any);
        const img = this.add.image(startX + cc * gapX, startY + rr * gapY, key);
        // Left/right discards should be rotated vertically.
        if (r === 1 || r === 3) img.setAngle(90);
        img.setDisplaySize(28, 36);
        img.setAlpha(0.95);
        this.discardSprites.push(img);
      }
    }
  }
}
