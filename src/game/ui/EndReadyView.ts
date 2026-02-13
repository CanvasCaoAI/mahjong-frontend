import Phaser from 'phaser';
import type { PublicState } from '../../domain/types';
import { computeLayout } from './layout';

export class EndReadyView {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private btnBg: Phaser.GameObjects.Rectangle;
  private btnText: Phaser.GameObjects.Text;

  private sent = false;

  constructor(scene: Phaser.Scene, opts: { onReady: () => void }) {
    this.scene = scene;

    const w = scene.scale.width;
    const h = scene.scale.height;

    const bw = Math.round(Math.min(w, h) * 0.22);
    const bh = Math.round(bw * 0.42);

    this.btnBg = scene.add.rectangle(0, 0, bw, bh, 0x111827, 0.92).setStrokeStyle(2, 0xffffff, 0.20);
    this.btnText = scene.add.text(0, 0, '准备', {
      fontSize: `${Math.round(bh * 0.46)}px`,
      color: '#E2E8F0',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.container = scene.add.container(w / 2, h / 2, [this.btnBg, this.btnText]);
    this.container.setDepth(9000);
    this.container.setSize(bw, bh);
    this.container.setInteractive({ useHandCursor: true });
    this.container.on('pointerdown', () => {
      if (this.sent) return;
      this.sent = true;
      this.btnText.setText('已准备');
      opts.onReady();
    });

    this.container.setVisible(false);
  }

  relayout() {
    const l = computeLayout(this.scene);
    this.container.setPosition(l.w / 2, l.h / 2);

    // scale with screen
    const s = this.scene.scale.width / 1100;
    this.container.setScale(s);
  }

  update(st: PublicState | null) {
    this.relayout();

    const shouldShow = !!(st && st.phase === 'end');

    if (!shouldShow) {
      this.sent = false;
      this.btnText.setText('准备');
      this.container.setVisible(false);
      return;
    }

    this.container.setVisible(true);
  }

  destroy() {
    this.container.destroy(true);
  }
}
