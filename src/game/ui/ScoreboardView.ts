import Phaser from 'phaser';
import type { PublicState, Seat } from '../../domain/types';

export class ScoreboardView {
  private visible = false;

  private btn: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Container;

  private scoreText: Phaser.GameObjects.Text;
  private roundsText: Phaser.GameObjects.Text;
  private roundsPageText: Phaser.GameObjects.Text;

  private prevBtn: Phaser.GameObjects.Container;
  private nextBtn: Phaser.GameObjects.Container;

  private roundsPage = 0; // 0 = 最新一页

  // panel geometry (container-local coords)
  private pw: number;
  private ph: number;
  private dividerY: number;
  private roundsTextY: number;

  constructor(scene: Phaser.Scene) {
    const w = scene.scale.width;
    const h = scene.scale.height;
    const margin = Math.round(w * 0.02);

    // Button (top-right)
    const bw = Math.round(w * 0.10);
    const bh = Math.round(h * 0.05);

    const btnBg = scene.add.rectangle(0, 0, bw, bh, 0x0b1020, 0.55).setStrokeStyle(1, 0xffffff, 0.18);
    const btnText = scene.add.text(0, 0, '分数', { fontSize: `${Math.round(w * 0.016)}px`, color: '#E2E8F0' }).setOrigin(0.5, 0.5);
    this.btn = scene.add.container(w - margin - bw / 2, margin + bh / 2, [btnBg, btnText]);
    this.btn.setSize(bw, bh);
    this.btn.setDepth(5000);
    this.btn.setInteractive({ useHandCursor: true });
    this.btn.on('pointerdown', () => this.toggle());

    // Panel overlay
    this.pw = Math.round(w * 0.92);
    this.ph = Math.round(h * 0.72);
    const panelX = Math.round(w / 2);
    const panelY = Math.round(h / 2);

    const overlay = scene.add.rectangle(0, 0, w, h, 0x000000, 0.35);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.hide());

    const bg = scene.add.rectangle(0, 0, this.pw, this.ph, 0x0b1020, 0.92).setStrokeStyle(1, 0xffffff, 0.14);

    const topPad = Math.round(Math.max(14, w * 0.012));
    const headerY = -this.ph / 2 + topPad;

    const title = scene.add.text(-this.pw / 2 + 16, headerY, '记分板', {
      fontSize: `${Math.round(w * 0.020)}px`,
      color: '#E2E8F0'
    });

    const closeHint = scene.add.text(this.pw / 2 - 16, headerY + 2, '点击空白处关闭', {
      fontSize: `${Math.round(w * 0.012)}px`,
      color: '#AAB3C7'
    }).setOrigin(1, 0);

    // 四行分数：缩小一点，更紧凑
    const headerToScores = Math.round(Math.max(34, w * 0.030));
    this.scoreText = scene.add.text(-this.pw / 2 + 16, headerY + headerToScores, '', {
      fontSize: `${Math.round(w * 0.014)}px`,
      color: '#E2E8F0',
      lineSpacing: Math.round(w * 0.003),
      wordWrap: { width: this.pw - 32 },
    });

    // Use panel height (ph) for layout — avoid mixing in full-screen h which can break positioning.
    // Divider sits below the 4 score lines; base it on panel height but keep some breathing room on large screens.
    this.dividerY = -this.ph / 2 + Math.round(this.ph * 0.32);
    const divider = scene.add.rectangle(0, this.dividerY, this.pw - 28, 1, 0xffffff, 0.10);

    const roundsTitle = scene.add.text(-this.pw / 2 + 16, this.dividerY + 14, '每轮记录', {
      fontSize: `${Math.round(w * 0.014)}px`,
      color: '#AAB3C7'
    });

    // 页码/提示
    this.roundsPageText = scene.add.text(this.pw / 2 - 16, this.dividerY + 16, '', {
      fontSize: `${Math.round(w * 0.012)}px`,
      color: '#AAB3C7'
    }).setOrigin(1, 0);

    this.roundsTextY = this.dividerY + 40;
    this.roundsText = scene.add.text(-this.pw / 2 + 16, this.roundsTextY, '', {
      fontSize: `${Math.round(w * 0.013)}px`,
      color: '#E2E8F0',
      lineSpacing: Math.round(w * 0.006),
      wordWrap: { width: this.pw - 32 },
    });

    // 翻页按钮（右下角）
    const makeSmallBtn = (x: number, y: number, label: string, onClick: () => void) => {
      const bw2 = 64;
      const bh2 = 28;
      const r = scene.add.rectangle(0, 0, bw2, bh2, 0x111827, 0.92)
        .setStrokeStyle(1, 0xffffff, 0.18)
        .setOrigin(0.5);
      const t = scene.add.text(0, 1, label, {
        fontSize: `${Math.round(w * 0.012)}px`,
        color: '#E2E8F0',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      const c = scene.add.container(x, y, [r, t]);
      c.setSize(bw2, bh2);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', onClick);
      return c;
    };

    const btnY = this.ph / 2 - 22;
    this.prevBtn = makeSmallBtn(this.pw / 2 - 16 - 64 - 10, btnY, '上一页', () => {
      this.roundsPage += 1;
      // update will clamp
      const st = (scene as any).state as PublicState | null;
      this.update(st);
    });
    this.nextBtn = makeSmallBtn(this.pw / 2 - 16 - 32, btnY, '下一页', () => {
      this.roundsPage = Math.max(0, this.roundsPage - 1);
      const st = (scene as any).state as PublicState | null;
      this.update(st);
    });

    this.panel = scene.add.container(panelX, panelY, [
      overlay,
      bg,
      title,
      closeHint,
      this.scoreText,
      divider,
      roundsTitle,
      this.roundsPageText,
      this.roundsText,
      this.prevBtn,
      this.nextBtn,
    ]);
    this.panel.setDepth(6000);
    this.panel.setVisible(false);

    // keep overlay behind bg inside container
    overlay.setPosition(0, 0);
  }

  private seatName(s: Seat) {
    return ['东', '南', '西', '北'][s] ?? String(s);
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  show() {
    this.visible = true;
    this.panel.setVisible(true);
  }

  hide() {
    this.visible = false;
    this.panel.setVisible(false);
  }

  destroy() {
    this.btn.destroy(true);
    this.panel.destroy(true);
  }

  private computePerPage(): number {
    // 估算 roundsText 可用高度
    const bottomPad = 44; // keep space for buttons
    const availH = (this.ph / 2 - bottomPad) - this.roundsTextY;

    // line height estimate
    const fontPx = Number(String(this.roundsText.style.fontSize).replace('px', '')) || 14;
    const lineSpacing = Number(((this.roundsText.style as any).lineSpacing ?? 0)) || 0;
    const lineH = fontPx + lineSpacing + 2;

    const per = Math.floor(availH / Math.max(10, lineH));
    return Math.max(4, Math.min(16, per));
  }

  update(st: PublicState | null) {
    if (!st) {
      this.scoreText.setText('未连接');
      this.roundsText.setText('');
      this.roundsPageText.setText('');
      this.prevBtn.setVisible(false);
      this.nextBtn.setVisible(false);
      return;
    }

    // scores
    const lines: string[] = [];
    for (const s of [0, 1, 2, 3] as const) {
      const p = st.players[s];
      const name = p?.name ?? `玩家${s + 1}`;
      lines.push(`${this.seatName(s)} ${name}: ${st.scores?.[s] ?? 0}`);
    }
    this.scoreText.setText(lines.join('\n'));

    // history
    const recs = (st.roundHistory ?? []).slice().reverse(); // newest first
    if (recs.length === 0) {
      this.roundsText.setText('暂无');
      this.roundsPageText.setText('');
      this.prevBtn.setVisible(false);
      this.nextBtn.setVisible(false);
      this.roundsPage = 0;
      return;
    }

    const perPage = this.computePerPage();
    const pageCount = Math.max(1, Math.ceil(recs.length / perPage));
    this.roundsPage = Math.min(this.roundsPage, pageCount - 1);

    const start = this.roundsPage * perPage;
    const page = recs.slice(start, start + perPage);

    const out: string[] = [];
    for (const r of page) {
      const winners = r.winners.map(this.seatName).join(',');
      const tile = r.winTile ?? '-';
      const type = r.winType === 'self' ? '自摸' : (r.winType === 'discard' ? '点炮' : '胡');
      const delta = ([0, 1, 2, 3] as const)
        .map(s => `${this.seatName(s)}${r.deltaBySeat[s] >= 0 ? '+' : ''}${r.deltaBySeat[s]}`)
        .join(' ');
      out.push(`第${r.round}轮：${winners} ${type} ${tile}（${r.reason}）  ${delta}`);
    }

    this.roundsText.setText(out.join('\n'));

    // paging UI
    this.roundsPageText.setText(`第${this.roundsPage + 1}/${pageCount}页`);
    this.prevBtn.setVisible(pageCount > 1 && this.roundsPage < pageCount - 1);
    this.nextBtn.setVisible(pageCount > 1 && this.roundsPage > 0);
  }
}
