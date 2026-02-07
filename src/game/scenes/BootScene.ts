import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    // No assets for now.
    this.scene.start('Game');
  }
}
