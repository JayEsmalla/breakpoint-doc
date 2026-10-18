import { readdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const directory = path.resolve('release');
const archives = (await readdir(directory))
  .filter(name => name.endsWith('.zip') || name.endsWith('.tar.gz'))
  .sort();

if (!archives.length) throw new Error('No release archive to hash');

for (const archive of archives) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path.join(directory, archive))) {
    digest.update(chunk);
  }
  const line = digest.digest('hex') + '  ' + archive;
  await writeFile(path.join(directory, archive + '.sha256'), line + '\n', 'utf8');
  console.log(line);
}
