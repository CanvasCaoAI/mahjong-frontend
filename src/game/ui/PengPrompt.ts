import Phaser from 'phaser';
import type { PublicState } from '../../domain/types';
import { computeLayout } from './layout';

export class PengPrompt {
  private pengBtn: Phaser.GameObjects.Container;
  private passBtn: Phaser.GameObjects.Container;
  private passedToken: string | null = null;
  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    opts: {
      onPeng: () => void;
      onPass: () => void;
    }
  ) {
    this.scene = scene;
    const { onPeng, onPass } = opts;

    this.pengBtn = this.makeRoundBtn(0, 0, 44, '碰', 0xB45309, () => {
      onPeng();
      this.markPassed();
      this.setVisible(false);
    });

    this.passBtn = this.makeRoundBtn(0, 0, 36, '过', 0x0F766E, () => {
      onPass();
      this.markPassed();
      this.setVisible(false);
    });

    this.relayout();
    this.setVisible(false);
  }

  private makeRoundBtn(x: number, y: number, r: number, label: string, color: number, onClick: () => void) {
    const circle = this.scene.add.circle(0, 0, r, color, 0.95);
    circle.setStrokeStyle(3, 0x062F1F, 0.9);

    const text = this.scene.add.text(0, 1, label, {
      fontSize: `${Math.round(r)}px`,
      color: '#F8FAFC',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const c = this.scene.add.container(x, y, [circle, text]);
    c.setSize(r * 2, r * 2);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', onClick);
    c.setDepth(120);
    return c;
  }

  private currentToken(): string | null {
    const st = (this.scene as any).state as PublicState | null;
    if (!st) return null;
    const last = st.discards?.length ? st.discards[st.discards.length - 1] : null;
    return `${st.phase}:${st.turn}:${st.wallCount}:${st.yourHand.length}:${last ? `${last.seat}:${last.tile}` : '-'}`;
  }

  private markPassed() {
    this.passedToken = this.currentToken();
  }

  relayout() {
    const l = computeLayout(this.scene);
    // 放在胡牌按钮附近，但稍靠左（避免与胡牌重叠）
    this.pengBtn.setPosition(l.winX - 140, l.winY);
    this.passBtn.setPosition(l.winX - 140 + l.winGap, l.winY);
  }

  setVisible(v: boolean) {
    this.pengBtn.setVisible(v);
    this.passBtn.setVisible(v);
  }

  update(st: PublicState | null) {
    this.relayout();
    const token = this.currentToken();
    const shouldShow = !!(st && st.pengAvailable && (!this.passedToken || this.passedToken !== token));
    this.setVisible(shouldShow);

    if (!st || token === null) {
      this.passedToken = null;
      return;
    }

    // 状态推进后允许再次提示
    if (this.passedToken && this.passedToken !== token && st.phase === 'draw') {
      this.passedToken = null;
    }
  }

  destroy() {
    this.pengBtn.destroy(true);
    this.passBtn.destroy(true);
  }
}
