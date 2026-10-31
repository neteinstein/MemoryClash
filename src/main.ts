import './styles.css';
import { synth } from './audio/synth';
import { loadFonts } from './fonts';
import { GameView } from './ui/game-view';
import { MenuView } from './ui/menu';
import { loadSettings, saveSettings } from './ui/settings';

loadFonts();
const app = document.getElementById('app')!;
const settings = loadSettings();
synth.muted = settings.muted;

let menu: MenuView | null = null;
let game: GameView | null = null;
/** Ignora o próximo `popstate` (quando somos nós a recuar no histórico). */
let ignorePop = false;

/** O truque do histórico (botão "voltar" pausa o jogo) só se usa quando a página não está dentro de um iframe. */
const useHistory = (() => {
  try {
    return window.top === window;
  } catch {
    return false;
  }
})();

function historyPush(): void {
  if (!useHistory) return;
  try {
    history.pushState({ memoryclash: true }, '');
  } catch {
    // Ignorar: sem histórico, o "voltar" funciona como habitualmente.
  }
}

function showMenu(): void {
  game?.destroy();
  game = null;
  saveSettings(settings);
  if (useHistory && history.state?.memoryclash) {
    ignorePop = true;
    history.back();
  }
  menu = new MenuView(settings, { onPlay: startGame });
  menu.mount(app);
}

function startGame(): void {
  menu?.destroy();
  menu = null;
  game?.destroy();
  saveSettings(settings);
  game = new GameView(settings, { onExit: showMenu, onRematch: startGame });
  game.mount(app);
  // Uma entrada no histórico para que o botão "voltar" do Android pause o jogo em vez de sair.
  if (!history.state?.memoryclash) historyPush();
}

window.addEventListener('popstate', () => {
  if (ignorePop) {
    ignorePop = false;
    return;
  }
  if (!game) return;
  if (game.isPaused || !game.isRunning) {
    showMenu();
  } else {
    game.pause();
    historyPush();
  }
});

// Os browsers só deixam ligar o som depois de um gesto "completo" (em ecrãs tácteis, ao levantar o dedo).
for (const type of ['pointerup', 'touchend', 'keydown', 'click']) {
  window.addEventListener(type, () => synth.unlock(), { capture: true, passive: true });
}

// Impede o menu de contexto (toque longo) e gestos de zoom durante o jogo.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

showMenu();
