import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const pulse = process.env.PULSE_BINARY;
const version = spawnSync(pulse, ['--version'], { encoding: 'utf8' });
assert.equal(version.status, 0, version.stderr);
assert.match(version.stdout, /0\.4\.0-rc\.1/);
const root = mkdtempSync(join(tmpdir(), 'pulse-smoke-'));
try {
  for (const code of [0, 23]) {
    const path = join(root, `scan-${code}.json`);
    const result = spawnSync(pulse, ['run', '--name', 'smoke', '--output', path, '--', process.execPath, '-e', `process.exit(${code})`], { encoding: 'utf8' });
    assert.equal(result.status, code, result.stderr);
    const scan = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(scan.outcome, code === 0 ? 'SUCCESS' : 'FAILED');
    assert.equal(scan.execution.spans[0].name, 'smoke');
    assert.ok(scan.execution.spans[0].durationMs >= 0);
  }
} finally { rmSync(root, { recursive: true, force: true }); }
console.log(version.stdout.trim(), 'command status and measurement verified');
