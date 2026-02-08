import Phaser from 'phaser';
import type { PublicState, Seat } from '../../domain/types';
import { computeLayout } from './layout';

const SEAT_NAME: Record<Seat, string> = { 0: '东', 1: '南', 2: '西', 3: '北' };
const seatName = (s: Seat) => SEAT_NAME[s] ?? String(s);

export class TurnCompass {
  private container: Phaser.GameObjects.Container;
  private labels: {
    bottom: Phaser.GameObjects.Text;
    right: Phaser.GameObjects.Text;
    top: Phaser.GameObjects.Text;
    left: Phaser.GameObjects.Text;
  };
  private wallLabelText: Phaser.GameObjects.Text;
  private wallCountText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const l = computeLayout(scene);
    this.container = scene.add.container(l.compassX, l.compassY);

    const ring = scene.add.circle(0, 0, 86, 0x000000, 0.08);
    ring.setStrokeStyle(2, 0x0b3d2e, 0.35);

    const center = scene.add.rectangle(0, 0, 44, 44, 0x000000, 0.12);
    center.setStrokeStyle(2, 0x86efac, 0.25);

    const mk = (px: number, py: number) => {
      const txt = scene.add.text(px, py, '-', {
        fontSize: '30px',
        color: '#9CA3AF',
        fontStyle: '900'
      }).setOrigin(0.5);
      return txt;
    };

    this.labels = {
      bottom: mk(0, 54),
      right: mk(54, 0),
      top: mk(0, -54),
      left: mk(-54, 0),
    };

    // “剩余张数：数字”这一行：往上移动一点点，但不要和 compass 重叠
    // ring 半径 86；这里放在 110（较原 118 上移 8px），与 ring 保持间距
    const wallY = 110;

    // “剩余张数”这几个字：黄色，并缩小 40%（28px -> ~17px）
    this.wallLabelText = scene.add.text(0, wallY, '剩余张数：', {
      fontSize: '17px',
      color: '#FACC15',
      fontStyle: '900'
    }).setOrigin(0, 0.5);

    // 数字部分：同样黄色、同样大小
    this.wallCountText = scene.add.text(0, wallY, '-', {
      fontSize: '17px',
      color: '#FACC15',
      fontStyle: '900'
    }).setOrigin(0, 0.5);

    this.container.add([
      ring,
      center,
      this.labels.bottom,
      this.labels.right,
      this.labels.top,
      this.labels.left,
      this.wallLabelText,
      this.wallCountText,
    ]);

    // 整体缩小 20%，保持以自身中心缩放
    this.container.setScale(0.8);
    this.container.setDepth(5);
  }

  update(st: PublicState | null, scene: Phaser.Scene) {
    const l = computeLayout(scene);
    this.container.setPosition(l.compassX, l.compassY);
    if (st && st.yourSeat !== null) {
      const you = st.yourSeat as Seat;
      const bottom = you;
      const right = (((you as number) + 1) % 4) as Seat;
      const top = (((you as number) + 2) % 4) as Seat;
      const left = (((you as number) + 3) % 4) as Seat;

      this.labels.bottom.setText(seatName(bottom));
      this.labels.right.setText(seatName(right));
      this.labels.top.setText(seatName(top));
      this.labels.left.setText(seatName(left));

      // Highlight direction of current turn relative to you.
      const relTurn = ((you as number) - (st.turn as number) + 4) % 4; // 0=bottom,1=left,2=top,3=right
      const isOn = {
        bottom: relTurn === 0,
        left: relTurn === 1,
        top: relTurn === 2,
        right: relTurn === 3,
      };

      for (const pos of ['bottom', 'left', 'top', 'right'] as const) {
        const t = this.labels[pos];
        const on = isOn[pos];
        t.setColor(on ? '#FDE68A' : '#9CA3AF');
        t.setAlpha(on ? 1 : 0.55);
      }
    } else {
      for (const pos of ['bottom', 'left', 'top', 'right'] as const) {
        this.labels[pos].setText('-');
        this.labels[pos].setColor('#9CA3AF');
        this.labels[pos].setAlpha(0.55);
      }
    }

    this.wallCountText.setText(String(st?.wallCount ?? '-'));

    // 动态居中对齐：让「剩余张数：」+「数字」整体仍然以 x=0 为中心
    const labelW = this.wallLabelText.width;
    const countW = this.wallCountText.width;
    const totalW = labelW + countW;
    const leftX = -totalW / 2;

    this.wallLabelText.setX(leftX);
    this.wallCountText.setX(leftX + labelW);
  }

  destroy() {
    this.container.destroy(true);
  }
}
