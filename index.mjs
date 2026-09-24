import { appendFile, readFile } from 'node:fs/promises';
import { install } from './installer.mjs';

try {
  const manifest = JSON.parse(await readFile(new URL('./releases.json', import.meta.url), 'utf8'));
  const version = process.env.INPUT_VERSION?.trim() || '0.4.0-rc.2';
  if (!process.env.RUNNER_TEMP || !process.env.GITHUB_PATH || !process.env.GITHUB_OUTPUT) throw new Error('GitHub Actions runner environment is required');
  const result = await install({ version, manifest, root: process.env.RUNNER_TEMP });
  if (/[\r\n]/.test(result.directory + result.binary)) throw new Error('Invalid installation path');
  await appendFile(process.env.GITHUB_PATH, `${result.directory}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `version=${result.version}\npath=${result.binary}\n`);
  console.log(`Installed Pulse CLI ${result.version} for ${process.platform}/${process.arch}`);
} catch (error) {
  console.error(`Pulse setup failed: ${error.message}`);
  process.exitCode = 1;
}
