/** O diabinho: desenho em SVG e animações de voo entre os jogadores. */

export const DEVIL_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M24 40 C9 26 11 9 18 3 C20 17 29 25 38 30 Z" fill="#7f1d1d"/>
  <path d="M76 40 C91 26 89 9 82 3 C80 17 71 25 62 30 Z" fill="#7f1d1d"/>
  <circle cx="50" cy="57" r="35" fill="#dc2626"/>
  <ellipse cx="40" cy="38" rx="14" ry="7" fill="#f87171" opacity=".45"/>
  <path d="M27 45 L44 52" stroke="#450a0a" stroke-width="5" stroke-linecap="round"/>
  <path d="M73 45 L56 52" stroke="#450a0a" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="38" cy="58" rx="6.5" ry="7.5" fill="#fff"/>
  <ellipse cx="62" cy="58" rx="6.5" ry="7.5" fill="#fff"/>
  <circle cx="40" cy="60" r="3.6" fill="#111"/>
  <circle cx="60" cy="60" r="3.6" fill="#111"/>
  <path d="M30 71 Q50 92 70 71 Q50 80 30 71 Z" fill="#450a0a"/>
  <path d="M39 74 L42.5 82 L46 75.5 Z" fill="#fff"/>
  <path d="M54 75.5 L57.5 82 L61 74 Z" fill="#fff"/>
</svg>`;

export function devilElement(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = DEVIL_SVG;
  return el;
}

function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Faz o diabinho aparecer sobre o teclado de quem o ganhou e voar até ao teclado do adversário.
 * Resolve quando aterra.
 */
export function flyDevil(layer: HTMLElement, from: Element, to: Element, durationMs: number): Promise<void> {
  const a = centerOf(from);
  const b = centerOf(to);
  const el = devilElement('devil-fly');
  layer.append(el);
  const size = Math.min(140, Math.max(80, Math.min(window.innerWidth, window.innerHeight) * 0.22));
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  const at = (p: { x: number; y: number }, extra = '') =>
    `translate(${p.x - size / 2}px, ${p.y - size / 2}px) ${extra}`;
  const mid = { x: (a.x + b.x) / 2 + (b.y - a.y) * 0.25, y: (a.y + b.y) / 2 + (a.x - b.x) * 0.25 };
  const anim = el.animate(
    [
      { transform: at(a, 'scale(0) rotate(-30deg)'), opacity: 0, offset: 0 },
      { transform: at(a, 'scale(1.35) rotate(10deg)'), opacity: 1, offset: 0.18 },
      { transform: at(a, 'scale(1.1) rotate(-8deg)'), opacity: 1, offset: 0.3 },
      { transform: at(a, 'scale(1.2) rotate(8deg)'), opacity: 1, offset: 0.42 },
      { transform: at(mid, 'scale(1) rotate(200deg)'), opacity: 1, offset: 0.7 },
      { transform: at(b, 'scale(0.55) rotate(360deg)'), opacity: 1, offset: 1 },
    ],
    { duration: durationMs, easing: 'ease-in-out', fill: 'forwards' },
  );
  return anim.finished
    .catch(() => undefined)
    .then(() => {
      el.remove();
    });
}

/** Pequena nuvem de fumo quando a maldição termina. */
export function poof(el: HTMLElement): void {
  const anim = el.animate(
    [
      { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' },
      { transform: 'scale(1.6)', opacity: 0, filter: 'blur(6px)' },
    ],
    { duration: 450, easing: 'ease-out', fill: 'forwards' },
  );
  anim.finished.catch(() => undefined).then(() => el.remove());
}
