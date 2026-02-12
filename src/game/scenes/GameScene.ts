import Phaser from 'phaser';
import type { PublicState, Seat, Tile } from '../../domain/types';
import { ALL_TILES, backKey, backUrl, tileKey, tileUrl } from '../../domain/tileset';
import { client, onState } from '../../net/clientSingleton';

import { ActionPrompt } from '../ui/ActionPrompt';
import { DiscardsView } from '../ui/DiscardsView';
import { TurnCompass } from '../ui/TurnCompass';
import { WallCountView } from '../ui/WallCountView';
import { OpponentHandsView } from '../ui/OpponentHandsView';
import { ScoreboardView } from '../ui/ScoreboardView';
import { HandView } from '../ui/HandView';
import { computeLayout } from '../ui/layout';
import { uiScale } from '../ui/uiScale';

const tableBgKey = 'table_bg';
const tableBgUrl = '/assets/ui/table-solid-darkgreen.svg';

const SEAT_NAME: Record<Seat, string> = { 0: '东', 1: '南', 2: '西', 3: '北' };
const seatName = (s: Seat) => SEAT_NAME[s] ?? String(s);

export class GameScene extends Phaser.Scene {

  private _stateUnsub: (() => void) | null = null;
  private state: PublicState | null = null;

  private hudText!: Phaser.GameObjects.Text;
  private msgText!: Phaser.GameObjects.Text;
  private winTexts: Partial<Record<Seat, Phaser.GameObjects.Text>> = {};
  private winTextTweens: Partial<Record<Seat, Phaser.Tweens.Tween>> = {};

  private animatingDiscard = false;
  private autoDrawToken: string | null = null;

  private actionPrompt!: ActionPrompt;
  private discardsView!: DiscardsView;
  private turnCompass!: TurnCompass;
  private wallCountView!: WallCountView;
  private opponentHands!: OpponentHandsView;
  private handView!: HandView;
  private scoreboardView!: ScoreboardView;

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
    this.wallCountView = new WallCountView(this);
    this.opponentHands = new OpponentHandsView(this);
    this.scoreboardView = new ScoreboardView(this);

    const l0 = computeLayout(this);
    this.handView = new HandView(this, {
      y: l0.handY,
      gap: l0.handGap,
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
      this.wallCountView?.destroy();
      this.opponentHands?.destroy();
      this.handView?.destroy();
      this.scoreboardView?.destroy();

      for (const k of Object.keys(this.winTexts) as any) {
        const seat = k as Seat;
        this.winTextTweens[seat]?.stop();
        this.winTextTweens[seat]?.remove();
        this.winTextTweens[seat] = undefined;
        this.winTexts[seat]?.destroy();
      }
      this.winTexts = {};
      this.winTextTweens = {};
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

    // Scoreboard
    this.scoreboardView?.update(st);

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
    // Safe band for bottom hand to avoid overlapping side opponents.
    // (Side opponent tiles are sized proportional to screen width in OpponentHandsView)
    const u = uiScale(this);
    const oppW = u.oppW;
    const pad = Math.round(u.w * 0.01);
    const xLeft = l.oppSideXInset + oppW / 2 + pad;
    const xRight = l.w - l.oppSideXInset - oppW / 2 - pad;

    this.handView.setLayout({ y: l.handY, gap: l.handGap, width: l.w, xLeft, xRight });
    const melds = (st && st.yourSeat !== null && st.meldsBySeat) ? (st.meldsBySeat[st.yourSeat] ?? []) : (st?.yourMelds ?? []);
    this.handView.update(st?.yourHand ?? [], canDiscard, melds);

    this.opponentHands.update(st);
    this.discardsView.update(st);
    this.turnCompass.update(st, this);
    this.wallCountView.update(st);

    // 和牌文字：大小一致，摆在中间罗盘的上下左右（只给胡家显示）
    // 注意：和牌内容（reason）已抽到 st.winInfo，不再写在 st.result 里。
    const winners = st?.result?.winners ?? [];
    const reason = st?.winInfo?.reason ?? '';

    // 只有在 end 阶段且有 reason 时展示
    const showWinText = !!(st && st.phase === 'end' && reason);

    // 清空/隐藏
    for (const seat of [0, 1, 2, 3] as const) {
      const t = this.winTexts[seat];
      if (t) t.setVisible(false);
    }

    if (showWinText && st && st.yourSeat !== null) {
      const you = st.yourSeat as Seat;
      const rel = (seat: Seat) => ((you as number) - (seat as number) + 4) % 4; // 0=bottom,1=left,2=top,3=right

      const cx = l.compassX;
      const cy = l.compassY;
      const minDim = Math.min(l.w, l.h);
      const offY = Math.round(minDim * 0.22);
      const offX = Math.round(minDim * 0.56);
      const posFor = (seat: Seat) => {
        const r = rel(seat);
        if (r === 0) return { x: cx, y: cy + offY };
        if (r === 2) return { x: cx, y: cy - offY };
        if (r === 1) return { x: cx - offX, y: cy };
        return { x: cx + offX, y: cy };
      };

      for (const w of winners) {
        if (!this.winTexts[w]) {
          const fontPx = Math.round(minDim * 0.055);
          this.winTexts[w] = this.add.text(0, 0, '', {
            fontFamily: '"KaiTi","STKaiti","Kaiti SC",serif',
            fontSize: `${fontPx}px`,
            color: '#FDE68A',
            fontStyle: 'bold',
            stroke: '#0B1020',
            strokeThickness: 10,
            shadow: {
              offsetX: 0,
              offsetY: 6,
              color: '#000000',
              blur: 8,
              fill: true,
              stroke: true,
            },
            backgroundColor: 'rgba(11,16,32,0.65)',
            padding: { x: 16, y: 10 },
          }).setOrigin(0.5);
          this.winTexts[w]!.setDepth(200);
        }

        const p = posFor(w);
        const t = this.winTexts[w]!;
        t.setPosition(p.x, p.y);
        t.setText(reason);
        t.setVisible(true);

        // Pulse animation (make it obvious)
        this.winTextTweens[w]?.stop();
        this.winTextTweens[w]?.remove();
        t.setScale(1.0);
        this.winTextTweens[w] = this.tweens.add({
          targets: t,
          scale: 1.12,
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
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
