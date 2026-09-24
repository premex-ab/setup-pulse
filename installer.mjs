import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

const maxBytes = 128 * 1024 * 1024;
const architectures = { x64: 'amd64', arm64: 'arm64' };
const systems = { linux: 'linux', darwin: 'darwin', win32: 'windows' };

export async function download(url, fetchImpl = fetch) {
  const signal = AbortSignal.timeout(120_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Download requires HTTPS without credentials');
    const response = await fetchImpl(url, { redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Download redirect has no location');
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
    return response;
  }
  throw new Error('Too many download redirects');
}

export async function install({ version, manifest, root, platform = process.platform, arch = process.arch, fetchImpl = fetch }) {
  if (!Object.hasOwn(manifest, version)) throw new Error(`Unsupported CLI version: ${version}. Use a version in releases.json or update the action.`);
  const target = `${systems[platform]}-${architectures[arch]}`;
  const artifact = manifest[version].artifacts[target];
  if (!artifact) throw new Error(`Unsupported platform: ${platform}/${arch}`);
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error('Invalid release checksum');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, 'pulse-'));
  const temporary = join(directory, '.download');
  const binary = join(directory, platform === 'win32' ? 'pulse.exe' : 'pulse');
  try {
    const response = await download(artifact.url, fetchImpl);
    const file = await open(temporary, 'wx', 0o600);
    const digest = createHash('sha256');
    let bytes = 0;
    try {
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > maxBytes) throw new Error('Download exceeds size limit');
        digest.update(chunk);
        // FileHandle.writeFile writes the whole chunk, including short writes.
        await file.writeFile(chunk);
      }
    } finally {
      await file.close();
    }
    if (digest.digest('hex') !== artifact.sha256) throw new Error('CLI checksum mismatch; refusing to install');
    await rename(temporary, binary);
    await chmod(binary, 0o755);
    return { version, directory, binary };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
