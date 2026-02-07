import './style.css';
import Phaser from 'phaser';
import { GameScene } from './game/scenes/GameScene';
import { mountLobby } from './lobby';

function startGame() {
  const lobbyRoot = document.getElementById('lobby');
  const appRoot = document.getElementById('app');
  if (lobbyRoot) lobbyRoot.style.display = 'none';
  if (appRoot) appRoot.style.display = 'flex';

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#05060B',
    // No Phaser DOM UI anymore; lobby is real DOM.
    dom: { createContainer: false },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1100,
      height: 700
    },
    scene: [GameScene]
  };

  const game = new Phaser.Game(config);
  (window as any).__game = game;
}

const lobbyRoot = document.getElementById('lobby');
if (!lobbyRoot) throw new Error('Missing #lobby');

let entered = false;
mountLobby({
  root: lobbyRoot,
  onEnterGame: () => {
    if (entered) return;
    entered = true;
    startGame();
  }
});
