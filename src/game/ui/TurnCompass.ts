import Phaser from 'phaser';
import type { PublicState, Seat } from '../../domain/types';
import { computeLayout } from './layout';
import { uiScale } from './uiScale';

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
  // moved to WallCountView

  constructor(scene: Phaser.Scene) {
    const l = computeLayout(scene);
    this.container = scene.add.container(l.compassX, l.compassY);

    const u = uiScale(scene);
    // Square compass (smaller, proportional)
    const size = u.compassSize;
    const half = size / 2;

    const frame = scene.add.rectangle(0, 0, size, size, 0x000000, 0.10);
    frame.setStrokeStyle(2, 0x0b3d2e, 0.35);

    const center = scene.add.rectangle(0, 0, size * 0.36, size * 0.36, 0x000000, 0.12);
    center.setStrokeStyle(2, 0x86efac, 0.25);

    const fontPx = Math.round(size * 0.14);
    const mk = (px: number, py: number) => {
      const txt = scene.add.text(px, py, '-', {
        fontSize: `${fontPx}px`,
        color: '#9CA3AF',
        fontStyle: '900'
      }).setOrigin(0.5);
      return txt;
    };

    const off = half * 0.62;
    this.labels = {
      bottom: mk(0, off),
      right: mk(off, 0),
      top: mk(0, -off),
      left: mk(-off, 0),
    };

    // Wall count moved to WallCountView (top-left)

    this.container.add([
      frame,
      center,
      this.labels.bottom,
      this.labels.right,
      this.labels.top,
      this.labels.left,
      // wall count moved
    ]);

    // No extra scaling: we already size it proportional to screen width.
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

    // Wall count moved to WallCountView
  }

  destroy() {
    this.container.destroy(true);
  }
}
