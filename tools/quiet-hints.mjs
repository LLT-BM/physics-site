/* LibLabTab · убирает hints из astro check.
   node tools/quiet-hints.mjs — идемпотентно. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/* 1. Служебные Node-скрипты не должны проверяться как код сайта. */
const TSC = 'tsconfig.json';
const tsNext = {
  extends: 'astro/tsconfigs/strict',
  include: ['.astro/types.d.ts', 'src/**/*'],
  exclude: ['dist', 'node_modules', 'tools', 'public'],
  compilerOptions: { strictNullChecks: true, allowJs: false, verbatimModuleSyntax: false }
};
const tsCur = existsSync(TSC) ? readFileSync(TSC, 'utf8') : '';
const tsWant = JSON.stringify(tsNext, null, 2) + '\n';
if (tsCur !== tsWant) { writeFileSync(TSC, tsWant, 'utf8'); console.log('[fix] tsconfig.json → tools/ и public/ исключены, allowJs=false'); }
else console.log('[ok ] tsconfig.json');

/* 2. Канонический источник z: astro/zod, если он есть в установленной версии. */
const P = 'src/content.config.ts';
if (existsSync(P)) {
  let src = readFileSync(P, 'utf8');
  let zodPath = null;
  try { await import('astro/zod'); zodPath = 'astro/zod'; } catch { zodPath = null; }
  if (zodPath && /import\s*\{\s*defineCollection\s*,\s*z\s*\}\s*from\s*['"]astro:content['"]/.test(src)) {
    src = src.replace(
      /import\s*\{\s*defineCollection\s*,\s*z\s*\}\s*from\s*['"]astro:content['"];?/,
      "import { defineCollection } from 'astro:content';\nimport { z } from 'astro/zod';"
    );
    writeFileSync(P, src, 'utf8');
    console.log('[fix] content.config.ts → z импортируется из astro/zod');
  } else if (!zodPath) {
    console.log('[ok ] content.config.ts — astro/zod в этой версии нет, реэкспорт оставлен (hints безвредны)');
  } else {
    console.log('[ok ] content.config.ts');
  }
}