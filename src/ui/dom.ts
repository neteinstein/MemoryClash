type Attrs = Record<string, string | number | boolean | undefined | null | EventListener>;
type Child = Node | string | null | undefined | false;

/** Pequeno ajudante para criar elementos DOM sem framework. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      el.className = String(value);
    } else if (key === 'html') {
      el.innerHTML = String(value);
    } else if (key === 'style') {
      el.setAttribute('style', String(value));
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/** Ativa no primeiro toque (pointerdown) e evita o atraso/zoom dos cliques em telemóvel. */
export function onTap(el: HTMLElement, handler: (e: PointerEvent) => void): void {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handler(e);
  });
}

/** Para botões de menu: o `click` conta como gesto do utilizador (necessário para ativar o som em ecrãs tácteis). */
export function onClick(el: HTMLElement, handler: (e: MouseEvent) => void): void {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    handler(e);
  });
}

export const isPortrait = (): boolean => window.matchMedia('(orientation: portrait)').matches;
