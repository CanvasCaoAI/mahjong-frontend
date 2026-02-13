import Phaser from 'phaser';
import type { PublicState, Tile } from '../../domain/types';
import { tileKey } from '../../domain/tileset';
import { uiScale } from './uiScale';

/**
 * 吃牌选项弹窗：当可吃组合有多种时，弹出让用户选择。
 */
export class ChiPickerView {
  private scene: Phaser.Scene;
  private visible = false;

  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private bg: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private optionObjs: Phaser.GameObjects.GameObject[] = [];

  private onPick: ((opt: { a: Tile; b: Tile }) => void) | null = null;
  private onCancel: (() => void) | null = null;

  private cancelBtn: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    onPick: (opt: { a: Tile; b: Tile }) => void,
    opts?: { onCancel?: () => void }
  ) {
    this.scene = scene;
    this.onPick = onPick;
    this.onCancel = opts?.onCancel ?? null;

    const u = uiScale(scene);
    const w = u.w;
    const h = u.h;

    this.overlay = scene.add.rectangle(0, 0, w, h, 0x000000, 0.35);
    this.overlay.setOrigin(0, 0);
    this.overlay.setInteractive();
    this.overlay.on('pointerdown', () => this.hide(true));

    const pw = Math.round(w * 0.68);
    const ph = Math.round(h * 0.26);

    this.bg = scene.add.rectangle(0, 0, pw, ph, 0x0b1020, 0.92).setStrokeStyle(1, 0xffffff, 0.14);

    // Title removed per UX feedback (keep modal clean)
    this.title = scene.add.text(-pw / 2 + 16, -ph / 2 + 10, '', {
      fontSize: `${Math.round(w * 0.018)}px`,
      color: '#E2E8F0',
    });
    this.title.setVisible(false);

    // Cancel button (top-right)
    this.cancelBtn = this.makeTextBtn(pw / 2 - 54, -ph / 2 + 26, 72, 30, '取消', () => {
      this.hide(true);
    });

    this.container = scene.add.container(Math.round(w / 2), Math.round(h / 2), [this.bg, this.title, this.cancelBtn]);
    this.container.setDepth(8000);
    this.container.setVisible(false);
    this.overlay.setDepth(7900);
    this.overlay.setVisible(false);
  }

  private makeTextBtn(x: number, y: number, bw: number, bh: number, label: string, onClick: () => void) {
    const r = this.scene.add
      .rectangle(0, 0, bw, bh, 0x111827, 0.92)
      .setStrokeStyle(1, 0xffffff, 0.18)
      .setOrigin(0.5);
    const t = this.scene.add
      .text(0, 1, label, {
        fontSize: `${Math.round(this.scene.scale.width * 0.016)}px`,
        color: '#E2E8F0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const c = this.scene.add.container(x, y, [r, t]);
    c.setSize(bw, bh);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', onClick);
    return c;
  }

  show(st: PublicState) {
    const u = uiScale(this.scene);
    const w = u.w;
    const h = u.h;

    this.overlay.setSize(w, h);
    this.overlay.setVisible(true);

    // clear old
    for (const o of this.optionObjs) o.destroy();
    this.optionObjs = [];

    const opts = st.chiOptions ?? [];
    if (!opts.length) return;

    // claim tile is the last discard
    const last = st.discards?.length ? st.discards[st.discards.length - 1] : null;
    const claimTile = (last?.tile ?? null) as Tile | null;
    if (!claimTile) return;

    const pw = this.bg.width;
    const ph = this.bg.height;

    const tileW = Math.round(w * 0.052);
    const tileH = Math.round(tileW * 1.28);
    const gap = Math.round(tileW * 0.18);

    const padX = 18;
    const topY = -ph / 2 + 18;

    // 垂直居中基线：所有牌（被吃的牌 + 组合牌）都以这个 y 为中心
    const centerY = 0;

    // 左侧单独显示「被吃的牌」
    const claimLabel = this.scene.add
      .text(-pw / 2 + padX, topY, '被吃的牌', {
        fontSize: `${Math.round(w * 0.014)}px`,
        color: '#AAB3C7',
      })
      .setOrigin(0, 0);

    const claimX = -pw / 2 + padX + tileW / 2;
    const claimY = centerY;
    const claimImg = this.scene.add.image(claimX, claimY, tileKey(claimTile as any));
    claimImg.setDisplaySize(tileW, tileH);

    // 分隔线
    const sepX = -pw / 2 + padX + tileW + 18;
    const sep = this.scene.add.rectangle(sepX, 0, 1, ph - 22, 0xffffff, 0.10).setOrigin(0.5);

    this.optionObjs.push(claimLabel, claimImg, sep);
    this.container.add([claimLabel, claimImg, sep]);

    // 右侧显示组合：每个选项只展示 (a,b)
    const optAreaX0 = sepX + 18;
    const optAreaX1 = pw / 2 - padX;
    const optAreaW = optAreaX1 - optAreaX0;

    // 每个组合之间的间距变大（不要箭头）
    const itemW = tileW * 2 + gap * 6;
    const cols = Math.max(1, Math.floor(optAreaW / itemW));

    const gridTop = 0; // 牌整体垂直居中
    const rowGap = Math.round(tileH * 0.32) + 16;

    const usedCols = Math.min(cols, opts.length);
    const gridW = usedCols * itemW;
    const startX = optAreaX0 + (optAreaW - gridW) / 2 + itemW / 2;

    for (let i = 0; i < opts.length; i++) {
      const [a, b] = opts[i];
      const r = Math.floor(i / cols);
      const c = i % cols;

      const x = Math.round(startX + c * itemW);
      const y = Math.round(gridTop + r * rowGap);

      const hit = this.scene.add
        .rectangle(x, y, itemW - 18, tileH + 18, 0xffffff, 0.03)
        .setStrokeStyle(1, 0xffffff, 0.12)
        .setOrigin(0.5);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.hide(false);
        this.onPick?.({ a, b });
      });

      // 两张牌上下居中（y=center）
      const imgA = this.scene.add.image(x - (tileW / 2 + gap * 1.6), y, tileKey(a as any));
      imgA.setDisplaySize(tileW, tileH);

      const imgB = this.scene.add.image(x + (tileW / 2 + gap * 1.6), y, tileKey(b as any));
      imgB.setDisplaySize(tileW, tileH);

      this.optionObjs.push(hit, imgA, imgB);
      this.container.add([hit, imgA, imgB]);
    }

    this.container.setPosition(Math.round(w / 2), Math.round(h / 2));
    this.container.setVisible(true);
    this.visible = true;
  }

  /**
   * @param isCancel 是否为“取消/点遮罩取消”。取消需要触发 onCancel，让 ActionPrompt 重新展示
   */
  hide(isCancel = false) {
    if (!this.visible) return;
    this.visible = false;
    this.container.setVisible(false);
    this.overlay.setVisible(false);
    if (isCancel) this.onCancel?.();
  }

  destroy() {
    for (const o of this.optionObjs) o.destroy();
    this.optionObjs = [];
    this.container.destroy(true);
    this.overlay.destroy(true);
  }
}
