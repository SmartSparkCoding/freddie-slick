// Fetches the repo's GitHub contributors into src/contributors.json for the site.
// Runs at build time, so visitors never call GitHub. If GitHub can't be reached
// (or rate-limits the build), the committed file is kept as it is.
// Set GITHUB_TOKEN to raise GitHub's limit from 60 to 5000 requests an hour.

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPO = 'hippogriff101/freddie-slick';
const OUT = path.join(import.meta.dirname, '..', 'src', 'contributors.json');

type GitHubContributor = { login: string; avatar_url: string; html_url: string; contributions: number; type: string };
export type Contributor = { login: string; avatar: string; url: string; contributions: number };

async function main() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'freddie-slick-site-build',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=100`, { headers });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const list = (await response.json()) as GitHubContributor[];

  const contributors: Contributor[] = list
    .filter((person) => person.type !== 'Bot' && !person.login.endsWith('[bot]'))
    .map((person) => ({
      login: person.login,
      avatar: `${person.avatar_url}${person.avatar_url.includes('?') ? '&' : '?'}s=96`,
      url: person.html_url,
      contributions: person.contributions,
    }));

  await writeFile(OUT, JSON.stringify(contributors, null, 2) + '\n');
  console.log(`[contributors] ${contributors.length} contributor${contributors.length === 1 ? '' : 's'}`);
}

try {
  await main();
} catch (error) {
  // A failed fetch shouldn't fail the whole site build.
  if (!existsSync(OUT)) await writeFile(OUT, '[]\n');
  console.warn(`[contributors] kept the existing list: ${error instanceof Error ? error.message : error}`);
}
