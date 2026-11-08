// Owns the popped-out window: a bare page with one video element mirroring the
// tile's MediaStream. Slack keeps decoding the stream, the window is just a
// second view of it, so the call is untouched.

export type PopOutSize = 'medium' | 'large' | 'huge' | 'fill';

export type PopOutOptions = {
  title: string;
  size: PopOutSize;
  muted: boolean;
  closeWhenVideoEnds: boolean;
  onClose: () => void;
};

export type PopOutHandle = {
  readonly closed: boolean;
  focus: () => void;
  close: () => void;
};

const SIZES: Record<Exclude<PopOutSize, 'fill'>, [number, number]> = {
  medium: [960, 540],
  large: [1280, 720],
  huge: [1600, 900],
};
const MARGIN = 40;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 180;
// Cameras drop their stream briefly while renegotiating, so a missing stream
// only closes the window once it has stayed missing.
const EMPTY_GRACE = 3000;
const TICK = 250;

const CSS = `
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; overflow: hidden; }
  body { background: #000; color: #fff; font: 13px/1.4 -apple-system, "Segoe UI", Roboto, sans-serif; }
  video { display: block; width: 100%; height: 100%; object-fit: contain; background: #000; }
  .note { position: absolute; inset: 0; display: grid; place-items: center; color: #ffffff8a; font-size: 15px; }
  .note[hidden] { display: none; }
  .bar {
    position: absolute; inset: auto 0 0 0; display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; background: linear-gradient(to top, #000000d9, #0000);
    opacity: 0; transition: opacity 120ms ease;
  }
  body:hover .bar, .bar:focus-within { opacity: 1; }
  .title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .spacer { flex: 1; }
  button {
    font: inherit; color: #fff; background: #ffffff1f; border: 1px solid #ffffff2e;
    border-radius: 6px; padding: 4px 10px; cursor: pointer;
  }
  button:hover { background: #ffffff33; }
`;

const BODY = `
<video autoplay playsinline muted></video>
<div class="note" hidden>Camera off</div>
<div class="bar">
  <span class="title"></span>
  <span class="spacer"></span>
  <button type="button" data-act="audio"></button>
  <button type="button" data-act="fullscreen">Fullscreen</button>
  <button type="button" data-act="close">Close</button>
</div>`;

function features(size: PopOutSize): string {
  const [width, height] =
    size === 'fill'
      ? [Math.max(MIN_WIDTH, screen.availWidth - MARGIN * 2), Math.max(MIN_HEIGHT, screen.availHeight - MARGIN * 2)]
      : SIZES[size];
  const left = Math.max(0, Math.round((screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((screen.availHeight - height) / 2));
  return [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=no',
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
  ].join(',');
}

export function openPopOut(source: HTMLVideoElement, options: PopOutOptions): PopOutHandle | null {
  const popup = window.open('', `slick-pop-out-${Date.now()}`, features(options.size));
  if (!popup) return null;
  const doc = popup.document;
  doc.head.innerHTML = `<meta charset="utf-8"><style>${CSS}</style>`;
  doc.body.innerHTML = BODY;
  doc.title = options.title;

  const video = doc.querySelector('video');
  const note = doc.querySelector<HTMLElement>('.note');
  const title = doc.querySelector<HTMLElement>('.title');
  const audio = doc.querySelector<HTMLButtonElement>('[data-act="audio"]');
  if (!video || !note || !title || !audio) {
    popup.close();
    return null;
  }
  title.textContent = options.title;

  const showAudio = () => {
    audio.textContent = video.muted ? 'Unmute' : 'Mute';
    audio.title = `${audio.textContent} (m)`;
  };
  video.muted = options.muted;
  showAudio();

  const mirror = () => {
    const stream = source.srcObject;
    if (stream === video.srcObject) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
  };
  mirror();
  video.addEventListener('loadedmetadata', () => void video.play().catch(() => {}));

  const audio_ = () => {
    video.muted = !video.muted;
    showAudio();
  };
  const fullscreen = () => {
    if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
    else void doc.documentElement.requestFullscreen?.().catch(() => {});
  };

  audio.addEventListener('click', audio_);
  doc.querySelector('[data-act="fullscreen"]')?.addEventListener('click', fullscreen);
  doc.querySelector('[data-act="close"]')?.addEventListener('click', () => popup.close());
  video.addEventListener('dblclick', fullscreen);
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') popup.close();
    else if (event.key === 'm' || event.key === 'M') audio_();
    else if (event.key === 'f' || event.key === 'F') fullscreen();
  });

  let emptyFor = 0;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    video.srcObject = null;
    options.onClose();
  };

  const timer = setInterval(() => {
    if (popup.closed) {
      stop();
      return;
    }
    const stream = source.srcObject;
    mirror();
    note.hidden = Boolean(stream);
    if (stream && source.isConnected) {
      emptyFor = 0;
      return;
    }
    if (!options.closeWhenVideoEnds) return;
    emptyFor += TICK;
    if (emptyFor >= EMPTY_GRACE) popup.close();
  }, TICK);

  mirror();
  popup.focus();
  return {
    get closed() {
      return popup.closed;
    },
    focus: () => popup.focus(),
    close: () => {
      if (!popup.closed) popup.close();
      stop();
    },
  };
}
