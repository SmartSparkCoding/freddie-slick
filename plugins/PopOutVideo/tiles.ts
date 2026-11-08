// Participant tiles and their overflow menus are Slack internals with no stable
// name, so everything here works off the DOM: walk up from whatever was clicked
// until an ancestor holds a video, and read the name from that tile.

/** Deep enough for Slack's tile wrappers, shallow enough to stop before the grid. */
const MAX_TILE_DEPTH = 16;
const MAX_NAME_DEPTH = 8;
const NAME_LIMIT = 48;

const isElement = (value: unknown): value is Element =>
  typeof value === 'object' && value !== null && (value as Node).nodeType === 1;

const squish = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

/** The video in the tile this click came from, or null if it is not a tile. */
export function videoFromTrigger(trigger: Element | null): HTMLVideoElement | null {
  let node = isElement(trigger) ? trigger : null;
  for (let depth = 0; node && depth < MAX_TILE_DEPTH; depth += 1, node = node.parentElement) {
    const videos = node.querySelectorAll('video');
    // A wrapper around several participants is the grid, not a tile. Popping out
    // whichever video came first would be a coin flip, so give up instead.
    if (videos.length > 1) return null;
    if (videos.length === 1) return videos[0] as HTMLVideoElement;
  }
  return null;
}

/** Best-effort participant name for the window title. */
export function nameFor(video: HTMLVideoElement): string {
  let node: Element | null = video.parentElement;
  for (let depth = 0; node && depth < MAX_NAME_DEPTH; depth += 1, node = node.parentElement) {
    const named = squish(node.querySelector('[data-qa*="name" i], [class*="name" i]')?.textContent);
    if (named && named.length <= NAME_LIMIT) return named;

    const alt = squish(node.querySelector('img[alt]')?.getAttribute('alt'));
    if (alt && alt.length <= NAME_LIMIT) return alt;

    const label = squish(node.getAttribute('aria-label'));
    if (label && label.length <= NAME_LIMIT) return label;
  }
  return 'Participant';
}
