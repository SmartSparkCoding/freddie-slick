// A "Keep me unmuted" row inside the huddle's mic menu and its settings menu.
// Slack owns both menus and renames their components between releases, so this
// watches menus open, works out which one it is from the button that opened it
// (falling back to the row labels) and clones one of Slack's own rows, which
// keeps the styling without depending on any private component name.

export type MenuKind = 'mic' | 'settings' | null;

const MIC_WORD = /mic(rophone)?\b|input device|audio input/i;
const NOT_MIC = /camera|video|screen|output|speaker|headphone|volume/i;
const SETTINGS_WORD = /settings|preferences|gear|cog|options/i;
// Host controls that must never be confused with the local toggle.
const NOT_LOCAL = /everyone|others|participants?\b|huddle settings for/i;

/**
 * Which menu this is, from the button that opened it and, failing that, what it
 * offers. Null means leave it alone.
 */
export function menuKind(triggerWords: string, itemLabels: readonly string[]): MenuKind {
  const trigger = triggerWords.trim();
  if (trigger && !NOT_LOCAL.test(trigger)) {
    if (MIC_WORD.test(trigger) && !NOT_MIC.test(trigger)) return 'mic';
    if (SETTINGS_WORD.test(trigger)) return 'settings';
  }
  const labels = itemLabels.join(' | ');
  if (MIC_WORD.test(labels) && !NOT_MIC.test(labels) && !NOT_LOCAL.test(labels)) return 'mic';
  if (/\b(huddle|call) settings\b/i.test(labels)) return 'settings';
  return null;
}

const MENU = '[role="menu"]';
const ITEM = '[role="menuitem"], [role="menuitemcheckbox"]';
const MARK = 'data-slick-mic-guard';
const CHECK =
  '<path d="M4 10.5 8 14.5 16 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';

const squish = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

/** Words that describe the control that opened a menu, e.g. "Microphone" or "Huddle settings". */
export function describeTrigger(element: Element | null): string {
  const parts: string[] = [];
  for (let node = element, depth = 0; node && depth < 4; node = node.parentElement, depth += 1) {
    for (const value of [
      node.getAttribute('aria-label'),
      node.getAttribute('title'),
      node.getAttribute('data-qa'),
      node.getAttribute('name'),
    ]) {
      if (value) parts.push(value);
    }
    const own = squish([...node.childNodes].filter((child) => child.nodeType === 3).length ? node.textContent : '');
    if (own) parts.push(own);
    if (parts.length > 6) break;
  }
  return [...new Set(parts)].join(' ');
}

function labelsOf(menu: Element): string[] {
  return [...menu.querySelectorAll(ITEM)]
    .filter((item) => !item.hasAttribute(MARK))
    .map((item) => squish(item.textContent))
    .filter(Boolean);
}

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
  let target: Text | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (squish(node.textContent)) target = node as Text;
  }
  if (target) target.textContent = label;
  else row.append(label);
}

export type MenuToggleState = {
  label: string;
  isOn: () => boolean;
  onToggle: (next: boolean) => void;
  log: (...args: unknown[]) => void;
};

function buildRow(sample: HTMLElement, label: string): HTMLElement {
  const row = sample.cloneNode(true) as HTMLElement;
  for (const attribute of ['data-qa', 'id', 'aria-controls', 'aria-haspopup', 'aria-expanded', 'aria-checked'])
    row.removeAttribute(attribute);
  row.setAttribute(MARK, '');
  row.setAttribute('role', 'menuitemcheckbox');
  row.setAttribute('tabindex', '-1');
  row.setAttribute('aria-label', label);
  for (const extra of row.querySelectorAll('[class*="shortcut" i], [class*="hotkey" i], [class*="check" i]'))
    extra.remove();
  const icon = row.querySelector('svg');
  if (icon) {
    // Keep the size attributes the cloned icon came with; Slack usually sizes by
    // CSS, but a menu that sets width/height visibly collapses without them.
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.innerHTML = CHECK;
  }
  rename(row, label);
  return row;
}

function paint(row: HTMLElement, on: boolean): void {
  row.setAttribute('aria-checked', on ? 'true' : 'false');
  const icon = row.querySelector('svg');
  if (icon) icon.style.opacity = on ? '1' : '0';
  row.title = on ? 'Someone mutes you, you get unmuted again' : 'Mic Guard will let a mute stick';
}

/** Watches one document for huddle menus. */
export function installMenuToggle(
  doc: Document,
  options: MenuToggleState,
): { dispose: () => void; refresh: () => void } {
  let trigger: Element | null = null;
  let frame: number | null = null;

  const remember = (event: Event) => {
    const target = event.target;
    if (!(target instanceof doc.defaultView!.Element)) return;
    if (target.closest(MENU)) return;
    trigger = target;
  };

  const inject = (menu: Element): void => {
    const existing = menu.querySelector<HTMLElement>(`[${MARK}]`);
    if (existing) {
      paint(existing, options.isOn());
      return;
    }
    const rows = [...menu.querySelectorAll<HTMLElement>(ITEM)].filter((item) => !item.hasAttribute(MARK));
    const sample = rows[rows.length - 1];
    if (!sample) return;
    const kind = menuKind(describeTrigger(trigger), labelsOf(menu));
    if (!kind) {
      if (options.isOn()) options.log('left a menu alone; rows were:', labelsOf(menu).slice(0, 8));
      return;
    }
    const row = buildRow(sample, options.label);
    paint(row, options.isOn());
    const pick = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const next = !options.isOn();
      options.onToggle(next);
      // React may re-render the row away; paint this copy straight away and let
      // the next sweep re-add it if it disappears.
      paint(row, next);
    };
    row.addEventListener('click', pick, true);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') pick(event);
    });
    sample.parentElement?.append(row);
    options.log(`added the toggle to the ${kind} menu`);
  };

  const sweep = (): void => {
    frame = null;
    for (const menu of doc.querySelectorAll(MENU)) inject(menu);
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

  return {
    refresh() {
      for (const row of doc.querySelectorAll<HTMLElement>(`[${MARK}]`)) paint(row, options.isOn());
    },
    dispose() {
      observer.disconnect();
      if (frame !== null) doc.defaultView?.cancelAnimationFrame(frame);
      doc.removeEventListener('pointerdown', remember, true);
      doc.removeEventListener('click', remember, true);
      doc.removeEventListener('keydown', remember, true);
      for (const row of doc.querySelectorAll(`[${MARK}]`)) row.remove();
    },
  };
}
