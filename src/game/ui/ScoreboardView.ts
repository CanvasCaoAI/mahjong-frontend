import Phaser from 'phaser';
import type { PublicState, Seat } from '../../domain/types';

export class ScoreboardView {
  private visible = false;

  private btn: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Container;

  private scoreText: Phaser.GameObjects.Text;
  private roundsText: Phaser.GameObjects.Text;

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
    const pw = Math.round(w * 0.92);
    const ph = Math.round(h * 0.72);
    const panelX = Math.round(w / 2);
    const panelY = Math.round(h / 2);

    const overlay = scene.add.rectangle(0, 0, w, h, 0x000000, 0.35);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.hide());

    const bg = scene.add.rectangle(0, 0, pw, ph, 0x0b1020, 0.92).setStrokeStyle(1, 0xffffff, 0.14);

    const topPad = 12;
    const headerY = -ph / 2 + topPad;

    const title = scene.add.text(-pw / 2 + 16, headerY, '记分板', { fontSize: `${Math.round(w * 0.020)}px`, color: '#E2E8F0' });

    const closeHint = scene.add.text(pw / 2 - 16, headerY + 2, '点击空白处关闭', {
      fontSize: `${Math.round(w * 0.012)}px`,
      color: '#AAB3C7'
    }).setOrigin(1, 0);

    this.scoreText = scene.add.text(-pw / 2 + 16, headerY + 36, '', {
      fontSize: `${Math.round(w * 0.016)}px`,
      color: '#E2E8F0',
      lineSpacing: Math.round(w * 0.006),
      wordWrap: { width: pw - 32 },
    });

    // Use panel height (ph) for layout — avoid mixing in full-screen h which can break positioning.
    const dividerY = -ph / 2 + Math.round(ph * 0.30);
    const divider = scene.add.rectangle(0, dividerY, pw - 28, 1, 0xffffff, 0.10);

    const roundsTitle = scene.add.text(-pw / 2 + 16, dividerY + 14, '每轮记录', {
      fontSize: `${Math.round(w * 0.014)}px`,
      color: '#AAB3C7'
    });

    this.roundsText = scene.add.text(-pw / 2 + 16, dividerY + 40, '', {
      fontSize: `${Math.round(w * 0.013)}px`,
      color: '#E2E8F0',
      lineSpacing: Math.round(w * 0.006),
      wordWrap: { width: pw - 32 },
    });

    this.panel = scene.add.container(panelX, panelY, [overlay, bg, title, closeHint, this.scoreText, divider, roundsTitle, this.roundsText]);
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

  update(st: PublicState | null) {
    if (!st) {
      this.scoreText.setText('未连接');
      this.roundsText.setText('');
      return;
    }

    const lines: string[] = [];
    for (const s of [0, 1, 2, 3] as const) {
      const p = st.players[s];
      const name = p?.name ?? `玩家${s + 1}`;
      lines.push(`${this.seatName(s)} ${name}: ${st.scores?.[s] ?? 0}`);
    }
    this.scoreText.setText(lines.join('\n'));

    const recs = (st.roundHistory ?? []).slice().reverse();
    if (recs.length === 0) {
      this.roundsText.setText('暂无');
      return;
    }

    const maxShow = 12;
    const out: string[] = [];
    for (const r of recs.slice(0, maxShow)) {
      const winners = r.winners.map(this.seatName).join(',');
      const tile = r.winTile ?? '-';
      const type = r.winType === 'self' ? '自摸' : (r.winType === 'discard' ? '点炮' : '胡');
      const delta = ([0, 1, 2, 3] as const).map(s => `${this.seatName(s)}${r.deltaBySeat[s] >= 0 ? '+' : ''}${r.deltaBySeat[s]}`).join(' ');
      out.push(`第${r.round}轮：${winners} ${type} ${tile}（${r.reason}）  ${delta}`);
    }

    if (recs.length > maxShow) out.push(`…（还有 ${recs.length - maxShow} 轮）`);

    this.roundsText.setText(out.join('\n'));
  }
}
