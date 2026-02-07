import Phaser from 'phaser';

export class TileButton {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private img: Phaser.GameObjects.Image;
  private enabled = true;
  private selected = false;

  private readonly baseY: number;
  private readonly baseDepth: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    onClick: () => void,
  ) {
    this.baseY = y;
    this.baseDepth = 0;

    this.bg = scene.add.rectangle(0, 0, 60, 78, 0x0b1020, 0.0)
      .setStrokeStyle(2, 0xffffff, 0.10);

    this.img = scene.add.image(0, 0, textureKey);
    this.img.setDisplaySize(56, 72);

    this.container = scene.add.container(x, y, [this.bg, this.img]);
    this.container.setSize(60, 78);
    this.container.setInteractive({ useHandCursor: true });

    this.container.on('pointerdown', () => {
      // Don’t delete this console
      console.log("clicked"+ textureKey);
      if (!this.enabled) return;
      onClick();
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    this.container.setAlpha(v ? 1 : 0.55);

    // Keep interactive always-on; gate behavior via `this.enabled` in the pointer handler.
    // Toggling input.enabled / disableInteractive can cause missed clicks in practice.

    if (!v) {
      // If disabled while selected, force-clear selection visuals.
      this.setSelected(false);
      this.bg.setStrokeStyle(2, 0xffffff, 0.06);
    } else {
      this.applyStroke();
    }
  }

  setSelected(v: boolean) {
    if (this.selected === v) return;
    this.selected = v;

    // Click-to-select: slightly larger (vertical only) + lift.
    // Don't scale X to avoid overlap stealing clicks.
    if (v && this.enabled) {
      this.container.setScale(1.0, 1.10);
      this.container.y = this.baseY - 10;
      this.container.setDepth(10);
    } else {
      this.container.setScale(1.0, 1.0);
      this.container.y = this.baseY;
      this.container.setDepth(this.baseDepth);
    }

    this.applyStroke();
  }

  private applyStroke() {
    if (this.selected) {
      this.bg.setStrokeStyle(2, 0x38BDF8, 0.9);
      return;
    }
    this.bg.setStrokeStyle(2, 0xffffff, this.enabled ? 0.10 : 0.06);
  }

  getTextureKey(): string {
    return this.img.texture.key;
  }

  destroy() {
    this.container.destroy(true);
  }
}
