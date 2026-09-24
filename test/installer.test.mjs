import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { download, install } from '../installer.mjs';

const contents = Buffer.from('test executable');
const artifact = { url: 'https://github.com/example/release', sha256: createHash('sha256').update(contents).digest('hex') };
const manifest = { '1.2.3': { artifacts: { 'linux-amd64': artifact, 'windows-arm64': artifact } } };
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'setup-pulse-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { version: '1.2.3', manifest, root, platform: 'linux', arch: 'x64', fetchImpl: async () => new Response(contents) };
}
test('installs only verified bytes in an executable file', async t => {
  const options = await fixture(t);
  const result = await install(options);
  assert.deepEqual(await readFile(result.binary), contents);
  if (process.platform !== 'win32') assert.equal((await stat(result.binary)).mode & 0o777, 0o755);
});
test('Windows ARM64 selects the exe artifact', async t => {
  const result = await install({ ...await fixture(t), platform: 'win32', arch: 'arm64' });
  assert.equal(result.binary.endsWith('pulse.exe'), true);
});
test('rejects tampering and removes downloaded content', async t => {
  const options = { ...await fixture(t), fetchImpl: async () => new Response('tampered') };
  await assert.rejects(install(options), /checksum mismatch/);
  assert.deepEqual(await readdir(options.root), []);
});
test('rejects unsupported versions and architectures before downloading', async t => {
  const options = { ...await fixture(t), fetchImpl: async () => { throw new Error('must not download'); } };
  await assert.rejects(install({ ...options, version: '../../latest' }), /Unsupported CLI version/);
  await assert.rejects(install({ ...options, version: 'toString' }), /Unsupported CLI version/);
  await assert.rejects(install({ ...options, arch: 'ia32' }), /Unsupported platform/);
});
test('HTTP failures clean the installation directory', async t => {
  const options = { ...await fixture(t), fetchImpl: async () => new Response('missing', { status: 404 }) };
  await assert.rejects(install(options), /HTTP 404/);
  assert.deepEqual(await readdir(options.root), []);
});
test('allows HTTPS redirects but refuses protocol downgrade', async () => {
  let calls = 0;
  const response = await download(artifact.url, async () => ++calls === 1 ? new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/example' } }) : new Response(contents));
  assert.equal(await response.text(), contents.toString());
  await assert.rejects(download(artifact.url, async () => new Response(null, { status: 302, headers: { location: 'http://example.com' } })), /HTTPS/);
});
test('bounds redirect chains', async () => {
  await assert.rejects(download(artifact.url, async () => new Response(null, { status: 302, headers: { location: artifact.url } })), /Too many/);
});
