import fs from 'node:fs';
import path from 'node:path';

import en from './locales/en.json';

type Tree = { [key: string]: string | Tree };

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function hasKey(tree: Tree, key: string): boolean {
  const parts = key.split('.');
  const last = parts.pop() as string;
  let node: string | Tree | undefined = tree;
  for (const part of parts) node = typeof node === 'object' ? node[part] : undefined;
  if (typeof node !== 'object') return false;
  return [last, `${last}_one`, `${last}_other`].some((k) => typeof node[k] === 'string');
}

test('every translation key used in src exists in en.json', () => {
  const used = new Set<string>();
  for (const file of sourceFiles(path.join(__dirname, '..'))) {
    const code = fs.readFileSync(file, 'utf8');
    for (const m of code.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) used.add(m[1]);
    // zod and rule messages are keys rendered later through translateError()
    for (const m of code.matchAll(/['"](validation\.[\w.]+)['"]/g)) used.add(m[1]);
  }

  if (used.size === 0) return; // Task 5 makes this strict once code uses keys
  expect([...used].filter((key) => !hasKey(en as Tree, key))).toEqual([]);
});
