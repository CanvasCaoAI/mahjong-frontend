import Phaser from 'phaser';
import type { PublicState } from '../../domain/types';
import { computeLayout } from './layout';

export class ActionPrompt {
  private huBtn: Phaser.GameObjects.Container;
  private gangBtn: Phaser.GameObjects.Container;
  private pengBtn: Phaser.GameObjects.Container;
  private chiBtn: Phaser.GameObjects.Container;
  private passBtn: Phaser.GameObjects.Container;

  private passedToken: string | null = null;
  private scene: Phaser.Scene;

  private readonly onHu: () => void;
  private readonly onGang: () => void;
  private readonly onPeng: () => void;
  private readonly onChi: () => boolean; // return true if opened a picker (defer action)

  private suppressed = false;
  private readonly onPassClaim: () => void;

  constructor(
    scene: Phaser.Scene,
    opts: {
      onHu: () => void;
      onGang: () => void;
      onPeng: () => void;
      onChi: () => boolean; // true => opened picker, do not mark pass yet
      onPassClaim: () => void;
    }
  ) {
    this.scene = scene;
    this.onHu = opts.onHu;
    this.onGang = opts.onGang;
    this.onPeng = opts.onPeng;
    this.onChi = opts.onChi;
    this.onPassClaim = opts.onPassClaim;

    this.huBtn = this.makeRoundBtn(0, 0, 44, '胡', 0xB91C1C, () => {
      this.onHu();
      // 胡不需要 pass 标记；状态会推进
      this.setVisible(false);
    });

    this.gangBtn = this.makeRoundBtn(0, 0, 44, '杠', 0x2563EB, () => {
      this.onGang();
      this.markPassed();
      this.setVisible(false);
    });

    this.pengBtn = this.makeRoundBtn(0, 0, 44, '碰', 0xB45309, () => {
      this.onPeng();
      this.markPassed();
      this.setVisible(false);
    });

    this.chiBtn = this.makeRoundBtn(0, 0, 44, '吃', 0x7C3AED, () => {
      const openedPicker = this.onChi();
      if (!openedPicker) {
        // 直接执行了吃/或吃无需选择时：按 claim 动作处理
        this.afterClaimAction();
      } else {
        // 进入选择弹窗：先临时隐藏，取消时再恢复
        this.setSuppressed(true);
      }
    });

    this.passBtn = this.makeRoundBtn(0, 0, 36, '过', 0x0F766E, () => {
      // 若当前处于 claim（胡/杠/碰/吃）则需要通知服务器 pass
      const st = (this.scene as any).state as PublicState | null;
      if (st && st.phase === 'claim') this.onPassClaim();
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

  /**
   * 临时隐藏（例如打开 Chi 组合选择弹窗时）。
   * 不会写入 passedToken，取消时可以恢复。
   */
  setSuppressed(v: boolean) {
    this.suppressed = v;
    if (v) this.setVisible(false);
  }

  /**
   * 取消弹窗后恢复按钮展示（不再视为 passed）。
   */
  restoreFromSuppressed(st: PublicState | null) {
    this.suppressed = false;
    this.passedToken = null;
    this.update(st);
  }

  /**
   * 选择吃/碰/杠 等 claim 动作后调用：写入 passedToken 并隐藏。
   */
  afterClaimAction() {
    this.markPassed();
    this.setSuppressed(false);
    this.setVisible(false);
  }

  private setVisible(v: boolean) {
    this.huBtn.setVisible(v);
    this.gangBtn.setVisible(v);
    this.pengBtn.setVisible(v);
    this.chiBtn.setVisible(v);
    this.passBtn.setVisible(v);
  }

  relayout() {
    const l = computeLayout(this.scene);
    // We will layout dynamically in update(); here just set a default anchor.
    this.huBtn.setPosition(l.winX, l.winY);
    this.gangBtn.setPosition(l.winX, l.winY);
    this.pengBtn.setPosition(l.winX, l.winY);
    this.chiBtn.setPosition(l.winX, l.winY);
    this.passBtn.setPosition(l.winX, l.winY);
  }

  update(st: PublicState | null) {
    const l = computeLayout(this.scene);

    // Pure proportional scaling (no min/max clamps)
    const s = this.scene.scale.width / 1100;
    this.huBtn.setScale(s);
    this.gangBtn.setScale(s);
    this.pengBtn.setScale(s);
    this.chiBtn.setScale(s);
    this.passBtn.setScale(s);

    const token = this.currentToken();

    const canShowAny = !!(st && (st.winAvailable || st.gangAvailable || st.pengAvailable || st.chiAvailable));
    const shouldShow = !!(canShowAny && (!this.passedToken || this.passedToken !== token));

    if (this.suppressed) {
      this.setVisible(false);
      return;
    }

    if (!shouldShow) {
      this.setVisible(false);
    } else {
      // Determine which buttons should show
      // visible flags
      this.huBtn.setVisible(!!st?.winAvailable);
      this.gangBtn.setVisible(!!st?.gangAvailable);
      this.pengBtn.setVisible(!!st?.pengAvailable);
      this.chiBtn.setVisible(!!st?.chiAvailable);
      this.passBtn.setVisible(true);

      // 维护成数组渲染：以「过」为锚点，其它按钮从「过」的左侧依次向左排开
      const gap = l.winGap;
      const y = l.winY;

      // pass 固定在最右侧锚点
      this.passBtn.setPosition(l.winX, y);

      // actions 从 pass 左侧向左排
      const actions: Phaser.GameObjects.Container[] = [];
      if (st?.winAvailable) actions.push(this.huBtn);
      if (st?.gangAvailable) actions.push(this.gangBtn);
      if (st?.pengAvailable) actions.push(this.pengBtn);
      if (st?.chiAvailable) actions.push(this.chiBtn);

      for (let i = 0; i < actions.length; i++) {
        actions[i].setPosition(l.winX - gap * (i + 1), y);
      }
    }

    // Reset passed status when state moved on
    if (!st || token === null) {
      this.passedToken = null;
      return;
    }

    if (this.passedToken && this.passedToken !== token && st.phase === 'draw') {
      this.passedToken = null;
    }

  }

  destroy() {
    this.huBtn.destroy(true);
    this.gangBtn.destroy(true);
    this.pengBtn.destroy(true);
    this.chiBtn.destroy(true);
    this.passBtn.destroy(true);
  }
}
