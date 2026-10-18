import { readdir,readFile,writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const dir=path.resolve('release');
const files=(await readdir(dir)).filter(f=>f.endsWith('.zip')||f.endsWith('.tar.gz')).sort();
if(!files.length)throw new Error('No release archive to hash');
const lines=[];
for(const file of files){lines.push(createHash('sha256').update(await readFile(path.join(dir,file))).digest('hex')+'  '+file);}
await writeFile(path.join(dir,files[0]+'.sha256'),lines.join('\n')+'\n','utf8');
console.log(lines.join('\n'));
