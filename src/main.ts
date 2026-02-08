import './style.css';
import Phaser from 'phaser';
import { GameScene } from './game/scenes/GameScene';
import { mountLobby } from './lobby';

function startGame() {
  const lobbyRoot = document.getElementById('lobby');
  const appRoot = document.getElementById('app');
  if (lobbyRoot) lobbyRoot.style.display = 'none';
  if (appRoot) appRoot.style.display = 'flex';

  // Best-effort: lock to landscape on mobile.
  try {
    (screen as any)?.orientation?.lock?.('landscape');
  } catch {}

  // If opened in portrait, rotate the whole game container to behave like landscape.
  const applyForceLandscape = () => {
    const portrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle('force-landscape', portrait);
  };
  applyForceLandscape();
  window.addEventListener('resize', applyForceLandscape);

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#05060B',
    // No Phaser DOM UI anymore; lobby is real DOM.
    dom: { createContainer: false },
    scale: {
      // Fullscreen canvas: resize to parent container.
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight
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
