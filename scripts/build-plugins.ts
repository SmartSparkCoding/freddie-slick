// Builds every plugins/<Name>/index.ts(x) into a single-file Slick user plugin,
// in the same shape as Slick's own `build:plugin`: the bundle runs as CommonJS
// inside a factory pushed onto globalThis.__slickPlugins, with `$slick` supplied
// by the app. Output goes to public/plugins/, plus src/plugins.json for the site.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'plugins');
const OUT = path.join(ROOT, 'public', 'plugins');
const SITE = process.env.SITE_URL ?? 'https://slick.freddieyershon.co.uk';

type Meta = { id: string; name: string; description: string };

async function buildOne(dir: string): Promise<(Meta & { file: string; userFile: string; size: number }) | null> {
  const entry = ['index.tsx', 'index.ts'].map((f) => path.join(dir, f)).find(existsSync);
  if (!entry) return null;
  const name = path.basename(dir);

  const { outputFiles } = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    jsx: 'transform', // classic React.createElement against Slack's global React
    external: ['$slick'],
    define: { process: 'undefined' },
    logLevel: 'warning',
  });

  const code = `(globalThis.__slickPlugins ??= []).push((require) => {
var module = { exports: {} }, exports = module.exports;
${outputFiles[0].text}return module.exports.default;
});
`;
  const meta = describe(code, name);
  if (meta.id !== name) throw new Error(`${name}: folder name and plugin id (${meta.id}) must match`);

  const file = `${name}.js`;
  const userFile = `${name}.user.js`;
  const sourceURL = `\n//# sourceURL=${SITE}/plugins/${file}\n`;
  await writeFile(path.join(OUT, file), `// slick-plugin ${JSON.stringify(meta)}\n${code}${sourceURL}`);
  await writeFile(path.join(OUT, userFile), userscriptHeader(meta) + code);
  const size = Buffer.byteLength(code);
  console.log(`[plugins] ${file}  ${(size / 1024).toFixed(1)} KB`);
  return { ...meta, file, userFile, size };
}

/** Reads the class statics by running the bundle against a stub `$slick`, like Slick does. */
function describe(code: string, fallback: string): Meta {
  class SlickPlugin {}
  const queue: ((require: (name: string) => unknown) => any)[] = [];
  new Function('globalThis', 'React', code)({ __slickPlugins: queue }, undefined);
  const PluginClass = queue[0]?.(() => ({ __esModule: true, SlickPlugin }));
  const text = (value: unknown, or: string) => (typeof value === 'string' && value ? value : or);
  const id = text(PluginClass?.id, fallback);
  return { id, name: text(PluginClass?.pluginName, id), description: text(PluginClass?.description, '') };
}

function userscriptHeader({ id, name, description }: Meta) {
  const tags = [
    ['name', `Slick: ${name}`],
    ['namespace', `slick-plugin/${id}`],
    ['description', description],
    ['match', 'https://app.slack.com/client'],
    ['match', 'https://app.slack.com/client/*'],
    ['run-at', 'document-start'],
    ['inject-into', 'page'],
    ['grant', 'none'],
    ['noframes', ''],
  ];
  const lines = tags
    .filter(([key, value]) => value || key === 'noframes')
    .map(([key, value]) => `// @${key} ${value.replace(/\s+/g, ' ')}`.trimEnd());
  return `// ==UserScript==\n${lines.join('\n')}\n// ==/UserScript==\n`;
}

await mkdir(OUT, { recursive: true });
const dirs = readdirSync(SOURCE)
  .filter((name) => !name.startsWith('.') && statSync(path.join(SOURCE, name)).isDirectory())
  .sort();
const built = [];
for (const dir of dirs) {
  const result = await buildOne(path.join(SOURCE, dir));
  if (result) built.push(result);
}
await writeFile(path.join(ROOT, 'src', 'plugins.json'), JSON.stringify(built, null, 2) + '\n');
