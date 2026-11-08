// Adds an item to the menu Slack opens over a participant's video. Slack owns
// that menu and renames its component whenever it feels like it, so instead of
// patching a component this watches for menus opening and drops a clone of one
// of their own rows in, which keeps Slack's styling for free.

import { videoFromTrigger } from './tiles.ts';

export type MenuHookOptions = {
  label: string;
  onPick: (video: HTMLVideoElement) => void;
  log: (...args: unknown[]) => void;
};

const MENU = '[role="menu"]';
const ITEM = '[role="menuitem"]';
const MARK = 'data-slick-pop-out';
const ICON =
  '<path d="M3.5 4.5h5v1.75H5.25v9.5h9.5V12h1.75v4.25a1.75 1.75 0 0 1-1.75 1.75h-9.5A1.75 1.75 0 0 1 3.5 16.25z"/>' +
  '<path d="M12 3.5h4.5V8h-1.75V6.49l-4.4 4.39-1.23-1.23 4.39-4.4H12z"/>';

const squish = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

/** The leaf that holds the whole row's text, so its icon and layout survive a rename. */
function labelNode(row: Element): Element | null {
  const whole = squish(row.textContent);
  if (!whole) return null;
  let match: Element | null = null;
  for (const child of row.querySelectorAll('*')) {
    if (child.children.length === 0 && squish(child.textContent) === whole) match = child;
  }
  return match;
}

/** Renames a cloned row without destroying the icon beside its text. */
function rename(row: Element, label: string): void {
  const leaf = labelNode(row);
  if (leaf) {
    leaf.textContent = label;
    return;
  }
  // Some menus keep the text in a bare text node rather than a span; the last
  // one with words in it is the label.
  const view = row.ownerDocument.defaultView;
  if (!view) return;
  const walker = row.ownerDocument.createTreeWalker(row, view.NodeFilter.SHOW_TEXT);
  let target: Node | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (squish(node.textContent)) target = node;
  }
  if (target) target.textContent = label;
  else row.append(label);
}

function buildItem(sample: HTMLElement, label: string): HTMLElement {
  const item = sample.cloneNode(true) as HTMLElement;
  for (const attribute of ['data-qa', 'id', 'aria-controls', 'aria-haspopup', 'aria-expanded', 'aria-checked'])
    item.removeAttribute(attribute);
  item.setAttribute(MARK, '');
  item.setAttribute('role', 'menuitem');
  item.setAttribute('tabindex', '-1');
  item.setAttribute('aria-label', label);

  // Shortcut hints, checkmarks and badges belong to the action we cloned.
  for (const extra of item.querySelectorAll('[class*="shortcut" i], [class*="hotkey" i], [class*="check" i]'))
    extra.remove();

  const icon = item.querySelector('svg');
  if (icon) {
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.removeAttribute('width');
    icon.removeAttribute('height');
    icon.innerHTML = ICON;
  }

  rename(item, label);
  return item;
}

function closeMenu(menu: Element): void {
  for (const type of ['keydown', 'keyup'] as const)
    menu.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', bubbles: true }));
  // A menu that ignores Escape would otherwise sit over the new window. Hidden
  // rather than removed, because React owns the node and deleting a child it
  // still holds throws.
  setTimeout(() => {
    (menu as HTMLElement).style.display = 'none';
  }, 150);
}

/** Watches one document. Returns a disposer. */
export function installMenuHook(doc: Document, { label, onPick, log }: MenuHookOptions): () => void {
  let trigger: Element | null = null;
  let frame: number | null = null;

  // Remember what opened the menu. Anything inside an already open menu is our
  // own row, and remembering that would lose the tile it belongs to.
  const remember = (event: Event) => {
    const target = event.target;
    if (!(target instanceof doc.defaultView!.Element)) return;
    if (target.closest(MENU)) return;
    trigger = target;
  };

  const injection = (menu: Element): void => {
    if (menu.querySelector(`[${MARK}]`)) return;
    const rows = [...menu.querySelectorAll<HTMLElement>(ITEM)];
    const sample = rows[rows.length - 1];
    if (!sample) return;
    const video = videoFromTrigger(trigger);
    if (!video) return;

    const item = buildItem(sample, label);
    const pick = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      // Re-resolve: the tile may have been recycled between opening and clicking.
      const live = videoFromTrigger(trigger);
      closeMenu(menu);
      if (live) onPick(live);
    };
    item.addEventListener('click', pick, true);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') pick(event);
    });
    sample.parentElement?.append(item);
    log('added the pop-out row to a participant menu');
  };

  const sweep = (): void => {
    frame = null;
    for (const menu of doc.querySelectorAll(MENU)) injection(menu);
  };

  const schedule = (): void => {
    if (frame !== null) return;
    frame = doc.defaultView?.requestAnimationFrame(sweep) ?? null;
    if (frame === null) sweep();
  };

  const observer = new doc.defaultView!.MutationObserver(schedule);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  doc.addEventListener('pointerdown', remember, true);
  doc.addEventListener('click', remember, true);
  doc.addEventListener('keydown', remember, true);

  return () => {
    observer.disconnect();
    if (frame !== null) doc.defaultView?.cancelAnimationFrame(frame);
    doc.removeEventListener('pointerdown', remember, true);
    doc.removeEventListener('click', remember, true);
    doc.removeEventListener('keydown', remember, true);
    for (const item of doc.querySelectorAll(`[${MARK}]`)) item.remove();
  };
}
