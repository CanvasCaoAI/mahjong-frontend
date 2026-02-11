import Phaser from 'phaser';
import type { PublicState, Seat, Tile } from '../../domain/types';
import { ALL_TILES, backKey, backUrl, tileKey, tileUrl } from '../../domain/tileset';
import { client, onState } from '../../net/clientSingleton';

import { ActionPrompt } from '../ui/ActionPrompt';
import { DiscardsView } from '../ui/DiscardsView';
import { TurnCompass } from '../ui/TurnCompass';
import { OpponentHandsView } from '../ui/OpponentHandsView';
import { HandView } from '../ui/HandView';
import { computeLayout } from '../ui/layout';

const tableBgKey = 'table_bg';
const tableBgUrl = '/assets/ui/table-solid-darkgreen.svg';

const SEAT_NAME: Record<Seat, string> = { 0: '东', 1: '南', 2: '西', 3: '北' };
const seatName = (s: Seat) => SEAT_NAME[s] ?? String(s);

export class GameScene extends Phaser.Scene {

  private _stateUnsub: (() => void) | null = null;
  private state: PublicState | null = null;

  private hudText!: Phaser.GameObjects.Text;
  private msgText!: Phaser.GameObjects.Text;
  private winReasonText: Phaser.GameObjects.Text | null = null;

  private animatingDiscard = false;
  private autoDrawToken: string | null = null;

  private actionPrompt!: ActionPrompt;
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

    // 顶部左上角不显示任何信息（按需求保持空白）。
    this.hudText = this.add.text(0, 0, '', { fontSize: '14px', color: '#AAB3C7' });
    this.hudText.setVisible(false);

    this.msgText = this.add.text(margin, margin, '', { fontSize: '16px', color: '#E2E8F0', wordWrap: { width: w - margin * 2 } });
    this.msgText.setVisible(false);

    // Components
    this.actionPrompt = new ActionPrompt(this, {
      onHu: () => client.checkWin(),
      onGang: () => client.gang(),
      onPeng: () => client.peng(),
      onChi: () => client.chi(),
      onPassClaim: () => client.passClaim(),
    });

    this.discardsView = new DiscardsView(this);
    this.turnCompass = new TurnCompass(this);
    this.opponentHands = new OpponentHandsView(this);

    const l0 = computeLayout(this);
    this.handView = new HandView(this, {
      y: l0.handY,
      gap: 58,
      width: l0.w,
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

      this.actionPrompt?.destroy();
      this.discardsView?.destroy();
      this.turnCompass?.destroy();
      this.opponentHands?.destroy();
      this.handView?.destroy();
      this.winReasonText?.destroy();
      this.winReasonText = null;
    });

    this.updateUI();
  }

  private showError(msg: string) {
    // 不在左上角显示任何文本；错误仅输出到控制台。
    console.warn('[mahjong-frontend]', msg);
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

    // 顶部不显示 message。

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

    this.actionPrompt.update(st);

    const l = computeLayout(this);

    // Hand + other views
    this.handView.setLayout({ y: l.handY, gap: 58, width: l.w });
    const melds = (st && st.yourSeat !== null && st.meldsBySeat) ? (st.meldsBySeat[st.yourSeat] ?? []) : (st?.yourMelds ?? []);
    this.handView.update(st?.yourHand ?? [], canDiscard, melds);

    this.opponentHands.update(st);
    this.discardsView.update(st);
    this.turnCompass.update(st, this);

    // 胡牌提示：如果你是胡家，在自己手牌附近用黄色文字显示和牌内容
    const isWinner = !!(st?.result && st.yourSeat !== null && st.result.winners.includes(st.yourSeat));
    if (isWinner) {
      const reason = st?.result?.reason ?? '';
      const x = l.w / 2;
      const y = l.handY - 96;

      if (!this.winReasonText) {
        this.winReasonText = this.add.text(x, y, '', {
          fontSize: '20px',
          color: '#FBBF24',
          fontStyle: 'bold',
          stroke: '#0B1020',
          strokeThickness: 5,
        }).setOrigin(0.5);
        this.winReasonText.setDepth(200);
      }

      this.winReasonText.setPosition(x, y);
      this.winReasonText.setText(reason ? `和牌：${reason}` : '和牌');
      this.winReasonText.setVisible(true);
    } else {
      if (this.winReasonText) this.winReasonText.setVisible(false);
    }

    // 不在左上角显示胜负信息（保持空白）。
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
    const l = computeLayout(this);

    // Animate to bottom discard band, centered.
    const cols = l.discardCols;
    const gapX = l.discardTileGapX;
    const gapY = l.discardTileGapY;

    const startX = Math.round(l.w / 2 - ((cols - 1) * gapX) / 2);
    const r = Math.floor(nextIdx / cols);
    const c = nextIdx % cols;
    const tx = startX + c * gapX;
    const ty = l.discardBottomY + r * gapY;

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
