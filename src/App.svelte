<script lang="ts">
  import plugins from './plugins.json';

  const base = typeof location === 'undefined' ? '' : location.origin;
  let copied = $state<string | null>(null);

  async function copy(file: string) {
    await navigator.clipboard.writeText(`${base}/plugins/${file}`);
    copied = file;
    setTimeout(() => copied === file && (copied = null), 1500);
  }
</script>

<main>
  <header>
    <h1>Slick plugins</h1>
    <p>
      Plugins for <a href="https://github.com/3kh0/slick">Slick</a>, made by
      <a href="https://freddieyershon.co.uk">Freddie</a>. Copy a link and install it from Slick, and it
      keeps itself up to date.
    </p>
  </header>

  <section aria-labelledby="plugins">
    <h2 id="plugins">Plugins</h2>
    <ul>
      {#each plugins as plugin (plugin.id)}
        <li>
          <div class="info">
            <h3>{plugin.name}</h3>
            <p>{plugin.description}</p>
          </div>
          <div class="actions">
            <button onclick={() => copy(plugin.file)}>
              {copied === plugin.file ? 'Copied' : 'Copy link'}
            </button>
            <a href="/plugins/{plugin.file}" download>{plugin.file}</a>
            <a href="/plugins/{plugin.userFile}">Userscript</a>
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="install">
    <h2 id="install">Install</h2>
    <ol>
      <li>In Slack, open <b>Preferences → Install plugins</b>.</li>
      <li>Paste the link and press <b>Install from URL</b>.</li>
      <li>Turn the plugin on. Its settings are under the cog.</li>
    </ol>
    <p class="muted">
      Plugins installed from a link update themselves every few hours. You can also download the
      <code>.js</code> and choose it under <b>From a file</b> instead, but it won't update itself. Using
      Slack in a browser? The userscript works in Violentmonkey.
    </p>
  </section>

  <section aria-labelledby="source">
    <h2 id="source">Source code</h2>
    <p>
      The code is open source under the MIT License, so anyone can read it, change it and build on it.
      It's on GitHub at
      <a href="https://github.com/hippogriff101/freddie-slick">hippogriff101/freddie-slick</a>.
    </p>
  </section>

  <section aria-labelledby="local">
    <h2 id="local">Run it yourself</h2>
    <ol>
      <li>
        Clone and build it (you'll need <a href="https://nodejs.org">Node.js</a>):
        <pre><code>git clone https://github.com/hippogriff101/freddie-slick.git
cd freddie-slick
npm install
npm run plugins</code></pre>
      </li>
      <li>In Slack, open <b>Preferences → Install plugins</b>.</li>
      <li>Under <b>From a file</b>, press <b>Choose File…</b> and pick a plugin from <code>freddie-slick/public/plugins/</code>, such as <code>ClubLeader.js</code>.</li>
      <li>Turn the plugin on. Its settings are under the cog.</li>
    </ol>
    <p class="muted">
      Plugins installed from a file don't update themselves. Pull the latest code, run
      <code>npm run plugins</code> and choose the file again.
    </p>
  </section>

  <footer class="muted">
    <p>
      <a href="https://github.com/3kh0/slick">Slick</a> is made and maintained by
      <a href="https://github.com/3kh0">@3kh0</a>. These plugins aren't made by or affiliated with Slack
      or Salesforce.
    </p>
    <p>
      © 2026 Freddie Yershon. Released under the
      <a href="https://github.com/hippogriff101/freddie-slick/blob/main/LICENSE">MIT License</a>.
    </p>
  </footer>
</main>

<style>
  main {
    max-width: 680px;
    margin: 0 auto;
    padding: 56px 16px 40px;
  }
  h1 {
    font-size: 2rem;
    margin: 0 0 8px;
    letter-spacing: -0.02em;
  }
  h1::before {
    content: '♣';
    color: var(--accent);
    margin-right: 10px;
  }
  header p { margin: 0; color: var(--muted); }
  h2 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin: 44px 0 12px;
  }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  li {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 18px;
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
  }
  h3 { margin: 0 0 2px; font-size: 1.05rem; }
  .info { flex: 1 1 260px; min-width: 0; }
  .info p { margin: 0; color: var(--muted); font-size: 0.95rem; }
  .actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 0.9rem; }
  .actions a { color: var(--muted); }
  .actions a:hover { color: var(--fg); }
  button {
    font: inherit;
    font-weight: 600;
    border: 0;
    border-radius: 8px;
    padding: 8px 14px;
    min-width: 96px;
    background: var(--accent);
    color: var(--accent-fg);
    cursor: pointer;
  }
  button:hover { filter: brightness(1.08); }
  button:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
  ol { padding-left: 20px; margin: 0 0 12px; }
  ol li {
    display: list-item;
    background: none;
    border: 0;
    padding: 2px 0;
  }
  .muted { color: var(--muted); font-size: 0.92rem; }
  section > p { margin: 0 0 12px; }
  pre {
    margin: 8px 0 4px;
    padding: 12px 14px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow-x: auto;
  }
  pre code { background: none; padding: 0; line-height: 1.6; }
  footer { margin-top: 48px; border-top: 1px solid var(--line); padding-top: 16px; }
  footer p { margin: 0 0 6px; }
</style>
