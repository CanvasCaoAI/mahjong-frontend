import Phaser from 'phaser';
import type { PublicState } from '../../domain/types';
import { computeLayout } from './layout';

// Top-left "remaining tiles" indicator.
export class WallCountView {
  private container: Phaser.GameObjects.Container;
  private labelText: Phaser.GameObjects.Text;
  private countText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const l = computeLayout(scene);

    // Slightly larger and more readable than compass small text.
    const fontPx = Math.round(Math.max(16, Math.min(22, scene.scale.width * 0.022)));

    this.labelText = scene.add.text(0, 0, '剩余张数：', {
      fontSize: `${fontPx}px`,
      color: '#FACC15',
      fontStyle: '900',
      stroke: '#0B1020',
      strokeThickness: 4,
    }).setOrigin(0, 0);

    this.countText = scene.add.text(0, 0, '-', {
      fontSize: `${fontPx}px`,
      color: '#FACC15',
      fontStyle: '900',
      stroke: '#0B1020',
      strokeThickness: 4,
    }).setOrigin(0, 0);

    const padX = 10;
    const padY = 6;
    const bg = scene.add.rectangle(0, 0, 10, 10, 0x0b1020, 0.55)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xffffff, 0.12);

    this.container = scene.add.container(l.margin, l.margin, [bg, this.labelText, this.countText]);
    this.container.setDepth(1000);

    // Layout once
    this.reflow(bg, padX, padY);
  }

  private reflow(bg: Phaser.GameObjects.Rectangle, padX: number, padY: number) {
    // Place count right after label
    this.countText.setX(this.labelText.width);

    const w = this.labelText.width + this.countText.width + padX * 2;
    const h = Math.max(this.labelText.height, this.countText.height) + padY * 2;

    bg.setSize(w, h);
    this.labelText.setPosition(padX, padY);
    this.countText.setPosition(padX + this.labelText.width, padY);
  }

  update(st: PublicState | null) {
    const v = String(st?.wallCount ?? '-');
    if (this.countText.text !== v) {
      this.countText.setText(v);
      const bg = this.container.list[0] as Phaser.GameObjects.Rectangle;
      this.reflow(bg, 10, 6);
    }
  }

  destroy() {
    this.container.destroy(true);
  }
}
