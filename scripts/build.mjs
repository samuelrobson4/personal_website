import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const isWatch = process.argv.includes('--watch');

const entry = resolve(root, 'web', 'main.tsx');
mkdirSync(resolve(root, 'dist'), { recursive: true });

const common = {
  entryPoints: [entry],
  bundle: true,
  outfile: resolve(root, 'dist', 'bundle.js'),
  platform: 'browser',
  sourcemap: true,
  target: ['es2020'],
  loader: { '.png': 'file' },
};

if (isWatch) {
  const ctx = await context(common);
  await ctx.watch();
  console.log('esbuild watching...');
} else {
  await build(common);
  console.log('built dist/bundle.js');
  // Add a cache-busting version query to asset URLs in HTML files
  try {
    const version = (process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 8) : String(Date.now()));
    const files = ['index.html', 'about.html', 'projects.html', 'blog.html', 'contact.html'];
    const patterns = [
      [/href="styles\.css(\?v=[^"]+)?"/g, (m) => `href="styles.css?v=${version}"`],
      [/src="dist\/bundle\.js(\?v=[^"]+)?"/g, (m) => `src="dist/bundle.js?v=${version}"`],
      [/src="hs-scroller-gsap\.js(\?v=[^"]+)?"/g, (m) => `src="hs-scroller-gsap.js?v=${version}"`],
      [/src="lib\/gsap\/gsap\.min\.js(\?v=[^"]+)?"/g, () => `src="lib/gsap/gsap.min.js?v=${version}"`],
      [/src="lib\/gsap\/ScrollTrigger\.min\.js(\?v=[^"]+)?"/g, () => `src="lib/gsap/ScrollTrigger.min.js?v=${version}"`],
    ];
    for (const f of files) {
      const p = resolve(root, f);
      let html = readFileSync(p, 'utf8');
      for (const [rx, repl] of patterns) html = html.replace(rx, repl);
      writeFileSync(p, html);
    }
    console.log('updated HTML asset URLs with version', version);
  } catch (e) {
    console.warn('versioning step skipped:', e?.message || e);
  }
}


