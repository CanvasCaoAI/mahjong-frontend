import Phaser from 'phaser';
import type { PublicState, Seat, Tile } from '../../domain/types';
import { ALL_TILES, backKey, backUrl, tileKey, tileUrl } from '../../domain/tileset';
import { client, onState } from '../../net/clientSingleton';

import { WinPrompt } from '../ui/WinPrompt';
import { DiscardsView } from '../ui/DiscardsView';
import { TurnCompass } from '../ui/TurnCompass';
import { OpponentHandsView } from '../ui/OpponentHandsView';
import { HandView } from '../ui/HandView';

const tableBgKey = 'table_bg';
const tableBgUrl = '/assets/ui/table-solid-darkgreen.svg';

const SEAT_NAME: Record<Seat, string> = { 0: '东', 1: '南', 2: '西', 3: '北' };
const seatName = (s: Seat) => SEAT_NAME[s] ?? String(s);

export class GameScene extends Phaser.Scene {
  // Layout
  private readonly DISCARD = { x: 550, y: 330, cols: 6, gapX: 34, gapY: 44 };

  private _stateUnsub: (() => void) | null = null;
  private state: PublicState | null = null;

  private hudText!: Phaser.GameObjects.Text;
  private msgText!: Phaser.GameObjects.Text;

  private animatingDiscard = false;
  private autoDrawToken: string | null = null;

  private winPrompt!: WinPrompt;
  private discardsView!: DiscardsView;
  private turnCompass!: TurnCompass;
  private opponentHands!: OpponentHandsView;
  private handView!: HandView;

  constructor() {
    super('Game');
  }

  preload() {
    // Table background
    this.load.svg(tableBgKey, tableBgUrl, { width: 1100, height: 700 });

    // Tileset
    this.load.svg(backKey(), backUrl(), { width: 140, height: 180 });
    for (const tile of ALL_TILES) {
      this.load.image(tileKey(tile), tileUrl(tile));
    }
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const margin = Math.round(w * 0.03);

    // Background
    const bg = this.add.image(w / 2, h / 2, tableBgKey);
    bg.setDisplaySize(w, h);

    // No top-left HUD text; keep only message line for errors/system info.
    this.hudText = this.add.text(0, 0, '', { fontSize: '14px', color: '#AAB3C7' });
    this.hudText.setVisible(false);

    this.msgText = this.add.text(margin, margin, '', { fontSize: '16px', color: '#E2E8F0', wordWrap: { width: w - margin * 2 } });

    // Components
    this.winPrompt = new WinPrompt(this, {
      onHu: () => client.checkWin(),
    });

    this.discardsView = new DiscardsView(this);
    this.turnCompass = new TurnCompass(this);
    this.opponentHands = new OpponentHandsView(this);
    this.handView = new HandView(this, {
      y: 620,
      gap: 62,
      width: 1100,
      onInvalidDiscard: () => this.showError('现在不是你出牌的回合。'),
      onDiscard: ({ displayIndex, serverIndex, tile }) => {
        this.animateDiscard(displayIndex, serverIndex, tile);
      }
    });

    this._stateUnsub = onState((st) => {
      this.state = st;
      this.updateUI();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._stateUnsub?.();
      this._stateUnsub = null;

      this.winPrompt?.destroy();
      this.discardsView?.destroy();
      this.turnCompass?.destroy();
      this.opponentHands?.destroy();
      this.handView?.destroy();
    });

    this.updateUI();
  }

  private showError(msg: string) {
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

    // Auto draw
    if (canDraw && st) {
      const token = `${st.turn}:${st.phase}:${st.wallCount}:${st.yourHand.length}`;
      if (this.autoDrawToken !== token) {
        this.autoDrawToken = token;
        client.draw();
      }
    } else {
      this.autoDrawToken = null;
    }

    this.winPrompt.update(st);

    // Hand + other views
    this.handView.update(st?.yourHand ?? [], canDiscard);
    this.opponentHands.update(st);
    this.discardsView.update(st);
    this.turnCompass.update(st, this);

    if (st?.result) {
      this.msgText.setText(`🎉 ${seatName(st.result.winnerSeat as Seat)} 胡了（${st.result.reason}）`);
    }
  }

  private animateDiscard(displayIndex: number, serverIndex: number, _tile: Tile) {
    if (this.animatingDiscard) return;
    const st = this.state;
    if (!st) return;

    const canDiscard = st.started && st.yourSeat !== null && st.turn === st.yourSeat && st.phase === 'discard';
    if (!canDiscard) return;

    this.animatingDiscard = true;
    this.handView.setAllEnabled(false);

    const btn = this.handView.getButton(displayIndex);
    if (!btn) {
      this.animatingDiscard = false;
      this.handView.setAllEnabled(true);
      return;
    }
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
}
