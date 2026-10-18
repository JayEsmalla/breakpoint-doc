import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

const script = path.resolve('scripts/checksums.js');

test('each release archive gets its own checksum even when there are multiple archives', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'bd-checksums-'));
  const release = path.join(root,'release');
  await mkdir(release);
  try {
    const archives = {'portable-win32.zip':'windows bytes','portable-linux.tar.gz':'linux bytes'};
    for (const [name, contents] of Object.entries(archives)) {
      await writeFile(path.join(release, name), contents);
    }
    const run = spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    for (const [name, contents] of Object.entries(archives)) {
      const expected = createHash('sha256').update(contents).digest('hex')+'  '+name+'\n';
      assert.equal(await readFile(path.join(release,name+'.sha256'),'utf8'),expected);
    }
    assert.equal((await readdir(release)).filter(name=>name.endsWith('.sha256')).length,2);
  } finally {
    await rm(root,{recursive:true,force:true});
  }
});

test('checksum generation fails when no archive exists',async () => {
  const root=await mkdtemp(path.join(tmpdir(),'bd-checksums-empty-'));
  try {
    await mkdir(path.join(root,'release'));
    const run=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
    assert.notEqual(run.status,0);
    assert.match(run.stderr,/No release archive to hash/);
  } finally {
    await rm(root,{recursive:true,force:true});
  }
});
