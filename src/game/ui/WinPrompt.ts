import Phaser from 'phaser';
import type { PublicState } from '../../domain/types';

import { computeLayout } from './layout';

export class WinPrompt {
  private huBtn: Phaser.GameObjects.Container;
  private passBtn: Phaser.GameObjects.Container;
  private passedToken: string | null = null;
  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    opts: {
      onHu: () => void;
      onPass?: () => void;
    }
  ) {
    this.scene = scene;
    const { onHu, onPass } = opts;

    this.huBtn = this.makeRoundBtn(0, 0, 44, '胡', 0xB91C1C, () => {
      onHu();
    });

    this.passBtn = this.makeRoundBtn(0, 0, 36, '过', 0x0F766E, () => {
      onPass?.();
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
    c.setDepth(100);
    return c;
  }

  private currentToken(): string | null {
    const st = (this.scene as any).state as PublicState | null;
    if (!st) return null;
    return `${st.turn}:${st.phase}:${st.wallCount}:${st.yourHand.length}`;
  }

  private markPassed() {
    this.passedToken = this.currentToken();
  }

  relayout() {
    const l = computeLayout(this.scene);
    this.huBtn.setPosition(l.winX, l.winY);
    this.passBtn.setPosition(l.winX + l.winGap, l.winY);
  }

  setVisible(v: boolean) {
    this.huBtn.setVisible(v);
    this.passBtn.setVisible(v);
  }

  update(st: PublicState | null) {
    this.relayout();
    const token = st ? `${st.turn}:${st.phase}:${st.wallCount}:${st.yourHand.length}` : null;
    const shouldShow = !!(st && st.winAvailable && (!this.passedToken || this.passedToken !== token));
    this.setVisible(shouldShow);

    // Reset passed status if game state moved on
    if (!st || token === null) {
      this.passedToken = null;
      return;
    }
    if (this.passedToken && this.passedToken !== token && st.phase === 'draw') {
      // allow prompt again after a new draw phase
      this.passedToken = null;
    }
  }

  destroy() {
    this.huBtn.destroy(true);
    this.passBtn.destroy(true);
  }
}
