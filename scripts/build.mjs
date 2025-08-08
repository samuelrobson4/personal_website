import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
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
  // Copy static assets used by pages if any are needed here later
}


