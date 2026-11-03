import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Expo Router turns every file under src/app into a route, so a test there ships in the web export.
test('no test file lives in the route tree', () => {
  const root = join(__dirname, 'app');
  const found = (readdirSync(root, { recursive: true }) as string[]).filter((file) => /\.(test|spec)\.[jt]sx?$/.test(file));
  expect(found).toEqual([]);
});
