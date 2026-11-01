import { synth } from '../audio/synth';
import type { CellChange } from '../game/board';
import {
  DEVIL_FLIGHT_MS,
  DEVIL_STREAK,
  DIFFICULTIES,
  ERROR_PAUSE_MS,
  KEYS,
  type PlayerId,
} from '../game/config';
import { Match, type MatchEvent } from '../game/match';
import type { PlayerEvent } from '../game/player';
import { AvatarView, avatarSvg } from './avatar';
import { devilElement, flyDevil, poof } from './devil';
import { h, isPortrait, onClick, onTap } from './dom';
import { activePlayers, playerTheme, themeVars, zoneVars, type Settings } from './settings';

/** Teclas físicas de cada jogador (por posição, independente do layout do teclado). */
const KEY_CODES: Record<PlayerId, string[][]> = {
  1: [
    ['KeyQ', 'KeyW', 'KeyE', 'KeyR'],
    ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
  ],
  2: [
    ['KeyU', 'KeyI', 'KeyO', 'KeyP'],
    ['KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  ],
  3: [
    ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
    ['KeyZ', 'KeyX', 'KeyC', 'KeyV'],
  ],
  4: [
    ['Digit7', 'Digit8', 'Digit9', 'Digit0'],
    ['KeyM', 'Comma', 'Period', 'Slash'],
  ],
};
const KEY_LABELS: Record<PlayerId, string[][]> = {
  1: [
    ['Q', 'W', 'E', 'R'],
    ['A', 'S', 'D', 'F'],
  ],
  2: [
    ['U', 'I', 'O', 'P'],
    ['J', 'K', 'L', 'Ç'],
  ],
  3: [
    ['1', '2', '3', '4'],
    ['Z', 'X', 'C', 'V'],
  ],
  4: [
    ['7', '8', '9', '0'],
    ['M', ',', '.', '-'],
  ],
};

export function keyboardHint(player: PlayerId, keys: number): string {
  const cols = keys / 2;
  return KEY_LABELS[player].map((row) => row.slice(0, cols).join(' ')).join(' / ');
}

/** Relógio de jogo que pode ser pausado. */
class Clock {
  private offset = 0;
  private pausedAt: number | null = null;
  now(): number {
    return (this.pausedAt ?? performance.now()) - this.offset;
  }
  pause(): void {
    if (this.pausedAt === null) this.pausedAt = performance.now();
  }
  resume(): void {
    if (this.pausedAt === null) return;
    this.offset += performance.now() - this.pausedAt;
    this.pausedAt = null;
  }
  get paused(): boolean {
    return this.pausedAt !== null;
  }
}

interface Side {
  zone: HTMLElement;
  pad: HTMLElement;
  keys: HTMLButtonElement[];
  status: HTMLElement;
  share: HTMLElement;
  seq: HTMLElement;
  pips: HTMLElement[];
  timerFill: HTMLElement;
  badges: HTMLElement;
  lightTimers: Map<number, number>;
  statusTimer: number;
  avatar: AvatarView;
}

export interface GameCallbacks {
  onExit: () => void;
  onRematch: () => void;
}

export class GameView {
  readonly root: HTMLElement;
  private readonly settings: Settings;
  private readonly callbacks: GameCallbacks;
  private readonly match: Match;
  private readonly clock = new Clock();
  private readonly sides: Record<PlayerId, Side>;
  private readonly cells: HTMLElement[] = [];
  private readonly board: HTMLElement;
  private readonly fx: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly timeEl: HTMLElement;
  /** Jogadores em jogo; com 3 ou 4 há um em cada lado do ecrã. */
  private readonly ids: PlayerId[];
  private readonly multi: boolean;
  private readonly bars = new Map<PlayerId, HTMLElement>();
  private readonly muteBtn: HTMLButtonElement;
  private raf = 0;
  private countdownTimers: number[] = [];
  private destroyed = false;
  private paused = false;
  private readonly portraitQuery = window.matchMedia('(orientation: portrait)');
  private readonly onKeyDown = (e: KeyboardEvent) => this.handleKey(e);
  private readonly onVisibility = () => {
    if (document.hidden) this.pause();
  };
  private readonly onOrientation = () => this.layoutBoard();

  constructor(settings: Settings, callbacks: GameCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.ids = activePlayers(settings);
    this.multi = this.ids.length > 2;
    this.match = new Match({
      players: this.ids.length,
      difficulties: settings.difficulties,
      boardSize: settings.boardSize,
      timeLimitSec: settings.timeLimitSec,
    });

    this.fx = h('div', { class: 'fx-layer' });
    this.overlay = h('div', { class: 'overlay hidden' });
    this.timeEl = h('span', { class: 'clock' });
    // Barra de território: J1 e J3 a partir da esquerda, J4 e J2 a partir da direita, livre no meio.
    const barOrder: Array<PlayerId | 0> = [1, 3, 0, 4, 2];
    const bar = h('div', { class: 'bar' });
    for (const id of barOrder) {
      if (id === 0) {
        bar.append(h('div', { class: 'bar-free' }));
      } else if (this.ids.includes(id)) {
        const seg = h('div', { class: `bar-seg`, style: `background:var(--p${id})` });
        this.bars.set(id, seg);
        bar.append(seg);
      }
    }
    this.muteBtn = h('button', { class: 'icon-btn', 'aria-label': 'Som' }) as HTMLButtonElement;
    this.board = h('div', { class: 'board' });

    const pauseBtn = h('button', { class: 'icon-btn', 'aria-label': 'Pausa', html: '&#10074;&#10074;' });
    onClick(pauseBtn, () => this.pause());
    onClick(this.muteBtn, () => this.toggleMute());
    this.updateMuteIcon();

    const mid = h(
      'div',
      { class: 'mid game-mid' },
      h(
        'div',
        { class: 'toolbar' },
        pauseBtn,
        h('div', { class: 'territory' }, bar, this.timeEl),
        this.muteBtn,
      ),
      this.board,
    );

    const sides = {} as Record<PlayerId, Side>;
    for (const id of this.ids) sides[id] = this.buildSide(id);
    this.sides = sides;

    const layout = this.multi
      ? ` multi players-${this.ids.length}`
      : settings.rotateP2
        ? ' rotate-p2'
        : '';
    this.root = h(
      'div',
      { class: `arena game${layout}`, style: themeVars(settings) },
      ...this.ids.map((id) => this.sides[id].zone),
      mid,
      this.fx,
      this.overlay,
    );

    this.buildBoard();
    this.match.on((e) => this.onMatchEvent(e));
    // Só em desenvolvimento: permite testes automáticos no browser.
    if (import.meta.env.DEV) (window as unknown as { __match?: Match }).__match = this.match;
    this.updateTerritory();
    this.updateClock();
  }

  // ---------------------------------------------------------------- construção

  private buildSide(player: PlayerId): Side {
    const theme = playerTheme(this.settings, player);
    const difficulty = DIFFICULTIES[this.settings.difficulties[player]];
    const cols = difficulty.keys / 2;
    const keys: HTMLButtonElement[] = [];
    const pad = h('div', { class: 'pad', style: `--cols:${cols}` });
    for (let i = 0; i < difficulty.keys; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const key = h(
        'button',
        {
          class: 'key',
          style: `--key:${KEYS[i].color}`,
          'aria-label': `Tecla ${KEYS[i].name}`,
        },
        h('span', { class: 'key-label' }, KEY_LABELS[player][row][col]),
      ) as HTMLButtonElement;
      onTap(key, () => this.press(player, i));
      keys.push(key);
      pad.append(key);
    }
    const badges = h('div', { class: 'devil-badges' });
    pad.append(badges);

    const pips: HTMLElement[] = [];
    const streak = h('div', { class: 'streak', title: `${DEVIL_STREAK} seguidos = diabinho` });
    for (let i = 0; i < DEVIL_STREAK; i++) {
      const pip = h('i');
      pips.push(pip);
      streak.append(pip);
    }
    streak.append(devilElement('streak-devil'));

    const avatar = new AvatarView(this.settings.avatars[player], 'avatar avatar-hud');
    const status = h('span', { class: 'hud-status' });
    const share = h('span', { class: 'hud-share' }, '0%');
    const seq = h('span', { class: 'hud-seq' });
    const timerFill = h('div', { class: 'timer-fill' });

    const hud = h(
      'div',
      { class: 'hud' },
      h(
        'div',
        { class: 'hud-row' },
        h(
          'span',
          { class: 'hud-name' },
          avatar.el,
          h('span', { class: 'hud-player' }, this.settings.avatars[player].name),
          h('span', { class: 'badge' }, difficulty.label),
        ),
        streak,
        share,
      ),
      h('div', { class: 'hud-row' }, status, seq),
      h('div', { class: 'timer' }, timerFill),
    );

    const zone = h(
      'section',
      { class: `zone zone-p${player}`, style: zoneVars(theme) },
      h('div', { class: 'zone-inner' }, hud, pad),
    );
    return { zone, pad, keys, status, share, seq, pips, timerFill, badges, lightTimers: new Map(), statusTimer: 0, avatar };
  }

  private buildBoard(): void {
    const b = this.match.board;
    for (let i = 0; i < b.size; i++) {
      const cell = h('div', { class: `cell o${b.owner(i)}` });
      this.cells.push(cell);
      this.board.append(cell);
    }
    this.layoutBoard();
  }

  /**
   * A dois: em retrato o J1 está em baixo e o J2 em cima; em paisagem o J1 à esquerda e o J2 à direita.
   * Com 3 ou 4 jogadores o tabuleiro fica sempre direito: J1 em baixo, J2 em cima, J3 à esquerda, J4 à direita.
   */
  private layoutBoard(): void {
    const b = this.match.board;
    const portrait = this.multi || isPortrait();
    const cols = portrait ? b.breadth : b.depth;
    const rows = portrait ? b.depth : b.breadth;
    this.root.style.setProperty('--bw', String(cols));
    this.root.style.setProperty('--bh', String(rows));
    this.cells.forEach((cell, i) => {
      const r = b.rowOf(i);
      const c = b.colOf(i);
      if (portrait) {
        cell.style.gridRow = String(b.depth - r);
        cell.style.gridColumn = String(c + 1);
      } else {
        cell.style.gridRow = String(c + 1);
        cell.style.gridColumn = String(r + 1);
      }
    });
  }

  // ---------------------------------------------------------------- ciclo de vida

  mount(parent: HTMLElement): void {
    parent.append(this.root);
    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.portraitQuery.addEventListener('change', this.onOrientation);
    this.countdown();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.countdownTimers.forEach((t) => clearTimeout(t));
    for (const id of this.ids) {
      this.sides[id].lightTimers.forEach((t) => clearTimeout(t));
      clearTimeout(this.sides[id].statusTimer);
      this.sides[id].avatar.dispose();
    }
    this.match.abort();
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.portraitQuery.removeEventListener('change', this.onOrientation);
    this.root.remove();
  }

  private countdown(): void {
    const steps = ['3', '2', '1', 'Já!'];
    const show = (text: string, final: boolean) => {
      this.overlay.className = 'overlay countdown';
      this.overlay.replaceChildren(...this.ids.map((id) => h('div', { class: `cd cd-p${id}` }, h('span', {}, text))));
      synth.countdown(final);
    };
    steps.forEach((text, i) => {
      this.countdownTimers.push(
        window.setTimeout(() => {
          if (this.destroyed) return;
          show(text, i === steps.length - 1);
          if (i === steps.length - 1) {
            this.match.start(this.clock.now());
            this.loop();
          }
        }, i * 700),
      );
    });
    this.countdownTimers.push(
      window.setTimeout(() => {
        if (!this.destroyed && !this.paused) this.hideOverlay();
      }, steps.length * 700),
    );
  }

  private loop = (): void => {
    if (this.destroyed) return;
    if (document.hidden) this.pause();
    const now = this.clock.now();
    if (!this.paused) this.match.update(now);
    this.updateTimers(now);
    this.updateClock();
    if (this.match.status !== 'ended') this.raf = requestAnimationFrame(this.loop);
  };

  pause(): void {
    if (this.paused || this.destroyed || this.match.status === 'ended') return;
    if (this.match.status === 'ready') return; // ainda na contagem decrescente
    this.paused = true;
    this.clock.pause();
    synth.suspend();
    this.clearLights();
    this.fx.getAnimations({ subtree: true }).forEach((a) => a.pause());
    this.showPause();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isRunning(): boolean {
    return this.match.status === 'running';
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    synth.resume();
    this.clock.resume();
    this.fx.getAnimations({ subtree: true }).forEach((a) => a.play());
    this.hideOverlay();
  }

  // ---------------------------------------------------------------- entrada

  private handleKey(e: KeyboardEvent): void {
    if (e.code === 'Escape' || e.code === 'Space') {
      e.preventDefault();
      if (this.paused) this.resume();
      else this.pause();
      return;
    }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    for (const player of this.ids) {
      const cols = DIFFICULTIES[this.settings.difficulties[player]].keys / 2;
      const grid = KEY_CODES[player];
      for (let row = 0; row < 2; row++) {
        const col = grid[row].indexOf(e.code);
        if (col >= 0 && col < cols) {
          e.preventDefault();
          this.press(player, row * cols + col);
          return;
        }
      }
    }
  }

  private press(player: PlayerId, key: number): void {
    synth.unlock();
    if (this.paused) return;
    const result = this.match.press(player, key, this.clock.now());
    if (result === null) {
      const el = this.sides[player].keys[key];
      el.classList.remove('nope');
      void el.offsetWidth;
      el.classList.add('nope');
    }
  }

  // ---------------------------------------------------------------- eventos do jogo

  private pan(player: PlayerId): number {
    if (this.multi) return player === 3 ? -0.35 : player === 4 ? 0.35 : 0;
    if (isPortrait()) return 0;
    return player === 1 ? -0.35 : 0.35;
  }

  private onMatchEvent(e: MatchEvent): void {
    switch (e.type) {
      case 'player':
        this.onPlayerEvent(e.player, e.event);
        break;
      case 'board':
        this.applyBoard(e.player, e.changes, e.reason);
        break;
      case 'devil':
        this.launchDevil(e.from, e.to);
        break;
      case 'end':
        window.setTimeout(() => this.showEnd(), 900);
        break;
    }
  }

  private onPlayerEvent(player: PlayerId, e: PlayerEvent): void {
    const side = this.sides[player];
    const engine = this.match.players[player];
    switch (e.type) {
      case 'round': {
        side.pad.classList.remove('input', 'error', 'success');
        side.pad.classList.add('showing');
        side.pad.classList.toggle('cursed', e.curse > 0);
        side.keys.forEach((k) => k.classList.remove('hint', 'wrong'));
        side.seq.textContent = `${e.length} notas`;
        if (e.curse > 0) {
          side.avatar.setMood('scared');
          this.setStatus(player, '😈 Sequência amaldiçoada!', 'bad');
          side.badges.querySelectorAll('.devil-badge').forEach((b) => b.classList.add('attacking'));
        } else {
          this.setStatus(player, '👀 Observa…');
        }
        this.updateStreak(player);
        break;
      }
      case 'show':
        this.light(player, e.key, e.durationMs);
        synth.note(e.key, e.durationMs, this.pan(player));
        break;
      case 'input':
        side.pad.classList.remove('showing');
        side.pad.classList.add('input');
        if (engine.activeCurse === 0) side.avatar.setMood('normal');
        this.setStatus(player, '👉 A tua vez!', 'go');
        break;
      case 'press':
        if (e.correct) {
          this.light(player, e.key, 200);
          synth.note(e.key, 240, this.pan(player));
        } else {
          side.keys[e.key].classList.add('wrong');
        }
        break;
      case 'success':
        side.pad.classList.remove('input', 'cursed');
        side.pad.classList.add('success');
        synth.success(this.pan(player));
        side.avatar.setMood('happy', 1100);
        this.updateStreak(player);
        if (e.cursed) this.clearBadges(player, engine.pendingCurses);
        break;
      case 'error': {
        side.pad.classList.remove('input', 'showing', 'cursed');
        side.pad.classList.add('error');
        synth.error(this.pan(player));
        side.avatar.setMood('dizzy', 1500);
        vibrate(140);
        const hint = side.keys[e.expected];
        hint?.classList.add('hint');
        window.setTimeout(() => hint?.classList.remove('hint'), ERROR_PAUSE_MS);
        this.setStatus(player, e.reason === 'timeout' ? '⏱ Tempo esgotado!' : '✖ Erro!', 'bad');
        this.updateStreak(player);
        if (e.cursed) this.clearBadges(player, engine.pendingCurses);
        break;
      }
      case 'cursed': {
        const badge = devilElement('devil-badge');
        side.badges.append(badge);
        badge.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }], {
          duration: 350,
          easing: 'ease-out',
        });
        vibrate([60, 40, 60]);
        side.avatar.setMood('scared', 1400);
        if (engine.phase === 'showing' || engine.phase === 'input') {
          this.setStatus(player, '😈 Apanhaste um diabinho!', 'bad');
        }
        break;
      }
      case 'devil':
        // A animação é tratada em `launchDevil`.
        break;
    }
  }

  private applyBoard(player: PlayerId, changes: CellChange[], reason: 'gain' | 'loss'): void {
    changes.forEach((ch, n) => {
      const cell = this.cells[ch.index];
      cell.className = `cell o${ch.to}`;
      cell.style.animationDelay = `${n * 45}ms`;
      void cell.offsetWidth;
      cell.classList.add(reason === 'gain' ? (ch.from === 0 ? 'pop' : 'steal') : 'lost');
    });
    this.updateTerritory();
    if (reason === 'gain') {
      synth.claim(this.pan(player));
      const stolen = changes.filter((c) => c.from !== 0).length;
      this.setStatus(player, `✔ Boa! +${changes.length}${stolen ? ' (roubadas!)' : ''}`, 'good');
    } else if (changes.length > 0) {
      const side = this.sides[player];
      const current = side.status.textContent ?? '';
      this.setStatus(player, `${current} −${changes.length}`, 'bad');
    }
  }

  private launchDevil(from: PlayerId, to: PlayerId): void {
    synth.devil(this.pan(from));
    this.setStatus(from, `😈 Diabinho enviado!`, 'good');
    this.sides[from].avatar.setMood('happy', 1800);
    // O diabinho voa até ao canto do teclado do adversário; o selo aparece quando a maldição pega.
    void flyDevil(this.fx, this.sides[from].pad, this.sides[to].badges, DEVIL_FLIGHT_MS);
  }

  private clearBadges(player: PlayerId, keep: number): void {
    const badges = Array.from(this.sides[player].badges.querySelectorAll<HTMLElement>('.devil-badge'));
    badges.slice(0, Math.max(0, badges.length - keep)).forEach((b) => poof(b));
    badges.slice(badges.length - keep).forEach((b) => b.classList.remove('attacking'));
  }

  // ---------------------------------------------------------------- visual

  private light(player: PlayerId, key: number, durationMs: number): void {
    const side = this.sides[player];
    const el = side.keys[key];
    if (!el) return;
    clearTimeout(side.lightTimers.get(key));
    el.classList.remove('lit');
    void el.offsetWidth;
    el.classList.add('lit');
    side.lightTimers.set(
      key,
      window.setTimeout(() => el.classList.remove('lit'), durationMs),
    );
  }

  private clearLights(): void {
    for (const id of this.ids) {
      this.sides[id].keys.forEach((k) => k.classList.remove('lit'));
    }
  }

  private setStatus(player: PlayerId, text: string, tone: '' | 'good' | 'bad' | 'go' = ''): void {
    const side = this.sides[player];
    side.status.textContent = text;
    side.status.dataset.tone = tone;
    side.status.classList.remove('bump');
    void side.status.offsetWidth;
    side.status.classList.add('bump');
  }

  private updateStreak(player: PlayerId): void {
    const streak = this.match.players[player].streak;
    const filled = streak === 0 ? 0 : ((streak - 1) % DEVIL_STREAK) + 1;
    this.sides[player].pips.forEach((pip, i) => pip.classList.toggle('on', i < filled));
    this.sides[player].zone.querySelector('.streak')?.classList.toggle('hot', filled >= DEVIL_STREAK - 2);
  }

  private updateTerritory(): void {
    const b = this.match.board;
    for (const id of this.ids) {
      const share = b.share(id);
      this.bars.get(id)!.style.width = `${share}%`;
      this.sides[id].share.textContent = `${Math.round(share)}%`;
    }
  }

  private updateTimers(now: number): void {
    for (const id of this.ids) {
      const left = this.match.players[id].inputTimeLeft(now);
      const fill = this.sides[id].timerFill;
      fill.style.transform = `scaleX(${left})`;
      fill.classList.toggle('low', left > 0 && left < 0.3);
    }
  }

  private updateClock(): void {
    const left = this.match.timeLeft(this.clock.now());
    if (left === null) {
      this.timeEl.textContent = '∞';
      this.timeEl.title = 'Sem limite de tempo: conquista o tabuleiro todo!';
      return;
    }
    const s = Math.ceil(left);
    const hurry = this.match.rush(this.clock.now()) < 0.9;
    this.timeEl.textContent = `${hurry ? '⚡' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.timeEl.title = hurry ? 'O tempo está a acabar: as sequências aceleram!' : '';
    this.timeEl.classList.toggle('urgent', s <= 10);
  }

  private toggleMute(): void {
    synth.unlock();
    this.settings.muted = !this.settings.muted;
    synth.muted = this.settings.muted;
    this.updateMuteIcon();
  }

  private updateMuteIcon(): void {
    this.muteBtn.innerHTML = this.settings.muted ? '&#128263;' : '&#128266;';
  }

  // ---------------------------------------------------------------- sobreposições

  private hideOverlay(): void {
    this.overlay.className = 'overlay hidden';
    this.overlay.replaceChildren();
  }

  private showPause(): void {
    const resume = h('button', { class: 'btn primary' }, 'Continuar');
    const restart = h('button', { class: 'btn' }, 'Recomeçar');
    const exit = h('button', { class: 'btn' }, 'Menu');
    onClick(resume, () => this.resume());
    onClick(restart, () => this.callbacks.onRematch());
    onClick(exit, () => this.callbacks.onExit());
    this.overlay.className = 'overlay dim';
    this.overlay.replaceChildren(
      h('div', { class: 'card' }, h('h2', {}, 'Pausa'), h('div', { class: 'card-actions' }, resume, restart, exit)),
    );
  }

  /** Lugar do jogador pelo território (1 = mais território). */
  private placeOf(player: PlayerId): number {
    const mine = this.match.board.count(player);
    return 1 + this.ids.filter((id) => this.match.board.count(id) > mine).length;
  }

  private showEnd(): void {
    if (this.destroyed) return;
    const { winner, endReason } = this.match;
    synth.win();
    const panel = (player: PlayerId) => {
      const s = this.match.players[player].stats;
      const share = Math.round(this.match.board.share(player));
      const title = winner === 0 ? 'Empate!' : winner === player ? 'Ganhaste!' : 'Perdeste…';
      const place = this.placeOf(player);
      const sub =
        winner === player && endReason === 'conquest'
          ? 'Conquistaste o tabuleiro todo!'
          : endReason === 'time'
            ? `Tempo esgotado · ${share}% do tabuleiro`
            : `Ficaste com ${share}% do tabuleiro`;
      const rank = this.multi ? `${place}.º lugar · ` : '';
      return h(
        'div',
        {
          class: `result result-p${player} ${winner === player ? 'won' : winner === 0 ? 'tie' : 'lost'}`,
          style: zoneVars(playerTheme(this.settings, player)),
        },
        h('span', {
          class: 'avatar avatar-result',
          html: avatarSvg(this.settings.avatars[player], winner === player ? 'happy' : winner === 0 ? 'normal' : 'dizzy'),
        }),
        h('div', { class: 'result-name' }, this.settings.avatars[player].name),
        h('div', { class: 'result-title' }, title),
        h('div', { class: 'result-sub' }, rank + sub),
        h(
          'dl',
          { class: 'stats' },
          h('dt', {}, 'Acertos'),
          h('dd', {}, String(s.successes)),
          h('dt', {}, 'Erros'),
          h('dd', {}, String(s.errors)),
          h('dt', {}, 'Maior sequência'),
          h('dd', {}, String(s.bestLength)),
          h('dt', {}, 'Melhor série'),
          h('dd', {}, String(s.bestStreak)),
          h('dt', {}, 'Diabinhos'),
          h('dd', {}, `${s.devilsSent} enviados · ${s.devilsReceived} recebidos`),
        ),
      );
    };
    const rematch = h('button', { class: 'btn primary' }, 'Revanche');
    const exit = h('button', { class: 'btn' }, 'Menu');
    onClick(rematch, () => this.callbacks.onRematch());
    onClick(exit, () => this.callbacks.onExit());
    this.overlay.className = `overlay dim end${!this.multi && this.settings.rotateP2 ? ' rotate-p2' : ''}`;
    this.overlay.replaceChildren(
      ...this.ids.map((id) => h('div', { class: `zone-p${id} end-zone` }, h('div', { class: 'zone-inner' }, panel(id)))),
      h('div', { class: 'mid end-mid' }, rematch, exit),
    );
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Sem vibração disponível.
  }
}
