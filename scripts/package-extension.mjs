import { mkdir, rm, readFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/', root), { recursive: true });
for (const [browser, directory] of [['chromium', 'dist'], ['firefox', 'dist-firefox']]) {
  const source = new URL(`apps/extension/${directory}/`, root);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', source), 'utf8'));
  if (manifest.manifest_version !== 3) throw new Error(`Invalid ${browser} manifest`);
  for (const name of ['COPYING', 'AUTHORS']) await copyFile(new URL(name, root), new URL(name, source));
  const archive = new URL(`dist/${browser}-release.zip`, root);
  await rm(archive, { force: true });
  execFileSync('zip', ['-qr', fileURLToPath(archive), '.'], { cwd: fileURLToPath(source), stdio: 'inherit' });
}
